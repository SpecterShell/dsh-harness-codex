/**
 * Per-model persona for the Codex preset.
 *
 * Codex renders a catalog model's base instructions from the literal
 * `model_messages.instructions_template` in its models catalog, and uses
 * models-manager/prompt.md for unknown models. The generated files in
 * prompts/codex/ preserve those bytes, and prompts/codex/models.json maps each
 * catalog slug to its file.
 *
 * A requested model is matched the way Codex matches it: a case-sensitive
 * longest-prefix test against catalog slugs, retried once with a single leading
 * provider namespace removed (`openai/gpt-6.1-sol` becomes `gpt-6.1-sol`). The
 * retry only applies when the namespace is a simple provider id and the suffix
 * has no further slash. Unknown OpenAI-looking slugs get Codex's fallback
 * prompt; other models get this package's own prompt.
 *
 * The prompt files are copied byte for byte from OpenAI Codex; source and
 * license details are in ../../NOTICE.
 * @module @spectershell/dsh-harness-codex/persona
 */
import { readFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import { loadCatalogIndex, matchCatalogSlug, slugCandidates } from './catalog.ts'
import type { PersonaContext, PromptContext } from './types.js'

/** Cordis plugin name. */
export const name = 'persona'

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/** Plugin config: whether the picked prompt replaces every inherited section. */
export interface Config {
  /** Make this persona the complete system prompt. Defaults to true. */
  complete?: boolean
}

/** Runtime schema for the persona row. */
export const Config: z<Config> = z.object({
  complete: z.boolean().default(true)
    .description('Replace every inherited prompt section with the selected persona.'),
})

/** The deployment persona slot a preset shadows with its own section. */
const SECTION = 'deployment:persona-prefix'

/** Slugs Codex treats as OpenAI models; its unknown-model fallback applies. */
const OPENAI = /^(?:gpt-|codex-|chatgpt-|o\d)/i

const read = (path: string): string => readFileSync(new URL(`../prompts/${path}`, import.meta.url), 'utf8')

/**
 * Read the catalog and every distinct prompt once per plugin apply, so prompt
 * assembly only selects strings and never touches the filesystem.
 */
function loadPrompts() {
  const index = loadCatalogIndex()
  const files = new Map<string, string>()
  const catalog = new Map<string, string>()
  for (const [slug, file] of Object.entries(index)) {
    if (!files.has(file)) files.set(file, read(`codex/${file}`))
    catalog.set(slug, files.get(file)!)
  }
  return { catalog, fallback: read('codex/prompt.md'), original: read('original.md') }
}

/** Longest catalog slug that prefixes the requested model, like Codex. */
function catalogPrompt(catalog: Map<string, string>, model: string): string | undefined {
  const slug = matchCatalogSlug(catalog.keys(), model)
  return slug === undefined ? undefined : catalog.get(slug)
}

/** Pick one stable prompt for an Agent model, or the original when unknown. */
function selectPrompt(prompts: ReturnType<typeof loadPrompts>, model: unknown): string {
  if (typeof model !== 'string') return prompts.original
  const matched = catalogPrompt(prompts.catalog, model)
  if (matched !== undefined) return matched
  const bare = slugCandidates(model).at(-1)!
  return OPENAI.test(bare) ? prompts.fallback : prompts.original
}

/**
 * Register the persona for this Agent scope.
 * @param ctx - an Agent scope context that injects the system prompt.
 * @param config - whether the section replaces the whole prompt.
 */
export function apply(ctx: PersonaContext, config: Config = {}): void {
  const prompts = loadPrompts()
  // A replacing section is the default: the Codex prompts are whole system
  // prompts. `complete: false` keeps every other section, which the PTC preset
  // needs because its transport instructions and tool SDK come from rows
  // outside this one.
  const complete = config.complete ?? true
  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION,
    order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    text: (context: PromptContext) => selectPrompt(prompts, context.modelSelection?.model ?? context.agent?.options?.model),
    ...(complete ? { complete: true } : {}),
    interpolate: false
  }), 'persona.section()')
}
