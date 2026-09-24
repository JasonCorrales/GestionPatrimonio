-- Removes the early MVP category amount columns from monthly_patrimony_records.
-- The application now stores one row per date/category/amount/note using
-- category_id and amount.

alter table public.monthly_patrimony_records
  drop column if exists stock_investments,
  drop column if exists term_certificates,
  drop column if exists solidarist_associations,
  drop column if exists emergency_fund,
  drop column if exists other;

notify pgrst, 'reload schema';
