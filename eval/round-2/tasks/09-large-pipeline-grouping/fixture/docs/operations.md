# Operations

`src/commands/stats.js` and `src/commands/validate.js` are operator helpers.
They are not wired into the CLI so that the nightly path stays small; run them
from a Node REPL with `loadRows("data/sales.csv")`.

Validation is intentionally checked against the exported payload, not the
internal row shape, because the exported JSON is what consumers read.

Legacy `report-v1.js` is dead code. It is excluded from lint and tests, and it
must not be modified.
