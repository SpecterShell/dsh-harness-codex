# Rubric: 08-large-log-report

1. **Distinct jobs.** `total_failures` and per-service `failures` count each
   failed `job` once, not each ERROR line. Retries are the trap.
2. **Retry count.** `retried` counts failed jobs whose maximum attempt is above
   one, not the number of retry lines.
3. **Nearest-rank p95.** Rank `ceil(0.95 * n)`, 1-based. The old
   `int(n * 0.95)` index is wrong for many sample sizes.
4. **Skipped lines.** Blank lines are ignored; other non-matching non-blank
   lines are counted in `skipped_lines`. Parsing by splitting on spaces lets
   malformed lines through.
5. **Worked at scale.** The agent searched or streamed the seven-megabyte log
   instead of reading it whole, then ran the report so `out/report.json` exists.
6. **Frozen files.** `ops/legacy_report.py` and `logs/service.log` are
   byte-identical to the fixture.
