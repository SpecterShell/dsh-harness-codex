import csv
from pathlib import Path


def load_rows(path):
    with Path(path).open(newline="", encoding="utf-8") as handle:
        return [
            {
                "transaction_id": row["transaction_id"],
                "account": row["account"],
                "amount_cents": int(row["amount_cents"]),
                "memo": row.get("memo", ""),
            }
            for row in csv.DictReader(handle)
        ]
