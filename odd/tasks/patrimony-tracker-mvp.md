# Patrimony Tracker MVP

## Goal
Build a small web MVP to register monthly patrimony by category, using a layered architecture where UI, business logic, and data access are decoupled.

## Architecture decision
- Stack: Next.js + TypeScript.
- Initial persistence: cloud database.
- Cloud provider: Supabase Postgres.
- Authentication: intentionally out of scope for this deliverable; it will be added later.

## Scope
- Patrimony entries by date, category, amount, and note.
- Categories are stored in the `categoria` table: Inversion Bolsa, Certificados a Plazo, Asociaciones solidaristas, Fondo de Emergencia, Capital Social.
- Layered structure:
  - UI layer: pages/components only.
  - Application/business layer: use cases, validation, calculations.
  - Domain layer: entities/value objects/types.
  - Data access layer: repository interfaces and cloud implementation.

## Tasks
- [x] Confirm cloud database provider and authentication requirements. Decision: Supabase, no authentication for this deliverable.
- [x] Initialize Next.js + TypeScript project structure.
- [x] Define domain model for monthly patrimony records and categories.
- [x] Create repository interfaces and cloud data-access implementation boundary.
- [x] Implement business use cases for creating/listing/updating monthly records.
- [x] Build MVP UI for monthly entry and historical listing.
- [x] Add basic validation and formatting.
- [x] Run verification checks.
- [x] Initialize local Git repository on `main`.
- [x] Add versioned Supabase migration for `monthly_patrimony_records`.
- [x] Add repository factory for explicit Supabase opt-in via public environment flag.
- [x] Refactor form to four fields: date, category, amount, note.
- [x] Add `categoria` Supabase table migration and category select support.
- [x] Remove legacy category amount columns from schema and documentation.
- [x] Add edit and delete actions for records in the history list.
- [x] Add category maintenance actions: list, create, edit, delete.
- [x] Add dashboard menu and split records/categories screens.
- [x] Refresh visual design with dashboard shell, cards, metrics, and responsive layout.
- [ ] Create `.env.example` if the harness safety policy allows that sensitive-looking path; README currently documents the same variables.

## Evidence
- Commits: pending; Git repository initialized on `main`, but no commit was created because commit authorization was not explicit.
- Checks:
  - `npm install` completed; after upgrading to Next.js 16.3.6, `npm audit --omit=dev` reports 0 vulnerabilities.
  - npm still reports one install-script approval warning for `unrs-resolver`.
  - `npm run typecheck` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
  - Follow-up verification after Supabase migration/repository factory: `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit --omit=dev` passed.
