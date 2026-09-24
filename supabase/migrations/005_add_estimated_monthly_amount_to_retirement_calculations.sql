-- Adds the estimated monthly retirement amount derived from the projected goal.
-- Formula: final_amount / duration_years / 12.

alter table public.retirement_calculations
  add column if not exists estimated_monthly_amount numeric(14, 2);

update public.retirement_calculations
set estimated_monthly_amount = round(final_amount / duration_years / 12, 2)
where estimated_monthly_amount is null;

alter table public.retirement_calculations
  alter column estimated_monthly_amount set not null,
  add constraint retirement_calculations_estimated_monthly_amount_check
    check (estimated_monthly_amount >= 0);

comment on column public.retirement_calculations.estimated_monthly_amount is
  'Estimated monthly amount calculated as final_amount / duration_years / 12.';

notify pgrst, 'reload schema';
