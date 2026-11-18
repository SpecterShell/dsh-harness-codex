/**
 * Opt-in freeform `apply_patch` bridge for the Codex preset.
 *
 * Enable it per provider, model, or provider+model with glob rules. The
 * bridge only changes the OpenAI Responses API wire: DSH keeps persisting
 * `apply_patch` as a normal tool call with `{"input": <patch>}`, so switching
 * between freeform and JSON models in one session keeps working. It applies
 * only to requests from Agents bound to this preset, and only to routes whose
 * pi-ai model speaks a Responses protocol.
 *
 * The plugin patches the pi-ai adapter prototype that actually serves the
 * registered routes, because DSH 0.2.2-rc.1 has no supported custom-tool
 * schema. That is the documented risk; see docs/freeform.md.
 * @module @spectershell/dsh-harness-codex/freeform
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import { loadCatalogIndex } from '../catalog.ts'
import { errorMessage, isRecord } from '../guards.ts'
import { compileConfig, matches, parseRuleText } from './rules.ts'
import type { FreeformRule, Matcher } from './rules.js'
import { activateBridge, bindBridgeAdapters } from './bridge.ts'
import type { BridgeInstance } from './bridge.js'
import type { CodexSettingsService } from '../config.js'
import type { FreeformContext } from '../types.js'

/** Cordis plugin name. */
export const name = 'freeform-patch'

/** The host LLM service whose registered adapters this row binds to. */
export const inject = ['llm']

/** The row config after DSH's schema normalization. */
export interface FreeformConfig {
  enabled?: boolean
  rules?: FreeformRule[]
  codexCatalog?: boolean
}

const ruleSchema = z.object({
  provider: z.string().description('Provider route to match, for example openrouter or openai-codex. Omit to match any provider.'),
  model: z.string().description('Model id to match; * is a glob, for example openai/gpt-* or gpt-6*. Omit to match any model.')
})

/**
 * The call face of the schemastery schema. The runtime value stays the real
 * schema; this annotation keeps schemastery's internal cosmokit types out of
 * the published declaration file.
 */
export interface FreeformConfigSchema {
  (data?: unknown, options?: unknown): FreeformConfig
  toJSON(): unknown
}

/** Settings schema shown by DSH's loader-backed configuration surfaces. */
export const Config: FreeformConfigSchema = z.object({
  enabled: z.boolean().default(false).description('Send apply_patch as an OpenAI Responses custom grammar tool for matching requests.'),
  rules: z.array(ruleSchema).default([]).description('Provider/model rules. Omitted fields match anything.'),
  codexCatalog: z.boolean().default(false).description("Also enable it for models the bundled Codex catalog marks as freeform, matched with Codex's prefix rules.")
}) as unknown as FreeformConfigSchema

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')

/** Best-effort provenance for the log line; the adapter is found by registered instance, not by this lookup. */
function piAiVersion(): string {
  for (const anchor of [process.argv[1], import.meta.url]) {
    if (typeof anchor !== 'string') continue
    try {
      const require = createRequire(anchor)
      const manifest = require.resolve('@deepseek-ai/dsh-llm-pi-ai/package.json')
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }
      return parsed.version
    } catch {
      // The host's install layout is not always resolvable from a linked bundle.
    }
  }
  return 'version unknown'
}

/**
 * Merge the row config with the live host settings.
 *
 * `enabled` and `codexCatalog` follow the service when it is present: the
 * Settings UI is the deployment-wide switch, and a row that disagrees with it
 * is the older profile patch. Rule text adds to the row's own rules, so a row
 * that already matches a route keeps working while the UI grows the list.
 * @param config - the row's resolved config.
 * @param settings - the host service, or undefined in a headless composition.
 * @returns the config the bridge should act on.
 */
export function effectiveConfig(config: FreeformConfig, settings: CodexSettingsService | undefined): FreeformConfig {
  if (settings === undefined) return config
  const live = settings.freeform()
  const liveRules = parseRuleText(live.rules)
  return {
    enabled: live.enabled,
    codexCatalog: live.codexCatalog,
    rules: liveRules.length === 0 ? config.rules : [...(config.rules ?? []), ...liveRules],
  }
}

/**
 * Install the per-preset bridge.
 *
 * With the settings service present the bridge follows the live `enabled`
 * flag: turning it on in the Settings UI activates the adapter patch then,
 * and turning it off restores the adapter without unloading the row. Without
 * the service the row config is the only source and a disabled row installs
 * nothing, which keeps headless profiles and direct test mounts unchanged.
 * @param ctx - preset-scope context that injects the host `llm` service.
 * @param config - resolved `enabled`, `rules`, and `codexCatalog` settings.
 */
export function apply(ctx: FreeformContext, config: FreeformConfig = {}): void {
  const settings = ctx.get('codexSettings')
  if (settings === undefined && effectiveConfig(config, settings).enabled !== true) return
  let catalogSlugs: string[]
  try {
    catalogSlugs = Object.keys(loadCatalogIndex())
  } catch (error) {
    throw new Error(`freeform: cannot read the bundled Codex catalog: ${errorMessage(error)}`, { cause: error })
  }
  let instance: BridgeInstance | undefined
  let disposeBridge: (() => void) | undefined
  let warned = false

  /** Undo the adapter patch when the live setting turns the bridge off. */
  const deactivate = (): void => {
    disposeBridge?.()
    disposeBridge = undefined
    instance = undefined
  }

  /** Read the live config and install the adapter patch when it is enabled. */
  const activate = (): void => {
    if (instance !== undefined) return
    const effective = effectiveConfig(config, settings)
    const matcher: Matcher | undefined = compileConfig(effective, catalogSlugs)
    if (matcher === undefined) {
      if (!warned) {
        warned = true
        ctx.logger.warn('freeform: enabled with no rules and codexCatalog false; apply_patch stays a JSON function tool')
      }
      return
    }
    const grammar = read('../../assets/codex/apply_patch.lark')
    if (grammar.trim().length === 0) throw new Error('freeform: the bundled apply_patch grammar is empty')
    const next: BridgeInstance = {
      logger: ctx.logger,
      llm: ctx.llm,
      grammar,
      matcher,
      version: piAiVersion(),
      signals: new WeakSet(),
      warned: new Set(),
      // Rules are read on every request: a settings save recompiles them
      // without touching the already installed prototype patch.
      matches: (provider, model) => {
        const live = effectiveConfig(config, settings)
        if (live.enabled !== true) return false
        const current = compileConfig(live, catalogSlugs)
        return current !== undefined && matches(current, provider, model)
      }
    }
    disposeBridge = activateBridge(next)
    instance = next
  }

  /** Follow the current setting; a no-op while already in that state. */
  const sync = (): void => {
    if (effectiveConfig(config, settings).enabled === true) activate()
    else deactivate()
  }

  // The effect owns the undo: unloading the row restores the prototype once the
  // last preset revision using it is gone. Activations after mount are undone
  // by the same cleanup because the disposer is replaced.
  ctx.effect(() => () => deactivate(), 'freeform.bridge()')
  // The settings service emits this after a saved form write. It is a plain
  // app event, so a preset row and the host entry do not need to share a scope.
  // A failure here must not turn the host's successful document write into an
  // error, so only the mount-time sync is allowed to throw.
  ctx.on('settings/document-updated', () => {
    try {
      sync()
    } catch (error) {
      ctx.logger.warn(`freeform: could not apply the saved setting; apply_patch stays a JSON function tool (${errorMessage(error)})`)
    }
  })
  // `agent/request` is scoped to this preset's Agents and carries the exact
  // AbortSignal later placed on GenerateOptions, which is what the adapter
  // wrapper tests. `llm/stream` is a global waterfall (it would show other
  // presets' requests), and the request object does not exist yet when
  // prepareCall runs, so the signal is the request-stable identity available
  // at both adapter entry points. See docs/freeform.md.
  ctx.on('agent/request', (payload: unknown, next?: () => unknown) => {
    const signal = isRecord(payload) ? payload.signal : undefined
    if (instance !== undefined && isRecord(signal)) instance.signals.add(signal)
    return next?.()
  }, { prepend: true })
  // A route may register after this preset mounts, and a second
  // dsh-llm-pi-ai copy may appear later. Bind each adapter as it arrives.
  ctx.on('llm/adapters-updated', () => {
    if (instance === undefined) return
    try {
      bindBridgeAdapters(instance)
    } catch (error) {
      ctx.logger.warn(`freeform: could not bind a newly registered pi-ai adapter; apply_patch stays a JSON function tool (${errorMessage(error)})`)
    }
  })
  sync()
}
