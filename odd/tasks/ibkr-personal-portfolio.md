# Personal IBKR portfolio

## Intent and constraints
Read-only /investments for personal-owner IBKR Flex manual asynchronous synchronization and separate Supabase snapshots/positions. No trading or changes to patrimony totals. Server-only token/query/ownerUUID/service-role key; exact validated Supabase owner before privileged work. Never read real secrets/.env or expose raw XML/URLs/account/reference/SQL in errors. Preserve native currency and unknown null values, NAV includes cash. Atomic stable user/account/report-date snapshots, latest by report-date. Fixed endpoints, streamed limits/timeouts, DB-gated cooldown/state/atomic poll claims. No automatic SendRequest/create replay; GetStatement downloads repeat only under claim/age/attempt/time bounds.
RDD globally off. Base a476e974faadf7d135a772ee620eef4dfa7d1eb0; branch feat/ibkr-personal-portfolio. No commit/push/PR/deploy/live DB or IBKR calls by assistant authorized. User privately configures/tests.

## Tasks and routing
- [x] T1: Schema/atomic persistence, Flex parser/client/tests. Delegated multi-file writer and independent verifier. SQL runtime pending; commit permission pending.
- [x] T2: Owner-auth APIs and screen/docs. Delegated multi-file writer and independent verifier; commit permission pending.
- [x] T3: Independent automated plus real browser/DB/IBKR verification. Automated checks passed; user-reported live sync now persists positions and renders them on screen.
- [x] T4: Safe diagnostic precedence and generated timestamp semantics. Delegated multi-file writer and independent verifier. Passive one-line stage-list doc correction inline, structurally read back; commit permission pending.
- [x] T5: Claim RPC ambiguity fix for runtime claim/unknown. Delegated writer and independent verifier; commit permission pending.
- [x] T6: OpenPosition summary casing fix after snapshot persisted without positions. Delegated writer and independent verifier; commit permission pending.

## Evidence
T1 RED->GREEN6; buffering/cooldown verifier findings corrected test-first GREEN9, independent pass. SQL only textually checked.
T2 RED->GREEN14; polling/job/date/decimal/multi-statement/server-only findings corrected RED->GREEN19, independent tests/lint/typecheck/build and bounded review passed.
User reports local vars/migration012 applied, bad ownerUUID corrected after503. UI then showed syncing, POST502 generic processing error, no successful snapshot observed.
T4 initial RED missing errors.ts/compact timestamp mismatch->GREEN23. Independent verifier found original error masked by markFailed failure and timezone-less timestamptz ambiguity. Corrections RED3->GREEN24: original broker/parse/persist diagnostic primary; transition/read failure secondary; generatedAt without explicit Z/offset becomes null, report-date preserved.
Independent mv1kr90q-f-kel6 passed npm run test:ibkr24/24, npm run lint, npm run typecheck, npm run build, code/privacy/polling review. Only stale doc stage-list remained; parent mechanically added broker/parse and read back. No meaningful RED for passive doc correction; structural check only. Underlying real502 still unknown.
Native assessment unassessable due untracked declaration, treated high with independent verification; no RDD review.
Runtime claim/unknown likely mapped to PostgreSQL ambiguous_column 42702 from PL/pgSQL RETURNS TABLE output `attempts` conflicting with unqualified claim predicate `attempts < 12`. T5 RED focused tests caught missing qualified predicate and 42702 collapsing to unknown; GREEN fixed `public.ibkr_sync_jobs.attempts < 12` and allowlisted code-only 42702. Independent verifier passed npm run test:ibkr 24/24 and confirmed no raw DB message exposure.
User then reported successful snapshot but empty positions table and UI no positions. T6 likely root cause: real IBKR OpenPosition `levelOfDetail` casing such as `SUMMARY` was dropped by exact `Summary` comparison. RED parser test caught uppercase `SUMMARY`/`LOT`; GREEN changed summary filter to case-insensitive and preserved absent levelOfDetail as summary. Independent re-verifier passed npm run test:ibkr 25/25. After cooldown, user reported another sync populated data and rendered positions on screen.
Audit8 pre-existing Next/eslint/sharp/source-map-js vulnerabilities, none added parser tree. Node typeless-package warnings. Browser/PostgreSQL unavailable; no live RLS/RPC/IBKR schema compatibility/deployment verification by assistant. Next build auto-loads .env.local, not inspected. .env.example blocked by safety, omitted; setup in docs/ibkr-setup.md.

## Delivery and next
Initial900–1300 forecast understated; ~2332 feature lines before later corrections. Oversized risk surfaced; ask-on-risk strategy choice required before any commit. No cosmetic compression/omitted checks. Single oversized work-unit commit authorized by user: `feat: add personal IBKR portfolio sync` on branch `feat/ibkr-personal-portfolio`. No PR, deploy, or assistant live IBKR/DB operations have been performed.
Next: Push authorized branch `feat/ibkr-personal-portfolio`; PR/deploy remain separate user decisions.
