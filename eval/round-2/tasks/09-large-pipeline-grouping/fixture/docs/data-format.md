# Sales CSV

Columns: `order_id`, `region`, `product`, `quantity`, `unit_price_cents`.

- `quantity` is a positive integer.
- `unit_price_cents` is a non-negative integer.
- `region` may be empty or contain commas when quoted.
- `product` is required.

Rows are sorted by product then order id only for display; aggregation does not
depend on the input order.
