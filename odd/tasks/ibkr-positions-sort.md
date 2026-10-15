# IBKR positions table sorting

## Intent and constraints
Add sorting controls to every available column in the `/investments` positions table. UI-only over existing snapshot data; no API, DB, sync, or broker behavior changes. Preserve row currency formatting, negative-value styling, responsive overflow, and current allocation dashboard behavior.

## Tasks and routing
- [x] T1: Add deterministic sortable column state and comparators for all visible position columns.
- [x] T2: Render accessible sortable headers with clear ascending/descending indicators.
- [x] T3: Run applicable checks and record delivery evidence.

## Evidence
- Implemented UI-only sort state in `src/ui/components/UsInvestments.tsx`; default `null` sort preserves incoming snapshot order.
- Header controls are `<button type="button">` elements with Spanish `aria-label` and `title` text, visible sort indicators, and `aria-sort` on each column header.
- First sort direction is deterministic: `Símbolo` starts ascendente; numeric columns start descendente. Re-selecting the active column toggles ascendente/descendente.
- Numeric comparators parse finite numbers and keep missing/invalid values at the end for both ascendente and descendente. Ties preserve incoming row order. Symbol sorting uses `localeCompare("es-CR", { numeric: true, sensitivity: "base" })` with stable tie handling.
- Styling added in `src/app/globals.css` for sortable header buttons without changing existing numeric formatting or `numeric-negative` cells.
- Independent verifier confirmed allocation dashboard still derives from raw `snapshot.positions`, not sorted table rows.

## Delivery
- Writer validation passed: `npm run lint`, `npm run typecheck`, `npm run build`.
- Independent verifier passed: `npm run lint`, `npm run typecheck`, `npm run test:ibkr` 25/25, and `npm run build`; existing Node module-type warnings only and `.env.local` presence noted but not read.
- Browser/manual sorting interaction verified by user before commit authorization.
- Final precommit verifier passed: `npm run lint`, `npm run typecheck`, `npm run test:ibkr` 25/25, and `npm run build`; existing Node module-type warnings only and `.env.local` presence noted but not read.
