/**
 * Canonical `apply_patch` result value and its model-facing renderer.
 *
 * The shape matches `dsh-tool-fs`'s `apply_patch` output, which hosted sessions
 * and the Web UI already understand: a commit phase with per-operation status
 * and applied change bases. Keeping it lets this Codex-faithful engine slot in
 * without changing how a stopped patch is displayed.
 * @module @spectershell/dsh-harness-codex/patch/output
 */
import type { JsonSchema } from '../types.js'

/** One applied change basis; paths use the backend's process spelling. */
export interface PatchChange {
  path: string
  before: string | null
  after: string | null
}

/** Per-operation outcome in patch order. */
export interface PatchOperationOutcome {
  index: number
  kind: 'add' | 'update' | 'delete' | 'move'
  path: string
  destination?: string
  patchLine: number
  status: 'completed' | 'failed' | 'unknown' | 'skipped'
  /** Stable host filesystem code when the failure came from the provider. */
  code?: string
  message?: string
  hunkLine?: number
  changes?: PatchChange[]
}

/** Canonical value a successful or partially applied call returns. */
export interface PatchToolValue {
  phase: 'commit'
  cancelled: boolean
  operations: PatchOperationOutcome[]
  affectedPaths: string[]
}

/** Standard JSON Schema accepted by the host tool registry. */
export const PATCH_OUTPUT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['phase', 'cancelled', 'operations', 'affectedPaths'],
  properties: {
    phase: { type: 'string', const: 'commit' },
    cancelled: { type: 'boolean' },
    operations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'kind', 'path', 'patchLine', 'status'],
        properties: {
          index: { type: 'integer' },
          kind: { type: 'string', enum: ['add', 'update', 'delete', 'move'] },
          path: { type: 'string' },
          destination: { type: 'string' },
          patchLine: { type: 'integer' },
          status: { type: 'string', enum: ['completed', 'failed', 'unknown', 'skipped'] },
          code: { type: 'string' },
          message: { type: 'string' },
          hunkLine: { type: 'integer' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['path', 'before', 'after'],
              properties: {
                path: { type: 'string' },
                before: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                after: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              },
            },
          },
        },
      },
    },
    affectedPaths: { type: 'array', items: { type: 'string' } },
  },
}

/** Whether every operation finished; a cancelled call never did. */
export function patchStopped(value: PatchToolValue): boolean {
  return value.cancelled || value.operations.some(operation => operation.status !== 'completed')
}

/**
 * Completed paths as git-style status lines. Codex groups additions, updates
 * and deletions, and reports a move under its destination.
 * @param operations - per-operation outcomes.
 * @returns one `A|M|D path` line per completed operation.
 */
function completedLines(operations: readonly PatchOperationOutcome[]): string[] {
  return ['add', 'update', 'delete'].flatMap(kind => operations
    .filter(operation => operation.status === 'completed'
      && (operation.kind === 'move' ? 'update' : operation.kind) === kind)
    .map(operation => `${kind === 'add' ? 'A' : kind === 'delete' ? 'D' : 'M'} ${operation.destination ?? operation.path}`))
}

/**
 * Render a commit or a stopped patch.
 * @param value - canonical result.
 * @returns model-visible text naming completed, failed and not-executed operations.
 */
export function renderPatch(value: PatchToolValue): string {
  if (!patchStopped(value)) {
    return value.operations.length === 0
      ? 'Success. No operations in patch.'
      : ['Success. Updated the following files:', ...completedLines(value.operations)].join('\n')
  }
  const completed = value.operations.filter(operation => operation.status === 'completed').length
  const lines = [`Patch stopped after ${completed} of ${value.operations.length} operations.`]
  if (completed > 0) lines.push('Completed:', ...completedLines(value.operations))
  for (const [status, title] of [
    ['failed', 'Failed:'],
    ['unknown', 'Outcome unknown:'],
    ['skipped', 'Not executed:'],
  ] as const) {
    const operations = value.operations.filter(operation => operation.status === status)
    if (operations.length === 0) continue
    lines.push(title)
    for (const operation of operations) {
      const label = `- operation ${operation.index + 1} (${operation.kind} ${operation.path}`
      if (status === 'skipped') {
        lines.push(`${label})`)
        continue
      }
      const destination = operation.destination === undefined ? '' : ` -> ${operation.destination}`
      lines.push(`${label}${destination}, patch line ${operation.patchLine}): ${operation.message}`)
      // A published move destination is a real, visible effect even when the
      // source removal then failed, so say so beside the failure.
      if (status === 'failed' && operation.kind === 'move' && operation.changes?.length) {
        lines.push(`  destination ${operation.destination} was written; source ${operation.path} remains`)
      }
    }
  }
  return lines.join('\n')
}
