/**
 * Exercise native local processes and a real command-scoped terminal.
 * All writes target a unique fixture directory. This proves the process and
 * confinement primitives, not Agent-level approval or continuation adapters.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { finished } from 'node:stream/promises'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary, english } from '../fixtures/native-host.ts'
import type { HostValue } from '../fixtures/native-host.ts'

const { Context } = await native('cordis')
const { LocalSubprocessRuntime } = await native('dsh-subprocess-local')
const { LocalBashExecutor } = await native('dsh-bash-local')
const { LocalSandboxProvider } = await native('dsh-sandbox-local')

/** Own native providers in the test context so failures still terminate children. */
async function runtime(t: TestContext, cwd: string, shell = false) {
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, LocalSubprocessRuntime)
  if (shell) await mount(host, LocalBashExecutor, { cwd, graceMs: 100 })
  return host
}

/** Specify every low-level disposition; native subprocess intentionally has no defaults. */
function pipeSpec(argv: string[], cwd: string) {
  return { argv, cwd, graceMs: 100, stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } } }
}

/** A noninteractive shell inside a PTY exits with its command rather than a prompt. */
function terminalSpec(argv: string[], cwd: string) {
  return { argv, cwd, rows: 24, cols: 80, terminalType: 'xterm-256color', graceMs: 100 }
}

/** Subscribe immediately so readiness and final bytes cannot race test observation. */
function terminalOutput(handle: HostValue, readyToken?: string) {
  let text = ''
  let announce!: () => void
  const ready = new Promise<void>(resolve => { announce = resolve })
  const drained = finished(handle.output, { cleanup: true })
  handle.output.on('data', (chunk: Buffer) => {
    text += chunk.toString('utf8')
    if (readyToken && text.includes(readyToken)) announce()
  })
  return { ready, drained, text: () => text }
}

await test(english.tests.pipe, { timeout: 20000 }, async t => {
  const cwd = await temporary(t)
  const host = await runtime(t, cwd, true)
  const first = await host.shell.execute(host.shell.resolve({ command: 'export CODEX_PROOF_LOCAL=changed; cd /; printf first; exit 7' }))
  const result = await first.result()
  assert.equal(result.exitCode, 7)
  assert.equal(first.status, 'completed')
  assert.equal(result.stdout.text, 'first')
  assert.equal(first.readOutput().delta, 'first')
  assert.equal(first.readOutput().delta, '')
  const second = await host.shell.execute(host.shell.resolve({ command: 'printf "%s\\n%s" "$PWD" "${CODEX_PROOF_LOCAL-unset}"' }))
  assert.equal((await second.result()).stdout.text, `${cwd}\nunset`)
})

await test(english.tests.pipeCancel, { timeout: 20000 }, async t => {
  const cwd = await temporary(t)
  const host = await runtime(t, cwd, true)
  const controller = new AbortController()
  const process = await host.shell.execute(host.shell.resolve({ command: 'exec tail -f /dev/null', onExpiry: 'none', signal: controller.signal }))
  controller.abort()
  const result = await process.result()
  assert.equal(result.aborted, true)
  assert.notEqual(process.status, 'running')
  const survivor = await host.shell.execute(host.shell.resolve({ command: 'exec tail -f /dev/null', onExpiry: 'none' }))
  await host.fiber.dispose()
  await survivor.done
  assert.notEqual(survivor.status, 'running')
})

await test(english.tests.tty, { timeout: 20000 }, async t => {
  const cwd = await temporary(t)
  const host = await runtime(t, cwd)
  const terminal = await host.subprocess.spawnTerminal(terminalSpec(['/bin/bash', '-c', 'printf "TTY_READY\\n"; IFS= read -r value; printf "GOT:%s\\n" "$value"; exit 9'], cwd))
  t.after(() => terminal.terminate())
  const output = terminalOutput(terminal, 'TTY_READY')
  await output.ready
  await terminal.write('fixture-input\n')
  const outcome = await terminal.done
  await output.drained
  assert.equal(outcome.exitCode, 9)
  assert.match(output.text(), /GOT:fixture-input/)
  await terminal.terminate()
})

await test(english.tests.ttyInterrupt, { timeout: 20000 }, async t => {
  const cwd = await temporary(t)
  const host = await runtime(t, cwd)
  const terminal = await host.subprocess.spawnTerminal(terminalSpec(['/bin/bash', '-c', 'printf "SIGNAL_READY\\n"; exec tail -f /dev/null'], cwd))
  t.after(() => terminal.terminate())
  const output = terminalOutput(terminal, 'SIGNAL_READY')
  await output.ready
  assert.ok(await terminal.signalForeground('SIGINT') > 0)
  const outcome = await terminal.done
  await output.drained
  assert.ok(outcome.signal !== null || outcome.exitCode !== 0)
  await terminal.terminate()
})

await test(english.tests.sandbox, { timeout: 30000 }, async t => {
  const cwd = await temporary(t)
  const target = join(cwd, 'protected.txt')
  await writeFile(target, 'original')
  const host = await runtime(t, cwd)
  await mount(host, LocalSandboxProvider)
  const argv = ['/bin/bash', '-c', 'printf "ATTEMPT\\n"; printf altered > "$1"', 'proof', target]
  let confined
  try {
    confined = await host.sandbox.confine(argv, { mode: 'read-only', workspaceRoot: cwd })
  } catch (error) {
    if ((error as { code?: unknown }).code !== 'SANDBOX_UNAVAILABLE') throw error
    t.skip(english.fixture.sandboxUnavailable)
    return
  }
  t.diagnostic(JSON.stringify({ enforcement: confined.enforcement, runner: confined.argv[0] }))
  const pipe = host.subprocess.spawn(pipeSpec(confined.argv, cwd))
  const pipeOutcome = await pipe.done
  const pipeOutput = pipe.collected.stdout.readFrom(0).text + pipe.collected.stderr.readFrom(0).text
  assert.notEqual(pipeOutcome.exitCode, 0)
  assert.match(pipeOutput, /ATTEMPT/)
  assert.ok(confined.denialSignatures.some((signature: string) => pipeOutput.toLowerCase().includes(signature.toLowerCase())))
  assert.equal(await readFile(target, 'utf8'), 'original')
  const terminal = await host.subprocess.spawnTerminal(terminalSpec(confined.argv, cwd))
  t.after(() => terminal.terminate())
  const output = terminalOutput(terminal)
  const outcome = await terminal.done
  await output.drained
  assert.notEqual(outcome.exitCode, 0)
  assert.match(output.text(), /ATTEMPT/)
  assert.ok(confined.denialSignatures.some((signature: string) => output.text().toLowerCase().includes(signature.toLowerCase())))
  assert.equal(await readFile(target, 'utf8'), 'original')
})
