/**
 * Narrow the tool surface of Agents that select this preset.
 *
 * The mask is a `deny` list in the preset's own scope, not an `allow` list in
 * each Agent's scope. `ToolsService.view()` filters inherited names through
 * every layer of the scope chain, and an Agent's preset binding parents the
 * Agent scope onto this one, so the deny follows the binding for free:
 * `AgentPresetRegistry` rebinding only re-parents the Agent scope
 * (`recompose()`/`select()`), so a blank session that switches to or away from
 * this preset gains or loses the mask without a new `agent/created`. An
 * `allow` list here would be wrong instead: `restrict()` validates names
 * against the calling scope's inherited `restrictableNames`, and this preset's
 * own registrations are inherited by its Agents, so an allow list would hide
 * every tool this preset registers. Denying only host tools leaves those rows
 * visible.
 *
 * `view()` takes an exact scope key, and `@deepseek-ai/dsh-scope` is not a
 * declared dependency of this plugin, so `scopeOf(ctx)` is not available here.
 * The key is not needed for the names: the registry creates a preset scope
 * with no enclosing scope, so its inherited names are exactly the global tool
 * names, which `view()` returns when called without a scope. `restrict()`
 * still validates against that same global set from inside the preset scope.
 */
import type { SurfaceContext } from './types.js'

/** Diagnostic plugin name. */
export const name = 'preset-surface'

/** `tools` supplies the mask and the change event that keeps it current. */
export const inject = ['tools']

/** The row config: host tool names the deployment wants to keep. */
export interface SurfaceConfig {
  allow?: string[]
  /**
   * Host tool names to hide instead of everything else. When present, the
   * preset masks exactly these names (for the extended preset, which keeps
   * non-conflicting host tools); when absent, every host tool is hidden.
   */
  deny?: string[]
}

/**
 * Install the host-tool deny list and keep it in step with the tool registry.
 *
 * `allow` is the escape hatch for a deployment that wants a host tool kept;
 * it defaults to none. Names that the preset itself registers never appear in
 * the global view, so they never need an exemption.
 *
 * @param ctx - preset-scope context, whose scope owns the restriction.
 * @param config - `allow`, host tool names to let through.
 */
export function apply(ctx: SurfaceContext, config: SurfaceConfig = {}): void {
  const allow = config.allow ?? []
  if (!Array.isArray(allow) || allow.some((tool) => typeof tool !== 'string')) {
    throw new TypeError('preset-surface: allow must be an array of tool names')
  }
  const rowAllowed = new Set(allow)
  const denyOnly = config.deny
  if (denyOnly !== undefined && (!Array.isArray(denyOnly) || denyOnly.some((tool) => typeof tool !== 'string'))) {
    throw new TypeError('preset-surface: deny must be an array of tool names')
  }
  let masked: string[] = []
  let dispose: (() => void) | undefined
  let syncing = false

  /**
   * Recompute the deny set and reinstall the restriction only when it changed.
   *
   * The settings service, when mounted, adds its allow list on top of the
   * row's list. It is read here, not captured once, so a saved setting is
   * picked up the next time the mask is recomputed.
   *
   * With `deny` configured the mask is exactly those names; unknown names are
   * dropped because a row can be platform-disabled. Without it every known
   * host tool is masked. Either way the list is intersected with the current
   * registry view, so a tool that registers later is picked up when its name
   * is in the set.
   *
   * `restrict()` emits `tools/change` like any other layer mutation, so the
   * listener would otherwise dispose and reinstall its own mask forever. That
   * echo is not a change to react to. An empty deny set installs nothing:
   * `restrict({ deny: [] })` would add a no-op layer and another change.
   */
  const sync = (): void => {
    if (syncing) return
    const liveAllowed = ctx.get('codexSettings')?.surfaceAllow() ?? []
    const allowed = new Set([...rowAllowed, ...liveAllowed])
    const known = ctx.tools.view().restrictableNames
    const deny = (denyOnly === undefined
      ? [...known].filter((tool) => !allowed.has(tool))
      : denyOnly.filter((tool) => known.has(tool) && !allowed.has(tool))
    ).sort()
    if (deny.length === masked.length && deny.every((tool, index) => tool === masked[index])) return
    syncing = true
    try {
      dispose?.()
      dispose = deny.length === 0 ? undefined : ctx.tools.restrict({ deny })
      masked = deny
    } finally {
      syncing = false
    }
  }

  // `restrict()` attaches its layer effect to this plugin's fiber, so unloading
  // the preset lifts the mask; the disposer is retained only to replace it.
  ctx.on('tools/change', sync)
  // A saved settings form changes the allow list without touching the tool
  // registry, so the registry event alone would leave the mask stale.
  ctx.on('settings/document-updated', sync)
  sync()
}
