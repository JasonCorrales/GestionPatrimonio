-- Standardizes table/amount names in English and adds optional USD amount.
-- `categoria` becomes `category`.
-- `monthly_patrimony_records.amount` becomes `amount_crc` and optional `amount_usd` is added.

alter table if exists public.categoria
  rename to category;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'categoria_pkey'
      and conrelid = 'public.category'::regclass
  ) then
    alter table public.category rename constraint categoria_pkey to category_pkey;
  end if;
end $$;

alter index if exists categoria_user_code_key rename to category_user_code_key;
alter index if exists categoria_user_name_key rename to category_user_name_key;
alter index if exists categoria_user_display_order_key rename to category_user_display_order_key;
alter index if exists categoria_user_id_idx rename to category_user_id_idx;

alter table public.monthly_patrimony_records
  rename column amount to amount_crc;

alter table public.monthly_patrimony_records
  add column if not exists amount_usd numeric(14, 2) check (amount_usd is null or amount_usd >= 0);

comment on table public.category is
  'Patrimony categories available in the MVP category select.';

comment on column public.monthly_patrimony_records.amount_crc is
  'Amount in Costa Rican colones for this patrimony entry.';

comment on column public.monthly_patrimony_records.amount_usd is
  'Optional amount in US dollars for this patrimony entry.';

-- Recreate RLS policies that reference the renamed category table.
drop policy if exists "Users can read own categories" on public.category;
drop policy if exists "Users can insert own categories" on public.category;
drop policy if exists "Users can update own categories" on public.category;
drop policy if exists "Users can delete own categories" on public.category;

create policy "Users can read own categories"
  on public.category
  for select
  using (user_id = auth.uid());

create policy "Users can insert own categories"
  on public.category
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own categories"
  on public.category
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own categories"
  on public.category
  for delete
  using (user_id = auth.uid());

drop policy if exists "Users can insert own patrimony records" on public.monthly_patrimony_records;
drop policy if exists "Users can update own patrimony records" on public.monthly_patrimony_records;

create policy "Users can insert own patrimony records"
  on public.monthly_patrimony_records
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.category category_row
      where category_row.id = category_id
        and category_row.user_id = auth.uid()
    )
  );

create policy "Users can update own patrimony records"
  on public.monthly_patrimony_records
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.category category_row
      where category_row.id = category_id
        and category_row.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
