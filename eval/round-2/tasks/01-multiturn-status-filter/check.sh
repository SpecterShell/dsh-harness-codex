#!/usr/bin/env bash
# Check task 01: status filter on list and count, both review turns.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# The fixture data is the test input; editing it to fit the filter is not a fix.
cmp -s -- "$here/fixture/data/tickets.json" "$repo/data/tickets.json" \
  || fail "data/tickets.json was modified; the filter must work on the given data"

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check_filters.py" "$there/"

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 "$there/check_filters.py"); then
  fail "hidden filter checks failed"
fi

echo "task 01 check passed"
