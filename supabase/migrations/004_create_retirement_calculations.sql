-- Saved retirement compound-interest scenarios.
-- Calculations are performed live in the browser and persisted only when the user
-- chooses "Guardar Cálculo de Jubilación".
-- Data remains shared in this MVP. Add user_id + RLS before multi-user production use.

create table if not exists public.retirement_calculations (
  id uuid primary key default gen_random_uuid(),
  initial_balance numeric(14, 2) not null check (initial_balance >= 0),
  periodic_amount numeric(14, 2) not null check (periodic_amount >= 0),
  annual_interest_rate numeric(7, 4) not null check (annual_interest_rate >= 0),
  duration_years numeric(6, 2) not null check (duration_years > 0),
  final_amount numeric(14, 2) not null check (final_amount >= 0),
  total_contributed numeric(14, 2) not null check (total_contributed >= 0),
  estimated_interest numeric(14, 2) not null,
  estimated_monthly_amount numeric(14, 2) not null check (estimated_monthly_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists retirement_calculations_created_at_idx
  on public.retirement_calculations (created_at desc);

comment on table public.retirement_calculations is
  'Saved retirement compound-interest scenarios. Shared MVP table; add user_id and RLS before multi-user production use.';

notify pgrst, 'reload schema';
