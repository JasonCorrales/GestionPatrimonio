# Dashboard Cumulative Patrimony

## Goal
Change the dashboard patrimony metric from month-only totals to cumulative patrimony through the selected month.

## Scope
- Use the dashboard selected date's month as the cutoff month.
- Include records whose `recordDate` month is before or equal to the selected month.
- Keep dashboard distribution, retirement progress, and displayed total aligned with the cumulative record set.
- Update dashboard copy and documentation to describe cumulative behavior.

## Non-goals
- Do not change record storage or historical record screens.
- Do not add day-level cutoff logic; the selected day only determines the month.

## Tasks
- [x] Replace month-only dashboard filtering with cumulative month filtering.
- [x] Update dashboard and README copy.
- [x] Run verification checks and commit.

## Evidence
- Branch: `feature/dashboard-cumulative-patrimony`
- Commits: pending.
- Checks:
  - Independent verifier ran `npm run typecheck`: passed.
  - Independent verifier ran `npm run lint`: passed.
  - Independent verifier ran `npm run build`: passed.
