# Report consumers

The spreadsheet export reads `report.csv`; the pager reads `report.txt`. Both
are built from the same JSON snapshot, so a re-run replaces all three files.

Alert thresholds are per service and live in the pager configuration, not in
the report.

The collector rotates the log at 50 MB before reading it, so the file passed to
`ops.report` is always the current segment.
