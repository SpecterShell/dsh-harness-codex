/**
 * Codex-faithful apply_patch execution over the host filesystem service.
 *
 * Upstream does the work in two passes: a read-only verification derives every
 * new file text (and rejects a patch with duplicate targets) before anything is
 * written, then a sequential commit repeats the derivation and writes. A commit
 * that fails midway stops, without rollback, and the already committed effects
 * are reported. This module keeps that split, but routes reads and mutations
 * through `ctx.fs` so a sandbox-enforcing backend fences every write.
 *
 * The patch-specific details — BOM retention, per-line endings, fuzzy matching
 * and context preservation — live in `text-file.ts` and `file-update.ts`; this
 * module only owns targets, ordering, and reporting.
 * @module @spectershell/dsh-harness-codex/patch/execute
 */
import { errorMessage, isRecord } from '../guards.ts'
import { deriveNewContents } from './file-update.ts'
import { parsePatch } from './parser.ts'
import type { PatchChange, PatchOperationOutcome, PatchToolValue } from './output.js'
import type { PatchChunk, PatchOperation } from './types.js'
import type {
  FsTarget,
  PatchContext,
  SandboxExecutionPolicy,
  ToolExecution,
} from '../types.js'

/** Cap used only when a backend does not report a file size. */
const FALLBACK_MAX_READ_BYTES = 64 * 1024 * 1024

/** A request after the caller resolved the per-call sandbox policy. */
export interface PatchExecutionRequest {
  patch: string
  sandboxPolicy: SandboxExecutionPolicy | undefined
}

/** The identity a failure report names for one operation. */
interface OperationRecord {
  index: number
  kind: PatchOperationOutcome['kind']
  path: string
  destination?: string
  patchLine: number
}

/** A verified operation; verification has already resolved targets and read sources. */
type PlannedOperation =
  | { kind: 'add'; record: OperationRecord; target: FsTarget; content: string }
  | { kind: 'delete'; record: OperationRecord; target: FsTarget; original: string }
  | { kind: 'update'; record: OperationRecord; target: FsTarget; chunks: PatchChunk[] }
  | { kind: 'move'; record: OperationRecord; target: FsTarget; destination: FsTarget; chunks: PatchChunk[] }

/** One preflight refusal. */
interface Refusal {
  record: OperationRecord
  message: string
}

/**
 * Read a file as text for patching.
 *
 * `ctx.fs.readText` decodes with the platform default, which drops a leading
 * BOM. Codex reads bytes and decodes UTF-8 without touching the BOM, so the
 * patch tool does the same: read the raw file, then decode with BOM retention
 * and fatal invalid-byte handling.
 * @param ctx - mounted filesystem.
 * @param target - resolved regular file.
 * @param signal - cancellation.
 * @returns the file text including a BOM when present.
 */
async function readPatchableText(ctx: PatchContext, target: FsTarget, signal: AbortSignal): Promise<string> {
  const info = await ctx.fs.stat(target, signal)
  if (info === undefined) throw new Error(`cannot read "${target.displayPath}": not found`)
  if (info.type !== 'file') throw new Error(`cannot read "${target.displayPath}": not a regular file`)
  const bytes = await ctx.fs.readBytes(target, signal, info.size ?? FALLBACK_MAX_READ_BYTES)
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error(`cannot read "${target.displayPath}": invalid UTF-8 text`)
  }
}

/** The LF-normalized text a diff consumer uses as one applied side. */
function diffBasis(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

/** A provider error's stable code, when it carries one. */
function failureCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined
}

/** Build the model-facing refusal text for preflight failures. */
function refusalMessage(refusals: readonly Refusal[]): string {
  const lines = refusals.map(({ record, message }) =>
    `- operation ${record.index + 1} (${record.kind} ${record.path}, patch line ${record.patchLine}): ${message}`)
  return `Patch rejected before any change (${refusals.length} problems):\n${lines.join('\n')}`
}

/** The identity fields every operation outcome repeats. */
function outcomeBase(record: OperationRecord): Omit<PatchOperationOutcome, 'status'> {
  return {
    index: record.index,
    kind: record.kind,
    path: record.path,
    patchLine: record.patchLine,
    ...(record.destination === undefined ? {} : { destination: record.destination }),
  }
}

/**
 * Resolve one parsed operation's targets and verify it read-only.
 * @param ctx - mounted filesystem.
 * @param exec - execution context supplying the signal.
 * @param resolveOptions - session cwd and cancellation for path resolution.
 * @param record - reporting identity for the operation.
 * @param operation - parsed operation.
 * @param target - the already resolved source, shared with duplicate detection.
 * @returns the verified operation, or the reason it cannot run.
 */
async function planOperation(
  ctx: PatchContext,
  exec: ToolExecution,
  resolveOptions: { cwd?: string; signal: AbortSignal },
  record: OperationRecord,
  operation: PatchOperation,
  target: FsTarget,
): Promise<{ ok: true; planned: PlannedOperation } | { ok: false; refusal: Refusal }> {
  const refuse = (message: string): { ok: false; refusal: Refusal } => ({
    ok: false,
    refusal: { record, message },
  })

  if (operation.kind === 'add') {
    return { ok: true, planned: { kind: 'add', record, target, content: operation.content } }
  }

  if (operation.kind === 'delete') {
    try {
      const original = await readPatchableText(ctx, target, exec.signal)
      return { ok: true, planned: { kind: 'delete', record, target, original } }
    } catch (error) {
      return refuse(`Failed to read ${target.displayPath}: ${errorMessage(error)}`)
    }
  }

  let destination: FsTarget | undefined
  if (operation.moveTo !== undefined) {
    destination = await ctx.fs.resolve(operation.moveTo, resolveOptions)
    record.destination = destination.displayPath
  }

  let original: string
  try {
    original = await readPatchableText(ctx, target, exec.signal)
  } catch (error) {
    return refuse(`Failed to read file to update ${target.displayPath}: ${errorMessage(error)}`)
  }
  const derived = deriveNewContents(original, target.displayPath, operation.chunks)
  if (!derived.ok) return refuse(derived.failure.message)

  if (destination === undefined) {
    return { ok: true, planned: { kind: 'update', record, target, chunks: operation.chunks } }
  }
  return { ok: true, planned: { kind: 'move', record, target, destination, chunks: operation.chunks } }
}

/**
 * Commit one verified operation.
 *
 * Reads are repeated here so the write is based on the file as it is now, like
 * upstream's commit pass. A move publishes the destination first and then
 * removes the source; a failed removal is reported as a failed operation that
 * still lists the destination it wrote.
 * @param ctx - mounted filesystem.
 * @param exec - execution context supplying the signal.
 * @param policy - per-call sandbox policy stamped onto every mutation.
 * @param operation - verified operation.
 * @returns the operation outcome, or a failure that still names committed effects.
 * @throws provider errors for operations with no committed effect.
 */
async function commitOperation(
  ctx: PatchContext,
  exec: ToolExecution,
  policy: SandboxExecutionPolicy | undefined,
  operation: PlannedOperation,
): Promise<PatchOperationOutcome> {
  const base = outcomeBase(operation.record)
  switch (operation.kind) {
    case 'add': {
      const written = await ctx.fs.writeText(operation.target, operation.content, undefined, exec.signal, policy)
      ctx.emit('fs/observed', operation.target, { kind: 'present', version: written.version }, exec)
      const changes: PatchChange[] = [{
        path: ctx.fs.processPath(operation.target),
        before: written.before,
        after: written.after,
      }]
      return { ...base, status: 'completed', changes }
    }
    case 'delete': {
      await ctx.fs.deleteFile(operation.target, undefined, exec.signal, policy)
      ctx.emit('fs/observed', operation.target, { kind: 'absent' }, exec)
      const changes: PatchChange[] = [{
        path: ctx.fs.processPath(operation.target),
        before: diffBasis(operation.original),
        after: null,
      }]
      return { ...base, status: 'completed', changes }
    }
    case 'update': {
      const original = await readPatchableText(ctx, operation.target, exec.signal)
      const derived = deriveNewContents(original, operation.target.displayPath, operation.chunks)
      if (!derived.ok) {
        return { ...base, status: 'failed', message: derived.failure.message, hunkLine: derived.failure.lineNumber }
      }
      const written = await ctx.fs.writeText(operation.target, derived.after, undefined, exec.signal, policy)
      ctx.emit('fs/observed', operation.target, { kind: 'present', version: written.version }, exec)
      const changes: PatchChange[] = [{
        path: ctx.fs.processPath(operation.target),
        before: diffBasis(original),
        after: diffBasis(derived.after),
      }]
      return { ...base, status: 'completed', changes }
    }
    case 'move': {
      const original = await readPatchableText(ctx, operation.target, exec.signal)
      const derived = deriveNewContents(original, operation.target.displayPath, operation.chunks)
      if (!derived.ok) {
        return { ...base, status: 'failed', message: derived.failure.message, hunkLine: derived.failure.lineNumber }
      }
      const written = await ctx.fs.writeText(operation.destination, derived.after, undefined, exec.signal, policy)
      ctx.emit('fs/observed', operation.destination, { kind: 'present', version: written.version }, exec)
      const destinationChange: PatchChange = {
        path: ctx.fs.processPath(operation.destination),
        before: written.before,
        after: diffBasis(derived.after),
      }
      try {
        await ctx.fs.deleteFile(operation.target, undefined, exec.signal, policy)
      } catch (error) {
        return {
          ...base,
          status: 'failed',
          message: `Failed to remove original ${operation.target.displayPath}: ${errorMessage(error)}`,
          ...(failureCode(error) === undefined ? {} : { code: failureCode(error) }),
          changes: [destinationChange],
        }
      }
      ctx.emit('fs/observed', operation.target, { kind: 'absent' }, exec)
      const sourceChange: PatchChange = {
        path: ctx.fs.processPath(operation.target),
        before: diffBasis(original),
        after: null,
      }
      return { ...base, status: 'completed', changes: [destinationChange, sourceChange] }
    }
  }
}

/**
 * Apply one patch, preserving Codex's verification/commit split.
 * @param ctx - mounted filesystem, working directory and tool context.
 * @param exec - execution context supplying the Agent, call id and signal.
 * @param request - raw patch and the resolved per-call sandbox policy.
 * @returns the canonical commit value, including partial failures.
 * @throws PatchParseError for syntax, or an Error for an empty patch, a
 *   preflight refusal, or a commit whose first operation failed with no effect.
 */
export async function runApplyPatch(
  ctx: PatchContext,
  exec: ToolExecution,
  request: PatchExecutionRequest,
): Promise<PatchToolValue> {
  const operations = parsePatch(request.patch)
  if (operations.length === 0) throw new Error('patch rejected: empty patch')

  const cwd = exec.agent === undefined ? undefined : await ctx.workingDirectory.ensure(exec.agent, exec.signal)
  const resolveOptions = { ...(cwd === undefined ? {} : { cwd }), signal: exec.signal }
  const planned: PlannedOperation[] = []
  const refusals: Refusal[] = []
  const seen = new Map<string, number>()

  for (const [index, operation] of operations.entries()) {
    const moveTo = operation.kind === 'update' ? operation.moveTo : undefined
    const record: OperationRecord = {
      index,
      kind: moveTo === undefined ? operation.kind : 'move',
      path: operation.path,
      patchLine: operation.lineNumber,
    }
    let target: FsTarget
    try {
      target = await ctx.fs.resolve(operation.path, resolveOptions)
    } catch (error) {
      refusals.push({ record, message: `Failed to resolve ${operation.path}: ${errorMessage(error)}` })
      continue
    }
    record.path = target.displayPath
    // Codex rejects a patch that touches the same resolved file twice instead
    // of guessing whether the second operation should see the first's effect.
    if (seen.has(target.targetKey)) {
      refusals.push({ record, message: `multiple operations target ${target.displayPath}` })
      continue
    }
    seen.set(target.targetKey, index)
    try {
      const result = await planOperation(ctx, exec, resolveOptions, record, operation, target)
      if (result.ok) planned.push(result.planned)
      else refusals.push(result.refusal)
    } catch (error) {
      refusals.push({ record, message: errorMessage(error) })
    }
  }

  if (refusals.length > 0) throw new Error(refusalMessage(refusals))

  const outcomes: PatchOperationOutcome[] = planned.map(operation => ({
    ...outcomeBase(operation.record),
    status: 'skipped',
  }))
  let cancelled = false
  for (const [index, operation] of planned.entries()) {
    if (exec.signal.aborted) {
      cancelled = true
      break
    }
    try {
      outcomes[index] = await commitOperation(ctx, exec, request.sandboxPolicy, operation)
    } catch (error) {
      outcomes[index] = {
        ...outcomeBase(operation.record),
        status: 'failed',
        message: errorMessage(error),
        ...(failureCode(error) === undefined ? {} : { code: failureCode(error) }),
      }
      cancelled = exec.signal.aborted
      break
    }
    if (outcomes[index]?.status !== 'completed') break
  }

  // A patch whose first operation failed without changing anything is a
  // rejection, not a partial application: no disk effect exists to report and
  // the model needs the failure text (for example a sandbox denial) as the
  // call's error so it can retry or escalate.
  const first = outcomes[0]
  if (first?.status === 'failed' && (first.changes === undefined || first.changes.length === 0)
    && outcomes.every((outcome, index) => index === 0 || outcome.status === 'skipped')) {
    const plannedFirst = planned[0] as PlannedOperation
    throw new Error(refusalMessage([{ record: plannedFirst.record, message: first.message ?? 'unknown failure' }]))
  }

  const affectedPaths = [...new Set(outcomes.flatMap(outcome =>
    outcome.changes?.map(change => change.path) ?? []))]
  return { phase: 'commit', cancelled, operations: outcomes, affectedPaths }
}
