/**
 * Runtime dictionaries for the settings card.
 *
 * The locale JSON files mix flat runtime strings with nested `meta` and
 * `approval` objects. Importing them at build time keeps the browser free of
 * runtime dictionary fetches, and the filter below keeps the nested objects
 * out of the flat map the locale service expects.
 * @module dsh-harness-codex/locales
 */
import en from '../locale/en.json' with { type: 'json' }
import zh from '../locale/zh.json' with { type: 'json' }

export type Locales = Record<string, Record<string, string>>

/**
 * Keep only top-level string values.
 * @param dictionaries - the imported JSON dictionaries.
 * @returns the flat runtime map for the locale service.
 */
export function runtimeLocales(dictionaries: Record<string, Record<string, unknown>>): Locales {
  return Object.fromEntries(Object.entries(dictionaries).map(([language, dictionary]) => [
    language,
    Object.fromEntries(Object.entries(dictionary).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
  ]))
}

export const locales = runtimeLocales({ en, zh })
