#!/usr/bin/env bash
# Check task 01: case-insensitive category filtering, retired report untouched.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/tools/report.py" "$repo/tools/report.py" \
  || fail "tools/report.py changed; the README says the retired copy must stay as is"

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
from pathlib import Path

from expenses import filter_by_category, load_expenses

rows = load_expenses(Path("data/expenses.csv"))


def ids(value):
    return [row["id"] for row in filter_by_category(rows, value)]


assert ids("travel") == [1, 4], ids("travel")
assert ids("TRAVEL") == [1, 4], ids("TRAVEL")
assert ids("  Meals  ") == [2, 5], ids("  Meals  ")
assert ids("office") == [3, 6], ids("office")
assert ids("hardware") == [], ids("hardware")
for row in filter_by_category(rows, "travel"):
    assert row["category"].strip().casefold() == "travel", row
print("behaviour checks ok")
PY
); then
  fail "hidden behaviour checks failed"
fi

echo "task 01 check passed"
