/**
 * Live settings shared by the host plugin and the preset rows.
 *
 * The host entry (`./host.ts`) resolves the Schemastery Config once and
 * exposes these values through the `codexSettings` service. Preset rows read
 * the service through `ctx.get` on every use, so a saved change takes effect
 * without remounting the preset. When the service is absent, for example in a
 * headless profile or in a test that mounts a row directly, the row's own
 * `config` remains the only source and this module is inert.
 * @module @spectershell/dsh-harness-codex/config
 */

/** A resolved volatile config field, read through `get()` on every call. */
export interface Volatile<T> {
  get(): T
}

/**
 * One rule as the freeformRules text field stores it.
 *
 * The shape matches the bridge's `FreeformRule`: an omitted field matches
 * anything, and `*` is the only glob metacharacter. The settings card parses
 * the stored text into these entries, edits the list, and writes the lines
 * back, so the service and the bridge see the same value they always did.
 */
export interface RuleText {
  provider?: string
  model?: string
}

/** The volatile field wrappers the host entry receives from Cordis. */
export interface CodexSettingsSource {
  freeformEnabled: Volatile<boolean>
  freeformCodexCatalog: Volatile<boolean>
  freeformRules: Volatile<string>
  surfaceAllow: Volatile<string>
  instructionsMaxBytes: Volatile<number>
}

/** Settings applied to the free-form `apply_patch` bridge. */
export interface FreeformSettings {
  /** Send `apply_patch` as a grammar tool when this is on. */
  enabled: boolean
  /** Raw rule text, one `provider:model` rule per line. */
  rules: string
  /** Follow the bundled Codex catalog's free-form model list. */
  codexCatalog: boolean
}

/** The read-only service the host entry provides. */
export interface CodexSettingsService {
  /** Free-form patch controls, read from the volatile Config on every call. */
  freeform(): FreeformSettings
  /** Tool names that stay visible inside the preset, on top of the surface row. */
  surfaceAllow(): string[]
  /** UTF-8 byte budget for project instruction files. */
  instructionsMaxBytes(): number
}

/** The settings UI defaults, also the values a profile without overrides sees. */
export const defaults = Object.freeze({
  freeformEnabled: false,
  freeformCodexCatalog: false,
  freeformRules: '',
  surfaceAllow: '',
  instructionsMaxBytes: 32 * 1024,
})

/**
 * Split a comma or whitespace separated tool list.
 * @param text - the raw field value.
 * @returns the non-empty names in their written order, without duplicates.
 */
export function parseToolNames(text: string): string[] {
  const names = text.split(/[\s,]+/).filter((name) => name.length > 0)
  return [...new Set(names)]
}

/** The field separator in one stored rule line. */
const RULE_SEPARATOR = ':'

/**
 * Parse one rule line into its provider and model.
 *
 * The dialect is the one the freeform bridge accepts: `provider:model`,
 * `provider:` or `:model`, split at the first colon so a model id that itself
 * contains a colon stays whole. Surrounding whitespace is ignored, and a line
 * without a separator names nothing.
 * @param line - one line of the stored field.
 * @returns the rule, or undefined for a blank or separator-less line.
 */
export function parseRuleLine(line: string): RuleText | undefined {
  const trimmed = line.trim()
  if (trimmed.length === 0) return undefined
  const colon = trimmed.indexOf(RULE_SEPARATOR)
  if (colon < 0) return undefined
  const provider = trimmed.slice(0, colon).trim()
  const model = trimmed.slice(colon + 1).trim()
  // A lone separator names nothing and would match every route by accident;
  // it is ignored like a blank line, as the bridge ignores it.
  if (provider.length === 0 && model.length === 0) return undefined
  return {
    ...(provider.length === 0 ? {} : { provider }),
    ...(model.length === 0 ? {} : { model }),
  }
}

/**
 * Parse the stored freeformRules text into editable rules.
 * @param text - one rule per line, blank lines and stray separators allowed.
 * @returns the rules in written order; malformed lines are skipped.
 */
export function parseRuleList(text: string): RuleText[] {
  const rules: RuleText[] = []
  for (const line of text.split(/\r?\n/)) {
    const rule = parseRuleLine(line)
    if (rule !== undefined) rules.push(rule)
  }
  return rules
}

/**
 * Write rules back to the stored newline-joined form.
 * @param rules - rules in display order; entries naming neither field are skipped.
 * @returns one `provider:model` line per rule, without a trailing newline.
 */
export function formatRuleList(rules: readonly RuleText[]): string {
  const lines: string[] = []
  for (const rule of rules) {
    if (rule.provider === undefined && rule.model === undefined) continue
    lines.push(`${rule.provider ?? ''}${RULE_SEPARATOR}${rule.model ?? ''}`)
  }
  return lines.join('\n')
}

/**
 * Parse the card's free-text add field, which also accepts a bare pattern.
 *
 * A line without a colon is a model pattern rather than an error, because the
 * model ids users copy from a provider often contain slashes (`openai/gpt-*`)
 * and no colon at all.
 * @param text - the custom rule input.
 * @returns the rule, or undefined for blank text or a lone separator.
 */
export function parseRuleEntry(text: string): RuleText | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  if (!trimmed.includes(RULE_SEPARATOR)) return { model: trimmed }
  return parseRuleLine(trimmed)
}

/** Stable identity for one rule, so exact duplicate lines are not added twice. */
function ruleKey(rule: RuleText): string {
  return `${rule.provider ?? ''}\u0000${rule.model ?? ''}`
}

/**
 * Append a rule to a list, keeping exact duplicates out.
 * @param rules - the current list, in display order.
 * @param rule - the rule to append; one naming neither field is ignored.
 * @returns a new list with the rule at the end, or a copy when it already exists.
 */
export function addRule(rules: readonly RuleText[], rule: RuleText): RuleText[] {
  if (rule.provider === undefined && rule.model === undefined) return [...rules]
  const key = ruleKey(rule)
  return rules.some(existing => ruleKey(existing) === key) ? [...rules] : [...rules, { ...rule }]
}

/**
 * Remove one rule by its position.
 * @param rules - the current list, in display order.
 * @param index - the row's index.
 * @returns a new list without that row, or a copy when the index is out of range.
 */
export function removeRuleAt(rules: readonly RuleText[], index: number): RuleText[] {
  if (index < 0 || index >= rules.length) return [...rules]
  return rules.filter((_rule, at) => at !== index)
}

/**
 * Build the live settings face over the volatile config wrappers.
 *
 * Every method reads its wrapper when called, so a Settings UI write reaches
 * the next request or pre-step without replacing the service. Keeping the
 * service a plain object (rather than a Cordis Service subclass) lets the
 * configured row stay a functional plugin with an exported `Config`.
 * @param config - volatile wrappers resolved by Cordis.
 * @returns the read-only service the host entry provides.
 */
export function createCodexSettings(config: CodexSettingsSource): CodexSettingsService {
  return {
    freeform: () => ({
      enabled: config.freeformEnabled.get(),
      rules: config.freeformRules.get(),
      codexCatalog: config.freeformCodexCatalog.get(),
    }),
    surfaceAllow: () => parseToolNames(config.surfaceAllow.get()),
    instructionsMaxBytes: () => config.instructionsMaxBytes.get(),
  }
}
