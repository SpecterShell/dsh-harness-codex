/**
 * Prove the Codex-style compaction engine against DSH's real Session, token
 * meter, LLM runtime and `/compact` command. The model is a minimal registered
 * adapter, so every assertion is about local history shaping, not a provider.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { native, mount } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'
import * as compaction from '../src/compaction/index.ts'

const { Context } = await native('cordis')
const { SessionStore } = await native('dsh-session')
const {
  LlmRuntime,
  LlmAdapter,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createToolResultMessage,
  ToolCallId,
} = await native('dsh-llm')
const { TokenMeter } = await native('dsh-token-meter')
const { SessionProjectionRegistry } = await native('dsh-session-projection')
const { CommandRuntime } = await native('dsh-commands')
const commandCompact = await native('dsh-command-compact')

const COMPACT_PROMPT = await readFile(new URL('../prompts/codex/compact-prompt.md', import.meta.url), 'utf8')
const SUMMARY_PREFIX = await readFile(new URL('../prompts/codex/compact-summary-prefix.md', import.meta.url), 'utf8')

/** Rough Codex token count: UTF-8 bytes divided by four. */
function tokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4)
}

/** Record every summarization request and return one text summary. */
class FakeAdapter extends (LlmAdapter as new () => HostValue) {
  readonly requests: HostValue[] = []
  summary = 'The prior work is complete.'
  fail = false
  hold = false
  onStart: (() => void) | undefined
  contextWindow = 10

  async resolveModel(provider: string, model: string) {
    return { provider, id: model, name: model, context: { contextWindow: this.contextWindow } }
  }

  async *stream(options: HostValue) {
    this.requests.push(options)
    if (this.fail) throw new Error('summary backend failed')
    if (this.hold) {
      this.onStart?.()
      await new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    }
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: this.summary }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: this.summary } }
    yield { type: 'usage', usage: { inputTokens: 12, outputTokens: 4 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

/** Mount the real services the preset uses and register the fake model. */
async function setup(t: TestContext, contextWindow = 10) {
  const host = new Context() as HostValue
  t.after(() => host.fiber.dispose())
  await mount(host, SessionProjectionRegistry)
  await mount(host, SessionStore)
  await mount(host, LlmRuntime)
  await mount(host, TokenMeter)
  await mount(host, CommandRuntime)
  const adapter = new FakeAdapter()
  adapter.contextWindow = contextWindow
  host.llm.registerAdapter(['fake'], adapter)
  await mount(host, compaction)
  await mount(host, commandCompact)
  const session = host.sessions.create()
  session.append('request/header', {
    header: { config: { provider: 'fake', model: 'fake' } },
    reason: 'initial',
  })
  return { host, session, adapter }
}

/** A test Agent: the loop's own surface writes plus the maintenance seam. */
function agentFor(session: HostValue) {
  return {
    session,
    options: { provider: 'fake', model: 'fake' },
    runMaintenance: async (task: (signal: AbortSignal) => Promise<unknown>) => task(new AbortController().signal),
  }
}

function appendSystem(session: HostValue, text: string) {
  return session.append('system/message', {
    turn: 1,
    step: 1,
    message: createSystemMessage(text),
  }, { surfaceOp: 'append' })
}

function appendUser(session: HostValue, text: string) {
  return session.append('user/message', createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

function appendStep(session: HostValue, step: number, body: () => void) {
  session.append('step/start', { turn: 1, step })
  body()
  session.append('step/end', { turn: 1, step })
}

function appendAssistant(session: HostValue, text: string, step = 1) {
  return session.append('assistant/message', {
    turn: 1,
    step,
    stream: [],
    message: createAssistantMessage({
      source: { provider: 'fake', model: 'fake' },
      content: [{ type: 'text', text }],
    }),
  }, { surfaceOp: 'append' })
}

/** Model-visible text, one string per derived message. */
function texts(session: HostValue): string[] {
  return session.deriveMessages().map((message: HostValue) =>
    message.content
      .filter((block: HostValue) => block.type === 'text')
      .map((block: HostValue) => block.text)
      .join(''),
  )
}

/** Dispatch the real pre-step waterfall so pressure policy runs its listener. */
async function preStep(host: HostValue, session: HostValue) {
  return host.waterfall('agent/pre-step', {
    agent: agentFor(session),
    signal: new AbortController().signal,
  }, async () => ({ kind: 'enter', messages: [] }))
}

/** True when the text is one of this backend's checkpoint summaries. */
function isSummary(text: string): boolean {
  return text.startsWith(`${SUMMARY_PREFIX}\n`)
}

await test('pressure compaction keeps original user text plus the Codex summary', async t => {
  const { host, session, adapter } = await setup(t, 100)
  appendSystem(session, 'SYSTEM PROMPT')
  appendUser(session, 'alpha '.repeat(40))
  appendUser(session, 'beta '.repeat(40))
  // Dropped bulk so the summary is smaller than what it replaces.
  appendStep(session, 1, () => appendAssistant(session, 'noise '.repeat(2000), 1))
  const originals = session.snapshotEvents().filter((event: HostValue) => event.type === 'user/message')

  await preStep(host, session)

  const visible = texts(session)
  assert.equal(visible[0], 'SYSTEM PROMPT')
  assert.equal(visible[1], 'alpha '.repeat(40))
  assert.equal(visible[2], 'beta '.repeat(40))
  assert.equal(visible[3], `${SUMMARY_PREFIX}\n${adapter.summary}`)
  const summary = session.deriveMessages().at(-1)
  assert.equal(summary.role, 'user')
  assert.equal(summary.source.kind, 'compact-checkpoint')
  assert.equal(adapter.requests.length, 1)
  assert.equal(adapter.requests[0].purpose, 'compaction')
  assert.equal(adapter.requests[0].messages.at(-1).content[0].text, COMPACT_PROMPT)
  const log = session.snapshotEvents()
  assert.ok(
    log.some((event: HostValue) => event.seq === originals[0].seq),
    'original events stay in the log',
  )
  assert.equal(
    log.filter((event: HostValue) => event.type === 'user/message').length,
    originals.length + 3,
    'two copied user messages and one summary are appended, originals are not rewritten',
  )
})

await test('kept user messages use the newest-first 20,000-token budget and keep chronology', async t => {
  const { host, session } = await setup(t, 10)
  appendSystem(session, 'S')
  const first = `first ${'word '.repeat(6000)}`
  const second = `second ${'word '.repeat(6000)}`
  const third = `third ${'word '.repeat(6000)}`
  const fourth = `fourth ${'word '.repeat(6000)}`
  appendUser(session, first)
  appendUser(session, second)
  appendUser(session, third)
  appendUser(session, fourth)

  await preStep(host, session)

  const visible = texts(session)
  assert.equal(visible[0], 'S')
  assert.equal(visible.length, 5, 'system, three kept users, summary')
  assert.ok(visible[1].startsWith('second '), 'the oldest kept message is the second user message')
  assert.ok(visible[1].includes('tokens truncated'), 'the budget boundary message is truncated')
  assert.equal(visible[2], third)
  assert.equal(visible[3], fourth)
  assert.ok(isSummary(visible[4]))
  assert.ok(!visible.some(text => text.startsWith('first ')), 'the message beyond the budget is dropped')
  const keptTokens = visible.slice(1, 4).reduce((total, text) => total + tokens(text), 0)
  assert.ok(keptTokens <= 20_000 + tokens('…0 tokens truncated…') + 8, `kept text stays near the budget: ${keptTokens}`)

  // A second compaction replaces the previous summary instead of keeping it as a user message.
  await preStep(host, session)
  const again = texts(session)
  assert.equal(again.length, 5)
  assert.equal(again.filter(isSummary).length, 1)
  assert.ok(again[1].startsWith('second '))
  assert.equal(again[2], third)
  assert.equal(again[3], fourth)
})

await test('tool results are not kept in the compacted context', async t => {
  const { host, session } = await setup(t, 10)
  appendSystem(session, 'S')
  appendUser(session, 'inspect the file')
  const callId = ToolCallId('compaction-call')
  appendStep(session, 1, () => {
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      stream: [],
      message: createAssistantMessage({
        source: { provider: 'fake', model: 'fake' },
        content: [{ type: 'tool-call', id: callId, name: 'exec_command', arguments: '{}' }],
      }),
    }, { surfaceOp: 'append' })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId,
        content: [{ type: 'text', text: 'tool evidence that must not survive' }],
        isError: false,
      }),
    }, { surfaceOp: 'append' })
  })
  appendUser(session, 'now summarize it')
  // Dropped bulk so the summary is smaller than what it replaces.
  appendStep(session, 2, () => appendAssistant(session, `done ${'noise '.repeat(2000)}`, 2))

  await preStep(host, session)

  const messages = session.deriveMessages()
  assert.ok(messages.every((message: HostValue) => message.role !== 'tool'), 'no tool result node survives')
  assert.ok(!texts(session).some(text => text.includes('tool evidence')), 'tool output text is gone')
  assert.deepEqual(texts(session).slice(0, 3), ['S', 'inspect the file', 'now summarize it'])
  assert.ok(isSummary(texts(session)[3]))
})

await test('a failed summary keeps the last valid context', async t => {
  const { host, session, adapter } = await setup(t, 10)
  appendSystem(session, 'S')
  appendUser(session, 'keep me')
  const before = texts(session)
  adapter.fail = true

  await assert.rejects(
    host.compaction.compactIfNeeded(agentFor(session), 'pressure', new AbortController().signal),
    /summary/,
  )
  assert.deepEqual(texts(session), before)
  const tail = session.snapshotEvents().slice(-2)
  assert.deepEqual(tail.map((event: HostValue) => event.type), ['compaction/start', 'compaction/end'])
  assert.equal(typeof tail[1].data.error, 'string')
})

await test('cancellation during summarization keeps the last valid context', async t => {
  const { host, session, adapter } = await setup(t, 10)
  appendSystem(session, 'S')
  appendUser(session, 'keep me too')
  const before = texts(session)
  adapter.hold = true
  const started = new Promise<void>(resolve => {
    adapter.onStart = resolve
  })
  const controller = new AbortController()
  const running = host.compaction.compactNow(agentFor(session), controller.signal)
  await started
  controller.abort(new Error('cancelled during summary'))

  await assert.rejects(running, /cancelled during summary/)
  assert.deepEqual(texts(session), before)
})

await test('/compact keeps working through the same engine', async t => {
  const { host, session } = await setup(t, 1_000_000)
  appendSystem(session, 'S')
  appendUser(session, 'command request')
  appendStep(session, 1, () => appendAssistant(session, 'command reply'))

  const execution = await host.commands.execute(
    agentFor(session),
    '/compact',
    [],
    new AbortController().signal,
  )
  assert.equal(execution.result.kind, 'success')
  assert.match(execution.result.text, /^Compacted \d+ history items/)
  assert.deepEqual(texts(session).slice(0, 2), ['S', 'command request'])
  assert.ok(isSummary(texts(session)[2]))
})
