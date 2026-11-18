# Expenses

Small helpers behind the finance dashboard.

`expenses.load_expenses(path)` reads a CSV into dicts with `id`, `category` and
`amount_cents`.

`expenses.filter_by_category(rows, category)` returns the matching rows for the
dashboard, ordered by id. The category column is typed by hand in the
spreadsheet, so matching ignores case and surrounding spaces.

`tools/report.py` is a copy of the retired report generator. It is kept for the
migration audit and nothing imports it. Do not change it.

## Tests

```sh
python3 -m unittest discover -s tests
```
