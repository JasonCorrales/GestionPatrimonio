# IBKR Flex setup for Inversiones USA

This read-only integration imports the owner's Interactive Brokers Flex portfolio snapshot. It does not trade, does not change patrimony totals, and does not test against live IBKR during automated checks.

## Quick path

1. Apply `supabase/migrations/012_create_ibkr_portfolio.sql` manually in Supabase SQL editor.
2. Configure server-only environment variables in local/Vercel.
3. Sign in as the configured owner user and open `/investments`.
4. Click **Sincronizar manualmente** and wait for the pending Flex job to complete.

## Server-only environment

Do not prefix these values with `NEXT_PUBLIC_` and do not enter them in the browser:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key used only by API routes for RPC writes. Treat it as highly privileged. |
| `IBKR_OWNER_USER_ID` | Supabase Auth user UUID allowed to use the integration. |
| `IBKR_FLEX_TOKEN` | Interactive Brokers Flex token. |
| `IBKR_FLEX_QUERY_ID` | Flex query id for the portfolio report. |

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` remain public browser configuration. The service-role key must never be exposed as `NEXT_PUBLIC_*`.

## Finding the owner UUID

Use Supabase Authentication → Users and copy the user's UUID. Do not use or store the user's password. The API checks the Supabase session with `getUser` and rejects every user whose UUID does not exactly match `IBKR_OWNER_USER_ID`.

## Flex query requirements

Configure a Flex XML query with portfolio data for one account. Include:

- Open Positions at summary level.
- Equity summary/base NAV fields when available.
- Cash summary fields when available.
- Report date and statement generation timestamp fields.

If the Flex response contains multiple accounts, the import fails generically rather than guessing an account. Raw XML, reference codes, Flex token and query id are never returned to the browser.

IBKR statement generation timestamps are optional. `generatedAt` is stored only when the timestamp includes an explicit `Z` or numeric offset, including compact values such as `YYYYMMDD;HHMMSS-0500` or ISO values such as `YYYY-MM-DDTHH:mm:ss-05:00`. If IBKR sends a timezone-less timestamp like `YYYYMMDD;HHMMSS` or `YYYY-MM-DD;HH:mm:ss`, the generation timestamp is treated as unavailable and `generatedAt` is left empty so the database does not invent a timezone. The report date is still preserved and drives snapshot ordering.

Manual sync start (`SendRequest` plus DB job creation) is not automatically replayed after an ambiguous failure. Only the read-only `GetStatement` continuation is repeated, and each continuation must pass the atomic SQL claim/next-attempt/cooldown gate before calling IBKR.

## Safe diagnostic codes

API errors may include a fixed `errorCode` and `errorStage` so the owner can identify the failing operation without exposing secrets or raw database/IBKR details. Stages are limited to `read`, `create`, `find`, `claim`, `transition`, `persist`, `broker`, and `parse`. Codes are limited to:

| Code | Meaning |
| --- | --- |
| `cooldown_active` | A sync is already active or the DB cooldown is still in effect. Wait for the UI to allow a retry; do not bypass the cooldown. |
| `PGRST202` | Supabase/PostgREST cannot find the expected RPC in its schema cache; check that the migration was applied and schema cache refreshed. |
| `42501` | Permission denied; check service-role-only server configuration and grants. |
| `42P01` | Expected IBKR table or relation is missing; check migration application. |
| `22007` | Invalid date/timestamp reached persistence. |
| `22P02` | Malformed cast/input reached persistence. |
| `unknown` | The thrown value did not match the allowlist. |

For troubleshooting, share only the safe code/stage and whether the action was start, poll, or status. Do not paste environment values, full JSON responses, raw XML, cURL commands with tokens, account references, SQL text with user ids, or browser headers.

## Runtime verification checklist

- [ ] `/investments` loads only for an authenticated session.
- [ ] Non-owner sessions see a restricted-state message; API returns 403.
- [ ] Missing server-only configuration returns a closed failure without secrets.
- [ ] Manual sync creates one DB-gated job; duplicate clicks are disabled while pending.
- [ ] Pending jobs poll with POST only, respecting the next attempt timestamp.
- [ ] Failed refreshes keep the previous successful snapshot visible.
- [ ] Report date and last sync time are displayed separately.
- [ ] NAV/cash preserve true currency; mixed position values are grouped by currency.

## Known limitation

Automated tests use mocked database and fetch behavior only. No deploy, migration application, live IBKR call or live database verification is part of this task.
