/**
 * Constants from OpenAI Codex's freeform `apply_patch` tool.
 *
 * The description and grammar are copied from Codex commit
 * ca21fe65d18a9b6326759fb4263c65dfbb645aa5; source and license details are in
 * ../../NOTICE. The grammar file is read by the plugin, not embedded, so the
 * bytes sent on the wire are the bytes on disk.
 * @module @spectershell/dsh-harness-codex/freeform/spec
 */

/** Codex's exact description for the custom `apply_patch` tool. */
export const FREEFORM_DESCRIPTION = 'The `apply_patch` tool can be used to edit files. This is a FREEFORM tool, so do not wrap the patch in JSON.'

/** pi-ai wire protocols that can carry custom grammar tools. */
export const RESPONSES_APIS: ReadonlySet<string> = new Set([
  'openai-responses',
  'azure-openai-responses',
  'openai-codex-responses'
])
