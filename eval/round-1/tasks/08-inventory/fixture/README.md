# inventory

A small stock service used by the warehouse tools. It reads one JSON file, so
you can run it against a copy without a database.

```sh
python3 -m inventory.cli list
python3 -m inventory.cli low-stock
python3 -m inventory.cli value
python3 -m inventory.cli show A-100
python3 -m inventory.cli adjust A-100 -2
```

The default data file is `data/stock.json`; `--data PATH` (or `INVENTORY_DATA`)
overrides it. Every command accepts `--json` for machine output.

`list` prints every item with its warehouse, quantity, reorder point and value.
`low-stock` prints items at or below their reorder point, with the shortfall.
Both are sorted by SKU. `value` prints the total value of the stock file.
`show` and `adjust` work on one SKU.

Unless `--json` is given, output is a plain table.

## Layout

- `inventory/models.py`: the item type and its validation
- `inventory/storage.py`: JSON load and save
- `inventory/service.py`: the operations the CLI exposes
- `inventory/reports.py`: table formatting
- `inventory/cli.py`: argument parsing and output
- `tests/`: unit tests

## Tests

```sh
python3 -m unittest discover -s tests
```
