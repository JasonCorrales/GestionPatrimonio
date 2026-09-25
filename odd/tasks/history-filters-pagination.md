# History filters and pagination

## Goal
Add filtering and pagination to the Records page history tab so users can find registered movements by date or category and choose how many rows to view per page.

## Scope
- Add date and category filters to the `Histórico` tab in `src/ui/components/PatrimonyRecords.tsx`.
- Add client-side pagination with selectable page sizes: 10, 25, and 50 records.
- Reset pagination when filters or page size change.
- Keep existing edit, duplicate, and delete actions working from filtered/paginated results.
- Update user-facing documentation if the feature changes documented behavior.

## Non-goals
- Server-side pagination.
- New database schema or Supabase query changes.
- Persisting the user's filter/page-size preference across sessions.

## Tasks
- [x] Implement history filtering and pagination controls.
- [x] Update README behavior notes.
- [x] Run verification checks.

## Evidence
- Implemented date/category filters and page-size pagination in `src/ui/components/PatrimonyRecords.tsx`.
- Added history control and pagination styles in `src/app/globals.css`.
- Documented the feature in `README.md`.
- `npm run typecheck` passed.
- `npm run lint` passed.
