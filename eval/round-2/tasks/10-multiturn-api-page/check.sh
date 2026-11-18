#!/usr/bin/env bash
# Check task 10: tag filter, pagination, total, validation, docs.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/data/items.json" "$repo/data/items.json" \
  || fail "data/items.json changed; the data is test input"

for needle in "tag" "limit" "offset" "total"; do
  grep -Fqi -- "$needle" "$repo/README.md" \
    || fail "README.md does not document: $needle"
done

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check_api.py" "$there/"

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$repo" python3 "$there/check_api.py"); then
  fail "hidden API checks failed"
fi

echo "task 10 check passed"
