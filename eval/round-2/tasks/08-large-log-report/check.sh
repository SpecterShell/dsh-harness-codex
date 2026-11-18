#!/usr/bin/env bash
# Check task 08: streaming report correctness, big log artifact, frozen files.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/ops/legacy_report.py" "$repo/ops/legacy_report.py" \
  || fail "ops/legacy_report.py changed; the audit copy is frozen"
gzip -dc -- "$here/fixture/logs/service.log.gz" | cmp -s -- - "$repo/logs/service.log" \
  || fail "logs/service.log changed; the log is the input, not a place to fix counts"

[[ -f "$repo/out/report.json" ]] \
  || fail "out/report.json is missing; the report was not run after the fix"

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check_report.py" "$there/"
cp -- "$here/hidden/expected.json" "$there/"
cp -- "$here/hidden/mini.log" "$there/"
cp -- "$here/hidden/mini-expected.json" "$there/"

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests); then
  fail "unit tests failed"
fi

if ! (cd -- "$repo" && PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$repo" python3 "$there/check_report.py"); then
  fail "hidden report checks failed"
fi

echo "task 08 check passed"
