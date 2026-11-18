import test from 'node:test'
import assert from 'node:assert/strict'

import { dailySummary, formatDate as dailyDate } from '../src/reports/daily.js'
import { formatDate as monthlyDate, monthlySummary } from '../src/reports/monthly.js'
import { formatDate as uiDate, shortDate } from '../src/ui/dates.js'

const januaryFirst = new Date(2026, 0, 1, 0, 0, 0)

test('daily formatter uses the local calendar date', () => {
  assert.equal(dailyDate(januaryFirst), '2026-01-01')
})

test('monthly formatter uses the local calendar date', () => {
  assert.equal(monthlyDate(januaryFirst), '2026-01-01')
})

test('ui formatter uses the local calendar date', () => {
  assert.equal(uiDate(januaryFirst), '2026-01-01')
})

test('shortDate uses the local calendar date', () => {
  assert.equal(shortDate(januaryFirst), '2026/01/01')
})

test('daily summary groups by local day', () => {
  const rows = [
    { createdAt: new Date(2026, 0, 1, 23, 30), totalCents: 100 },
    { createdAt: new Date(2026, 0, 1, 0, 10), totalCents: 250 },
    { createdAt: new Date(2026, 0, 2, 12, 0), totalCents: 50 }
  ]
  assert.deepEqual(dailySummary(rows), [
    { date: '2026-01-01', totalCents: 350 },
    { date: '2026-01-02', totalCents: 50 }
  ])
})

test('monthly summary groups by local month', () => {
  const rows = [
    { createdAt: new Date(2026, 0, 31, 23, 30), totalCents: 100 },
    { createdAt: new Date(2026, 1, 1, 0, 10), totalCents: 250 }
  ]
  assert.deepEqual(monthlySummary(rows), [
    { month: '2026-01', totalCents: 100 },
    { month: '2026-02', totalCents: 250 }
  ])
})
