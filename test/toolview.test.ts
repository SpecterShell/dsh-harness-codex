/**
 * Behavior tests for the conversation-row models.
 *
 * The model module is pure (no React, no browser module table), so these
 * tests drive it with the block shapes the slot runtime passes: preparing and
 * started calls, and settled results built from Codex's text envelope.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { execModel, formatDuration, parseProcessStatus, patchSummary, planItems, resultDiffs } from '../src/client-toolview-model.ts'
import type { ArgsAccessor, ResultBlock, StreamingBlock } from '../src/client-toolview-model.ts'

/** Build the argument accessor the slot runtime ships. */
function argsOf(values: Record<string, string>): ArgsAccessor {
  return {
    has: key => key in values,
    complete: () => true,
    text: key => values[key],
  }
}

/** A started (unsettled) call block. */
function runningBlock(name: string, values: Record<string, string>): StreamingBlock {
  return { phase: 'start', callId: 'fc_1', name, args: argsOf(values), argsRaw: JSON.stringify(values), time: 1_000 }
}

/** A settled result whose content is the exact Codex envelope text. */
function resultBlock(text: string, extra?: Partial<ResultBlock>): ResultBlock {
  return {
    kind: 'tool-result',
    callId: 'fc_1',
    call: { name: 'exec_command', argsRaw: '{"cmd":"ls"}' },
    args: argsOf({ cmd: 'ls' }),
    content: [{ type: 'text', text }],
    isError: false,
    ...extra,
  }
}

test('parseProcessStatus reads the exit header, wall time, and body', () => {
  const status = parseProcessStatus('Wall time: 0.3812 seconds\nProcess exited with code 0\nOutput:\nhello\n')
  assert.equal(status.exitCode, 0)
  assert.equal(status.sessionId, undefined)
  assert.equal(status.wallSeconds, 0.3812)
  assert.equal(status.output, 'hello\n')
})

test('parseProcessStatus reads the session marker of a still-running process', () => {
  const status = parseProcessStatus('Chunk ID: 219bc8\nWall time: 29.9992 seconds\nProcess running with session ID 74779\nOutput:\npartial\n')
  assert.equal(status.exitCode, undefined)
  assert.equal(status.sessionId, '74779')
  assert.equal(status.wallSeconds, 29.9992)
  assert.equal(status.output, 'partial\n')
})

test('a settled session result never claims the process still runs', () => {
  // A Host restart kills every process a historical result names, so the row
  // keeps the session id as information instead of a liveness claim.
  const model = execModel('write_stdin', resultBlock(
    'Wall time: 30.0000 seconds\nProcess running with session ID 74779\nOutput:\n',
    { call: { name: 'write_stdin', argsRaw: '{"session_id":74779,"chars":""}' } },
  ), 'Poll session')
  assert.equal(model.state, 'ok')
  assert.equal(model.processRunning, false)
  assert.equal(model.sessionId, '74779')
  assert.equal(model.wallSeconds, 30)
})

test('an unsettled call keeps the running presentation', () => {
  const model = execModel('exec_command', runningBlock('exec_command', { cmd: 'sleep 60' }), 'Poll session')
  assert.equal(model.state, 'running')
  assert.equal(model.processRunning, true)
  assert.equal(model.sessionId, undefined)
})

test('a non-zero exit turns the row red with the code and wall time', () => {
  const model = execModel('exec_command', resultBlock('Wall time: 1.5000 seconds\nProcess exited with code 2\nOutput:\nno\n'), 'Poll session')
  assert.equal(model.state, 'error')
  assert.equal(model.exitCode, 2)
  assert.equal(model.wallSeconds, 1.5)
})

test('an interrupted call presents as stopped', () => {
  const model = execModel('exec_command', resultBlock('', { isError: true, error: { code: 'interrupted' } }), 'Poll session')
  assert.equal(model.state, 'stopped')
  assert.equal(model.processRunning, false)
})

test('formatDuration compacts sub-second, second, and minute spans', () => {
  assert.equal(formatDuration(0.3812), '381ms')
  assert.equal(formatDuration(1.5), '1.5s')
  assert.equal(formatDuration(29.9992), '30s')
  assert.equal(formatDuration(65), '1m 05s')
  assert.equal(formatDuration(Number.NaN), '')
})

test('resultDiffs narrows presentation metadata and rejects other shapes', () => {
  const block = resultBlock('', {
    meta: { diffs: [{ path: 'a.ts', oldText: 'x', newText: 'y' }], stopped: false },
  })
  assert.deepEqual(resultDiffs(block), [{ path: 'a.ts', oldText: 'x', newText: 'y' }])
  assert.deepEqual(resultDiffs(resultBlock('')), [])
  assert.deepEqual(resultDiffs(resultBlock('', { meta: { diffs: [] } })), [])
  assert.deepEqual(resultDiffs(runningBlock('apply_patch', { input: '*** Begin Patch' })), [])
})

test('patchSummary prefers diff paths and falls back to the status line', () => {
  const withDiffs = resultBlock('', { meta: { diffs: [{ path: 'a.ts', oldText: null, newText: 'y' }, { path: 'a.ts', oldText: 'x', newText: 'z' }] } })
  assert.equal(patchSummary(withDiffs, resultDiffs(withDiffs)), 'a.ts')
  const textOnly = resultBlock('Success. Updated the following files:\nM a.ts')
  assert.equal(patchSummary(textOnly, resultDiffs(textOnly)), 'Success. Updated the following files:')
  assert.equal(patchSummary(runningBlock('apply_patch', {}), []), '')
})

test('planItems reads the plan array from raw arguments', () => {
  const block = resultBlock('', {
    call: { name: 'update_plan', argsRaw: '{"plan":[{"step":"a","status":"completed"},{"step":"b","status":"in_progress"}]}' },
  })
  assert.deepEqual(planItems(block), [
    { step: 'a', status: 'completed' },
    { step: 'b', status: 'in_progress' },
  ])
})
