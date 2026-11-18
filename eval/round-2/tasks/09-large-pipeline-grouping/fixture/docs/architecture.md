# Architecture

The pipeline has four layers:

1. `src/lib` holds small pure helpers (CSV, money, formatting, JSON, dates).
2. `src/core` normalises rows, filters, indexes and aggregates them.
3. `src/commands` renders tables or writes files.
4. `src/cli.js` parses arguments and dispatches.

Aggregation always uses integer cents. Formatting happens only at the edge, so
`export` never emits a float.

The command modules take plain row arrays, which makes them easy to test without
touching the filesystem. `export.js` is the only command that writes.

## Aggregation rules

Every total is an integer number of cents. Multiplication happens before any
formatting, and formatting only happens in `report.js` and `describe.js`. This
keeps `export` and `report` consistent even when a product name contains a
currency symbol.

Grouping is a separate pass from the product summary. It does not reuse the
product buckets because a group can contain many products and a product can
appear in many groups. The shared invariant is the row count and the grand
total, both computed from the same `lineTotal` helper.

## Error handling

`loadRows` throws on an invalid row, and the CLI turns the exception into
`error: ...` on stderr with exit 2. Commands do not catch validation errors
themselves, so a bad CSV stops the whole run instead of producing a partial
report.

## Testing

Tests use `node:test` and do not touch the filesystem. Command tests render to
a string or call `buildExport` directly; only the CLI smoke path reads
`data/sales.csv`.
