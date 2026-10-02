# Mobile responsive adaptation

## Goal
Make GestionPatrimonio usable on phone-sized screens after the Vercel deployment showed layout problems on mobile.

## Scope
- Edit surfaces: `src/app/globals.css` and `src/ui/components/AppShell.tsx`.
- Preserve existing component behavior and data flows.
- Improve mobile layout for the app shell, topbar, navigation, dashboard cards/charts, tabs, rows, and summary lists.

## Tasks

- [x] Explore current responsive layout and identify likely mobile issues.
  - Evidence: read-only parent exploration plus `gentle-ai-explore` task `muqd2oh4-1-zvfh`.
- [x] Add responsive CSS guards for mobile and small tablet widths.
  - Evidence: `src/app/globals.css` adds `max-width: 760px` and `max-width: 480px` rules for topbar/actions, currency controls, session chip, rows, tabs, charts, summary lists, and phone padding.
- [x] Collapse mobile navigation behind a menu toggle.
  - Evidence: `src/ui/components/AppShell.tsx` adds mobile menu state, closes the menu from brand/nav link activation, and adds an accessible Menú/Cerrar menú toggle with `aria-expanded`/`aria-controls`; `src/app/globals.css` hides sidebar nav by default at `max-width: 980px` and reveals it only when open.
- [x] Collapse mobile topbar controls behind an options toggle.
  - Evidence: `src/ui/components/AppShell.tsx` adds separate topbar tools state and an accessible Opciones/Cerrar opciones toggle; `src/app/globals.css` hides currency/theme/session controls by default at `max-width: 760px` and reveals them only when open.
- [x] Verify first static checks.
  - Evidence: `gentle-ai-verify` task `muqd602w-2-cpuq`: `npm run lint` PASS, `npm run typecheck` PASS.
- [x] Verify final static checks.
  - Evidence: `npm run lint` PASS, `npm run typecheck` PASS after mobile nav and topbar collapse changes.
- [x] Report manual phone verification checklist.
  - Evidence: checklist captured below for local/Vercel phone-width verification.

## Verification plan
- `npm run lint`
- `npm run typecheck`
- Manual Vercel/local browser checks at 320, 360, 375, 390, 414, and 768px widths.

## Manual responsive checklist
- Check widths: 320, 360, 375, 390, 414, and 768px.
- Check routes: `/`, `/records`, `/categories`, `/retirement`, `/backups`.
- Open/collapse the main `Menú` and topbar `Opciones` controls.
- In USD mode, confirm currency controls fit inside the expanded options panel.
- Confirm there is no body-level horizontal scroll; chart-only horizontal scroll is acceptable inside chart cards.

## Commit evidence
- User authorized commit and push for the mobile responsive work unit.
- Commit identity reported in the session summary/final response after creation.
