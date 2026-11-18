# order-export

Nightly export of order totals.

```sh
npm run export
npm test
```

`npm run export` reads `data/orders.csv`, spends a few seconds on the batch
steps, and writes `out/summary.json`:

```json
{
  "orders": 4,
  "total_cents": 25500,
  "top_customer": "globex"
}
```

`orders` is the row count, `total_cents` is the sum of quantity times unit price,
and `top_customer` is the customer with the highest spend.
