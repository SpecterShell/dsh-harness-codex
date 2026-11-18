/**
 * Codex's per-command sandbox override for `exec_command`, mapped onto DSH's
 * sandbox policy and approval services.
 *
 * Codex models send `sandbox_permissions: "require_escalated"` with a
 * `justification` when a command needs to run outside the sandbox, so the
 * schema keeps Codex's vocabulary. `require_escalated` maps to DSH's
 * `danger-full-access` mode for this one call, after the user approves it.
 * `prefix_rule` and `with_additional_permissions` have no DSH equivalent and
 * are left out of the schema rather than accepted and ignored.
 */

import { approvalText } from '../approval.ts'
import type {
  ExecCommandArgs,
  ExecContext,
  JsonSchema,
  SandboxExecutionPolicy,
  SandboxPolicyService,
  ToolExecution,
} from '../types.js'

/** DSH mode that matches Codex's unsandboxed execution. */
const UNSANDBOXED = 'danger-full-access'

/** The override fields this module adds to the `exec_command` schema. */
export interface SandboxController {
  schemaFields(): Record<string, JsonSchema>
  resolvePolicy(args: ExecCommandArgs, exec: ToolExecution): Promise<SandboxExecutionPolicy>
  confine(
    argv: readonly string[],
    policy: SandboxExecutionPolicy,
    signal: AbortSignal,
  ): Promise<{ argv: string[] }>
}

/**
 * Build the sandbox controller when the mounted shell executor confines.
 * Without a confining executor the escalation fields are not advertised,
 * matching `dsh-tool-bash`.
 * @param ctx - plugin context after its injected services are available.
 * @returns the controller, or undefined for an unconfined composition.
 */
export function createSandboxController(ctx: ExecContext): SandboxController | undefined {
  if (ctx.shell.sandboxMode === undefined) return undefined
  const policy = ctx.get('sandboxPolicy')
  const sandbox = ctx.get('sandbox')
  if (policy === undefined) throw new Error('exec: the mounted shell confines but ctx.sandboxPolicy is missing')
  if (sandbox === undefined) throw new Error('exec: the mounted shell confines but ctx.sandbox is missing')
  return {
    schemaFields,
    resolvePolicy: (args, exec) => resolvePolicy(ctx, policy, args, exec),
    confine: (argv, resolved, signal) => sandbox.confine(argv, resolved, signal),
  }
}

/** Codex's escalation fields (`shell_spec.rs`, `create_approval_parameters`). */
function schemaFields(): Record<string, JsonSchema> {
  return {
    sandbox_permissions: {
      type: 'string',
      enum: ['use_default', 'require_escalated'],
      description: 'Per-command sandbox override. Defaults to `use_default`; use `require_escalated` for unsandboxed execution.',
    },
    justification: {
      type: 'string',
      description: 'User-facing approval question for `require_escalated`; omit otherwise.',
    },
  }
}

/**
 * Resolve the policy for one call. The standing session policy applies unless
 * the model asks for `require_escalated`, which needs user approval unless the
 * session already runs unsandboxed.
 * @param ctx - plugin context, for the optional approval service.
 * @param policy - injected sandbox policy service.
 * @param args - the call's arguments.
 * @param exec - tool execution context (agent, call id, signal).
 * @returns the policy to hand to the shell executor or `sandbox.confine`.
 */
async function resolvePolicy(
  ctx: ExecContext,
  policy: SandboxPolicyService,
  args: ExecCommandArgs,
  exec: ToolExecution,
): Promise<SandboxExecutionPolicy> {
  const standing = policy.resolve(exec.agent === undefined ? {} : { session: exec.agent.session })
  if (args.sandbox_permissions !== 'require_escalated' || standing.mode === UNSANDBOXED) return standing

  const approver = ctx.get('approval')
  if (approver === undefined || exec.agent === undefined) {
    throw new Error('require_escalated needs user approval, but no approval channel is available')
  }
  const justification = typeof args.justification === 'string' && args.justification.trim().length > 0 ? args.justification : args.cmd
  const outcome = await approver.request({
    agent: exec.agent,
    toolName: 'exec_command',
    callId: exec.callId,
    reason: `run without the sandbox: ${justification}`,
    displayReason: approvalText('unsandboxed', String(justification)),
    signal: exec.signal,
  })
  if (outcome === 'allowed-once') return { ...standing, mode: UNSANDBOXED }
  if (outcome === 'rejected') throw new Error('the user rejected running this command without the sandbox')
  if (outcome === 'cancelled') throw new Error('approval for running this command without the sandbox was cancelled')
  throw new Error(`require_escalated needs user approval, but approval returned ${JSON.stringify(outcome)}`)
}
