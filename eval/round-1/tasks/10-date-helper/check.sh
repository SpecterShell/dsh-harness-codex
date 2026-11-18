#!/usr/bin/env bash
# Check task 10: one local-date helper, three call sites, timezone-correct.
set -euo pipefail

repo=${1:-$PWD}
[[ -d "$repo" ]] || { echo "no such work dir: $repo" >&2; exit 1; }
repo=$(cd -- "$repo" && pwd)

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$repo/src/lib/dates.js" ]] || fail "src/lib/dates.js is missing"

for file in src/reports/daily.js src/reports/monthly.js src/ui/dates.js; do
  [[ -f "$repo/$file" ]] || fail "$file is missing"
  grep -q "lib/dates.js" "$repo/$file" || fail "$file does not import from src/lib/dates.js"
  if grep -q "toISOString" "$repo/$file"; then
    fail "$file still formats through toISOString"
  fi
done

run_tests() {
  local zone=$1
  if [[ -n "$zone" ]]; then
    (cd -- "$repo" && TZ="$zone" node --test)
  else
    (cd -- "$repo" && node --test)
  fi
}

if ! run_tests ""; then
  fail "tests failed in the local timezone"
fi
if ! run_tests "Pacific/Auckland"; then
  fail "tests failed in Pacific/Auckland"
fi
if ! run_tests "America/Los_Angeles"; then
  fail "tests failed in America/Los_Angeles"
fi

if ! (cd -- "$repo" && TZ="Pacific/Auckland" node --input-type=module - <<'JS'
import assert from 'node:assert/strict'

import { formatDate as helperDate } from './src/lib/dates.js'
import { dailySummary, formatDate as dailyDate } from './src/reports/daily.js'
import { formatDate as monthlyDate, monthlySummary } from './src/reports/monthly.js'
import { formatDate as uiDate, shortDate } from './src/ui/dates.js'

const cases = [
  [new Date(2026, 0, 1, 0, 0), '2026-01-01'],
  [new Date(2026, 2, 4, 12, 0), '2026-03-04'],
  [new Date(2026, 11, 31, 23, 59), '2026-12-31']
]

for (const [date, expected] of cases) {
  assert.equal(helperDate(date), expected)
  assert.equal(dailyDate(date), expected)
  assert.equal(monthlyDate(date), expected)
  assert.equal(uiDate(date), expected)
}

assert.equal(shortDate(new Date(2026, 0, 1)), '2026/01/01')

const rows = [
  { createdAt: new Date(2026, 0, 1, 23, 30), totalCents: 100 },
  { createdAt: new Date(2026, 0, 1, 0, 10), totalCents: 250 },
  { createdAt: new Date(2026, 1, 1, 0, 10), totalCents: 50 }
]
assert.deepEqual(dailySummary(rows), [
  { date: '2026-01-01', totalCents: 350 },
  { date: '2026-02-01', totalCents: 50 }
])
assert.deepEqual(monthlySummary(rows), [
  { month: '2026-01', totalCents: 350 },
  { month: '2026-02', totalCents: 50 }
])
console.log('timezone behaviour ok')
JS
); then
  fail "hidden timezone checks failed"
fi

echo "task 10 check passed"
