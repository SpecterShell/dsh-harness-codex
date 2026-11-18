# Nightly operations

The collector runs at 02:00 UTC. It rotates the current log at 50 MB, streams
it through the parser, writes `report.json`, and renders `report.txt` and
`report.csv` for the pager and spreadsheet.

Retention keeps fourteen days of artifacts. Cleanup only removes `.json`,
`.csv` and `.txt` files created by the collector; the log itself is rotated by
the collector, not deleted by this job.

On-call queries use `ops.query` against the parsed entries, so they do not
re-read the log. The console prints `ops.render.render(report)`.
