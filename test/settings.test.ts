/**
 * Prove the host settings surface and the live overrides the preset rows read.
 *
 * The host plugin, ToolsService-facing surface row and instruction row mount
 * through a real Cordis Context, so service provisioning, the settings event
 * and the pre-step waterfall behave as they do in a profile. The freeform row
 * patches a third-party adapter, so its matcher is exercised through the
 * exported merge instead of a mounted bridge.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'
import * as hostPlugin from '../src/host.ts'
import { createCodexSettings, parseToolNames } from '../src/config.ts'
import type { CodexSettingsService } from '../src/config.ts'
import * as freeform from '../src/freeform/index.ts'
import { compileConfig, matches, parseRuleText } from '../src/freeform/rules.ts'
import * as surface from '../src/surface.ts'
import * as instructions from '../src/instructions.ts'

const { Context } = await native('cordis')
const { LocalFileSystem } = await native('dsh-fs-local')

/** A config field the test can change, shaped like a resolved volatile field. */
function live<T>(initial: T) {
  let value = initial
  return {
    get: (): T => value,
    set: (next: T): void => { value = next },
  }
}

/** A settings service whose values the test can change between calls. */
function settings(overrides: Partial<CodexSettingsService> = {}): CodexSettingsService {
  return {
    freeform: () => ({ enabled: false, rules: '', codexCatalog: false }),
    surfaceAllow: () => [],
    instructionsMaxBytes: () => 32 * 1024,
    ...overrides,
  }
}

/** Mount a fake service provider; the test keeps the behavior it provides. */
async function provide(ctx: HostValue, name: string, value: unknown): Promise<void> {
  await mount(ctx, {
    name: `fixture-${name}`,
    apply(pluginCtx: HostValue) { pluginCtx.provide(name, value) },
  })
}

await test('the host Config resolves every field to its default', () => {
  const config = hostPlugin.Config({}, {}) as hostPlugin.CodexVolatileConfig
  assert.equal(config.freeformEnabled.get(), false)
  assert.equal(config.freeformCodexCatalog.get(), false)
  assert.equal(config.freeformRules.get(), '')
  assert.equal(config.surfaceAllow.get(), '')
  assert.equal(config.instructionsMaxBytes.get(), 32 * 1024)
  // The Settings UI renders only volatile fields, so every field must be live.
  const json = hostPlugin.Config.toJSON() as {
    uid: number
    refs: Record<number, { dict?: Record<string, number>; meta?: { volatile?: boolean } }>
  }
  const root = json.refs[json.uid]
  const fields = Object.keys(root?.dict ?? {})
  assert.deepEqual(fields.sort(), [
    'freeformCodexCatalog',
    'freeformEnabled',
    'freeformRules',
    'instructionsMaxBytes',
    'surfaceAllow',
  ])
  for (const field of fields) {
    const node = json.refs[root?.dict?.[field] ?? -1]
    assert.equal(node?.meta?.volatile, true, field)
  }
})

await test('the codexSettings service reads the volatile fields on every call', () => {
  const freeformEnabled = live(false)
  const freeformCodexCatalog = live(false)
  const freeformRules = live('')
  const surfaceAllow = live('')
  const instructionsMaxBytes = live(32 * 1024)
  const service = createCodexSettings({
    freeformEnabled,
    freeformCodexCatalog,
    freeformRules,
    surfaceAllow,
    instructionsMaxBytes,
  })
  assert.deepEqual(service.freeform(), { enabled: false, rules: '', codexCatalog: false })
  assert.deepEqual(service.surfaceAllow(), [])
  assert.equal(service.instructionsMaxBytes(), 32 * 1024)

  freeformEnabled.set(true)
  freeformCodexCatalog.set(true)
  freeformRules.set('openai:*')
  surfaceAllow.set('exec_command  view_image, exec_command')
  instructionsMaxBytes.set(4096)
  assert.deepEqual(service.freeform(), { enabled: true, rules: 'openai:*', codexCatalog: true })
  assert.deepEqual(service.surfaceAllow(), ['exec_command', 'view_image'])
  assert.equal(service.instructionsMaxBytes(), 4096)
})

await test('the host plugin provides codexSettings from its resolved Config', async t => {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  const fiber = ctx.plugin(hostPlugin, {})
  await fiber.await()
  const first = ctx.get('codexSettings') as CodexSettingsService
  assert.ok(first)
  assert.deepEqual(first.freeform(), { enabled: false, rules: '', codexCatalog: false })
  await fiber.update({ freeformEnabled: true, freeformRules: 'fixture:*' })
  const second = ctx.get('codexSettings') as CodexSettingsService
  assert.deepEqual(second.freeform(), { enabled: true, rules: 'fixture:*', codexCatalog: false })
})

await test('rules text parses into the row rule shape', () => {
  assert.deepEqual(parseRuleText('openai:gpt-*\r\n:gpt-6*\n  provider:  \n\n*:*'), [
    { provider: 'openai', model: 'gpt-*' },
    { model: 'gpt-6*' },
    { provider: 'provider' },
    { provider: '*', model: '*' },
  ])
  // A bare "*" has no field separator and is not one of the documented forms.
  assert.deepEqual(parseRuleText('*'), [])
})

await test('the settings service wins for enabled and catalog and adds its rules', () => {
  const off = { enabled: true, rules: [{ provider: 'row' }], codexCatalog: true }
  const disabled = freeform.effectiveConfig(off, settings())
  assert.equal(disabled.enabled, false)
  assert.equal(disabled.codexCatalog, false)
  assert.equal(compileConfig(disabled, []), undefined)

  const service = settings({
    freeform: () => ({ enabled: true, rules: 'openai:*\n:gpt-6*', codexCatalog: true }),
  })
  const merged = freeform.effectiveConfig(off, service)
  assert.equal(merged.enabled, true)
  assert.equal(merged.codexCatalog, true)
  const matcher = compileConfig(merged, ['gpt-6-codex'])
  assert.ok(matcher)
  assert.ok(matches(matcher, 'openai', 'o3'), 'the settings rule matches')
  assert.ok(matches(matcher, 'other', 'gpt-6-codex'), 'the catalog still applies')
  assert.ok(matches(matcher, 'row', 'anything'), 'the row rule is kept')
  assert.ok(!matches(matcher, 'other', 'gpt-4'))
})

await test('the surface row merges the settings allow list and re-syncs on a settings change', async t => {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  const restrictions: string[][] = []
  const fakeTools = {
    view: () => ({ restrictableNames: new Set(['apply_patch', 'exec_command', 'host_tool', 'ui_tool']) }),
    restrict: (filter: { deny?: readonly string[] }) => {
      restrictions.push([...(filter.deny ?? [])])
      return () => {}
    },
  }
  await provide(ctx, 'tools', fakeTools)
  let allowText = ''
  await provide(ctx, 'codexSettings', settings({ surfaceAllow: () => parseToolNames(allowText) }))
  await mount(ctx, surface, { allow: ['apply_patch', 'exec_command'] })
  assert.deepEqual(restrictions.at(-1), ['host_tool', 'ui_tool'])

  allowText = 'ui_tool'
  ctx.emit('settings/document-updated', 'dsh-harness-codex', 1)
  assert.deepEqual(restrictions.at(-1), ['host_tool'])
})

await test('instructions read the settings byte budget at every pre-step', async t => {
  const root = await temporary(t)
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'AGENTS.md'), 'b'.repeat(20))
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await mount(ctx, LocalFileSystem, { cwd: root })
  await provide(ctx, 'workingDirectory', { ensure: async () => root })
  let maxBytes = 20
  await provide(ctx, 'codexSettings', settings({ instructionsMaxBytes: () => maxBytes }))
  await mount(ctx, instructions, { maxBytes: 4, projectRootMarkers: [], fallbackFilenames: [] })

  const agent = { id: 'settings-agent', session: { surface: { nodes: [] }, eventAt: () => undefined }, options: {} }
  const step = async (number: number): Promise<HostValue> => ctx.waterfall(agent, 'agent/pre-step', {
    agent,
    messages: [],
    turn: 1,
    step: number,
    signal: new AbortController().signal,
    modelSelection: {},
  }, async () => ({ kind: 'enter', messages: [] }))

  const first = await step(1)
  const firstText = first.messages[0].content[0].text as string
  assert.equal((firstText.match(/b/g) ?? []).length, 20, 'the service budget overrides the row budget')

  maxBytes = 7
  const second = await step(2)
  const secondText = second.messages[0].content[0].text as string
  assert.equal((secondText.match(/b/g) ?? []).length, 7, 'the next step reads the new budget')
})
