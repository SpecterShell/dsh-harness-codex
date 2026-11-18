import { isAbsolute, join } from 'node:path'
import { finished } from 'node:stream/promises'
import { isRecord } from '../guards.ts'
import { formatExecOutput, generateChunkId, resolveMaxTokens, truncateOutput } from './output.ts'
import { createSandboxController } from './sandbox.ts'
import type { SandboxController } from './sandbox.js'
import { ExecSessions } from './sessions.ts'
import type { ExecSessionEntry } from './sessions.js'
import type {
  ExecCommandArgs,
  ExecContext,
  ExecProcess,
  JsonSchema,
  PipeExecProcess,
  ProcessOutcome,
  SandboxExecutionPolicy,
  ShellExecution,
  ShellExecRequest,
  SubprocessTerminalHandle,
  TerminalExecProcess,
  ToolDefinition,
  ToolExecution,
  WriteStdinArgs,
} from '../types.js'

/** Codex's initial `exec_command` wait defaults to 10 s and clamps to 250 ms–30 s. */
const DEFAULT_EXEC_YIELD_MS = 10_000
const MIN_YIELD_MS = 250
const MAX_YIELD_MS = 30_000

/** Codex's `write_stdin` defaults: 250 ms for writes, at least 5 s for empty polls. */
const DEFAULT_WRITE_YIELD_MS = 250
const MIN_EMPTY_YIELD_MS = 5_000
const MAX_EMPTY_YIELD_MS = 300_000

/** Codex caps one process's retained output at 1 MiB; the shell executor accepts the same budget. */
const STDOUT_MAX_BYTES = 1024 * 1024

/**
 * Codex's `UNIFIED_EXEC_ENV`, applied to both pipes and terminals
 * (`unified_exec/process_manager.rs`). The pipe path already gets a similar set
 * from the shell executor; the terminal spawn gets it here so TTY commands do
 * not open pagers or emit colors either. Codex keeps TERM=dumb even under a
 * PTY.
 */
const UNIFIED_EXEC_ENV: Record<string, string> = {
  NO_COLOR: '1',
  TERM: 'dumb',
  LANG: 'C.UTF-8',
  LC_CTYPE: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
  COLORTERM: '',
  PAGER: 'cat',
  GIT_PAGER: 'cat',
  GH_PAGER: 'cat',
  CODEX_CI: '1',
}

/** Surfaced only when DSH's bounded stream buffer dropped bytes before we could read them. */
const LOSSY_NOTICE = '[output truncated: some output was dropped before it could be read]\n'

/** Codex's interrupt input for `write_stdin` (`process_manager.rs`, `INTERRUPT`). */
const INTERRUPT = '\u0003'

/** Output and exit facts collected from one process wrapper. */
interface CollectedOutput {
  text: string
  lossy: boolean
  exitCode: number | undefined
}

/** Fields needed to start one fresh process. */
interface StartProcessOptions {
  ctx: ExecContext
  command: string
  workdir: string | undefined
  dshEnv: Record<string, string> | undefined
  tty: boolean
  policy: SandboxExecutionPolicy | undefined
  sandbox: SandboxController | undefined
  exec: ToolExecution
}

/**
 * Codex-style unified exec tools. Each call starts a fresh process, returns
 * its exit facts when it finishes inside `yield_time_ms`, or yields a numeric
 * session id that `write_stdin` can poll or feed input to.
 *
 * The pipe path rides `ctx.shell` (sandboxing, process management, incremental
 * reads). The terminal path rides `ctx.subprocess.spawnTerminal`, because the
 * shell seam has no TTY allocation; a sandboxing composition's `confine` wraps
 * the argv first. Sessions are owned by the calling Agent, since one plugin
 * instance is shared by every Agent that selects the preset.
 */
export const name = 'tool-exec'

/** The shell seam supplies process management; subprocess allocates the optional PTY. */
export const inject = ['tools', 'shell', 'subprocess']

/**
 * Register `exec_command` and `write_stdin`.
 * @param ctx - plugin context with `tools`, `shell`, and `subprocess` available.
 */
export function apply(ctx: ExecContext): void {
  const sessions = new ExecSessions()
  const sandbox = createSandboxController(ctx)
  ctx.effect(() => () => sessions.dispose())
  // A session or subagent that ends leaves no one able to reach its session
  // ids, so its processes would otherwise run until the preset unloads.
  ctx.on('agent/disposed', ({ agent }: { agent: { id: string } }) => sessions.disposeOwner(agent.id))
  ctx.tools.register(execCommandTool(ctx, sessions, sandbox))
  ctx.tools.register(writeStdinTool(sessions))
}

function execCommandTool(
  ctx: ExecContext,
  sessions: ExecSessions,
  sandbox: SandboxController | undefined,
): ToolDefinition<ExecCommandArgs, string> {
  const properties: Record<string, JsonSchema> = {
    cmd: { type: 'string', description: 'Shell command to execute.' },
    workdir: { type: 'string', description: 'Working directory for the command. Defaults to the turn cwd.' },
    tty: { type: 'boolean', description: 'True allocates a PTY for the command; false or omitted uses plain pipes.' },
    yield_time_ms: { type: 'number', description: 'Wait before yielding output. Defaults to 10000 ms; effective range is 250-30000 ms.' },
    max_output_tokens: { type: 'number', description: 'Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy.' },
  }
  if (sandbox !== undefined) Object.assign(properties, sandbox.schemaFields())

  return {
    name: 'exec_command',
    description: 'Runs a command in a PTY, returning output or a session ID for ongoing interaction.',
    parameters: { type: 'object', properties, required: ['cmd'], additionalProperties: false },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
    },
    // Every call starts a fresh process, so parallel calls cannot interfere.
    isConcurrencySafe: () => true,
    async execute(args: ExecCommandArgs, exec): Promise<string> {
      if (!isRecord(args)) throw new Error('invalid arguments: expected an object')
      const command = requireString(args.cmd, 'cmd')
      const yieldTimeMs = clampYield(readNumber(args.yield_time_ms, 'yield_time_ms') ?? DEFAULT_EXEC_YIELD_MS)
      const maxTokens = resolveMaxTokens(readNumber(args.max_output_tokens, 'max_output_tokens'))
      const workdir = await resolveWorkdir(ctx, args.workdir, exec)
      const dshEnv = ctx.get('shellEnv')?.collect(exec)
      const policy = sandbox === undefined ? undefined : await sandbox.resolvePolicy(args, exec)

      const start = performance.now()
      let process: ExecProcess
      try {
        process = await startProcess({ ctx, command, workdir, dshEnv, tty: args.tty === true, policy, sandbox, exec })
      } catch (error) {
        throw new Error(`exec_command failed: ${describe(error)}`)
      }

      await waitUntil(process, start + yieldTimeMs, exec.signal)
      if (exec.signal.aborted) {
        // The model never received a session id, so nothing could reach this process again.
        process.kill()
        exec.signal.throwIfAborted()
      }
      let collected: CollectedOutput
      try {
        collected = await collectStable(process)
      } catch (error) {
        process.kill()
        throw new Error(`exec_command failed: ${describe(error)}`)
      }
      // The turn can be cancelled while output settles; a session the model
      // never hears about would run unreachable until preset unload.
      if (exec.signal.aborted) {
        process.kill()
        exec.signal.throwIfAborted()
      }
      const sessionId = process.running() ? sessions.add(ownerOf(exec), process) : undefined
      return buildResponse({ start, sessionId, maxTokens, ...collected })
    },
  }
}

function writeStdinTool(sessions: ExecSessions): ToolDefinition<WriteStdinArgs, string> {
  return {
    name: 'write_stdin',
    description: 'Writes characters to an existing unified exec session and returns recent output.',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'number', description: 'Identifier of the running unified exec session.' },
        chars: { type: 'string', description: 'Bytes to write to stdin. Defaults to empty, which polls without writing.' },
        yield_time_ms: { type: 'number', description: 'Wait before yielding output. Non-empty writes default to 250 ms and cap at 30000 ms; empty polls wait 5000-300000 ms by default.' },
        max_output_tokens: { type: 'number', description: 'Output token budget. Defaults to 10000 tokens; larger requests may be capped by policy.' },
      },
      required: ['session_id'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
    },
    async execute(args: WriteStdinArgs, exec): Promise<string> {
      if (!isRecord(args)) throw new Error('invalid arguments: expected an object')
      const id = requireInteger(args.session_id, 'session_id')
      const chars = args.chars === undefined ? '' : requireString(args.chars, 'chars')
      const maxTokens = resolveMaxTokens(readNumber(args.max_output_tokens, 'max_output_tokens'))
      let entry: ExecSessionEntry
      try {
        entry = sessions.get(id, ownerOf(exec))
      } catch (error) {
        throw new Error(`write_stdin failed: ${describe(error)}`)
      }

      const start = performance.now()
      if (chars.length > 0) {
        if (!entry.process.tty) {
          if (chars !== INTERRUPT) {
            throw new Error('write_stdin failed: stdin is closed for this session; rerun exec_command with tty=true to keep stdin open')
          }
          // Codex maps a bare Ctrl-C on a pipe session to an interrupt. The
          // shell seam exposes kill() but no signal, so the process ends with
          // the executor's termination signal instead of SIGINT.
          entry.process.kill()
        } else if (entry.process.running()) {
          try {
            await entry.process.write(chars)
          } catch (error) {
            entry.process.kill()
            sessions.remove(id)
            throw new Error(`write_stdin failed: ${describe(error)}`)
          }
        }
      }

      const yieldTimeMs = clampWriteYield(readNumber(args.yield_time_ms, 'yield_time_ms'), chars.length === 0)
      await waitUntil(entry.process, start + yieldTimeMs, exec.signal)
      // Cancelling a poll leaves the session running, so a later write_stdin can resume it.
      exec.signal.throwIfAborted()
      let collected: CollectedOutput
      try {
        collected = await collectStable(entry.process)
      } catch (error) {
        entry.process.kill()
        sessions.remove(id)
        throw new Error(`write_stdin failed: ${describe(error)}`)
      }

      const running = entry.process.running()
      if (!running) sessions.remove(id)
      return buildResponse({ start, sessionId: running ? id : undefined, maxTokens, ...collected })
    },
  }
}

/**
 * Start one fresh process. Pipe execution goes through the shell seam so
 * sandboxing and process ownership stay there; TTY execution uses the raw
 * terminal primitive and applies the same policy through `sandbox.confine`.
 *
 * The process is deliberately not bound to the tool call's abort signal: a
 * yielded session must outlive the call that started it, as background jobs
 * in `dsh-tool-bash` do. The session table and plugin disposal own cleanup.
 */
async function startProcess({
  ctx,
  command,
  workdir,
  dshEnv,
  tty,
  policy,
  sandbox,
  exec,
}: StartProcessOptions): Promise<ExecProcess> {
  const request: ShellExecRequest = { command, onExpiry: 'none' }
  if (workdir !== undefined) request.workdir = workdir
  if (dshEnv !== undefined) request.dshEnv = dshEnv
  if (!tty) {
    if (policy !== undefined) request.sandboxPolicy = policy
    return pipeProcess(await ctx.shell.execute(ctx.shell.resolve({ ...request, stdoutMaxBytes: STDOUT_MAX_BYTES })))
  }

  const spec = ctx.shell.resolve(request)
  const argv = ['bash', '-c', command]
  const confined = policy !== undefined && policy.mode !== 'danger-full-access'
    ? await sandbox!.confine(argv, policy, exec.signal)
    : { argv }
  const handle = await ctx.subprocess.spawnTerminal({
    argv: confined.argv,
    cwd: spec.workdir,
    rows: 24,
    cols: 80,
    terminalType: 'xterm-256color',
    graceMs: 1_000,
    env: { ...UNIFIED_EXEC_ENV, ...(dshEnv ?? {}) },
    // Only cancels terminal allocation; the running command is not bound to it.
    signal: exec.signal,
  })
  return terminalProcess(handle)
}

/** Adapt a `ShellExecution` to the small view both response paths share. */
function pipeProcess(proc: ShellExecution): PipeExecProcess {
  let failure: unknown
  const exited = proc.done.then(() => {}, (error: unknown) => { failure = error })
  return {
    tty: false,
    exited,
    running: () => proc.status === 'running',
    read: () => {
      const read = proc.readOutput()
      return { text: read.delta, lossy: read.lossy }
    },
    async settle(): Promise<ProcessOutcome> {
      await exited
      if (failure !== undefined) throw failure
      const result = await proc.result()
      return { exitCode: result.exitCode, signal: result.signal }
    },
    kill: () => proc.kill(),
  }
}

/**
 * Accumulate terminal output in delivery order. `read` advances a cursor so
 * consecutive responses never repeat or lose bytes; settlement waits for the
 * output stream to drain so the final poll includes everything the process
 * wrote before exiting.
 */
function terminalProcess(handle: SubprocessTerminalHandle): TerminalExecProcess {
  let status: 'running' | 'completed' | 'killed' = 'running'
  let failure: unknown
  let outcome!: ProcessOutcome
  let text = ''
  let cursor = 0

  handle.output.setEncoding('utf8')
  handle.output.on('data', (chunk: string) => { text += chunk })
  const drained = finished(handle.output).catch(() => {})
  const exited = handle.done.then(
    value => { outcome = value; status = 'completed' },
    (error: unknown) => { failure = error; status = 'killed' },
  )

  return {
    tty: true,
    exited,
    running: () => status === 'running',
    read: () => {
      const delta = text.slice(cursor)
      if (text.length > STDOUT_MAX_BYTES) {
        text = text.slice(cursor)
        cursor = 0
      } else {
        cursor = text.length
      }
      return { text: delta, lossy: false }
    },
    write: (chars: string) => handle.write(chars),
    async settle(): Promise<ProcessOutcome> {
      await exited
      if (failure !== undefined) throw failure
      await drained
      return { exitCode: outcome.exitCode, signal: outcome.signal }
    },
    kill: () => { handle.terminate().catch(() => {}) },
  }
}

/**
 * Read the output produced since the previous response. A process that is no
 * longer running is settled first, then read again so output buffered between
 * the wait and the first read is included.
 */
async function collect(process: ExecProcess): Promise<CollectedOutput> {
  const first = process.read()
  if (process.running()) return { text: first.text, lossy: first.lossy, exitCode: undefined }
  const outcome = await process.settle()
  const rest = process.read()
  return {
    text: `${first.text}${rest.text}`,
    lossy: first.lossy || rest.lossy,
    exitCode: outcome.exitCode ?? undefined,
  }
}

/**
 * A process can exit between the running check inside {@link collect} and the
 * response, which would leave no exit code and no session id. Settle once more
 * in that window and merge the final bytes so every response is actionable.
 */
async function collectStable(process: ExecProcess): Promise<CollectedOutput> {
  const first = await collect(process)
  if (first.exitCode !== undefined || process.running()) return first
  const final = await collect(process)
  return {
    text: `${first.text}${final.text}`,
    lossy: first.lossy || final.lossy,
    exitCode: final.exitCode,
  }
}

function buildResponse({ start, sessionId, exitCode, text, lossy, maxTokens }: {
  start: number
  sessionId: number | undefined
  exitCode: number | undefined
  text: string
  lossy: boolean
  maxTokens: number
}): string {
  const body = lossy ? `${LOSSY_NOTICE}${text}` : text
  const truncated = truncateOutput(body, maxTokens)
  return formatExecOutput({
    chunkId: generateChunkId(),
    wallTimeSeconds: (performance.now() - start) / 1000,
    exitCode,
    sessionId,
    originalTokenCount: truncated.original,
    output: truncated.text,
  })
}

/** Wait until the process exits, the deadline passes or the call is cancelled. */
async function waitUntil(process: ExecProcess, deadline: number, signal: AbortSignal): Promise<void> {
  const remaining = deadline - performance.now()
  if (remaining <= 0 || signal.aborted) return
  let timer: NodeJS.Timeout | undefined
  let onAbort: (() => void) | undefined
  const elapsed = new Promise<void>(resolve => {
    timer = setTimeout(resolve, remaining)
    onAbort = resolve
    signal.addEventListener('abort', onAbort, { once: true })
  })
  await Promise.race([process.exited, elapsed])
  if (timer !== undefined) clearTimeout(timer)
  if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
}

/** Codex's `clamp_yield_time`: 250 ms–30 s, with the default applied by the caller. */
function clampYield(yieldTimeMs: number): number {
  return Math.min(Math.max(yieldTimeMs, MIN_YIELD_MS), MAX_YIELD_MS)
}

/** Codex clamps empty polls to 5 s–300 s and non-empty writes to at most 30 s. */
function clampWriteYield(yieldTimeMs: number | undefined, empty: boolean): number {
  const requested = Math.max(yieldTimeMs ?? DEFAULT_WRITE_YIELD_MS, MIN_YIELD_MS)
  return empty
    ? Math.min(Math.max(requested, MIN_EMPTY_YIELD_MS), MAX_EMPTY_YIELD_MS)
    : Math.min(requested, MAX_YIELD_MS)
}

/**
 * Resolve the working directory. The session's effective directory comes from
 * the optional `workingDirectory` service (absent in minimal compositions);
 * a relative `workdir` resolves against it, as in `dsh-tool-bash`.
 */
async function resolveWorkdir(
  ctx: ExecContext,
  requested: unknown,
  exec: ToolExecution,
): Promise<string | undefined> {
  if (requested !== undefined && typeof requested !== 'string') requireString(requested, 'workdir')
  const workingDirectory = ctx.get('workingDirectory')
  const base = workingDirectory !== undefined && exec.agent !== undefined
    ? await workingDirectory.ensure(exec.agent, exec.signal)
    : undefined
  // Codex treats an empty workdir as "use the environment cwd".
  if (requested === undefined || requested === '') return base
  const requestedPath = requested as string
  if (isAbsolute(requestedPath)) return requestedPath
  return base === undefined ? requestedPath : join(base, requestedPath)
}

/** The Agent's session id is the ownership identity; agentless calls share `undefined`. */
function ownerOf(exec: ToolExecution): string | undefined {
  return exec.agent?.id
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`invalid ${field}: expected a string, got ${JSON.stringify(value)}`)
  return value
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`invalid ${field}: expected an integer, got ${JSON.stringify(value)}`)
  }
  return value
}

function readNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`invalid ${field}: expected a number, got ${JSON.stringify(value)}`)
  return value
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
