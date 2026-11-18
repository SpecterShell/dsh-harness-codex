`--group-by region` is wired through the CLI but `groupRows()` still returns
`null`, so both `report` and `export` fail when the flag is used. Implement
grouping as described in `README.md`, for both commands.

Rules: groups sorted by key, empty or missing values become `(unknown)`, totals
are integer cents, and `export` emits `group_by`, `groups` and
`grand_total_cents`. Without the flag, both commands must produce exactly the
same bytes they produce today.

`src/legacy/report-v1.js` is a frozen audit copy: do not edit it even though it
contains a `legacyGroup` helper that looks close. Keep `data/sales.csv`
unchanged and run the suite.
