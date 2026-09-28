-- Adds a required scenario description and active-state selection to saved
-- retirement calculations. A partial unique index and trigger keep at most one
-- active calculation per user, while the trigger promotes the latest remaining
-- calculation if the active one is deleted.

alter table public.retirement_calculations
  add column if not exists description text,
  add column if not exists is_active boolean not null default false;

update public.retirement_calculations
set description = 'Escenario guardado ' || to_char(created_at, 'YYYY-MM-DD HH24:MI')
where description is null or btrim(description) = '';

alter table public.retirement_calculations
  alter column description set not null;

alter table public.retirement_calculations
  drop constraint if exists retirement_calculations_description_not_blank,
  add constraint retirement_calculations_description_not_blank
    check (btrim(description) <> '');

with ranked_calculations as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id desc) as active_rank
  from public.retirement_calculations
)
update public.retirement_calculations calculation
set is_active = ranked_calculations.active_rank = 1
from ranked_calculations
where calculation.id = ranked_calculations.id;

create unique index if not exists retirement_calculations_one_active_per_user_idx
  on public.retirement_calculations (user_id)
  where is_active;

create index if not exists retirement_calculations_user_active_idx
  on public.retirement_calculations (user_id, is_active);

drop policy if exists "Users can update own retirement calculations" on public.retirement_calculations;

create policy "Users can update own retirement calculations"
  on public.retirement_calculations
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.ensure_single_active_retirement_calculation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_active then
      update public.retirement_calculations
      set is_active = false
      where user_id = new.user_id
        and is_active = true;
    elsif not exists (
      select 1
      from public.retirement_calculations
      where user_id = new.user_id
        and is_active = true
    ) then
      new.is_active := true;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' and new.is_active then
    update public.retirement_calculations
    set is_active = false
    where user_id = new.user_id
      and id <> new.id
      and is_active = true;
  end if;

  return new;
end;
$$;

create or replace function public.promote_retirement_calculation_after_active_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_active then
    update public.retirement_calculations
    set is_active = true
    where id = (
      select id
      from public.retirement_calculations
      where user_id = old.user_id
      order by created_at desc, id desc
      limit 1
    );
  end if;

  return old;
end;
$$;

drop trigger if exists ensure_single_active_retirement_calculation_trigger
  on public.retirement_calculations;

create trigger ensure_single_active_retirement_calculation_trigger
  before insert or update of is_active on public.retirement_calculations
  for each row
  execute function public.ensure_single_active_retirement_calculation();

drop trigger if exists promote_retirement_calculation_after_active_delete_trigger
  on public.retirement_calculations;

create trigger promote_retirement_calculation_after_active_delete_trigger
  after delete on public.retirement_calculations
  for each row
  execute function public.promote_retirement_calculation_after_active_delete();

comment on column public.retirement_calculations.description is
  'Required user-facing name or description for the saved retirement scenario.';

comment on column public.retirement_calculations.is_active is
  'Marks the retirement calculation used by the dashboard. At most one active row exists per user.';

notify pgrst, 'reload schema';
