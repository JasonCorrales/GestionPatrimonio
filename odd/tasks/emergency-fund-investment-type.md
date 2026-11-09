# Emergency fund investment type
Add a persistable emergency-fund investment type to monthly patrimony records and make the dashboard classify records by that selected type.
Risk: item 1 — additive database constraint migration.

## Specs
1. S1 — "ocupo que agreges en la sección de \"Registro mensual de patrimonio\" en el campo \"Tipo de inversión\" una opción para fondo de emergencia"
2. S2 — "Sí, usar el tipo de inversión"

## Tasks
- [x] T1 — S1-S2 — Implement record, persistence, import/backup, migration, and dashboard behavior with test-first coverage — route: parallel bounded writers — commit: pending
- [x] T2 — S1-S2 — Run focused, regression, static migration, lint, typecheck, and build verification — route: parent + independent verifier — commit: pending

## Log
- L1 — "ocupo que agreges en la sección de \"Registro mensual de patrimonio\" en el campo \"Tipo de inversión\" una opción para fondo de emergencia"
- L2 — Dashboard classification decision: "Sí, usar el tipo de inversión"
- L3 — Integrated focused tests, IBKR regression tests, typecheck, lint, production build, and diff checks passed.
- L4 — Independent verification passed S1-S2 after correcting legacy backup restoration to default missing investment types to `fixed_income`.
