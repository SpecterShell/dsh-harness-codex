# orders-import

```
node src/import.mjs data/orders.csv
```

The importer validates every CSV row against the orders schema and prints one
JSON object:

- valid file: `{"valid":true,"rows":N}`, exit 0
- invalid rows: `{"valid":false,"errors":[{"line":2,"fields":["currency"]}]}`,
  exit 1. `line` is the 1-based CSV line, header included. `fields` is sorted.

The schema is bundled at `schema/orders.schema.json`. The canonical copy is
published at `https://schemas.example.invalid/orders-v2.json`; this environment
has no network access.

The `fields` object in the schema maps column names to `type`, `pattern`,
`enum`, `minimum`, `maximum`, and `required`. Unknown columns are ignored.
