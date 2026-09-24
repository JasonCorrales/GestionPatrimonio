# Patrimony Tracker MVP

Small web MVP for monthly patrimony tracking.

## Current scope

- Register, edit, and delete patrimony entries with four fields:
  - date
  - category
  - amount
  - note
- Track the categories the user currently manages:
  - Inversion Bolsa
  - Certificados a Plazo
  - Asociaciones solidaristas
  - Fondo de Emergencia
  - Capital Social
- Keep UI, business rules, and data access decoupled.
- Use Supabase as the planned cloud database provider.
- Authentication is intentionally out of scope for this deliverable and will be added later.

## Architecture

```text
src/
  app/                Next.js App Router entry points
  ui/                 React components and presentation concerns
  domain/             Business concepts and pure domain helpers
  application/        Use cases, validation, and repository ports
  data/               Repository implementations and external data clients
supabase/
  migrations/         Versioned database schema
```

The UI depends on application services. Application services depend on repository interfaces. Supabase stays behind the `data` layer.

For local MVP behavior, `InMemoryPatrimonyRecordRepository` provides demo data without requiring Supabase credentials. `SupabasePatrimonyRecordRepository` defines the cloud persistence boundary.

`createPatrimonyRecordRepository` selects the repository:

- default: in-memory demo repository
- Supabase: only when `NEXT_PUBLIC_DATA_SOURCE=supabase` and the Supabase public variables are present

## No-auth MVP warning

This deliverable intentionally has no authentication. That means a client-side Supabase anon key can only write if the table allows public anon access, usually by leaving RLS disabled for the MVP.

That is acceptable only for a private MVP/testing setup. Before multi-user usage or public deployment, add authentication, enable RLS, and scope records by user without changing UI components or application use-case contracts.

## Environment variables

Create `.env.local` with the following values when enabling Supabase:

```bash
NEXT_PUBLIC_DATA_SOURCE="supabase"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

If `NEXT_PUBLIC_DATA_SOURCE` is missing or set to anything other than `supabase`, the app uses the in-memory demo repository.

No real credentials should be committed.

## Local development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Supabase migrations

Apply migrations in order:

```text
supabase/migrations/001_create_monthly_patrimony_records.sql
supabase/migrations/002_add_categories_and_category_records.sql
supabase/migrations/003_drop_legacy_category_amount_columns.sql
```

You can paste them into the Supabase SQL editor for the MVP, or run them through the Supabase CLI if the project is linked.

The second migration creates the `categoria` table, seeds the MVP categories, and adds row-based `record_date`, `category_id`, and `amount` fields to `monthly_patrimony_records`.

The third migration removes the early MVP category amount columns from `monthly_patrimony_records`.

If the app reports schema cache issues, run:

```sql
notify pgrst, 'reload schema';
```
