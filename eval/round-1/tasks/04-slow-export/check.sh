#!/usr/bin/env bash
# Check task 04: fixed summary code, generated artifact, tests green.
set -euo pipefail

repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$repo/out/summary.json" ]] \
  || fail "out/summary.json is missing; the export was not run after the fix"

python3 - "$repo/out/summary.json" <<'PY' || fail "generated summary has wrong values"
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    summary = json.load(handle)

assert summary.get("orders") == 4, summary
assert summary.get("total_cents") == 25500, summary
assert summary.get("top_customer") == "globex", summary
print("generated summary ok")
PY

if ! (cd -- "$repo" && node --test); then
  fail "node --test failed"
fi

if ! (cd -- "$repo" && FAST=1 node scripts/export.js); then
  fail "export failed in fast mode"
fi

python3 - "$repo/out/summary.json" <<'PY' || fail "regenerated summary has wrong values"
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    summary = json.load(handle)

assert summary.get("orders") == 4, summary
assert summary.get("total_cents") == 25500, summary
assert summary.get("top_customer") == "globex", summary
print("regenerated summary ok")
PY

echo "task 04 check passed"
