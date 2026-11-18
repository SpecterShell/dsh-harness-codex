import test from 'node:test'
import assert from 'node:assert/strict'

import { handle } from '../src/server.js'

test('root health returns the envelope', () => {
  const response = handle('GET', '/health')
  assert.equal(response.status, 200)
  assert.equal(response.body.data.status, 'ok')
  assert.equal(response.body.error, null)
})

test('root unknown route is a 404 envelope', () => {
  const response = handle('GET', '/nope')
  assert.equal(response.status, 404)
  assert.equal(response.body.data, null)
  assert.equal(typeof response.body.error, 'string')
})
