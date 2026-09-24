-- Adds per-user ownership and Row Level Security to patrimony data.
-- Existing MVP data is assigned to the Supabase Auth user below.
-- Change the email before running this migration in another environment.

do $$
declare
  owner_email text := 'jascoba@gmail.com';
  owner_id uuid;
begin
  select id into owner_id
  from auth.users
  where email = owner_email
  limit 1;

  if owner_id is null then
    raise exception 'No Supabase Auth user found for email %', owner_email;
  end if;

  alter table public.categoria
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

  alter table public.monthly_patrimony_records
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

  alter table public.retirement_calculations
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

  update public.categoria
  set user_id = owner_id
  where user_id is null;

  update public.monthly_patrimony_records
  set user_id = owner_id
  where user_id is null;

  update public.retirement_calculations
  set user_id = owner_id
  where user_id is null;
end $$;

alter table public.categoria
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.monthly_patrimony_records
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.retirement_calculations
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

-- Earlier MVP category constraints were global. User-scoped data needs per-user
-- uniqueness so different users can keep the same category names and order.
alter table public.categoria
  drop constraint if exists categoria_code_key,
  drop constraint if exists categoria_name_key,
  drop constraint if exists categoria_display_order_key;

create unique index if not exists categoria_user_code_key
  on public.categoria (user_id, code);

create unique index if not exists categoria_user_name_key
  on public.categoria (user_id, lower(name));

create unique index if not exists categoria_user_display_order_key
  on public.categoria (user_id, display_order);

create index if not exists categoria_user_id_idx
  on public.categoria (user_id);

create index if not exists monthly_patrimony_records_user_id_idx
  on public.monthly_patrimony_records (user_id);

create index if not exists retirement_calculations_user_id_idx
  on public.retirement_calculations (user_id);

alter table public.categoria enable row level security;
alter table public.monthly_patrimony_records enable row level security;
alter table public.retirement_calculations enable row level security;

drop policy if exists "Users can read own categories" on public.categoria;
drop policy if exists "Users can insert own categories" on public.categoria;
drop policy if exists "Users can update own categories" on public.categoria;
drop policy if exists "Users can delete own categories" on public.categoria;

create policy "Users can read own categories"
  on public.categoria
  for select
  using (user_id = auth.uid());

create policy "Users can insert own categories"
  on public.categoria
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own categories"
  on public.categoria
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own categories"
  on public.categoria
  for delete
  using (user_id = auth.uid());

drop policy if exists "Users can read own patrimony records" on public.monthly_patrimony_records;
drop policy if exists "Users can insert own patrimony records" on public.monthly_patrimony_records;
drop policy if exists "Users can update own patrimony records" on public.monthly_patrimony_records;
drop policy if exists "Users can delete own patrimony records" on public.monthly_patrimony_records;

create policy "Users can read own patrimony records"
  on public.monthly_patrimony_records
  for select
  using (user_id = auth.uid());

create policy "Users can insert own patrimony records"
  on public.monthly_patrimony_records
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.categoria category
      where category.id = category_id
        and category.user_id = auth.uid()
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
      from public.categoria category
      where category.id = category_id
        and category.user_id = auth.uid()
    )
  );

create policy "Users can delete own patrimony records"
  on public.monthly_patrimony_records
  for delete
  using (user_id = auth.uid());

drop policy if exists "Users can read own retirement calculations" on public.retirement_calculations;
drop policy if exists "Users can insert own retirement calculations" on public.retirement_calculations;
drop policy if exists "Users can delete own retirement calculations" on public.retirement_calculations;

create policy "Users can read own retirement calculations"
  on public.retirement_calculations
  for select
  using (user_id = auth.uid());

create policy "Users can insert own retirement calculations"
  on public.retirement_calculations
  for insert
  with check (user_id = auth.uid());

create policy "Users can delete own retirement calculations"
  on public.retirement_calculations
  for delete
  using (user_id = auth.uid());

comment on column public.categoria.user_id is
  'Supabase Auth owner for this category.';

comment on column public.monthly_patrimony_records.user_id is
  'Supabase Auth owner for this patrimony record.';

comment on column public.retirement_calculations.user_id is
  'Supabase Auth owner for this saved retirement calculation.';

notify pgrst, 'reload schema';
