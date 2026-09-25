# Dashboard movement type trend lines

## Goal
Enhance the Dashboard `Evolución acumulada` chart to keep the total cumulative line and shade the cumulative contribution and interest portions.

## Scope
- Keep the existing accumulated monthly total line.
- Add cumulative `Aporte` shading based on records with `movementType === "contribution"`.
- Add cumulative `Interés` shading based on records with `movementType === "interest"`.
- Keep records with missing legacy movement type included in the total line only.
- Preserve the month range from first record month to latest record month and carry values forward for months without records.
- Update the chart legend/summary and documentation.

## Non-goals
- Changing dashboard totals or distribution logic.
- Backfilling legacy movement types.
- Adding a charting dependency.

## Tasks
- [x] Build cumulative contribution and interest series.
- [x] Render total line with contribution/interest shading, legend, and accessible labels.
- [x] Update README behavior notes.
- [x] Run verification checks.

## Evidence
- Updated `src/ui/components/DashboardHome.tsx` to build cumulative total, `Aporte`, and `Interés` series.
- Legacy records with empty movement type remain included in the total line only.
- Updated the SVG chart with one total line, stacked contribution/interest shading, point titles, legend, and three summary cards.
- Added contribution and interest percentages relative to the total accumulated amount in the summary cards.
- Adjusted the Dashboard two-card grid so `Distribución` and `Jubilación` use equal widths.
- Updated `src/app/globals.css` with area/line/point/legend styles and responsive summary layout.
- Documented the chart split in `README.md`.
- `npm run typecheck` passed.
- `npm run lint` passed.
- Read-only verification passed.
