# Record movement type

## Goal
Add a required movement type to patrimony records so each new manual or imported record can be classified as either an owner contribution or generated interest.

## Scope
- Add movement type values: `contribution` and `interest`, displayed as `Aporte` and `Interés`.
- Manual Records form must require the movement type for create/update.
- Excel import must require a movement type column for imported rows.
- Existing Supabase rows may keep the column empty until the user fills them later.
- History should display the movement type when present and show a clear pending/empty label when missing.
- Add a Supabase migration for the new nullable column with a value constraint.
- Update the Excel template and README.

## Non-goals
- Auto-classifying existing records.
- Changing dashboard totals based on movement type.
- Backfilling existing Supabase data.

## Tasks
- [x] Add movement type to domain, validation, repositories, and migration.
- [x] Add manual form and history UI support.
- [x] Add Excel import/template support.
- [x] Update README behavior notes.
- [x] Run verification checks.

## Evidence
- Added nullable `movement_type` Supabase migration in `supabase/migrations/009_add_record_movement_type.sql`.
- Extended domain/input/service validation and in-memory/Supabase repositories for `contribution` and `interest`.
- Added required manual `Tipo de movimiento` selector and history display in `src/ui/components/PatrimonyRecords.tsx`.
- Added required Excel `Tipo de movimiento` column parsing and updated the `.xlsx` template.
- Documented the field in `README.md`.
- `npm run typecheck` passed.
- `npm run lint` passed.
