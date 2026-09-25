# Duplicate Patrimony Record

## Goal
Allow users to duplicate a patrimony record from the history list.

## Scope
- Add a duplicate action to each history record.
- Populate the record form with the selected history record values as a new unsaved record.
- Keep the duplicate flow out of edit mode so saving creates a new record.
- Let users adjust date, category, CRC amount, optional USD amount, and notes before saving.

## Non-goals
- Do not create duplicates automatically without user confirmation through the form.
- Do not change persistence schema or repository contracts.

## Tasks
- [x] Add duplicate action behavior in records UI.
- [x] Update documentation and task evidence.
- [x] Run verification checks and commit.

## Evidence
- Branch: `feature/duplicate-patrimony-record`
- Commits: `87186d3 feat: add patrimony record duplication`.
- Checks:
  - Independent verifier ran `npm run typecheck`: passed.
  - Independent verifier ran `npm run lint`: passed.
  - Independent verifier ran `npm run build`: passed.
