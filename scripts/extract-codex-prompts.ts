#!/usr/bin/env node
/**
 * Regenerate prompts/codex from an OpenAI Codex checkout.
 *
 * Codex renders a catalog model's base instructions from
 * codex-rs/models-manager/models.json (`model_messages.instructions_template`)
 * and uses codex-rs/models-manager/prompt.md for unknown models. This script
 * copies the fallback verbatim, writes one file per distinct template, records
 * the slug-to-file mapping in models.json, and copies the local-compaction
 * prompt and summary prefix. Every shipped prompt can then be refreshed from a
 * newer Codex checkout.
 *
 * Expected Codex commit: ca21fe65d18a9b6326759fb4263c65dfbb645aa5.
 *
 * Usage: node scripts/extract-codex-prompts.ts <codex-checkout> [out-dir]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The catalog shape this script consumes. */
interface CodexModel {
  slug: string
  model_messages?: { instructions_template?: unknown }
}

const [checkoutArg, outArg] = process.argv.slice(2)
if (!checkoutArg) {
  console.error('usage: node scripts/extract-codex-prompts.ts <codex-checkout> [out-dir]')
  process.exit(2)
}

const checkout = resolve(checkoutArg)
const out = outArg ? resolve(outArg) : fileURLToPath(new URL('../prompts/codex/', import.meta.url))
const { models } = JSON.parse(
  await readFile(join(checkout, 'codex-rs/models-manager/models.json'), 'utf8')
) as { models: CodexModel[] }
const fallback = await readFile(join(checkout, 'codex-rs/models-manager/prompt.md'))
const compactPrompt = await readFile(join(checkout, 'codex-rs/prompts/templates/compact/prompt.md'))
const compactSummaryPrefix = await readFile(join(checkout, 'codex-rs/prompts/templates/compact/summary_prefix.md'))

await mkdir(out, { recursive: true })
await writeFile(join(out, 'prompt.md'), fallback)
await writeFile(join(out, 'compact-prompt.md'), compactPrompt)
await writeFile(join(out, 'compact-summary-prefix.md'), compactSummaryPrefix)

/** One file per exact template, named after the first catalog slug that uses it. */
const files = new Map<string, string>()
const index: Record<string, string> = {}
for (const { slug, model_messages: messages } of models) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(slug)) throw new Error(`unsafe model slug: ${slug}`)
  const template = messages?.instructions_template
  if (typeof template !== 'string') {
    throw new Error(`model ${slug} has no model_messages.instructions_template`)
  }
  let file = files.get(template)
  if (!file) {
    file = `${slug}.md`
    files.set(template, file)
    await writeFile(join(out, file), template)
  }
  index[slug] = file
}

const sorted = Object.fromEntries(
  Object.entries(index).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
)
await writeFile(join(out, 'models.json'), `${JSON.stringify(sorted, null, 2)}\n`)
console.log(`wrote ${files.size + 4} files to ${out}`)
