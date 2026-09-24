-- Adds an optional expected annual interest rate to patrimony categories.

alter table public.categoria
  add column if not exists interest_rate numeric(7, 4) check (interest_rate is null or interest_rate >= 0);

comment on column public.categoria.interest_rate is
  'Optional expected annual interest rate percentage for this patrimony category.';

notify pgrst, 'reload schema';
