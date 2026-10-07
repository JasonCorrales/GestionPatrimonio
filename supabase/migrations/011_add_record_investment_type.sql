-- Adds a required investment type classification to patrimony records.
-- Existing rows default to fixed income so legacy data remains valid.

alter table public.monthly_patrimony_records
  add column if not exists investment_type text;

update public.monthly_patrimony_records
set investment_type = 'fixed_income'
where investment_type is null;

alter table public.monthly_patrimony_records
  alter column investment_type set default 'fixed_income';

alter table public.monthly_patrimony_records
  alter column investment_type set not null;

alter table public.monthly_patrimony_records
  drop constraint if exists monthly_patrimony_records_investment_type_check;

alter table public.monthly_patrimony_records
  add constraint monthly_patrimony_records_investment_type_check
  check (investment_type in ('fixed_income', 'variable_income'));

comment on column public.monthly_patrimony_records.investment_type is
  'Required investment classification for dashboard split. Values: fixed_income or variable_income.';

notify pgrst, 'reload schema';
