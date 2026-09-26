# Automatic BCCR exchange rate

## Goal

Use the daily BCCR CRC/USD exchange rate for presentation-layer currency conversion while preserving the existing manual fallback.

## Decisions

- Use BCCR indicator `318` (`Tipo de cambio: venta colón/dólar`) as the automatic CRC-per-USD rate.
- If BCCR fails or credentials are missing, keep using the last saved/manual rate.
- Keep persisted patrimony records unchanged; automatic exchange rate affects display conversion only.
- Store the BCCR REST bearer token in the server-only `BCCR_TOKEN` environment variable, never `NEXT_PUBLIC_*`.

## Tasks

- [x] Add server API route for the current BCCR REST exchange rate.
- [x] Update currency context and topbar controls to fetch/show automatic rate with manual fallback.
- [x] Document BCCR environment variables and run verification.

## Evidence

- Removed dependency: `bccr-indicadores-economicos`.
- Updated server route: `src/app/api/exchange-rate/route.ts` now calls the BCCR REST API with `Authorization: Bearer <token>`.
- Updated currency context: `src/ui/currency.tsx`.
- Updated topbar controls: `src/ui/components/AppShell.tsx`.
- `npm run typecheck` passed after the REST/Bearer token migration.
- `npm run lint` passed after the REST/Bearer token migration.
- `npm run build` passed after the REST/Bearer token migration.
- `git grep -n -E 'bccr-indicadores-economicos|BCCR_EMAIL' -- .` returned no tracked matches.
- Work-unit commit: `7426fad feat: fetch BCCR exchange rate automatically`.
