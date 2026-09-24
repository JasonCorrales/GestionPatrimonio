-- Patrimony Tracker MVP schema.
--
-- Authentication is intentionally deferred for this deliverable. This migration keeps
-- Row Level Security disabled so the anon key can be used by the MVP client when
-- NEXT_PUBLIC_DATA_SOURCE=supabase. This is not a production-safe multi-user setup.
-- Before public deployment or authentication work, enable RLS and scope rows by user.

create table if not exists public.monthly_patrimony_records (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month)
);

create index if not exists monthly_patrimony_records_month_idx
  on public.monthly_patrimony_records (month desc);

comment on table public.monthly_patrimony_records is
  'MVP patrimony records. RLS/auth must be added before multi-user or public deployment.';

-- Ask Supabase PostgREST to refresh its schema cache after creating the table.
notify pgrst, 'reload schema';
