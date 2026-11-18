/**
 * Prove native Session replacement vocabulary without a model or private log reads.
 * The public event feed captures original events for replay. These tests do not
 * claim a production compaction engine, atomic multi-node commit or disk durability.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { native, mount, english } from '../fixtures/native-host.ts'
import type { HostValue } from '../fixtures/native-host.ts'

const { Context } = await native('cordis')
const { SessionStore, Session, SessionId } = await native('dsh-session')
const { createUserMessage, createAssistantMessage, createToolResultMessage, ToolCallId } = await native('dsh-llm')
const { compactCheckpointSource, CompactionId, toolPairingBalancedBefore, toolPairingBalancedAfter } = await native('dsh-compaction')

/** Append original fixture input with native source identity and surface metadata. */
function user(session: HostValue, text: string) {
  return session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }), { surfaceOp: 'append' })
}

/** Observe only the tested session through public post-commit events. */
async function setup(t: TestContext) {
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, SessionStore)
  const events: HostValue[] = []
  host.on('session/event', (session: HostValue, event: HostValue) => {
    if (session.id === 'proof') events.push(event)
  })
  const session = host.sessions.create(SessionId('proof'))
  return { host, session, events }
}

/** Preserve the existing native checkpoint discriminator instead of text markers. */
function checkpoint(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: compactCheckpointSource(CompactionId('proof-compact')) })
}

/** Read model-visible text for small synthetic records without reaching into storage. */
function texts(session: HostValue): string[] {
  return session.deriveMessages().map((message: HostValue) => message.content.filter((block: HostValue) => block.type === 'text').map((block: HostValue) => block.text).join(''))
}

await test(english.tests.replacement, async t => {
  const { host, session, events } = await setup(t)
  const first = user(session, 'original-input')
  const callId = ToolCallId('proof-call')
  const assistant = session.append('assistant/message', {
    turn: 1, step: 1, stream: [],
    message: createAssistantMessage({ source: { provider: 'fixture', model: 'fixture' }, content: [{ type: 'tool-call', id: callId, name: 'fixture', arguments: '{}' }] }),
  }, { surfaceOp: 'append' })
  const result = session.append('tool/result', {
    turn: 1, step: 1,
    message: createToolResultMessage({ callId, content: [{ type: 'text', text: 'tool-evidence' }], isError: false }),
  }, { surfaceOp: 'append' })
  assert.equal(toolPairingBalancedAfter(session, assistant.seq), false)
  assert.equal(toolPairingBalancedBefore(session, first.seq), true)
  assert.equal(toolPairingBalancedAfter(session, result.seq), true)
  const originalEvents = events.slice()
  const originalBytes = JSON.stringify(originalEvents)
  const sourceEventSeqs = [...session.surface.nodes]
  const late = user(session, 'accepted-after-snapshot')
  session.append('user/message', checkpoint('summary'), {
    surfaceOp: { op: 'replace', startSeq: first.seq, endSeq: result.seq }, sourceEventSeqs,
  })
  assert.deepEqual(texts(session), ['summary', 'accepted-after-snapshot'])
  assert.equal(session.surface.nodes.at(-1), late.seq)
  assert.equal(JSON.stringify(originalEvents), originalBytes)
  assert.ok(Object.isFrozen(first.data))
  assert.ok(events.includes(first))
  const replay = Session.create(SessionId('replay'), JSON.parse(JSON.stringify(events)))
  assert.deepEqual(replay.deriveMessages(), session.deriveMessages())
  const child = host.sessions.fork(session, undefined, SessionId('fork'))
  assert.deepEqual(child.deriveMessages(), session.deriveMessages())
})

await test(english.tests.multiNode, async t => {
  const { session } = await setup(t)
  const first = user(session, 'selected-original')
  const last = user(session, 'old-tail')
  const late = user(session, 'accepted-after-snapshot')
  session.append('user/message', createUserMessage({ content: first.data.content, source: first.data.source }), {
    surfaceOp: { op: 'replace', startSeq: first.seq, endSeq: last.seq }, sourceEventSeqs: [first.seq, last.seq],
  })
  session.append('user/message', checkpoint('summary'), { surfaceOp: 'append' })
  assert.deepEqual(texts(session), ['selected-original', 'accepted-after-snapshot', 'summary'])
  assert.equal(session.surface.nodes[1], late.seq)
})

await test(english.tests.positional, async t => {
  const { host, session, events } = await setup(t)
  const first = user(session, 'old-input')
  const selected = user(session, 'selected-original')
  const late = user(session, 'accepted-after-snapshot')
  const commits: string[][] = []
  host.on('session/event', (owner: HostValue, event: HostValue) => {
    if (owner === session && typeof event.surfaceOp === 'object') commits.push(texts(owner))
  })
  session.append('user/message', createUserMessage({ content: selected.data.content, source: selected.data.source }), {
    surfaceOp: { op: 'replace', startSeq: first.seq, endSeq: first.seq }, sourceEventSeqs: [first.seq, selected.seq],
  })
  session.append('user/message', checkpoint('summary'), {
    surfaceOp: { op: 'replace', startSeq: selected.seq, endSeq: selected.seq }, sourceEventSeqs: [selected.seq],
  })
  assert.deepEqual(texts(session), ['selected-original', 'summary', 'accepted-after-snapshot'])
  assert.equal(session.surface.nodes.at(-1), late.seq)
  // An observer sees the intermediate state: this is deliberately no atomicity claim.
  assert.deepEqual(commits, [
    ['selected-original', 'selected-original', 'accepted-after-snapshot'],
    ['selected-original', 'summary', 'accepted-after-snapshot'],
  ])
  const replay = Session.create(SessionId('multi-replay'), JSON.parse(JSON.stringify(events)))
  assert.deepEqual(replay.deriveMessages(), session.deriveMessages())
})
