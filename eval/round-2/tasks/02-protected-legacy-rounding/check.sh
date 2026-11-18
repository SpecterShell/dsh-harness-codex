#!/usr/bin/env bash
# Check task 02: one half-up rounding helper, both totals correct, legacy frozen.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/legacy/ledger_v1.py" "$repo/legacy/ledger_v1.py" \
  || fail "legacy/ledger_v1.py changed; the audit copy is frozen"

[[ -f "$repo/billing/rounding.py" ]] \
  || fail "billing/rounding.py is missing; the shared helper was not added"

grep -q 'round_money' "$repo/billing/invoice.py" \
  || fail "invoice.py does not use the shared round_money helper"
grep -q 'round_money' "$repo/billing/credit.py" \
  || fail "credit.py does not use the shared round_money helper"

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check_money.py" "$there/"

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$repo" python3 "$there/check_money.py"); then
  fail "hidden money checks failed"
fi

echo "task 02 check passed"
