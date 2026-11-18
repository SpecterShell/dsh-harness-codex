#!/usr/bin/env bash
# Check task 03: pricing tests pass and the documented behaviour holds.
set -euo pipefail

repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 - <<'PY'
import pricing

assert pricing.apply_tax(100, 0.08) == 108.0, pricing.apply_tax(100, 0.08)
assert pricing.apply_tax(19.99, 0.07) == 21.39, pricing.apply_tax(19.99, 0.07)
assert pricing.apply_tax(200, 0.05) == 210.0, pricing.apply_tax(200, 0.05)
assert pricing.apply_tax(42.5, 0.0) == 42.5, pricing.apply_tax(42.5, 0.0)
assert pricing.format_price(3.5) == "$3.50", pricing.format_price(3.5)
assert pricing.format_price(1234.5) == "$1,234.50", pricing.format_price(1234.5)
assert pricing.format_price(0) == "$0.00", pricing.format_price(0)
assert pricing.format_price(1000000) == "$1,000,000.00", pricing.format_price(1000000)
print("behaviour checks ok")
PY
); then
  fail "hidden behaviour checks failed"
fi

echo "task 03 check passed"
