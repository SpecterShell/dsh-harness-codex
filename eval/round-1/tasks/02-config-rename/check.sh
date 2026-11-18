#!/usr/bin/env bash
# Check task 02: retryCount renamed to retry_count everywhere, behaviour intact.
set -euo pipefail

repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if grep -R -n --exclude-dir=.git --exclude-dir=node_modules "retryCount" "$repo"; then
  fail "retryCount still appears in the tree"
fi

grep -R -q --exclude-dir=.git --exclude-dir=node_modules "retry_count" "$repo/src" \
  || fail "retry_count not found in src"
grep -R -q --exclude-dir=.git --exclude-dir=node_modules "retry_count" "$repo/docs" \
  || fail "retry_count not found in docs"

if ! (cd -- "$repo" && node --test); then
  fail "node --test failed"
fi

if ! (cd -- "$repo" && node --input-type=module - <<'JS'
import assert from 'node:assert/strict'

import { Client } from './src/client.js'
import { DEFAULTS, loadConfig } from './src/config.js'

assert.equal(DEFAULTS.retry_count, 3)
assert.equal(DEFAULTS.timeoutMs, 5000)
assert.equal(loadConfig().retry_count, 3)
assert.equal(loadConfig({ retry_count: 9 }).retry_count, 9)
assert.equal(loadConfig({ timeoutMs: 100 }).timeoutMs, 100)
assert.throws(() => loadConfig({ retry_count: -1 }), /retry_count/)
assert.equal(new Client({ retry_count: 4 }).plan({ id: 'x' }).attempts, 4)
console.log('behaviour checks ok')
JS
); then
  fail "hidden behaviour checks failed"
fi

echo "task 02 check passed"
