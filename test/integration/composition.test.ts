/**
 * Prove registry and persona seams through the real in-memory Cordis Loader.
 * No deployed profile, provider account or Agent loop participates in this fixture.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { native, english, chinese } from '../fixtures/native-host.ts'
import type { HostValue } from '../fixtures/native-host.ts'

const { Context } = await native('cordis')
const { Loader } = await native('cordis-plugin-loader')
const { SystemPrompt, renderPrompt, renderContextSnapshot } = await native('dsh-system-prompt')
const { ToolsService, validateJsonSchemaValue } = await native('dsh-tools')
const { createScope, scopeOf } = await native('dsh-scope')
const executor = await native('dsh-tool-executor-native')

/** Raw object-rooted schemas are required at the direct registry boundary. */
function definition(name: string, description: string, value = description) {
  return {
    name,
    description,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'string' },
      /** Render the actual typed result, preserving translator-owned text. */
      render: (_context: unknown, result: string) => [{ type: 'text', text: result }],
    },
    /** The harmless fixture exercises result projection without running commands. */
    execute: async (): Promise<string> => value,
  }
}

/** Collect leaf paths so translators can change text independently of assertions. */
function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof child === 'object' ? keys(child as object, path) : [path]
  }).sort()
}

await test(english.tests.catalogs, () => assert.deepEqual(keys(english), keys(chinese)))

await test(english.tests.composition, { timeout: 15000 }, async t => {
  const host = new Context()
  t.after(() => host.fiber.dispose())
  // Mount Loader as a plugin so its isolation listeners initialize before entries.
  const loaderFiber = host.plugin(Loader, { baseUrl: import.meta.url })
  await loaderFiber.await()
  const loader = host.loader
  loader.enableLogs = false
  loader.builtins.prompt = SystemPrompt
  loader.builtins.tools = ToolsService
  loader.builtins.executor = executor
  const scopes = new Map()
  /** Loader remounts own all registrations, including the freshly minted scope. */
  loader.builtins.fixture = async function scopedFixture(ctx: HostValue, config: { id: string; locale: string }) {
    const key = {}
    const scope = createScope(ctx, key)
    // The backing scope Fiber must be active before its effects are registered.
    await scope.ctx.fiber.await()
    const messages = config.locale === 'zh-Hans' ? chinese : english
    scopes.set(config.id, key)
    scope.ctx.tools.restrict({ allow: ['apply_patch'] })
    scope.ctx.tools.register(definition('exec_command', messages.fixture.tool, messages.fixture.result))
    scope.ctx.systemPrompt.section({ name: 'codex-proof:persona', order: 0, complete: true, text: messages.fixture.persona })
    assert.equal(scopeOf(scope.ctx), key)
    assert.deepEqual(scope.ctx.tools.schemas(key).map((tool: HostValue) => tool.name).sort(), ['apply_patch', 'exec_command'])
    ctx.effect(() => () => scopes.delete(config.id))
  }
  loader.builtins.fixture.inject = ['tools', 'systemPrompt']
  await loader.create({ name: 'cordis:prompt', config: { includeHarnessIdentity: false, personaPrefix: english.fixture.globalPolicy } })
  await loader.create({ name: 'cordis:tools' })
  await loader.create({ name: 'cordis:executor' })
  host.tools.register(definition('read', english.fixture.read))
  host.tools.register(definition('apply_patch', english.fixture.shared))
  host.systemPrompt.context({ name: 'proof:runtime', order: 0, required: true, text: english.fixture.runtime })
  const ordinary = await host.systemPrompt.assemble()
  const id = await loader.create({ name: 'cordis:fixture', config: { id: 'codex', locale: 'en' } })
  await loader.await()
  const firstKey = scopes.get('codex')
  assert.ok(firstKey)
  assert.deepEqual(host.tools.schemas(firstKey).map((tool: HostValue) => tool.name).sort(), ['apply_patch', 'exec_command'])
  assert.equal(host.tools.get('read', firstKey), undefined)
  const scopedPrompt = await host.systemPrompt.assemble({ scope: firstKey })
  assert.equal(renderPrompt(scopedPrompt), english.fixture.persona)
  assert.equal(renderContextSnapshot(scopedPrompt), renderContextSnapshot(ordinary))
  assert.ok(renderContextSnapshot(scopedPrompt).endsWith(english.fixture.runtime))
  assert.deepEqual(scopedPrompt, await host.systemPrompt.assemble({ scope: firstKey }))
  t.diagnostic(JSON.stringify({ locale: 'en', assembly: scopedPrompt }))
  const tool = host.tools.get('exec_command', firstKey)
  const result = await tool.execute()
  assert.deepEqual(validateJsonSchemaValue(tool.output.schema, result), [])
  assert.deepEqual(tool.output.render({}, result), [{ type: 'text', text: english.fixture.result }])
  const removeLate = host.tools.register(definition('late_global', english.fixture.late))
  assert.equal(host.tools.get('late_global', firstKey), undefined)
  assert.ok(host.tools.get('late_global'))
  removeLate()
  assert.deepEqual(await host.systemPrompt.assemble(), ordinary)

  await loader.update(id, { config: { id: 'codex', locale: 'zh-Hans' } })
  await loader.await()
  const secondKey = scopes.get('codex')
  assert.ok(secondKey)
  assert.notEqual(secondKey, firstKey)
  assert.equal(host.tools.get('exec_command', firstKey), undefined)
  const chinesePrompt = await host.systemPrompt.assemble({ scope: secondKey })
  assert.equal(renderPrompt(chinesePrompt), chinese.fixture.persona)
  t.diagnostic(JSON.stringify({ locale: 'zh-Hans', assembly: chinesePrompt }))
  const chineseTool = host.tools.get('exec_command', secondKey)
  assert.equal(await chineseTool.execute(), chinese.fixture.result)
  assert.deepEqual(chineseTool.output.render({}, chinese.fixture.result), [{ type: 'text', text: chinese.fixture.result }])
  assert.deepEqual(await host.systemPrompt.assemble(), ordinary)

  // Await the exact Fiber, because Loader.remove starts disposal synchronously.
  const fiber = loader.resolve(id).fiber
  loader.remove(id)
  await fiber.dispose()
  await loader.await()
  assert.equal(scopes.size, 0)
  assert.equal(host.tools.get('exec_command', secondKey), undefined)
  assert.deepEqual(host.tools.schemas().map((tool: HostValue) => tool.name).sort(), ['apply_patch', 'read'])
  assert.deepEqual(await host.systemPrompt.assemble(), ordinary)
})
