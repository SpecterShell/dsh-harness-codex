# sales pipeline

```
node src/cli.js report --data data/sales.csv
node src/cli.js export --data data/sales.csv --out out/summary.json
npm test
```

`report` prints a table of per-product totals. `export` writes the same summary
as JSON to `--out`.

## Grouping

`--group-by <column>` is not implemented yet. It must work on both commands and
group rows by the named column:

- group key is the cell value; an empty or missing value uses `(unknown)`
- groups are sorted by key in ascending string order
- each group reports `rows` and `total_cents` (`quantity * unit_price_cents`)
- `export` adds `"group_by"` and `"groups"` to its JSON, plus
  `"grand_total_cents"`
- without the flag, output is byte-for-byte what it is today

`src/legacy/report-v1.js` is the retired implementation kept for audit. It is
frozen and must not change.
