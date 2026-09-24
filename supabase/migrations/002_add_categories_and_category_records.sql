-- Adds normalized patrimony categories and converts records to one row per
-- date/category/amount/note.

create table if not exists public.categoria (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  display_order integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.categoria (code, name, display_order)
values
  ('stock_investment', 'Inversion Bolsa', 1),
  ('term_certificate', 'Certificados a Plazo', 2),
  ('solidarist_association', 'Asociaciones solidaristas', 3),
  ('emergency_fund', 'Fondo de Emergencia', 4),
  ('capital_social', 'Capital Social', 5)
on conflict (code) do update
set
  name = excluded.name,
  display_order = excluded.display_order,
  updated_at = now();

alter table public.monthly_patrimony_records
  add column if not exists record_date date,
  add column if not exists category_id uuid references public.categoria(id),
  add column if not exists amount numeric(14, 2) check (amount >= 0);

-- The normalized model allows multiple category entries for the same month/date.
alter table public.monthly_patrimony_records
  drop constraint if exists monthly_patrimony_records_month_key;

create index if not exists monthly_patrimony_records_record_date_idx
  on public.monthly_patrimony_records (record_date desc);

create index if not exists monthly_patrimony_records_category_id_idx
  on public.monthly_patrimony_records (category_id);

comment on table public.categoria is
  'Patrimony categories available in the MVP category select.';

comment on column public.monthly_patrimony_records.record_date is
  'Selected date from the UI date field. The legacy month column stores YYYY-MM derived from this date.';

comment on column public.monthly_patrimony_records.category_id is
  'Selected category for this patrimony entry.';

comment on column public.monthly_patrimony_records.amount is
  'Amount for the selected date and category.';

notify pgrst, 'reload schema';
