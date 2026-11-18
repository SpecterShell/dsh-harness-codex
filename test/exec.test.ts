/**
 * Behavior tests for the Codex-style unified exec tools.
 *
 * These mount the real local subprocess and shell services, the real tool
 * registry, and then call the registered definitions' `execute` directly. The
 * tests therefore exercise the same process, output, and ownership paths the
 * model would, without a model or a deployed profile.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'

const { Context } = await native('cordis')
const { LocalSubprocessRuntime } = await native('dsh-subprocess-local')
const { LocalBashExecutor } = await native('dsh-bash-local')
const { SystemPrompt } = await native('dsh-system-prompt')
const { ToolsService } = await native('dsh-tools')
const plugin = await import('../src/exec/index.ts')

/** Own native providers in the test context so failures still terminate children. */
async function runtime(t: TestContext) {
  const cwd = await temporary(t)
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, LocalSubprocessRuntime)
  await mount(host, LocalBashExecutor, { cwd, graceMs: 100 })
  await mount(host, SystemPrompt)
  await mount(host, ToolsService)
  const fiber = await mount(host, plugin)
  return { host, cwd, fiber }
}

/** The execution context a direct tool call receives from the registry. */
function execution(agent?: HostValue) {
  return {
    callId: 'proof-call',
    name: 'proof',
    arguments: {},
    signal: new AbortController().signal,
    ...agent === undefined ? {} : { agent },
  }
}

async function call(host: HostValue, name: string, args: HostValue, agent?: HostValue) {
  const tool = host.tools.get(name)
  assert.ok(tool, `tool ${name} is registered`)
  return tool.execute(args, execution(agent))
}

/** The fields of one Codex-shaped unified exec response. */
interface ParsedResponse {
  chunkId: string | undefined
  wallTimeSeconds: number
  exitCode: number | undefined
  sessionId: number | undefined
  originalTokenCount: number
  output: string
}

/** Parse the exact response shape Codex emits, without relying on timing values. */
function parse(text: string): ParsedResponse {
  const match = /^(?:Chunk ID: ([0-9a-f]{6})\n)?Wall time: (\d+\.\d{4}) seconds\n(?:Process exited with code (-?\d+)\n)?(?:Process running with session ID (\d+)\n)?(?:Original token count: (\d+)\n)?Output:\n([\s\S]*)$/.exec(text)
  assert.ok(match, `unexpected unified exec response:\n${text}`)
  return {
    chunkId: match[1],
    wallTimeSeconds: Number(match[2]),
    exitCode: match[3] === undefined ? undefined : Number(match[3]),
    sessionId: match[4] === undefined ? undefined : Number(match[4]),
    originalTokenCount: Number(match[5]),
    output: match[6],
  }
}

async function waitForProcessGone(pid: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise<void>(resolve => setTimeout(resolve, 20))
  }
  assert.fail(`process ${pid} survived plugin disposal`)
}

await test('advertises the fields the shell service can honor', async t => {
  const { host } = await runtime(t)
  const schema = host.tools.get('exec_command').parameters
  assert.deepEqual(Object.keys(schema.properties).sort(), ['cmd', 'max_output_tokens', 'tty', 'workdir', 'yield_time_ms'])
  assert.deepEqual(schema.required, ['cmd'])
  const write = host.tools.get('write_stdin').parameters
  assert.deepEqual(Object.keys(write.properties).sort(), ['chars', 'max_output_tokens', 'session_id', 'yield_time_ms'])
  assert.deepEqual(write.required, ['session_id'])
})

await test('returns exit code and output of a fast command', async t => {
  const { host, cwd } = await runtime(t)
  const result = parse(await call(host, 'exec_command', { cmd: 'printf hello', workdir: cwd }))
  assert.equal(result.exitCode, 0)
  assert.equal(result.sessionId, undefined)
  assert.equal(result.originalTokenCount, 2)
  assert.equal(result.output, 'hello')
  assert.ok(result.wallTimeSeconds >= 0)
  assert.ok(result.chunkId !== undefined)
  assert.match(result.chunkId, /^[0-9a-f]{6}$/)
})

await test('cd and exports do not leak into the next call', async t => {
  const { host, cwd } = await runtime(t)
  parse(await call(host, 'exec_command', { cmd: 'export CODEX_PROOF_LEAK=changed; cd /; printf moved', workdir: cwd }))
  const result = parse(await call(host, 'exec_command', { cmd: 'printf "%s|%s" "$PWD" "${CODEX_PROOF_LEAK-unset}"', workdir: cwd }))
  assert.equal(result.output, `${cwd}|unset`)
})

await test('yields a session for a slow command and polls without losing output', async t => {
  const { host, cwd } = await runtime(t)
  const start = parse(await call(host, 'exec_command', {
    cmd: 'printf one; sleep 0.35; printf two; sleep 0.35; printf three',
    workdir: cwd,
    yield_time_ms: 250,
  }))
  assert.equal(start.exitCode, undefined)
  assert.ok(start.sessionId !== undefined)
  assert.equal(start.output, 'one')

  let output = start.output
  let sessionId: number | undefined = start.sessionId
  for (let poll = 0; poll < 4 && sessionId !== undefined; poll += 1) {
    const next = parse(await call(host, 'write_stdin', { session_id: sessionId, yield_time_ms: 5000 }))
    output += next.output
    if (next.exitCode !== undefined) {
      assert.equal(next.exitCode, 0)
      sessionId = undefined
    }
  }
  assert.equal(sessionId, undefined, 'the process exited within the polling budget')
  assert.equal(output, 'onetwothree')
})

await test('rejects nonempty input for a non-TTY session', async t => {
  const { host, cwd } = await runtime(t)
  const start = parse(await call(host, 'exec_command', { cmd: 'sleep 5', workdir: cwd, yield_time_ms: 250 }))
  assert.ok(start.sessionId !== undefined)
  await assert.rejects(
    call(host, 'write_stdin', { session_id: start.sessionId, chars: 'x', yield_time_ms: 250 }),
    /write_stdin failed: stdin is closed for this session; rerun exec_command with tty=true to keep stdin open/,
  )
})

await test('interrupts a non-TTY session with Codex’s control-C input', async t => {
  const { host, cwd } = await runtime(t)
  const start = parse(await call(host, 'exec_command', { cmd: 'sleep 30', workdir: cwd, yield_time_ms: 250 }))
  assert.ok(start.sessionId !== undefined)
  const done = parse(await call(host, 'write_stdin', { session_id: start.sessionId, chars: '\u0003', yield_time_ms: 250 }))
  assert.equal(done.sessionId, undefined)
  assert.ok(done.exitCode === undefined || done.exitCode !== 0, 'the interrupt ends the process')
})

await test('delivers input to a TTY session and reports its exit code', async t => {
  const { host, cwd } = await runtime(t)
  const start = parse(await call(host, 'exec_command', {
    cmd: 'printf "READY\\n"; IFS= read -r line; printf "GOT:%s\\n" "$line"; exit 9',
    workdir: cwd,
    tty: true,
    // PTY startup is measurably slower on macOS; the prompt must fit in the wait.
    yield_time_ms: 5000,
  }))
  assert.match(start.output, /READY/)
  assert.ok(start.sessionId !== undefined)

  const poll = parse(await call(host, 'write_stdin', { session_id: start.sessionId, chars: 'hello\n', yield_time_ms: 5000 }))
  assert.equal(poll.exitCode, 9)
  assert.equal(poll.sessionId, undefined)
  assert.match(start.output + poll.output, /GOT:hello/)
  await assert.rejects(
    call(host, 'write_stdin', { session_id: start.sessionId }),
    new RegExp(`Unknown process id ${start.sessionId}`),
  )
})

await test('truncates output in Codex format', async t => {
  const { host, cwd } = await runtime(t)
  const result = parse(await call(host, 'exec_command', {
    cmd: "head -c 5000 /dev/zero | tr '\\0' x",
    workdir: cwd,
    max_output_tokens: 10,
  }))
  assert.equal(result.exitCode, 0)
  assert.equal(result.originalTokenCount, 1250)
  assert.equal(
    result.output,
    `Warning: truncated output (original token count: 1250)\nTotal output lines: 1\n\n${'x'.repeat(20)}…1240 tokens truncated…${'x'.repeat(20)}`,
  )
})

await test('rejects another owner and an unknown session id', async t => {
  const { host, cwd } = await runtime(t)
  const start = parse(await call(host, 'exec_command', { cmd: 'sleep 5', workdir: cwd, yield_time_ms: 250 }, { id: 'owner-a' }))
  assert.ok(start.sessionId !== undefined)
  await assert.rejects(
    call(host, 'write_stdin', { session_id: start.sessionId }, { id: 'owner-b' }),
    /session \d+ belongs to a different agent/,
  )
  await assert.rejects(
    call(host, 'write_stdin', { session_id: 999999 }),
    /Unknown process id 999999/,
  )
})

await test('disposal kills every live process', async t => {
  const { host, cwd, fiber } = await runtime(t)
  const pidPath = join(cwd, 'pid')
  const start = parse(await call(host, 'exec_command', { cmd: `echo $$ > ${pidPath}; exec sleep 30`, workdir: cwd, yield_time_ms: 250 }))
  assert.ok(start.sessionId !== undefined)
  const pid = Number((await readFile(pidPath, 'utf8')).trim())
  assert.ok(Number.isInteger(pid) && pid > 0)
  assert.doesNotThrow(() => process.kill(pid, 0))

  await fiber.dispose()
  await waitForProcessGone(pid)
})
