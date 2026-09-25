# Dashboard cumulative line chart

## Goal
Add a dashboard card showing the accumulated patrimony month by month from the first investment month to the most recent month.

## Scope
- Build a monthly cumulative time series from patrimony records.
- Use the earliest record month as the investment start month and the latest record month as the most recent month.
- Include months without records by carrying forward the previous accumulated amount.
- Render a line chart below the existing dashboard cards.
- Keep global currency preference behavior.
- Update documentation and verification evidence.

## Non-goals
- Adding a charting dependency.
- Forecasting future balances.
- Server-side aggregation.
- Persisting dashboard chart settings.

## Tasks
- [x] Implement monthly cumulative series and line chart UI.
- [x] Update README behavior notes.
- [x] Run verification checks.

## Evidence
- Implemented monthly cumulative trend generation and SVG line chart in `src/ui/components/DashboardHome.tsx`.
- Added chart layout, SVG, and summary styles in `src/app/globals.css`.
- Documented the dashboard chart in `README.md`.
- `npm run typecheck` passed.
- `npm run lint` passed.
