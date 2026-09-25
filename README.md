# Patrimony Tracker MVP

Small web MVP for monthly patrimony tracking.

## Current scope

- Register, duplicate from history, edit, delete, and bulk import patrimony entries with these fields:
  - date
  - category
  - movement type (`Aporte` or `Interés`)
  - amount CRC
  - optional amount USD
  - note
- Import patrimony records from Excel using columns `Fecha`, `Categoria`, `Tipo de movimiento`, `Monto CRC`, optional `Monto USD`, and optional `Nota`; an empty template is available at `public/templates/patrimony-records-template.xlsx`.
- Filter the records history by exact date, category, or movement type, and paginate it in pages of 10, 25, or 50 records.
- Navigate through a dashboard-style menu with a main dashboard plus separate record and category sections.
- Maintain categories from the UI: list, create, edit, delete, and optional expected annual interest rate.
- Protect the dashboard with Supabase email/password login and logout.
- Calculate retirement compound-interest scenarios live and persist selected saved calculations.
- View a main dashboard with cumulative patrimony distribution, progress toward the latest retirement goal, and a monthly cumulative line chart from the first recorded investment month to the most recent month with `Aporte` and `Interés` shaded areas; the dashboard date filter uses the selected day's month as the cumulative cutoff for the distribution and retirement cards.
- Switch between light and dark visual themes from the topbar.
- Switch the global display currency between CRC and USD from the topbar with a locally persisted manual CRC-to-USD exchange rate; no exchange-rate API is used.
- Track the categories the user currently manages:
  - Inversion Bolsa
  - Certificados a Plazo
  - Asociaciones solidaristas
  - Fondo de Emergencia
  - Capital Social
- Keep UI, business rules, and data access decoupled.
- Use Supabase as the planned cloud database provider.
- Authentication is included with Supabase email/password; patrimony data is scoped per authenticated user with RLS.

## Architecture

```text
src/
  app/                Next.js App Router entry points
  ui/                 React components, dashboard shell, and presentation concerns
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

## Authentication and RLS

The dashboard is protected with Supabase email/password authentication. Patrimony records, categories, and saved retirement calculations include `user_id` ownership and Row Level Security policies so authenticated users can access only their own rows.

Migration `006_add_user_scoping_and_rls.sql` assigns existing MVP data to `jascoba@gmail.com`. Change that email before running the migration in another environment.

## Supabase Auth setup

Enable the Email provider in Supabase Auth and create at least one user for testing. The app uses `/login` for sign-in and the dashboard topbar for sign-out.

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
supabase/migrations/004_create_retirement_calculations.sql
supabase/migrations/005_add_estimated_monthly_amount_to_retirement_calculations.sql
supabase/migrations/006_add_user_scoping_and_rls.sql
supabase/migrations/007_add_category_interest_rate.sql
supabase/migrations/008_rename_category_and_add_usd_amount.sql
```

You can paste them into the Supabase SQL editor for the MVP, or run them through the Supabase CLI if the project is linked.

The second migration creates the initial category table, seeds the MVP categories, and adds row-based `record_date`, `category_id`, and amount fields to `monthly_patrimony_records`.

The third migration removes the early MVP category amount columns from `monthly_patrimony_records`.

The fourth migration creates `retirement_calculations`, which stores only the compound-interest scenarios the user explicitly saves from the retirement calculator.

The fifth migration adds `estimated_monthly_amount`, calculated as projected goal divided by years divided by 12.

The sixth migration adds `user_id`, assigns existing data to the configured Supabase Auth user, enables RLS, and adds per-user policies for categories, patrimony records, and retirement calculations.

The seventh migration adds optional `interest_rate` to categories.

The eighth migration renames `categoria` to `category`, renames `amount` to `amount_crc`, adds optional `amount_usd`, and refreshes RLS policies that reference the category table.

If the app reports schema cache issues, run:

```sql
notify pgrst, 'reload schema';
```
