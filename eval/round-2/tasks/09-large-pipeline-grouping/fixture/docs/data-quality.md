# Data quality checks

Before an import reaches the pipeline, the producer checks:

- every row has an `order_id` and a `product`
- `quantity` is a positive integer
- `unit_price_cents` is a non-negative integer
- the same `order_id` is not repeated

`loadRows` re-checks the first three because the CSV can be edited by hand. The
duplicate check lives in `order-index.js` and is only used by the describe
command; the nightly aggregation tolerates duplicates today.

When a check fails, the CLI exits 2 and prints `error: ...` on stderr.

## Known gaps

The duplicate order check is only used by `describe`. If the nightly export ever
needs it, move it into `loadRows` so every command sees the same validation.
The grouping command intentionally accepts any column name; an unknown column
groups everything under `(unknown)`, which is visible in the output and easy to
spot during review.
