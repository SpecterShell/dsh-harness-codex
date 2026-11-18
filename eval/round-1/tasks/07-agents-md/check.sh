#!/usr/bin/env bash
# Check task 07: new route follows the nested AGENTS.md rules, vendor untouched.
set -euo pipefail

here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

if ! diff -rq -- "$here/fixture/vendor" "$repo/vendor" >/dev/null; then
  fail "vendor/ changed; both AGENTS.md files say it must stay untouched"
fi

if ! (cd -- "$repo" && node --test); then
  fail "the test suite failed"
fi

if ! (cd -- "$repo" && node --input-type=module - <<'JS'
import assert from 'node:assert/strict'

import { handle } from './packages/api/src/index.js'

const found = handle('GET', '/users/1')
assert.equal(found.status, 200)
assert.equal(found.body.data.id, '1')
assert.equal(found.body.data.name, 'Ada')
assert.equal(found.body.error, null)

const missing = handle('GET', '/users/999')
assert.equal(missing.status, 404)
assert.equal(missing.body.data, null)
assert.ok(missing.body.error, 'expected a non-empty error')

const health = handle('GET', '/health')
assert.equal(health.status, 200)
assert.equal(health.body.error, null)
console.log('route behaviour ok')
JS
); then
  fail "route behaviour checks failed"
fi

grep -R -q "users" "$repo/packages/api/test" \
  || fail "no test under packages/api/test mentions the users route"

python3 - "$repo/packages/api/CHANGELOG.md" <<'PY' || fail "CHANGELOG.md Unreleased section does not record the route"
import sys

text = open(sys.argv[1], encoding="utf-8").read()
assert "## Unreleased" in text, text
unreleased = text.split("## Unreleased", 1)[1].split("\n## ", 1)[0]
assert "/users/" in unreleased, unreleased
print("changelog ok")
PY

echo "task 07 check passed"
