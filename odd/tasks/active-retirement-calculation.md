# Active Retirement Calculation

## Goal

Let users save retirement scenarios with a required name/description, choose exactly one saved scenario as active, and use that active scenario for retirement progress on the dashboard.

## Acceptance criteria

- Saving a retirement calculation requires a non-empty name or description.
- The database stores the new required name/description field for retirement calculations.
- The retirement saved-calculations list displays each scenario name/description.
- A user can mark one saved retirement calculation as active from the list.
- Only one retirement calculation can be active at a time per authenticated user/data scope.
- Dashboard retirement progress uses the active calculation, not simply the latest saved calculation.
- Dashboard progress copy shows the active calculation name/description.
- Existing visual calculations continue to update from the form inputs.

## Tasks

- [x] Add retirement calculation metadata and active-state support across domain, repository, and Supabase migration.
- [x] Update the retirement UI to require a name/description when saving and to select the active saved calculation.
- [x] Update the dashboard to load and present the active retirement goal name/description.
- [x] Keep JSON backup export/import compatible with retirement description and active-state fields.
- [x] Verify typecheck/lint and record evidence.

## Evidence

- Branch: `feature/active-retirement-calculation`
- Commits: this work-unit commit (`feat: activate saved retirement scenarios`).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Parent follow-up fixed backup export/import for the new required retirement fields and reran `npm run typecheck && npm run lint`: passed.
- User manually tested the feature successfully before commit authorization.
