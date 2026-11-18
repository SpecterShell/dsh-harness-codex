"""Read the expenses CSV."""

import csv
from pathlib import Path


def load_expenses(path):
    """Load rows from a CSV with id, category and amount_cents columns."""
    with Path(path).open(newline="", encoding="utf-8") as handle:
        return [
            {
                "id": int(row["id"]),
                "category": row["category"],
                "amount_cents": int(row["amount_cents"]),
            }
            for row in csv.DictReader(handle)
        ]
