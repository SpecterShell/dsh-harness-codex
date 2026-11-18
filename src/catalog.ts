/**
 * Codex model-catalog matching shared by the persona and freeform bridge.
 *
 * Codex matches a requested model against its catalog by longest prefix,
 * retried once with a single leading provider namespace removed
 * (`openai/gpt-6.1-sol` becomes `gpt-6.1-sol`). The generated
 * prompts/codex/models.json is the bundled catalog index; both consumers read
 * the same slugs from it so the persona and the freeform set cannot drift.
 * @module dsh-harness-codex/catalog
 */
import { readFileSync } from 'node:fs'

/** Parse the shipped slug-to-prompt index, in catalog order. */
export function loadCatalogIndex(): Record<string, string> {
  return JSON.parse(readFileSync(new URL('../prompts/codex/models.json', import.meta.url), 'utf8'))
}

/**
 * Codex's candidate order: the model as requested, then its bare slug when a
 * single simple provider namespace is present.
 */
export function slugCandidates(model: string): string[] {
  const namespaced = /^[A-Za-z0-9_-]+\/([^/]+)$/.exec(model)
  return namespaced ? [model, namespaced[1]] : [model]
}

/**
 * Longest catalog slug that prefixes the requested model, like Codex.
 * @returns the matched catalog slug, or undefined when none prefixes it.
 */
export function matchCatalogSlug(slugs: Iterable<string>, model: string): string | undefined {
  const catalog = [...slugs]
  for (const candidate of slugCandidates(model)) {
    let best: string | undefined
    for (const slug of catalog) {
      if (candidate.startsWith(slug) && (!best || slug.length > best.length)) best = slug
    }
    if (best !== undefined) return best
  }
  return undefined
}
