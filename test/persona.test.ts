/**
 * Prove the persona chooses its text from the Agent model at assembly time.
 * The real prompt registry supplies the same complete-section and runtime
 * context behavior the preset gets in an Agent scope. A second test keeps the
 * committed Codex prompts reproducible from the pinned checkout.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { native, mount, temporary } from './fixtures/native-host.ts'

const { Context } = await native('cordis')
const { SystemPrompt, renderPrompt, renderContextSnapshot } = await native('dsh-system-prompt')
const { createScope } = await native('dsh-scope')
const persona = await import('../src/persona.ts')

const read = (path: string) => readFile(new URL(`../prompts/${path}`, import.meta.url), 'utf8')

test('persona follows the Codex model mapping and keeps other models original', async t => {
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, SystemPrompt, { includeHarnessIdentity: false })
  host.systemPrompt.context({ name: 'proof:runtime', order: 0, required: true, text: 'runtime' })

  // The scoped section shadows the registry's global deployment persona.
  const key = {}
  const scope = createScope(host, key)
  await scope.ctx.fiber.await()
  await mount(scope.ctx, persona)

  const assemble = (model: string, provider = 'openai') => host.systemPrompt.assemble({
    scope: key,
    modelSelection: { provider, model }
  })

  const cases: Array<[string, string] | [string, string, string]> = [
    ['gpt-6.1-sol', 'codex/gpt-6.1-sol.md'],
    ['gpt-5.6-sol', 'codex/gpt-5.6-sol.md'],
    ['gpt-6-astra', 'codex/gpt-6-astra.md'],
    ['gpt-6.1-terra', 'codex/gpt-6-astra.md'],
    ['openai/gpt-6.1-sol', 'codex/gpt-6.1-sol.md'],
    ['gpt-6.1-sol-preview', 'codex/gpt-6.1-sol.md'],
    ['gpt-99-unknown', 'codex/prompt.md'],
    ['GPT-6.1-SOL', 'codex/prompt.md'],
    ['deepseek-flash', 'original.md', 'deepseek']
  ]
  for (const [model, file, provider] of cases) {
    const assembly = await assemble(model, provider)
    assert.equal(renderPrompt(assembly), await read(file), model)
    assert.ok(renderContextSnapshot(assembly).endsWith('runtime'), model)
  }

  const first = await assemble('gpt-5.6-sol')
  const second = await assemble('gpt-5.6-sol')
  assert.equal(renderPrompt(first), renderPrompt(second))
  assert.deepEqual(first, second)
})

test('persona is a complete section by default and can keep inherited sections', async t => {
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, SystemPrompt, { includeHarnessIdentity: false })
  host.systemPrompt.section({ name: 'proof:inherited', order: 0, text: 'inherited guidance' })

  const original = await read('original.md')
  const assemble = async (config?: unknown) => {
    const key = {}
    const scope = createScope(host, key)
    await scope.ctx.fiber.await()
    await mount(scope.ctx, persona, config)
    return host.systemPrompt.assemble({
      scope: key,
      modelSelection: { provider: 'deepseek', model: 'deepseek-flash' },
    })
  }

  // The schema default is the historic behavior: the selected persona replaces
  // every inherited section.
  assert.equal(persona.Config({}).complete, true)
  const complete = await assemble()
  assert.equal(renderPrompt(complete), original)

  // `complete: false` omits the flag, so the inherited section renders beside
  // the persona instead of being suppressed.
  const partial = await assemble({ complete: false })
  const prompt = renderPrompt(partial)
  assert.notEqual(prompt, original)
  assert.ok(prompt.startsWith(original), prompt)
  assert.ok(prompt.endsWith('inherited guidance'), prompt)
})

const codexCheckout = process.env.CODEX_CHECKOUT ?? ''
const codexMissing = `Codex checkout not found at ${codexCheckout}`

test('extraction script reproduces the shipped Codex prompts', {
  skip: existsSync(codexCheckout) ? false : codexMissing
}, async t => {
  const out = await temporary(t)
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../scripts/extract-codex-prompts.ts', import.meta.url)),
    codexCheckout,
    out
  ], { encoding: 'utf8' })

  const committed = fileURLToPath(new URL('../prompts/codex/', import.meta.url))
  const generated = (await readdir(out)).sort()
  assert.deepEqual(
    generated,
    (await readdir(committed)).filter(name => name !== 'LICENSE').sort()
  )

  for (const name of generated) {
    const [actual, expected] = await Promise.all([
      readFile(join(out, name)),
      readFile(join(committed, name))
    ])
    assert.ok(actual.equals(expected), name)
  }
})
