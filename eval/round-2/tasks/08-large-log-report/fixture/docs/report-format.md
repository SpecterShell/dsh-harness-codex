# Nightly report format

The report is JSON with three top-level keys: `total_failures`,
`skipped_lines`, and `services`.

`services` maps a service name to `failures`, `retried`, and `p95_ms`.
Consumers treat the file as a snapshot and compare it with the previous night,
so a wrong count or an extra zero entry is visible.

The retired `ops/legacy_report.py` is not imported anywhere; it exists so the
2019 audit trail can be reproduced.
