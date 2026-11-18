# Architecture notes

The nightly path is deliberately boring: one streaming pass over the current
log segment, one in-memory dictionary of failed jobs, one JSON write. Everything
else (`render`, `export`, `compare`, `notify`) is a pure function over that
report, which is why those modules can be tested without a log.

`ops.logparse` is the only module that knows the line grammar. It returns
`(entries, skipped)`. Callers must pass `skipped` through to the report; a
report with a hardcoded zero hides format drift.

The dashboard and pager payloads are built from the same report object. They do
not re-read the log.

`ops.audit` and `ops.cache` are small filesystem helpers used by the cron
wrapper. They are not on the request path and are not imported by `report.py`.
