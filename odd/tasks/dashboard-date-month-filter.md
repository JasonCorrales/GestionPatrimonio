# Dashboard Date Month Filter

## Goal
Allow the dashboard month filter to use a date picker: the user selects any day, and the dashboard calculates using that day's month.

## Scope
- Replace the dashboard `Mes a consultar` month input with a date input.
- Store the selected date while deriving the `YYYY-MM` month used for calculations.
- Keep dashboard labels and month formatting based on the derived month.
- Preserve existing dashboard totals, distribution, and retirement progress behavior.

## Non-goals
- Do not change records filtering outside the dashboard.
- Do not change persistence or database schema.

## Tasks
- [x] Replace dashboard month input with a date input.
- [x] Derive the calculation month from the selected date.
- [x] Update documentation and verify checks.

## Evidence
- Branch: `feature/dashboard-date-month-filter`
- Commits: pending.
- Checks:
  - Independent verifier ran `npm run typecheck`: passed.
  - Independent verifier ran `npm run lint`: passed.
  - Independent verifier ran `npm run build`: passed.
