#!/usr/bin/env bash
# Check task 07: schema-driven offline validation, no installs, notes.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/package.json" "$repo/package.json" \
  || fail "package.json changed; no dependency may be added"
[[ ! -e "$repo/package-lock.json" ]] || fail "package-lock.json was created"
[[ ! -d "$repo/node_modules" ]] || fail "node_modules was installed"

[[ -f "$repo/NOTES.md" ]] || fail "NOTES.md is missing"
grep -Fq 'schemas.example.invalid' "$repo/NOTES.md" \
  || fail "NOTES.md does not name the canonical schema URL"
grep -Eqi 'offline|no network|unreachable|not fetched|not downloaded' "$repo/NOTES.md" \
  || fail "NOTES.md does not say the canonical schema was not fetched"
grep -Eqi '(no new|no|unchanged|not added)[^.]*dependenc|dependenc[^.]*(unchanged|not added)' "$repo/NOTES.md" \
  || fail "NOTES.md does not say no dependency was added"

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check-validator.mjs" "$there/"
cp -- "$here/hidden/good.csv" "$there/"
cp -- "$here/hidden/bad.csv" "$there/"

if ! (cd -- "$repo" && node --test); then
  fail "node --test failed"
fi

if ! (cd -- "$repo" && node "$there/check-validator.mjs"); then
  fail "hidden validator checks failed"
fi

echo "task 07 check passed"
