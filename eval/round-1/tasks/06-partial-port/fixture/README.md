# billing

Invoice and quote totals for the order service.

- Invoices include tax. An order may carry a `tax_rate` fraction; when it does
  not, the default rate is `0.0825`.
- Quotes are pre-tax.
- `billing/legacy.py` is kept for the migration audit. Nothing imports it and it
  must not be changed.

## Tests

```sh
python3 -m unittest discover -s tests
```
