/**
 * Sandbox escalation for `apply_patch`.
 *
 * The policy vocabulary mirrors `src/exec/sandbox.ts`: a call may ask for
 * `require_escalated`, which means this one patch runs with
 * `danger-full-access` after the user approves. The standing session policy
 * still supplies the workspace root, so an approved call widens the mode only.
 * A composition whose mounted filesystem does not confine advertises nothing,
 * exactly like the shell and native filesystem tools.
 * @module @spectershell/dsh-harness-codex/patch/sandbox
 */
import { approvalText } from '../approval.ts'
import type {
  JsonSchema,
  PatchContext,
  SandboxExecutionPolicy,
  SandboxPolicyService,
  ToolExecution,
} from '../types.js'

/** DSH mode that matches Codex's unsandboxed execution. */
const UNSANDBOXED = 'danger-full-access'

/** The model-supplied escalation fields. */
export interface PatchEscalationArgs {
  sandbox_permissions?: string
  justification?: string
}

/** The escalation surface one patch plugin instance advertises. */
export interface PatchSandboxController {
  schemaFields(): Record<string, JsonSchema>
  resolvePolicy(args: PatchEscalationArgs, exec: ToolExecution): Promise<SandboxExecutionPolicy | undefined>
}

/**
 * Build the controller, or nothing when no confining filesystem is mounted.
 * @param ctx - plugin context carrying `fs` and the optional host services.
 * @returns the controller, or undefined for an unconfined composition.
 */
export function createPatchSandbox(ctx: PatchContext): PatchSandboxController | undefined {
  if (ctx.fs.sandboxMode === undefined) return undefined
  const policy = ctx.get('sandboxPolicy')
  if (policy === undefined) throw new Error('patch: the mounted filesystem confines but ctx.sandboxPolicy is missing')
  return {
    schemaFields: () => ({
      sandbox_permissions: {
        type: 'string',
        enum: ['use_default', 'require_escalated'],
        description: 'Per-call sandbox override. Defaults to `use_default`; use `require_escalated` to write outside the sandbox.',
      },
      justification: {
        type: 'string',
        description: 'User-facing approval reason for `require_escalated`; omit otherwise.',
      },
    }),
    resolvePolicy: (args, exec) => resolvePolicy(ctx, policy, args, exec),
  }
}

/**
 * Resolve the policy for one patch. The standing session policy applies unless
 * the model asks for `require_escalated`, which needs user approval unless the
 * session already runs unsandboxed.
 * @param ctx - plugin context, for the optional approval service.
 * @param policy - injected sandbox policy service.
 * @param args - the call's escalation arguments.
 * @param exec - tool execution context (agent, call id, signal).
 * @returns the policy to stamp onto every mutation in this patch.
 */
async function resolvePolicy(
  ctx: PatchContext,
  policy: SandboxPolicyService,
  args: PatchEscalationArgs,
  exec: ToolExecution,
): Promise<SandboxExecutionPolicy | undefined> {
  const standing = policy.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
  if (args.sandbox_permissions !== 'require_escalated' || standing.mode === UNSANDBOXED) return standing

  const approver = ctx.get('approval')
  if (approver === undefined || exec.agent === undefined) {
    throw new Error('require_escalated needs user approval, but no approval channel is available')
  }
  const justification = typeof args.justification === 'string' && args.justification.trim().length > 0
    ? args.justification
    : 'apply this patch'
  const outcome = await approver.request({
    agent: exec.agent,
    toolName: 'apply_patch',
    callId: exec.callId,
    reason: `write files without the sandbox: ${justification}`,
    displayReason: approvalText('unsandboxedFiles', String(justification)),
    signal: exec.signal,
  })
  if (outcome === 'allowed-once') return { ...standing, mode: UNSANDBOXED }
  if (outcome === 'rejected') throw new Error('the user rejected writing this patch without the sandbox')
  if (outcome === 'cancelled') throw new Error('approval for writing this patch without the sandbox was cancelled')
  throw new Error(`require_escalated needs user approval, but approval returned ${JSON.stringify(outcome)}`)
}
