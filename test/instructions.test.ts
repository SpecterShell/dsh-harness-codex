/**
 * Prove the Codex project-document chain: first-present candidates per
 * directory, root-marker discovery, root-to-cwd order, the UTF-8 byte budget,
 * and the step message that joins it to DSH's user-level instructions.
 *
 * The integration case mounts the real native `agent-instructions` row with
 * project candidates off, the real host services, and this package's
 * `instructions` row, then drives the real `agent/pre-step` waterfall.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'
import { readProjectInstructions } from '../src/instructions.ts'

const { Context } = await native('cordis')
const { LocalFileSystem } = await native('dsh-fs-local')
const { SystemPrompt } = await native('dsh-system-prompt')
const { SessionStore } = await native('dsh-session')
const { SessionProjectionRegistry } = await native('dsh-session-projection')
const { AgentRegistry } = await native('dsh-agent')
const { WorkingDirectoryService } = await native('dsh-working-directory')
const agentInstructions = await native('dsh-agent-instructions')
const projectInstructions = await import('../src/instructions.ts')

/** Mount the real local filesystem service for one temp root. */
async function filesystem(t: TestContext, cwd: string): Promise<HostValue> {
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, LocalFileSystem, { cwd })
  return host.fs
}

/** Read the model-facing text of one session message. */
function messageText(message: HostValue): string {
  return message.content
    .filter((block: HostValue) => block.type === 'text')
    .map((block: HostValue) => block.text)
    .join('')
}

/** Count non-overlapping literal occurrences for duplicate assertions. */
function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1
}

/** A minimal inbox the native instruction row can read and mutate. */
function createInbox() {
  const messages: HostValue[] = []
  return {
    get nextStep(): HostValue[] {
      return messages
    },
    prepend(_boundary: string, message: HostValue): void {
      messages.unshift(message)
    },
    remove(id: string): void {
      const index = messages.findIndex((message) => message.id === id)
      if (index >= 0) messages.splice(index, 1)
    },
    replace(id: string, message: HostValue): void {
      const index = messages.findIndex((candidate) => candidate.id === id)
      if (index >= 0) messages.splice(index, 1, message)
    },
  }
}

/** One real host, one session, and a step function over the real waterfall. */
async function harness(t: TestContext) {
  const root = await temporary(t)
  const repo = join(root, 'repo')
  const nested = join(repo, 'nested')
  const dshHome = join(root, 'dsh-home')
  const agentsHome = join(root, 'agents-home')
  for (const directory of [join(repo, '.git'), nested, dshHome, agentsHome]) await mkdir(directory, { recursive: true })
  await writeFile(join(dshHome, 'AGENTS.md'), 'USER_GLOBAL_SENTINEL')
  await writeFile(join(repo, 'AGENTS.override.md'), 'ROOT_OVERRIDE_SENTINEL')
  await writeFile(join(repo, 'AGENTS.md'), 'ROOT_BASE_SENTINEL')
  await writeFile(join(nested, 'AGENTS.md'), 'CHILD_BASE_SENTINEL')

  const previousHome = process.env.DSH_HOME
  const previousAgentsHome = process.env.DSH_AGENTS_HOME
  process.env.DSH_HOME = dshHome
  process.env.DSH_AGENTS_HOME = agentsHome
  t.after(() => {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousAgentsHome === undefined) delete process.env.DSH_AGENTS_HOME
    else process.env.DSH_AGENTS_HOME = previousAgentsHome
  })

  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, SystemPrompt, { includeHarnessIdentity: false })
  await mount(host, SessionStore)
  await mount(host, SessionProjectionRegistry)
  await mount(host, AgentRegistry)
  await mount(host, LocalFileSystem, { cwd: nested })
  await mount(host, WorkingDirectoryService, { defaultDirectory: nested })
  // The shipping native row keeps only user-global instructions.
  await mount(host, agentInstructions, {
    maxBytes: 32768,
    instructionFileCandidates: [],
    localInstructionFileCandidates: [],
  })
  await mount(host, projectInstructions, { maxBytes: 32768 })

  const session = host.sessions.create('project-instructions-agent', { meta: { cwd: nested } })
  const agent: HostValue = {
    id: session.id,
    session,
    options: {},
    inbox: createInbox(),
    // The working-directory service asserts the Agent's owning fiber is live.
    ctx: { fiber: { assertActive: (): void => {} } },
  }
  const remove = await host.agents.register(agent)
  t.after(() => remove())

  /** Enter one step and commit the messages it decided, as the loop does. */
  async function step(number: number): Promise<HostValue[]> {
    const decision = await host.waterfall(agent, 'agent/pre-step', {
      agent,
      messages: [],
      turn: 1,
      step: number,
      signal: new AbortController().signal,
      modelSelection: {},
    }, async () => ({ kind: 'enter', messages: [] }))
    assert.equal(decision.kind, 'enter')
    for (const message of decision.messages) session.append('user/message', message, { surfaceOp: 'append' })
    return decision.messages
  }

  return { repo, nested, session, step }
}

await test('an override alone is used', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  await mkdir(join(root, '.git'))
  await writeFile(join(root, 'AGENTS.override.md'), 'override')
  const result = await readProjectInstructions({ cwd: root, fs, maxBytes: 32768 })
  assert.deepEqual(result.files.map((file) => file.content), ['override'])
})

await test('a base file alone is used', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  await mkdir(join(root, '.git'))
  await writeFile(join(root, 'AGENTS.md'), 'base')
  const result = await readProjectInstructions({ cwd: root, fs, maxBytes: 32768 })
  assert.deepEqual(result.files.map((file) => file.content), ['base'])
})

await test('both names in one directory load only the override', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  await mkdir(join(root, '.git'))
  await writeFile(join(root, 'AGENTS.override.md'), 'override')
  await writeFile(join(root, 'AGENTS.md'), 'base')
  const result = await readProjectInstructions({ cwd: root, fs, maxBytes: 32768 })
  assert.deepEqual(result.files.map((file) => file.content), ['override'])
})

await test('configured fallback filenames come after AGENTS.md', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  await mkdir(join(root, '.git'))
  await writeFile(join(root, 'TEAM.md'), 'team')
  const fallback = await readProjectInstructions({ cwd: root, fs, maxBytes: 32768, fallbackFilenames: ['TEAM.md'] })
  assert.deepEqual(fallback.files.map((file) => file.content), ['team'])

  await writeFile(join(root, 'AGENTS.md'), 'base')
  const base = await readProjectInstructions({ cwd: root, fs, maxBytes: 32768, fallbackFilenames: ['TEAM.md', 'nested/TEAM.md'] })
  assert.deepEqual(base.files.map((file) => file.content), ['base'])
})

await test('the project root marker bounds the walk', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  const repo = join(root, 'repo')
  const nested = join(repo, 'nested')
  await mkdir(join(repo, '.git'), { recursive: true })
  await mkdir(nested, { recursive: true })
  await writeFile(join(repo, 'AGENTS.md'), 'root')
  await writeFile(join(nested, 'AGENTS.md'), 'nested')

  const marked = await readProjectInstructions({ cwd: nested, fs, maxBytes: 32768 })
  assert.deepEqual(marked.files.map((file) => file.content), ['root', 'nested'])

  // No marker above the cwd means the cwd alone, never its parent.
  const plain = join(root, 'plain')
  const child = join(plain, 'child')
  await mkdir(child, { recursive: true })
  await writeFile(join(plain, 'AGENTS.md'), 'parent')
  await writeFile(join(child, 'AGENTS.md'), 'child')
  // This machine has /tmp/.git, so use a marker that cannot appear above cwd.
  const unmarked = await readProjectInstructions({
    cwd: child,
    fs,
    maxBytes: 32768,
    projectRootMarkers: ['.absent-project-root-marker'],
  })
  assert.deepEqual(unmarked.files.map((file) => file.content), ['child'])
})

await test('nested directories are ordered from root to cwd', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  const middle = join(root, 'middle')
  const leaf = join(middle, 'leaf')
  await mkdir(join(root, '.git'), { recursive: true })
  await mkdir(leaf, { recursive: true })
  await writeFile(join(root, 'AGENTS.md'), 'root')
  await writeFile(join(middle, 'AGENTS.md'), 'middle')
  await writeFile(join(leaf, 'AGENTS.md'), 'leaf')
  const result = await readProjectInstructions({ cwd: leaf, fs, maxBytes: 32768 })
  assert.deepEqual(result.files.map((file) => file.content), ['root', 'middle', 'leaf'])
})

await test('the 32 KiB budget counts UTF-8 bytes and never splits a character', async t => {
  const root = await temporary(t)
  const fs = await filesystem(t, root)
  const nested = join(root, 'nested')
  await mkdir(join(root, '.git'), { recursive: true })
  await mkdir(nested, { recursive: true })
  // 12000 * 3 = 36000 bytes, so the root file alone exceeds the budget.
  await writeFile(join(root, 'AGENTS.md'), '中'.repeat(12000))
  await writeFile(join(nested, 'AGENTS.md'), 'b'.repeat(20000))
  const result = await readProjectInstructions({ cwd: nested, fs, maxBytes: 32768 })
  assert.equal(result.files.length, 2)
  const [first, second] = result.files
  assert.ok(first)
  assert.ok(second)
  assert.equal(Buffer.byteLength(first.content, 'utf8'), 32766)
  assert.ok(first.content.endsWith('中'))
  assert.ok(!first.content.includes('\uFFFD'))
  assert.equal(second.content, 'bb')
  assert.equal(result.files.reduce((total, file) => total + Buffer.byteLength(file.content, 'utf8'), 0), 32768)
  assert.equal(Buffer.byteLength(result.text, 'utf8'), 32770)
  const disabled = await readProjectInstructions({ cwd: nested, fs, maxBytes: 0 })
  assert.deepEqual(disabled, { text: '', files: [] })
})

await test('project docs join the user-level instructions in one step', { timeout: 30000 }, async t => {
  const { repo, nested, session, step } = await harness(t)
  const first = await step(2)
  assert.equal(first.length, 2, 'the native row adds the global file and this row adds the project files')
  assert.deepEqual(first.map((message) => message.source.kind), ['agent-instructions', 'project-instructions'])
  const prompts = first.map(messageText)
  const project = prompts[1]!
  assert.equal(occurrences(prompts.join('\n'), 'USER_GLOBAL_SENTINEL'), 1)
  assert.equal(occurrences(project, 'ROOT_OVERRIDE_SENTINEL'), 1)
  assert.equal(occurrences(project, 'ROOT_BASE_SENTINEL'), 0)
  assert.equal(occurrences(project, 'CHILD_BASE_SENTINEL'), 1)
  assert.ok(project.indexOf('ROOT_OVERRIDE_SENTINEL') < project.indexOf('CHILD_BASE_SENTINEL'))
  assert.match(project, /--- project-doc ---/)

  const before = JSON.stringify(session.deriveMessages())
  assert.deepEqual(await step(3), [], 'unchanged files add no message')
  assert.equal(JSON.stringify(session.deriveMessages()), before, 'the prompt stays byte-identical')
  const all = session.deriveMessages().map(messageText).join('\n')
  assert.equal(occurrences(all, 'USER_GLOBAL_SENTINEL'), 1)
  assert.equal(occurrences(all, 'ROOT_OVERRIDE_SENTINEL'), 1)

  // A changed project file replaces the visible docs with one new message.
  await writeFile(join(nested, 'AGENTS.md'), 'CHILD_REFRESHED_SENTINEL')
  const refreshed = await step(4)
  assert.equal(refreshed.length, 1)
  assert.equal(refreshed[0]!.source.kind, 'project-instructions')
  assert.match(messageText(refreshed[0]!), /replace all previously provided/)
  assert.match(messageText(refreshed[0]!), /CHILD_REFRESHED_SENTINEL/)
  assert.doesNotMatch(messageText(refreshed[0]!), /CHILD_BASE_SENTINEL/)

  // Removing every project file leaves one removal notice and then silence.
  for (const path of [join(repo, 'AGENTS.override.md'), join(repo, 'AGENTS.md'), join(nested, 'AGENTS.md')]) await rm(path)
  const removed = await step(5)
  assert.equal(removed.length, 1)
  assert.match(messageText(removed[0]!), /no longer apply/)
  assert.deepEqual(await step(6), [], 'the removal notice is not repeated')
})
