import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSummary } from '../lib/summary.js'

const rows = [
  { order_id: 1001, customer: 'acme', quantity: 2, unit_price_cents: 1500 },
  { order_id: 1002, customer: 'globex', quantity: 1, unit_price_cents: 9900 },
  { order_id: 1003, customer: 'acme', quantity: 3, unit_price_cents: 1200 },
  { order_id: 1004, customer: 'initech', quantity: 2, unit_price_cents: 4500 }
]

test('total includes quantity', () => {
  assert.equal(buildSummary(rows).total_cents, 25500)
})

test('top customer is the highest spend', () => {
  assert.equal(buildSummary(rows).top_customer, 'globex')
})

test('order count is the row count', () => {
  assert.equal(buildSummary(rows).orders, 4)
})
