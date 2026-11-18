"""Retired report generator, kept for the migration audit.

The dashboard no longer calls this file. It stays in the tree so the audit can
compare old and new output, and it is not part of the package.
"""

import csv
import sys


def load_rows(path):
    with open(path, newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def filter_by_category(rows, category):
    wanted = category.strip().casefold()
    return [
        row
        for row in rows
        if row["category"].strip().casefold() == wanted
    ]


def main(argv):
    if len(argv) != 3:
        print("usage: report.py <csv> <category>", file=sys.stderr)
        return 2
    rows = filter_by_category(load_rows(argv[1]), argv[2])
    total = sum(int(row["amount_cents"]) for row in rows)
    print(f"{len(rows)} rows, {total} cents")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
