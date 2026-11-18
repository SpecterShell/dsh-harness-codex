/**
 * Codex-faithful `apply_patch` over the host filesystem service.
 *
 * The preset used the native `dsh-tool-fs` patch row, which was ported from
 * Codex 0.158.0 and had drifted: it normalized line endings, dropped BOMs,
 * rewrote fuzzy-matched context, inserted at a trailing blank line, and accepted
 * an empty patch. This row owns the tool instead, following Codex HEAD's parser
 * and text updater (sources and commit in NOTICE) while keeping the native
 * tool's JSON schema, sandbox escalation and output value so the rest of DSH
 * (freeform bridge, surface row, Web diff rendering) sees the same tool.
 * @module @spectershell/dsh-harness-codex/patch
 */
import { isRecord } from '../guards.ts'
import { runApplyPatch } from './execute.ts'
import { PATCH_OUTPUT_SCHEMA, renderPatch } from './output.ts'
import { createPatchSandbox } from './sandbox.ts'
import type { PatchToolValue } from './output.js'
import type { JsonSchema, PatchContext, ToolExecution } from '../types.js'

/** Diagnostic plugin name. */
export const name = 'tool-patch'

/** The registry, filesystem and session directory the tool needs. */
export const inject = ['tools', 'fs', 'workingDirectory']

/** Model-supplied arguments; `input` is required and the escalation fields are optional. */
interface ApplyPatchArgs {
  input?: unknown
  sandbox_permissions?: unknown
  justification?: unknown
}

/** Reuse the same model-facing wording the native tool used, so only behavior changes. */
const DESCRIPTION = 'Create, update, delete, or move UTF-8 text files with one patch; '
  + 'prefer it over multiple edit calls when a change spans several files or separated regions.'

const INPUT_DESCRIPTION = 'Patch text: start with *** Begin Patch and end with *** End Patch. '
  + 'Use *** Add File: path with + lines; *** Update File: path, optionally followed by *** Move to: path, '
  + 'with @@ or @@ context and space-prefixed context, + added, or - removed lines; '
  + '*** End of File anchors the last hunk to the file end. Use *** Delete File: path to delete. '
  + 'Paths are relative to the Session working directory.'

/**
 * Register `apply_patch`.
 * @param ctx - registrant context carrying the tools, filesystem and services.
 */
export function apply(ctx: PatchContext): void {
  const sandbox = createPatchSandbox(ctx)
  const properties: Record<string, JsonSchema> = {
    input: { type: 'string', description: INPUT_DESCRIPTION },
  }
  if (sandbox !== undefined) Object.assign(properties, sandbox.schemaFields())

  ctx.tools.register<ApplyPatchArgs, PatchToolValue>({
    name: 'apply_patch',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties,
      required: ['input'],
      additionalProperties: false,
    },
    output: {
      schema: PATCH_OUTPUT_SCHEMA,
      render: (_args: unknown, value: PatchToolValue) => [{ type: 'text', text: renderPatch(value) }],
    },
    async execute(args: ApplyPatchArgs, exec: ToolExecution): Promise<PatchToolValue> {
      if (!isRecord(args) || typeof args.input !== 'string') {
        throw new Error('input must be the patch text string')
      }
      const sandboxPolicy = sandbox === undefined
        ? undefined
        : await sandbox.resolvePolicy({
          ...(typeof args.sandbox_permissions === 'string' ? { sandbox_permissions: args.sandbox_permissions } : {}),
          ...(typeof args.justification === 'string' ? { justification: args.justification } : {}),
        }, exec)
      return runApplyPatch(ctx, exec, { patch: args.input, sandboxPolicy })
    },
  })
}
