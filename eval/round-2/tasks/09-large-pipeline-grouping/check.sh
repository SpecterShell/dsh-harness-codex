#!/usr/bin/env bash
# Check task 09: grouping in report and export, defaults untouched, legacy frozen.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/src/legacy/report-v1.js" "$repo/src/legacy/report-v1.js" \
  || fail "src/legacy/report-v1.js changed; the audit copy is frozen"
cmp -s -- "$here/fixture/data/sales.csv" "$repo/data/sales.csv" \
  || fail "data/sales.csv changed; the CSV is test input"

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
for file in check-grouping.mjs default-report.txt default-export.json grouped-report.txt \
            grouped-export.json edge.csv edge-report.txt edge-export.json; do
  cp -- "$here/hidden/$file" "$there/"
done

if ! (cd -- "$repo" && node --test); then
  fail "node --test failed"
fi

# The default export is written by the check, then compared field by field.
if ! (cd -- "$repo" && node src/cli.js export --data data/sales.csv --out "$there/current-default.json"); then
  fail "default export failed"
fi

if ! (cd -- "$repo" && node "$there/check-grouping.mjs"); then
  fail "hidden grouping checks failed"
fi

echo "task 09 check passed"
