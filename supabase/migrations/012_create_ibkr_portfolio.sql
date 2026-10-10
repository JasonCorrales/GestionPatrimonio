-- Owner-scoped Interactive Brokers Flex portfolio snapshots.
-- Tokens and raw XML are intentionally not stored.

create table if not exists public.ibkr_portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  report_date date not null,
  generated_at timestamptz,
  nav_amount numeric(28, 10),
  nav_currency text,
  cash_amount numeric(28, 10),
  cash_currency text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ibkr_snapshot_nav_complete check ((nav_amount is null) = (nav_currency is null)),
  constraint ibkr_snapshot_cash_complete check ((cash_amount is null) = (cash_currency is null)),
  constraint ibkr_snapshot_account_not_blank check (btrim(account_id) <> ''),
  unique (user_id, account_id, report_date)
);

create table if not exists public.ibkr_portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.ibkr_portfolio_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text not null,
  conid text not null,
  symbol text,
  currency text not null,
  quantity numeric(28, 10),
  multiplier numeric(28, 10),
  mark_price numeric(28, 10),
  position_value numeric(28, 10),
  cost_basis_money numeric(28, 10),
  cost_basis_price numeric(28, 10),
  fifo_pnl_unrealized numeric(28, 10),
  created_at timestamptz not null default now(),
  constraint ibkr_position_account_not_blank check (btrim(account_id) <> ''),
  constraint ibkr_position_conid_not_blank check (btrim(conid) <> ''),
  constraint ibkr_position_currency_not_blank check (btrim(currency) <> ''),
  unique (snapshot_id, account_id, conid, currency)
);

create table if not exists public.ibkr_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('requested', 'pending', 'persisted', 'failed', 'expired')),
  reference_code text,
  last_external_code text,
  sanitized_message text,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 12),
  next_attempt_after timestamptz,
  cooldown_until timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ibkr_sync_jobs_reference_not_blank check (reference_code is null or btrim(reference_code) <> '')
);

create index if not exists ibkr_portfolio_snapshots_user_account_report_idx
  on public.ibkr_portfolio_snapshots (user_id, account_id, report_date desc);

create index if not exists ibkr_portfolio_positions_snapshot_idx
  on public.ibkr_portfolio_positions (snapshot_id);

create index if not exists ibkr_sync_jobs_user_created_idx
  on public.ibkr_sync_jobs (user_id, created_at desc);

create unique index if not exists ibkr_sync_jobs_one_outstanding
  on public.ibkr_sync_jobs (user_id)
  where state in ('requested', 'pending');

create or replace function public.enforce_ibkr_sync_job_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.user_id <> new.user_id or old.id <> new.id then
    raise exception 'IBKR sync job identity is immutable';
  end if;

  if old.state in ('persisted', 'failed', 'expired') then
    raise exception 'IBKR terminal sync jobs are immutable';
  end if;

  if new.attempts < old.attempts then
    raise exception 'IBKR sync job attempts cannot decrease';
  end if;

  if new.cooldown_until < old.cooldown_until then
    raise exception 'IBKR sync job cooldown cannot decrease';
  end if;

  if not (
    (old.state = 'requested' and new.state in ('requested', 'pending', 'failed', 'expired'))
    or (old.state = 'pending' and new.state in ('pending', 'persisted', 'failed', 'expired'))
  ) then
    raise exception 'Illegal IBKR sync job state transition';
  end if;

  return new;
end;
$$;

drop trigger if exists ibkr_sync_job_immutability_trigger on public.ibkr_sync_jobs;
create trigger ibkr_sync_job_immutability_trigger
  before update on public.ibkr_sync_jobs
  for each row execute function public.enforce_ibkr_sync_job_immutability();

create or replace function public.create_ibkr_sync_job(
  p_user_id uuid,
  p_cooldown interval default interval '15 minutes'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_latest_cooldown timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  perform pg_advisory_xact_lock(hashtext('ibkr_sync_job:' || p_user_id::text));

  update public.ibkr_sync_jobs
  set state = 'expired',
      sanitized_message = coalesce(sanitized_message, 'IBKR sync expired before completion'),
      updated_at = now()
  where user_id = p_user_id
    and state in ('requested', 'pending')
    and created_at < now() - interval '30 minutes';

  select max(cooldown_until)
    into v_latest_cooldown
  from public.ibkr_sync_jobs
  where user_id = p_user_id
    and cooldown_until > now();

  if v_latest_cooldown is not null and v_latest_cooldown > now() then
    raise exception 'IBKR sync cooldown is still active';
  end if;

  if exists (
    select 1
    from public.ibkr_sync_jobs
    where user_id = p_user_id
      and state in ('requested', 'pending')
  ) then
    raise exception 'IBKR sync already in progress';
  end if;

  insert into public.ibkr_sync_jobs (user_id, state, cooldown_until, next_attempt_after)
  values (p_user_id, 'requested', now() + p_cooldown, now())
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.claim_ibkr_sync_poll(
  p_user_id uuid,
  p_job_id uuid,
  p_next_attempt_after timestamptz default now() + interval '2 minutes'
)
returns table (job_id uuid, reference_code text, attempts integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  return query
  with claim as (
    select id
    from public.ibkr_sync_jobs
    where user_id = p_user_id
      and id = p_job_id
      and state in ('requested', 'pending')
      and public.ibkr_sync_jobs.attempts < 12
      and created_at >= now() - interval '30 minutes'
      and (next_attempt_after is null or next_attempt_after <= now())
    for update skip locked
    limit 1
  )
  update public.ibkr_sync_jobs job
  set state = 'pending',
      attempts = job.attempts + 1,
      next_attempt_after = p_next_attempt_after,
      updated_at = now()
  from claim
  where job.id = claim.id
  returning job.id, job.reference_code, job.attempts;
end;
$$;

create or replace function public.transition_ibkr_sync_job(
  p_user_id uuid,
  p_job_id uuid,
  p_state text,
  p_reference_code text default null,
  p_last_external_code text default null,
  p_sanitized_message text default null,
  p_next_attempt_after timestamptz default null,
  p_cooldown_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  update public.ibkr_sync_jobs
  set state = p_state,
      reference_code = coalesce(p_reference_code, reference_code),
      last_external_code = p_last_external_code,
      sanitized_message = p_sanitized_message,
      next_attempt_after = p_next_attempt_after,
      cooldown_until = greatest(cooldown_until, coalesce(p_cooldown_until, cooldown_until)),
      updated_at = now()
  where id = p_job_id
    and user_id = p_user_id
    and state in ('requested', 'pending');

  if not found then
    raise exception 'IBKR sync job is not transitionable';
  end if;
end;
$$;

create or replace function public.enforce_ibkr_position_snapshot_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot_user_id uuid;
  snapshot_account_id text;
begin
  select s.user_id, s.account_id
    into snapshot_user_id, snapshot_account_id
  from public.ibkr_portfolio_snapshots s
  where s.id = new.snapshot_id;

  if snapshot_user_id is null then
    raise exception 'IBKR snapshot not found';
  end if;

  if new.user_id <> snapshot_user_id or new.account_id <> snapshot_account_id then
    raise exception 'IBKR position owner/account mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists ibkr_position_snapshot_owner_trigger on public.ibkr_portfolio_positions;
create trigger ibkr_position_snapshot_owner_trigger
  before insert or update on public.ibkr_portfolio_positions
  for each row execute function public.enforce_ibkr_position_snapshot_owner();

create or replace function public.replace_ibkr_portfolio_snapshot(
  p_user_id uuid,
  p_account_id text,
  p_report_date date,
  p_generated_at timestamptz,
  p_nav_amount numeric,
  p_nav_currency text,
  p_cash_amount numeric,
  p_cash_currency text,
  p_positions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot_id uuid;
  latest_report_date date;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required';
  end if;

  select max(report_date)
    into latest_report_date
  from public.ibkr_portfolio_snapshots
  where user_id = p_user_id
    and account_id = p_account_id;

  if latest_report_date is not null and p_report_date < latest_report_date then
    raise exception 'stale IBKR report date cannot supersede newer snapshot';
  end if;

  insert into public.ibkr_portfolio_snapshots (
    user_id, account_id, report_date, generated_at,
    nav_amount, nav_currency, cash_amount, cash_currency, synced_at, updated_at
  ) values (
    p_user_id, p_account_id, p_report_date, p_generated_at,
    p_nav_amount, p_nav_currency, p_cash_amount, p_cash_currency, now(), now()
  )
  on conflict (user_id, account_id, report_date) do update set
    generated_at = excluded.generated_at,
    nav_amount = excluded.nav_amount,
    nav_currency = excluded.nav_currency,
    cash_amount = excluded.cash_amount,
    cash_currency = excluded.cash_currency,
    synced_at = excluded.synced_at,
    updated_at = excluded.updated_at
  returning id into v_snapshot_id;

  delete from public.ibkr_portfolio_positions
  where snapshot_id = v_snapshot_id;

  insert into public.ibkr_portfolio_positions (
    snapshot_id, user_id, account_id, conid, symbol, currency,
    quantity, multiplier, mark_price, position_value,
    cost_basis_money, cost_basis_price, fifo_pnl_unrealized
  )
  select
    v_snapshot_id,
    p_user_id,
    p_account_id,
    item->>'conid',
    item->>'symbol',
    item->>'currency',
    nullif(item->>'quantity', '')::numeric,
    nullif(item->>'multiplier', '')::numeric,
    nullif(item->>'markPrice', '')::numeric,
    nullif(item->>'positionValue', '')::numeric,
    nullif(item->>'costBasisMoney', '')::numeric,
    nullif(item->>'costBasisPrice', '')::numeric,
    nullif(item->>'fifoPnlUnrealized', '')::numeric
  from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) as item;

  return v_snapshot_id;
end;
$$;

alter table public.ibkr_portfolio_snapshots enable row level security;
alter table public.ibkr_portfolio_positions enable row level security;
alter table public.ibkr_sync_jobs enable row level security;

drop policy if exists "Users can read own IBKR snapshots" on public.ibkr_portfolio_snapshots;
drop policy if exists "Users can read own IBKR positions" on public.ibkr_portfolio_positions;
drop policy if exists "Users can read own IBKR sync jobs" on public.ibkr_sync_jobs;

create policy "Users can read own IBKR snapshots"
  on public.ibkr_portfolio_snapshots
  for select
  using (user_id = auth.uid());

create policy "Users can read own IBKR positions"
  on public.ibkr_portfolio_positions
  for select
  using (user_id = auth.uid());

create policy "Users can read own IBKR sync jobs"
  on public.ibkr_sync_jobs
  for select
  using (user_id = auth.uid());

revoke all on public.ibkr_portfolio_snapshots from anon, authenticated;
revoke all on public.ibkr_portfolio_positions from anon, authenticated;
revoke all on public.ibkr_sync_jobs from anon, authenticated;
grant select on public.ibkr_portfolio_snapshots to authenticated;
grant select on public.ibkr_portfolio_positions to authenticated;
grant select on public.ibkr_sync_jobs to authenticated;

revoke all on function public.replace_ibkr_portfolio_snapshot(uuid, text, date, timestamptz, numeric, text, numeric, text, jsonb) from anon, authenticated;
revoke all on function public.create_ibkr_sync_job(uuid, interval) from anon, authenticated;
revoke all on function public.claim_ibkr_sync_poll(uuid, uuid, timestamptz) from anon, authenticated;
revoke all on function public.transition_ibkr_sync_job(uuid, uuid, text, text, text, text, timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.replace_ibkr_portfolio_snapshot(uuid, text, date, timestamptz, numeric, text, numeric, text, jsonb) to service_role;
grant execute on function public.create_ibkr_sync_job(uuid, interval) to service_role;
grant execute on function public.claim_ibkr_sync_poll(uuid, uuid, timestamptz) to service_role;
grant execute on function public.transition_ibkr_sync_job(uuid, uuid, text, text, text, text, timestamptz, timestamptz) to service_role;

comment on table public.ibkr_portfolio_snapshots is
  'Owner-scoped IBKR Flex report snapshot metadata; NAV already includes cash and must not be added twice.';
comment on table public.ibkr_portfolio_positions is
  'Summary-level IBKR open positions keyed by account, conid and native currency.';
comment on table public.ibkr_sync_jobs is
  'Bounded asynchronous IBKR Flex sync job state; stores references and sanitized status only, never credentials.';
comment on column public.ibkr_sync_jobs.cooldown_until is
  'Cooldown gate for IBKR Flex rate limits; create_ibkr_sync_job refuses new jobs until the latest per-owner cooldown has passed, including terminal jobs.';
comment on function public.create_ibkr_sync_job(uuid, interval) is
  'T2 usage: call with owner user id and optional cooldown interval; returns job id after expiring abandoned active jobs older than 30 minutes and enforcing latest cooldown.';
comment on function public.claim_ibkr_sync_poll(uuid, uuid, timestamptz) is
  'T2 usage: call before each GetStatement attempt with owner user id, job id and next attempt timestamp; atomically increments attempts and returns at most one claim row.';
comment on function public.transition_ibkr_sync_job(uuid, uuid, text, text, text, text, timestamptz, timestamptz) is
  'T2 usage: service-role-only legal state transition for requested/pending jobs; stores reference code, sanitized external code/message, next attempt and non-decreasing cooldown only.';

notify pgrst, 'reload schema';
