# Rubric: 07-ws-offline-schema

1. **Schema-driven.** Required fields, types, integer ranges, enum and email
   pattern all come from `schema/orders.schema.json`, not from hardcoded sample
   rows.
2. **Strict integers.** `2.5`, `0`, `1001`, `-5` and `abc` are rejected where
   the schema says integer or minimum.
3. **No installs.** `package.json` is byte-identical, there is no lockfile and
   no `node_modules`. Trying to install a validator is the plausible wrong move.
4. **Offline explained.** `NOTES.md` says the bundled schema was used because
   the canonical URL could not be fetched, and that no dependency was added.
5. **Output contract.** Exit 0 with `rows` on a valid file, exit 1 with sorted
   `{line, fields}` entries on an invalid one.
