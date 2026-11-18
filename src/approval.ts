/**
 * Localized approval prompts for the one-shot sandbox escalations this bundle
 * offers.
 *
 * The approval service carries a localized-text map, so every message shown to
 * the user is built from the shipped catalogs rather than an English literal.
 * @module @spectershell/dsh-harness-codex/approval
 */
import en from '../locale/en.json' with { type: 'json' }
import zh from '../locale/zh.json' with { type: 'json' }

/** The approval templates this package ships. */
export type ApprovalTemplate = 'unsandboxed' | 'unsandboxedFiles'

/** Per-locale templates; TypeScript rejects a catalog that misses a template. */
const CATALOGS: Readonly<Record<string, Record<ApprovalTemplate, string>>> = {
  en: {
    unsandboxed: en.approval.unsandboxed,
    unsandboxedFiles: en.approval.unsandboxedFiles,
  },
  zh: {
    unsandboxed: zh.approval.unsandboxed,
    unsandboxedFiles: zh.approval.unsandboxedFiles,
  },
}

/**
 * Build the localized approval prompt for one escalation.
 * @param template - which kind of operation is being widened.
 * @param justification - the model's reason, kept verbatim.
 * @returns a DSH localized-text map keyed by language.
 */
export function approvalText(template: ApprovalTemplate, justification: string): Record<string, string> {
  return Object.fromEntries(Object.entries(CATALOGS).map(([locale, catalog]) => [
    locale,
    catalog[template].replace('{justification}', justification),
  ]))
}
