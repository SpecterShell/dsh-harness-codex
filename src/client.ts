/**
 * Installed client entry: the Plugins-page settings card and the exec tool
 * conversation rows.
 *
 * lib/client.js bundles this module into the ModuleLoader registration the
 * page executes. The host entry owns the schema and the values; this entry
 * installs dictionaries, the staged form, and the `tool.call.toolview`
 * entries for `exec_command` and `write_stdin`.
 * @module @spectershell/dsh-harness-codex/client
 */
import { mountSettingsCard } from './client-settings.js'
import type { SettingsContext } from './client-settings.js'
import { apply as applyToolviews } from './client-toolview.js'
import type { ToolviewContext } from './client-toolview.js'
import { locales } from './locales.ts'

export { mountSettingsCard }
export { locales }

/** The subset of the DSH client context this plugin uses. */
export type ClientContext = SettingsContext & ToolviewContext & {
  locale: {
    register: (namespace: string, dictionaries: Record<string, Record<string, string>>) => () => void
    bind: (namespace: string) => (key: string) => string
  }
}

/**
 * Install the dictionaries, the settings card, and the exec tool rows.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  // Registration is its own effect so disposing the plugin also unregisters
  // the dictionaries. The card binds a translator over the same namespace.
  ctx.effect(() => ctx.locale.register('@spectershell/dsh-harness-codex', locales), '@spectershell/dsh-harness-codex: locales')
  mountSettingsCard(ctx, ctx.locale.bind('@spectershell/dsh-harness-codex'))
  applyToolviews(ctx)
}

export const inject = ['locale', 'slots', 'configForms', 'remote', 'remote.session']
