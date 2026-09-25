# Global Currency Selector

## Goal
Add a global currency preference so the app can display general monetary data across pages in CRC or USD from a topbar selector.

## Scope
- Add a global currency preference with topbar control next to the theme toggle.
- Persist the selected display currency and a manual CRC-to-USD exchange rate locally.
- Format dashboard, records, and retirement amounts according to the selected display currency.
- Use recorded USD amounts where available; otherwise convert CRC values with the configured exchange rate.
- Keep record entry fields as explicit CRC and optional USD source values.

## Non-goals
- Do not fetch exchange rates from an external API.
- Do not change database schema for the exchange rate.
- Do not change stored retirement calculations from CRC source values.

## Tasks
- [x] Add a client currency preference provider and formatting helpers.
- [x] Add a topbar currency selector/rate input beside the theme toggle.
- [x] Apply display currency to dashboard summaries and distributions.
- [x] Apply display currency to record totals and history.
- [x] Apply display currency to retirement calculator display values.
- [x] Update documentation and run verification checks.

## Evidence
- Branch: `feature/global-currency-selector`
- Commits: `241d917 feat: add global currency selector`.
- Checks:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run build`: passed.
  - Independent verifier reran `npm run typecheck`, `npm run lint`, and `npm run build`: passed.
- Caveat: browser smoke testing was not run in this session.
