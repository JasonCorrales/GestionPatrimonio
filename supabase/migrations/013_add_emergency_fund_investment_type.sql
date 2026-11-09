-- Expands the selected investment types without changing existing records.
alter table public.monthly_patrimony_records
  drop constraint if exists monthly_patrimony_records_investment_type_check;

alter table public.monthly_patrimony_records
  add constraint monthly_patrimony_records_investment_type_check
  check (investment_type in ('fixed_income', 'variable_income', 'emergency_fund'));

comment on column public.monthly_patrimony_records.investment_type is
  'Required investment classification for dashboard split. Values: fixed_income, variable_income, or emergency_fund.';

notify pgrst, 'reload schema';
