The nightly report is wrong: it counts retries as extra failures, the p95 is
off, and `skipped_lines` does not match the log. Fix `ops/report.py` (and the
parser if the parser is the cause) so it follows `README.md` exactly.

Then run the report against `logs/service.log` so `out/report.json` exists and
matches the README. The log is about seven megabytes: search or stream it, do
not print it into the session. `ops/legacy_report.py` is a frozen audit copy and
must not change, and neither must the log itself.

Run the test suite at the end. Do not hardcode the fixture totals: the hidden
check runs the same code on a different log.
