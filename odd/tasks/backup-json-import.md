# Backup JSON import

## Outcome

Add a restore flow that imports a previously exported GestionPatrimonio JSON backup into the authenticated user's account.

## Scope

Included:

- Import endpoint for `schemaVersion: 1` GestionPatrimonio backups.
- Replace-current-data semantics selected by the user.
- Strong client-side confirmation before invoking the destructive restore.
- Server-side session validation using the Supabase bearer token and RLS policies.
- Delete existing visible records/calculations/categories for the current user before inserting backup rows.
- Recreate categories first, then map backup category IDs into restored patrimony records.
- Restore saved retirement calculations.
- README documentation for import behavior and risk.

Excluded for this slice:

- Google Drive direct upload/download.
- Scheduled backups.
- Partial merge mode.
- Cross-version migration beyond backup schema version 1.
- Restore/import rollback UI after confirmation.

## Safety notes

- The route must not trust or insert `backup.user.id`; Supabase RLS/default `auth.uid()` owns restored rows.
- The destructive operation is allowed only after an explicit UI confirmation phrase.
- The import should delete child tables before categories to satisfy foreign keys/RLS.
- If the route fails mid-restore, the user may need to re-run the import because this slice does not add a PostgreSQL RPC transaction.

## Implementation notes

- Added `POST /api/backups/import` for `schemaVersion: 1` GestionPatrimonio JSON backups.
- The route validates Supabase configuration, bearer session, top-level backup shape, row shape, and category references before deleting current user-visible rows.
- Restore uses replace-current-data semantics: patrimony records and retirement calculations are deleted before categories, then categories are recreated before dependent patrimony records are inserted with remapped category IDs.
- Backup `user.id`, row `id`, and `user_id` values are intentionally not inserted; ownership comes from the active Supabase bearer token and RLS/default `auth.uid()`.
- The UI requires a JSON file plus the exact typed phrase `RESTORE BACKUP` before enabling the destructive import button.
- Backup form controls are constrained to the panel width, the restore panel text wraps inside its border, and the main backup card is wider to avoid visual overflow.

## Verification

- `npm run typecheck`
- `npm run lint` if available

## Evidence

- `npm run typecheck`: passed (`tsc --noEmit`).
- `npm run lint`: passed (`eslint .`).
