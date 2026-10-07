# Investment type dashboard

## Goal
Add an investment-type classification to patrimony records and show a dashboard donut chart with the split between fixed income and variable income.

## Scope
- Add a record-level investment type with two values: fixed income and variable income.
- Default existing records to fixed income through a Supabase migration.
- Expose the investment type in the record form and history screen.
- Persist and load the value through in-memory and Supabase repositories.
- Add a Dashboard card showing percentages and amounts for fixed vs variable income using records accumulated up to the selected dashboard month.

## Tasks

- [x] Add domain, validation, and persistence support for record investment type.
  - Evidence: `MonthlyPatrimonyRecord` and `PatrimonyRecordInput` include `investmentType`; validation accepts only `fixed_income` or `variable_income`; in-memory and Supabase repositories map and persist the field with fixed-income fallback.
- [x] Add record UI controls and history display for fixed/variable income.
  - Evidence: record create/edit form has required `Tipo de inversión` select; edit and duplicate hydrate it from the selected record; history rows show `Renta Fija` / `Renta Variable` alongside category, movement, and note.
- [x] Add Dashboard investment-type donut chart.
  - Evidence: Dashboard now computes cumulative records up to the selected month and renders a fixed-vs-variable donut using `displayRecordAmount` and `formatCurrency`, including amount and percentage legend entries.
- [x] Adjust Dashboard layout for retirement progress and charts.
  - Evidence: the `Jubilación` card now renders above the two donut charts, spans the full dashboard grid width, removes the redundant progress summary, and reflows the progress bar beside the active-goal panel on wider screens.
- [x] Standardize visible amount and percentage separators.
  - Evidence: shared CRC/USD currency formatters now force dot thousands and comma decimals while preserving `₡`/`$` prefixes; Dashboard and Retirement percentage formatters use the same separator convention.
- [x] Make cumulative evolution respect the selected date.
  - Evidence: the `Evolución acumulada` chart now uses the same records accumulated up to `Fecha a consultar` as the dashboard totals and donut charts.
- [x] Add/update database migration and import/template behavior where applicable.
  - Evidence: `supabase/migrations/011_add_record_investment_type.sql` adds `investment_type`, backfills existing rows to `fixed_income`, applies default, NOT NULL, and allowed-value check; bulk import accepts optional investment type headers and defaults missing values to Renta Fija.
  - Follow-up: generated binary Excel template was not edited; update `/templates/patrimony-records-template.xlsx` manually if the distributed template should include the optional `Tipo de inversión` column.
- [x] Run focused verification checks.
  - Evidence: independent `gentle-ai-verify` ran `npm run lint`, `npm run typecheck`, and `npm run build`; all passed.

## Verification plan
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Manual check: create/edit/duplicate records preserve investment type, history shows it, Dashboard split updates by selected month.

## Commit evidence
- `2adcfc6` — `feat: add investment type dashboard`
