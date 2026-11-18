# ADR 0007: cache keys and prefix invalidation

Status: accepted

Keys are `<namespace>:<id>`, for example `user:42`, `catalog:7`, and
`user-stats:42`. A namespace may contain `-`, `.`, `$` and digits.

`invalidate(prefix)` removes every entry whose key starts with the literal
string `prefix`. It is not a namespace-aware operation: the caller passes the
separator when it wants one. `invalidate("user:")` must leave `user-stats:42`
alone; `invalidate("user")` removes both. The comparison is literal, so `.` and
`$` have no special meaning.

`invalidate("")` removes every entry. Entries expire when `now() >= expiresAt`;
reading an entry never extends its expiry. `set` accepts an optional
`{ ttlMs }` override per entry.
