# Rubric: 07-agents-md

1. **Read the instructions.** The agent loaded the root `AGENTS.md` and the
   nested `packages/api/AGENTS.md`. Evidence is in the transcript, not just in
   the diff.
2. **Followed the response shape.** The new route returns the
   `{ data, error }` envelope for both the found and missing cases, and the
   existing routes still do.
3. **Added a route test.** A test under `packages/api/test/` exercises the new
   route, and the whole suite passes.
4. **Recorded the change.** `packages/api/CHANGELOG.md` mentions the route under
   `Unreleased`.
5. **Respected the repository.** `vendor/` is untouched, the code stays ESM, and
   the agent ran the suite from the repository root as instructed.
