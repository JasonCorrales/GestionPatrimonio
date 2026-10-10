# IBKR position allocation dashboard

## Intent and constraints
Add a circular dashboard below the `/investments` positions table showing each stock/action by invested amount and percentage. Use existing IBKR snapshot positions only; no live broker calls, DB changes, or changes to sync behavior. Preserve safe display behavior for missing/invalid values and mixed currencies.

## Tasks and routing
- [x] T1: Derive allocation data from current positions with deterministic formatting and edge-case handling.
- [x] T2: Render the circular dashboard below the positions table with responsive, theme-aware CSS.
- [x] T3: Enlarge the circular chart, improve panel space distribution, and add per-segment hover/focus details.
- [x] T4: Add summary metrics for liquidable NAV value and current gain using NAV minus cost basis in the NAV currency.
- [x] T5: Run focused and full applicable checks; commit/push authorized after user approval.

## Evidence
- Added allocation derivation that groups positive finite `positionValue` by currency and symbol, sorting deterministically and ignoring missing/invalid/non-positive values.
- Rendered a per-currency donut dashboard below the positions table with Spanish copy, accessible labels, and a text legend with amount and percentage.
- Replaced the conic-gradient donut with a larger SVG donut, widened the chart column, and added native per-segment hover/focus titles showing action, percentage, and amount.
- Writer validation passed: `npm run lint`, `npm run typecheck`, `npm run test:ibkr` (25 passing tests; existing Node module-type warnings only).
- Independent verifier passed earlier: `npm run lint`, `npm run typecheck`, `npm run test:ibkr` 25/25, and `npm run build`; build generated `/investments` successfully and noted `.env.local` presence without reading it.
- Post-hover-adjustment validation passed: `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:ibkr` 25/25; existing Node module-type warnings only.
- Added summary metrics: `Valor real liquidable` from NAV base and `Ganancia actual` as NAV minus summed positive `costBasisMoney` for positions in the NAV currency; focused validation passed `npm run lint` and `npm run typecheck`.
- Adjusted the positions table to show `Símbolo`, `Cantidad`, `Precio de mercado`, `Precio`, `Valor`, `Costo`, and `P/L`, keeping row-currency money formatting without a visible currency column and highlighting finite negative numeric cells with the scoped `numeric-negative` style.

## Delivery
Commit and push authorized by user. Commit: `feat: add IBKR allocation dashboard` on branch `feat/ibkr-personal-portfolio`; push evidence pending.
