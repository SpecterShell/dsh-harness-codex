# API package notes

- Every JSON response uses the envelope `{ "data": ..., "error": ... }`.
  Exactly one of the two is non-null.
- Add or update a test under `packages/api/test/` for every route change.
- Record user-visible route changes in `CHANGELOG.md` under the `Unreleased`
  heading.
