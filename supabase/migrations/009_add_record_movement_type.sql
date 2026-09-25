-- Adds a nullable movement type to patrimony records.
-- Existing records intentionally remain null so users can classify them manually.

alter table public.monthly_patrimony_records
  add column if not exists movement_type text;

alter table public.monthly_patrimony_records
  drop constraint if exists monthly_patrimony_records_movement_type_check;

alter table public.monthly_patrimony_records
  add constraint monthly_patrimony_records_movement_type_check
  check (movement_type is null or movement_type in ('contribution', 'interest'));

comment on column public.monthly_patrimony_records.movement_type is
  'Optional for legacy rows; required by the app for new patrimony entries. Values: contribution or interest.';

notify pgrst, 'reload schema';
