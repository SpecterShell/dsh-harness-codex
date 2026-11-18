#!/usr/bin/env bash
# Check task 03: literal prefix invalidation, TTL contract, frozen ADR.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cmp -s -- "$here/fixture/docs/adr-0007-cache-keys.md" "$repo/docs/adr-0007-cache-keys.md" \
  || fail "docs/adr-0007-cache-keys.md changed; the ADR is the specification"

there=$(mktemp -d "$repo/.round2-hidden.XXXXXX")
trap 'rm -rf -- "${there:?}"' EXIT
cp -- "$here/hidden/check-cache.mjs" "$there/"

if ! (cd -- "$repo" && node --test); then
  fail "node --test failed"
fi

if ! (cd -- "$repo" && node "$there/check-cache.mjs"); then
  fail "hidden cache checks failed"
fi

echo "task 03 check passed"
