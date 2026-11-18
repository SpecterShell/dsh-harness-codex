import test from 'node:test'
import assert from 'node:assert/strict'

import { Client } from '../src/client.js'
import { DEFAULTS, loadConfig } from '../src/config.js'

test('defaults are stable', () => {
  assert.equal(DEFAULTS.retryCount, 3)
  assert.equal(DEFAULTS.timeoutMs, 5000)
  assert.equal(DEFAULTS.endpoint, 'https://notify.invalid')
})

test('overrides replace the default retry count', () => {
  const config = loadConfig({ retryCount: 7 })
  assert.equal(config.retryCount, 7)
})

test('client plans one attempt per retry', () => {
  const plan = new Client({ retryCount: 2 }).plan({ id: 'evt-1' })
  assert.equal(plan.attempts, 2)
  assert.equal(plan.payload.id, 'evt-1')
})

test('negative retry counts are rejected', () => {
  assert.throws(() => loadConfig({ retryCount: -1 }), /retryCount/)
})

test('timeouts are still validated', () => {
  assert.throws(() => loadConfig({ timeoutMs: 0 }), /timeoutMs/)
})
