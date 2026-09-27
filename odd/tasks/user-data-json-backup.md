# User data JSON backup

## Outcome

Add a first backup slice that lets an authenticated user download a JSON backup of their own GestionPatrimonio data.

## Scope

Included:

- Categories from `category`.
- Patrimony records from `monthly_patrimony_records`.
- Saved retirement calculations from `retirement_calculations`.
- A sidebar Backups page with a manual download action.
- Server API route that validates the Supabase access token and relies on RLS-visible data.

Excluded for this slice:

- Direct Google Drive upload.
- Scheduled/automatic backups.
- Full Supabase/Postgres dump.
- Restore/import flow.

## Design notes

- The backup endpoint uses the public Supabase anon key plus the caller's bearer session token, not a service-role key.
- The exported JSON is versioned with `schemaVersion: 1` for a future restore/import flow.
- The client downloads the file locally so the user can manually store it in Google Drive.

## Verification

- `npm run typecheck`
