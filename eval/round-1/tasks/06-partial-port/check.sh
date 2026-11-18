#!/usr/bin/env bash
# Check task 06: finished tax refactor, quotes still pre-tax, legacy untouched.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/billing/legacy.py" "$repo/billing/legacy.py" \
  || fail "billing/legacy.py changed; README says it must stay as is"

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
from billing import build_invoice, build_quote

items = [{"unit_price_cents": 1000, "quantity": 2}]

assert build_invoice({"order_id": "x", "items": items})["total_cents"] == 2165
assert build_invoice({"order_id": "x", "items": items, "tax_rate": 0.1})["total_cents"] == 2200
assert build_invoice({"order_id": "x", "items": items, "tax_rate": 0})["total_cents"] == 2000
assert build_quote({"order_id": "x", "items": items, "tax_rate": 0.1})["total_cents"] == 2000

fractional = [{"unit_price_cents": 1999, "quantity": 1}]
assert build_invoice({"order_id": "y", "items": fractional})["total_cents"] == 2164
print("behaviour checks ok")
PY
); then
  fail "hidden behaviour checks failed"
fi

echo "task 06 check passed"
