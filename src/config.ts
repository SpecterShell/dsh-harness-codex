/**
 * Live settings shared by the host plugin and the preset rows.
 *
 * The host entry (`./host.ts`) resolves the Schemastery Config once and
 * exposes these values through the `codexSettings` service. Preset rows read
 * the service through `ctx.get` on every use, so a saved change takes effect
 * without remounting the preset. When the service is absent, for example in a
 * headless profile or in a test that mounts a row directly, the row's own
 * `config` remains the only source and this module is inert.
 * @module dsh-harness-codex/config
 */

/** A resolved volatile config field, read through `get()` on every call. */
export interface Volatile<T> {
  get(): T
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
