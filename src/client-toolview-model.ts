/**
 * Pure row-model derivation for the Codex tool conversation rows.
 *
 * Everything here is free of React and the browser module table so the node
 * test runner can exercise it directly; `client-toolview.ts` renders the
 * models this module derives.
 * @module @spectershell/dsh-harness-codex/client-toolview-model
 */
import { isRecord } from './guards.ts'

/** Streamed-argument accessor the Tool blocks expose to row models. */
export interface ArgsAccessor {
  has: (key: string) => boolean
  complete: (key: string) => boolean
  text: (key: string) => string | undefined
}

/** A call still streaming its arguments or waiting on the tool. */
export interface StreamingBlock {
  phase: 'preparing' | 'start'
  callId: string
  name: string
  args: ArgsAccessor
  argsRaw: string
  /** Call start time in milliseconds, when the snapshot carries it. */
  time?: number
}

/** A settled call and its result content. */
export interface ResultBlock {
  kind: string
  callId: string
  call: { name: string, argsRaw: string } | null
  args: ArgsAccessor
  content: readonly unknown[]
  isError: boolean
  error?: { code?: string }
  meta?: unknown
  parentCallId?: string
  /** Settlement time in milliseconds, when the snapshot carries it. */
  time?: number
}

export type ToolBlock = StreamingBlock | ResultBlock

/** Codex's settled-process marker (`ExecCommandToolOutput::response_text`). */
const EXIT_PATTERN = /^Process exited with code (-?\d+)$/m
/** Codex's still-running marker; the session id feeds later write_stdin calls. */
const SESSION_PATTERN = /^Process running with session ID (\d+)$/m
/** Codex's wall-clock line, always present in the header. */
const WALL_PATTERN = /^Wall time: ([\d.]+) seconds$/m
/** The header/body separator Codex always ends the header with. */
const OUTPUT_PATTERN = /\nOutput:\n/

/** The first line of a possibly multi-line text. */
export function firstLine(text: string): string {
  const end = text.indexOf('\n')
  return end < 0 ? text : text.slice(0, end)
}

/**
 * Read the exact single text block of a settled result.
 * @param block - settled Tool result.
 * @returns its text, or undefined for any other content layout.
 */
export function singleResultText(block: ResultBlock): string | undefined {
  if (block.content.length !== 1) return undefined
  const only = block.content[0]
  return isRecord(only) && only.type === 'text' && typeof only.text === 'string' ? only.text : undefined
}

/** The parsed Codex process status: exit code or live session, wall time, plus the body. */
export interface ProcessStatus {
  output: string
  exitCode?: number
  sessionId?: string
  wallSeconds?: number
}

/**
 * Parse Codex's reply envelope without importing the Host's exec plugin.
 * @param text - the raw result text.
 * @returns the output body and any status the header carried.
 */
export function parseProcessStatus(text: string): ProcessStatus {
  const exit = EXIT_PATTERN.exec(text)
  const session = SESSION_PATTERN.exec(text)
  const wall = WALL_PATTERN.exec(text)
  const marker = OUTPUT_PATTERN.exec(text)
  const output = marker === null ? text : text.slice(marker.index + marker[0].length)
  return {
    output,
    ...exit?.[1] !== undefined ? { exitCode: Number(exit[1]) } : {},
    ...session?.[1] !== undefined ? { sessionId: session[1] } : {},
    ...wall?.[1] !== undefined ? { wallSeconds: Number(wall[1]) } : {},
  }
}

/** Presentation states, matching the built-in row's vocabulary. */
export type ExecState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'

/** Everything the row renders, derived once per block. */
export interface ExecModel {
  state: ExecState
  /** The terminal prompt text: the command, or the stdin bytes sent. */
  command: string
  /** True only while the tool call itself is unsettled. */
  processRunning: boolean
  output?: string
  exitCode?: number
  /** The session id a settled call left running, for display only. */
  sessionId?: string
  /** Codex's recorded wall time, when the header carried it. */
  wallSeconds?: number
  /** The collapsed row's one-line summary. */
  summary: string
}

/**
 * Read the chars a write_stdin call sent; an empty write is a poll.
 * @param args - the call's streamed arguments.
 * @returns the raw bytes, or undefined when they have not streamed yet.
 */
function stdinChars(args: ArgsAccessor): string | undefined {
  return args.has('chars') ? args.text('chars') ?? '' : undefined
}

/**
 * Derive the row model from a frozen call slice.
 *
 * The tool settles a failing command as a completed call (`isError` stays
 * false: the exit status is result data), exactly like the built-in bash
 * tool, so a non-zero exit code turns the row red without the tool failing.
 * A settled call never claims the process still runs: the result text is a
 * historical record, and a Host restart kills every process it names, so the
 * session id is shown as plain information instead.
 * @param toolName - wire tool name (`exec_command` or `write_stdin`).
 * @param block - preparing call, dispatched call, or result from the snapshot.
 * @param pollLabel - localized label for a write_stdin poll.
 * @returns the row model.
 */
export function execModel(toolName: string, block: ToolBlock, pollLabel: string): ExecModel {
  const raw = toolName === 'write_stdin' ? stdinChars(block.args) : block.args.text('cmd')
  const command = raw ?? ''
  const base = {
    command,
    summary: command === '' && toolName === 'write_stdin' ? pollLabel : firstLine(command),
  }
  if (!('kind' in block)) {
    return {
      ...base,
      state: block.phase === 'preparing' ? 'preparing' : 'running',
      processRunning: true,
    }
  }
  if (block.error?.code === 'interrupted') {
    return { ...base, state: 'stopped', processRunning: false }
  }
  if (block.isError) {
    const output = singleResultText(block)
    return {
      ...base,
      state: 'error',
      processRunning: false,
      ...output !== undefined ? { output, summary: firstLine(output) } : {},
    }
  }
  const text = singleResultText(block)
  if (text === undefined) {
    return { ...base, state: 'ok', processRunning: false }
  }
  const status = parseProcessStatus(text)
  const wall = status.wallSeconds !== undefined ? { wallSeconds: status.wallSeconds } : {}
  if (status.exitCode !== undefined) {
    return {
      ...base,
      state: status.exitCode === 0 ? 'ok' : 'error',
      processRunning: false,
      output: status.output,
      exitCode: status.exitCode,
      ...wall,
    }
  }
  return {
    ...base,
    state: 'ok',
    processRunning: false,
    output: status.output,
    ...status.sessionId !== undefined ? { sessionId: status.sessionId } : {},
    ...wall,
  }
}

/**
 * Format a duration the way Codex's header reads, compacted for a badge.
 * @param seconds - wall or elapsed seconds.
 * @returns `380ms`, `3.2s`, or `1m 05s`.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

export interface PlanItem { step: string, status: 'pending' | 'in_progress' | 'completed' }

/** Parse the `plan` argument from the raw call arguments, as the built-in todo card does. */
export function planItems(block: ToolBlock): PlanItem[] {
  const raw = 'argsRaw' in block ? block.argsRaw : block.call?.argsRaw
  if (raw === undefined) return []
  try {
    const outer: unknown = JSON.parse(raw)
    const value: unknown = isRecord(outer) ? outer.plan : undefined
    if (!Array.isArray(value)) return []
    return value.flatMap(item => isRecord(item)
      && typeof item.step === 'string'
      && (item.status === 'pending' || item.status === 'in_progress' || item.status === 'completed')
      ? [{ step: item.step, status: item.status }]
      : [])
  } catch {
    return []
  }
}

/** One hunk of the presentation diff carried in result metadata. */
export interface ResultDiff {
  path: string
  oldText: string | null
  newText: string
}

/** Narrow apply_patch presentation metadata to the DiffBlock contract. */
export function resultDiffs(block: ToolBlock): ResultDiff[] {
  if (!('kind' in block) || block.isError || !isRecord(block.meta) || !Array.isArray(block.meta.diffs)) return []
  return block.meta.diffs.flatMap(diff => isRecord(diff)
    && typeof diff.path === 'string'
    && (diff.oldText === null || typeof diff.oldText === 'string')
    && typeof diff.newText === 'string'
    ? [{ path: diff.path, oldText: diff.oldText, newText: diff.newText }]
    : [])
}

/**
 * The collapsed summary for an apply_patch row: the touched paths from the
 * diff metadata, else the result's first line (the Codex status sentence),
 * else nothing while the call streams.
 * @param block - the apply_patch block.
 * @param diffs - the already-narrowed diff hunks.
 * @returns the summary text.
 */
export function patchSummary(block: ToolBlock, diffs: readonly ResultDiff[]): string {
  if (diffs.length > 0) return [...new Set(diffs.map(diff => diff.path))].join(', ')
  if (!('kind' in block)) return ''
  const text = singleResultText(block)
  return text === undefined ? '' : firstLine(text)
}

/** The durable image reference in a settled result, used by the view_image row. */
export interface AttachmentRef {
  attachmentId: string
  mediaType: string
  bytes: number
  width: number
  height: number
  name?: string
}

/** Locate the durable image reference emitted in the settled result content. */
export function resultImage(block: ToolBlock): AttachmentRef | undefined {
  if (!('kind' in block) || block.isError) return undefined
  for (const part of block.content) {
    if (!isRecord(part) || part.type !== 'image' || !isRecord(part.attachment)) continue
    const ref = part.attachment
    if (typeof ref.attachmentId === 'string' && typeof ref.mediaType === 'string'
      && typeof ref.bytes === 'number' && typeof ref.width === 'number' && typeof ref.height === 'number') {
      return { attachmentId: ref.attachmentId, mediaType: ref.mediaType, bytes: ref.bytes, width: ref.width, height: ref.height, ...(typeof ref.name === 'string' ? { name: ref.name } : {}) }
    }
  }
}
