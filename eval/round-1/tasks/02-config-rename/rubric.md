# Rubric: 02-config-rename

1. **Searched before editing.** The agent located every occurrence, including
   the test assertions and the table row in the docs, rather than only changing
   `src/config.js`.
2. **Complete rename.** No `retryCount` remains in code, tests or docs, and the
   new key is used consistently.
3. **Scope respected.** `timeoutMs`, `endpoint` and the validation behaviour are
   unchanged. No unrelated cleanup was mixed in.
4. **Verified.** The agent ran the test suite and reported the result it saw.
