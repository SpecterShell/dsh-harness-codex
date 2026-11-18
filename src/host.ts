/**
 * Host entry: the live settings schema and its `codexSettings` service.
 *
 * The Settings UI renders a form from this Schemastery Config, and every
 * field is volatile so a saved value reaches the running preset without a
 * restart. The preset rows read the service through `ctx.get`, never this
 * module directly, because they run in their own scopes and may be mounted
 * without the host entry in headless profiles.
 * @module @spectershell/dsh-harness-codex/host
 */
import z from '@deepseek-ai/schemastery'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defaults, createCodexSettings } from './config.ts'
import type { CodexSettingsService, CodexSettingsSource } from './config.js'

/** The minimal slice of the DSH webServer service this entry uses. */
interface WebServerLike {
  register(route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void
  }): () => void
}

/** The volatile config Cordis hands `apply`, one wrapper per field. */
export type CodexVolatileConfig = CodexSettingsSource

/** The minimal slice of the Cordis host context this entry uses. */
export interface HostContext {
  provide(name: 'codexSettings', value: CodexSettingsService): void
  inject(
    deps: ['webServer'],
    callback: (ctx: {
      webServer: WebServerLike
      effect: (setup: () => (() => void) | void, label: string) => unknown
    }) => void,
  ): unknown
}

/**
 * Settings form schema. Bounds match the client-side validation so a value
 * the form accepts is also a value the budget reader can use.
 *
 * Rules stay a single text field rather than a list of objects: the Settings
 * UI edits one multiline value, and the freeform row parses it into the same
 * matcher it builds from its own `rules` array.
 */
export const Config = z.object({
  freeformEnabled: z.boolean().default(defaults.freeformEnabled)
    .description('Send apply_patch to matching models as an OpenAI Responses grammar tool instead of a JSON function.')
    .volatile(),
  freeformCodexCatalog: z.boolean().default(defaults.freeformCodexCatalog)
    .description('Also enable the free-form bridge for models the bundled Codex catalog marks as free-form.')
    .volatile(),
  freeformRules: z.string().default(defaults.freeformRules)
    .description('One rule per line: provider:model, provider:, or :model. * is a glob; an empty field keeps the preset row rules.')
    .volatile(),
  surfaceAllow: z.string().default(defaults.surfaceAllow)
    .description('Comma or space separated tool names that stay visible inside the preset, in addition to the surface row allow list.')
    .volatile(),
  instructionsMaxBytes: z.number().min(1024).max(262144).default(defaults.instructionsMaxBytes)
    .description('UTF-8 byte budget for project instruction files.')
    .volatile(),
})

/**
 * Install the services this package contributes to the host.
 * @param ctx - host context; the service is visible to every preset row.
 * @param config - volatile field wrappers resolved by Cordis.
 */
export function apply(ctx: HostContext, config: CodexVolatileConfig): void {
  ctx.provide('codexSettings', createCodexSettings(config))
  // webServer can activate after this entry; deferred injection registers the
  // route only when the service appears. The settings form reads the same
  // values through the loader-backed config mirror, so this route is for
  // diagnostics and for clients that do not speak that mirror.
  ctx.inject(['webServer'], (injected) => {
    injected.effect(() => injected.webServer.register({
      kind: 'exact',
      path: '/codex/settings.json',
      handler(_req, res) {
        const current = {
          freeformEnabled: config.freeformEnabled.get(),
          freeformCodexCatalog: config.freeformCodexCatalog.get(),
          freeformRules: config.freeformRules.get(),
          surfaceAllow: config.surfaceAllow.get(),
          instructionsMaxBytes: config.instructionsMaxBytes.get(),
        }
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify(current))
      },
    }), '@spectershell/dsh-harness-codex: settings route')
  })
}
