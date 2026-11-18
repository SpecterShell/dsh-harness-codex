/**
 * Rule matching for the freeform bridge.
 *
 * A rule matches when every field it names matches the request. `provider`
 * and `model` are exact strings or `*` globs, and an omitted field matches
 * anything. The optional Codex catalog match is separate: a model counts as
 * catalog-freeform when Codex's longest-prefix catalog lookup finds it.
 * @module @spectershell/dsh-harness-codex/freeform/rules
 */
import { matchCatalogSlug } from '../catalog.ts'
import { isRecord } from '../guards.ts'

/** One provider/model rule; omitted fields match anything. */
export interface FreeformRule {
  provider?: string
  model?: string
}

/** The compiled form the bridge consults on every request. */
export interface Matcher {
  rules: FreeformRule[]
  catalogSlugs: readonly string[]
}

/** Raw plugin config before validation. */
export interface RuleConfig {
  enabled?: unknown
  rules?: unknown
  codexCatalog?: unknown
}

/** `*` is the only glob metacharacter, and it matches any run of characters. */
function glob(pattern: string, value: string): boolean {
  if (pattern === '*') return true
  const source = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${source}$`).test(value)
}

/**
 * Parse the settings text form into the same rules the row config uses.
 *
 * The line dialect is deliberately the smallest one that covers the row
 * format: `provider:model`, `provider:` and `:model`, with `*` as a glob.
 * Malformed lines are skipped rather than thrown: this text is edited live
 * from the Settings UI, where a throw would poison every later request.
 * @param text - one rule per line, blank lines allowed.
 * @returns the rules in written order.
 */
export function parseRuleText(text: string): FreeformRule[] {
  const rules: FreeformRule[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const colon = trimmed.indexOf(':')
    if (colon < 0) continue
    const provider = trimmed.slice(0, colon).trim()
    const model = trimmed.slice(colon + 1).trim()
    // ":": both sides empty names nothing, so it would match anything by
    // accident; skipping keeps a stray separator inert.
    if (provider.length === 0 && model.length === 0) continue
    rules.push({
      ...(provider.length === 0 ? {} : { provider }),
      ...(model.length === 0 ? {} : { model }),
    })
  }
  return rules
}

/**
 * Compile and validate the plugin config into the form the bridge consults.
 * Validation happens here rather than at request time so a bad rule fails the
 * preset mount with a clear message instead of leaving apply_patch as JSON.
 * @param config - `enabled`, `rules`, and `codexCatalog` as resolved by DSH.
 * @param catalogSlugs - freeform slugs from the bundled Codex catalog.
 * @returns matching state, or undefined when the bridge is disabled.
 */
export function compileConfig(
  config: RuleConfig = {},
  catalogSlugs: readonly string[] = [],
): Matcher | undefined {
  if (config.enabled !== true) return undefined
  const rules = config.rules ?? []
  if (!Array.isArray(rules)) throw new TypeError('freeform: rules must be an array')
  for (const [index, rule] of rules.entries()) {
    if (!isRecord(rule) || Array.isArray(rule)) {
      throw new TypeError(`freeform: rules[${index}] must be an object`)
    }
    for (const field of ['provider', 'model'] as const) {
      const value = rule[field]
      if (value !== undefined && (typeof value !== 'string' || value.length === 0)) {
        throw new TypeError(`freeform: rules[${index}].${field} must be a non-empty string when set`)
      }
    }
  }
  const codexCatalog = config.codexCatalog === true
  const validRules = rules as FreeformRule[]
  if (validRules.length === 0 && !codexCatalog) return undefined
  return { rules: validRules, catalogSlugs: codexCatalog ? catalogSlugs : [] }
}

/**
 * Test one request against the compiled matcher.
 * @param matcher - result of {@link compileConfig}.
 * @param provider - request provider route.
 * @param model - requested model id.
 * @returns whether this route is enabled.
 */
export function matches(matcher: Matcher, provider: string, model: string): boolean {
  if (matcher.rules.some(rule =>
    (rule.provider === undefined || glob(rule.provider, provider))
    && (rule.model === undefined || glob(rule.model, model)))) return true
  return matcher.catalogSlugs.length > 0 && matchCatalogSlug(matcher.catalogSlugs, model) !== undefined
}
