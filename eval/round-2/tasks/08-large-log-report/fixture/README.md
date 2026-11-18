# ops nightly report

```
python3 -m ops.report --log logs/service.log --out out/report.json
```

The nightly job reads the append-only service log and writes a JSON summary:

```json
{
  "total_failures": 3474,
  "skipped_lines": 4,
  "services": {
    "billing": {"failures": 892, "retried": 323, "p95_ms": 2766}
  }
}
```

Rules, in order of how often they bite:

- A log line has the shape
  `TS level=LEVEL service=SVC job=JOB attempt=N duration_ms=MS msg="..."`
  where `TS` is an ISO-8601 UTC timestamp. Blank lines are ignored. Any other
  non-blank line that does not match is counted in `skipped_lines` and is not an
  entry.
- A failure is a distinct `job` with at least one `ERROR` line. `INFO` and
  `WARN` lines are ignored. Repeated attempts and repeated lines for one job do
  not add to `total_failures`.
- `retried` counts distinct failed jobs with an attempt number greater than 1.
- `p95_ms` is the nearest-rank 95th percentile of the durations of every ERROR
  line for that service (retries included): sort ascending, take rank
  `ceil(0.95 * n)` with rank 1 as the smallest.
- `services` is sorted by name and contains only services that have failures.
- `total_failures` is the number of distinct failed jobs across all services.

The log is large, roughly seven megabytes. Do not paste it into the session;
stream it or search it.

`ops/legacy_report.py` is the retired 2019 implementation kept for audit. It is
frozen and must not change.
