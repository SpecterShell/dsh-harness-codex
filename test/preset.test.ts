/**
 * Prove the real codex presets through the real Cordis Loader and the real
 * Agent preset registry, then join a test Agent scope and inspect the tools
 * and prompt that Agent would receive.
 *
 * The preset rows are read and parsed by the host's own patch loader, so ids,
 * configs and group structure are the shipping ones. Only module specifiers
 * are rewritten to `cordis:` builtins: this source repository is not installed
 * in a DSH profile, so `@spectershell/dsh-harness-codex/*` and the host's `@deepseek-ai/*`
 * packages cannot be resolved by Node from here. Every builtin is the real
 * module; none of the preset behavior is replaced. Host services the rows
 * require are mounted for real except `cordisInspect`, whose host row is not
 * part of this fixture and is stubbed minimally over the real tool row.
 *
 * An Agent is emulated with the real AgentRegistry's registration path rather
 * than a full AgentLoop: the loop needs a provider and a model turn, while the
 * surface under test only depends on the Agent scope, the Agent object and the
 * preset binding. That binding, the scope chain and the tool registry are real,
 * so rebinding through `recompose()` reproduces a blank-session preset switch.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { native, mount, temporary } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'

const { Context } = await native('cordis')
const { Loader, Group } = await native('cordis-plugin-loader')
const { applyEntryPatches } = await native('cordis-plugin-include')
const { loadOverlayPatches } = await native('dsh-app-boot')
const { SystemPrompt, renderPrompt } = await native('dsh-system-prompt')
const { ToolsService } = await native('dsh-tools')
const { createScope, scopeOf } = await native('dsh-scope')
const executor = await native('dsh-tool-executor-native')
const { SessionProjectionRegistry } = await native('dsh-session-projection')
const { AgentRegistry } = await native('dsh-agent')
const { AgentPresetRegistry } = await native('dsh-agent-preset-registry')
const AgentPreset = await native('dsh-agent-preset')
const { SessionStore } = await native('dsh-session')
const { LocalFileSystem } = await native('dsh-fs-local')
const { LocalAttachmentStore } = await native('dsh-attachment-local')
const { WorkingDirectoryService } = await native('dsh-working-directory')
const { LocalBashExecutor } = await native('dsh-bash-local')
const { LocalSubprocessRuntime } = await native('dsh-subprocess-local')
const { CommandRuntime } = await native('dsh-commands')
const { TokenMeter } = await native('dsh-token-meter')
const compactionBasic = await native('dsh-compaction-basic')
const { BasicCompactionEngine } = compactionBasic
const agentInstructions = await native('dsh-agent-instructions')
const toolFs = await native('dsh-tool-fs')
const commandCompact = await native('dsh-command-compact')
const SkillRegistry = (await native('dsh-skill')).default
const skillFilesystem = await native('dsh-skill-filesystem')
const toolSkill = await native('dsh-tool-skill')
const toolCordis = await native('dsh-tool-cordis')
const pluginManagerTools = await native('dsh-plugin-manager/tools')
const pluginMarketTools = await native('dsh-plugin-market/tools')
const { SubagentRuntime } = await native('dsh-subagent')
const subagentSpawn = await native('dsh-subagent-spawn-in-process')
const subagentFork = await native('dsh-subagent-fork-in-process')
const workflowPtc = await native('dsh-workflow-ptc')
const toolWorkflow = await native('dsh-tool-workflow')
const toolSubagentControl = await native('dsh-tool-subagent-control')
const toolSubagent = await native('dsh-tool-subagent')
const NodePtcRuntime = (await native('dsh-ptc-runtime-node')).default
const LocalSandboxProvider = (await native('dsh-sandbox-local')).default
const { SandboxPolicyService } = await native('dsh-sandbox-policy')
const toolExecutorPtc = await native('dsh-tool-executor-ptc')

const codexExec = await import('../src/exec/index.ts')
const codexPatch = await import('../src/patch/index.ts')
const codexPlan = await import('../src/plan.ts')
const codexImage = await import('../src/image.ts')
const codexSurface = await import('../src/surface.ts')
const codexPersona = await import('../src/persona.ts')
const codexInstructions = await import('../src/instructions.ts')
const codexCompaction = await import('../src/compaction/index.ts')
const codexFreeform = await import('../src/freeform/index.ts')

/** The five Codex tools every preset is specified to expose. */
const CODEX_TOOLS = ['apply_patch', 'exec_command', 'update_plan', 'view_image', 'write_stdin']

/** The skill loader the three non-PTC presets add beside the Codex tools. */
const SKILL_TOOLS = ['skill']

/** The Creator preset's additions: read-only Cordis inspection and the skill loader. */
const CREATOR_TOOLS = [
  ...CODEX_TOOLS,
  'cordis_inspect_list',
  'cordis_inspect_query',
  ...SKILL_TOOLS,
].sort()

/** A harmless host-level definition; nothing here executes a command. */
function hostTool(name: string) {
  return {
    name,
    description: `Host-level fixture tool ${name}.`,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'string' },
      render: (_context: unknown, result: string) => [{ type: 'text', text: result }],
    },
    execute: async (): Promise<string> => name,
  }
}

/**
 * Bind each preset row's module specifier to a Loader builtin.
 *
 * A row that this fixture does not know must fail the test instead of being
 * mounted from an unexpected package, so a new preset row is always reviewed
 * together with its real module here.
 */
/** One preset row as the Loader sees it. */
interface PresetRow {
  id?: string
  name: string
  group?: boolean
  config: unknown
  [key: string]: unknown
}

function builtinRows(rows: PresetRow[], bindings: Map<string, string>): PresetRow[] {
  return rows.map((row: PresetRow): PresetRow => {
    if (row.group === true) return { ...row, config: builtinRows(row.config as PresetRow[], bindings) }
    const builtin = bindings.get(row.name)
    assert.ok(builtin, `no real module is bound for preset row "${row.name}"`)
    return { ...row, name: `cordis:${builtin}` }
  })
}

await test('the codex presets expose the Codex tools and their own additions to their Agents', { timeout: 30000 }, async t => {
  const root = await temporary(t)
  const host = new Context()
  t.after(() => host.fiber.dispose())

  // Real Loader and the real registry/service tree, as a profile composes them.
  const loaderFiber = host.plugin(Loader, { baseUrl: import.meta.url })
  await loaderFiber.await()
  const loader = host.loader
  loader.enableLogs = false
  loader.builtins.prompt = SystemPrompt
  loader.builtins.tools = ToolsService
  loader.builtins.executor = executor
  loader.builtins.group = Group
  const bindings = new Map([
    ['@spectershell/dsh-harness-codex/persona', 'codex-persona'],
    ['@deepseek-ai/dsh-agent-instructions', 'agent-instructions'],
    ['@spectershell/dsh-harness-codex/instructions', 'codex-instructions'],
    ['@spectershell/dsh-harness-codex/compaction', 'codex-compaction'],
    ['@spectershell/dsh-harness-codex/exec', 'codex-exec'],
    ['@deepseek-ai/dsh-tool-fs', 'tool-fs'],
    ['@spectershell/dsh-harness-codex/plan', 'codex-plan'],
    ['@spectershell/dsh-harness-codex/image', 'codex-image'],
    ['@spectershell/dsh-harness-codex/surface', 'codex-surface'],
    ['@spectershell/dsh-harness-codex/freeform', 'codex-freeform'],
    ['@deepseek-ai/dsh-compaction-basic', 'compaction-basic'],
    ['@deepseek-ai/dsh-command-compact', 'command-compact'],
    ['@spectershell/dsh-harness-codex/patch', 'codex-patch'],
    ['@deepseek-ai/dsh-skill-filesystem', 'skill-filesystem'],
    ['@deepseek-ai/dsh-tool-skill', 'tool-skill'],
    ['@deepseek-ai/dsh-tool-cordis', 'tool-cordis'],
    ['@deepseek-ai/dsh-plugin-manager/tools', 'plugin-manager-tools'],
    ['@deepseek-ai/dsh-plugin-market/tools', 'plugin-market-tools'],
    ['@deepseek-ai/dsh-tool-subagent-control', 'tool-subagent-control'],
    ['@deepseek-ai/dsh-tool-subagent', 'tool-subagent'],
    ['@deepseek-ai/dsh-workflow-ptc', 'workflow-ptc'],
    ['@deepseek-ai/dsh-tool-workflow', 'tool-workflow'],
    ['@deepseek-ai/dsh-tool-executor-ptc', 'tool-executor-ptc'],
  ])
  const modules = new Map([
    ['agent-preset', AgentPreset],
    ['codex-persona', codexPersona],
    ['agent-instructions', agentInstructions],
    ['codex-instructions', codexInstructions],
    ['codex-compaction', codexCompaction],
    ['codex-exec', codexExec],
    ['tool-fs', toolFs],
    ['codex-plan', codexPlan],
    ['codex-image', codexImage],
    ['codex-surface', codexSurface],
    ['codex-freeform', codexFreeform],
    ['compaction-basic', compactionBasic],
    ['command-compact', commandCompact],
    ['codex-patch', codexPatch],
    ['skill-filesystem', skillFilesystem],
    ['tool-skill', toolSkill],
    ['tool-cordis', toolCordis],
    ['plugin-manager-tools', pluginManagerTools],
    ['plugin-market-tools', pluginMarketTools],
    ['tool-subagent-control', toolSubagentControl],
    ['tool-subagent', toolSubagent],
    ['workflow-ptc', workflowPtc],
    ['tool-workflow', toolWorkflow],
    ['tool-executor-ptc', toolExecutorPtc],
  ])
  for (const [name, module] of modules) loader.builtins[name] = module
  await loader.create({ name: 'cordis:prompt', config: { includeHarnessIdentity: false } })
  await loader.create({ name: 'cordis:tools' })
  await loader.create({ name: 'cordis:executor' })

  await mount(host, SessionProjectionRegistry)
  await mount(host, AgentRegistry)
  await mount(host, SessionStore)
  await mount(host, LocalFileSystem, { cwd: root })
  await mount(host, WorkingDirectoryService, { defaultDirectory: root })
  await mount(host, LocalAttachmentStore, { dshHome: join(root, 'dsh-home') })
  await mount(host, LocalSubprocessRuntime)
  await mount(host, LocalBashExecutor, { cwd: root })
  await mount(host, CommandRuntime)
  await mount(host, TokenMeter)
  // The skill registry backs the skill-filesystem provider and the skill tool.
  await mount(host, SkillRegistry)
  // tool-cordis reads the host inspect registry. The registry is a host row
  // that is not part of this fixture, so the service is stubbed minimally: the
  // preset test proves registration and visibility, not inspection results.
  await mount(host, {
    name: 'preset-test-cordis-inspect',
    apply(ctx: HostValue) {
      ctx.provide('cordisInspect', {
        list: () => [],
        query: async () => ({}),
      })
    },
  })
  // The PTC delegation group needs the subagent runtime and both in-process
  // providers, plus the PTC runtime and the sandbox services that back it.
  // The Creator plugin-manager and plugin-market rows stay disabled because no
  // profile context exists, so their services are not mounted.
  await mount(host, SubagentRuntime)
  await mount(host, subagentSpawn, { providerName: 'spawn' })
  await mount(host, subagentFork, { providerName: 'fork' })
  await mount(host, SandboxPolicyService, { mode: 'danger-full-access', workspaceRoot: root })
  await mount(host, LocalSandboxProvider)
  await mount(host, NodePtcRuntime)
  // The real compaction engine needs a provider to exist; no request is made.
  await mount(host, {
    name: 'preset-test-llm',
    apply(ctx: HostValue) {
      ctx.provide('llm', { resolveModelInfo: async () => ({ inputModalities: ['image'] }) })
    },
  })
  await mount(host, BasicCompactionEngine)
  await mount(host, AgentPresetRegistry, { default: 'codex' })
  const presets = host.agentPresets

  const patchPath = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
  const rows = applyEntryPatches([], loadOverlayPatches('preset-test', patchPath))
  const presetRow = rows.find((row: HostValue) => row.id === 'preset-codex-inspired')
  assert.ok(presetRow, 'the codex preset row is present')
  const config = { ...presetRow.config, plugins: builtinRows(presetRow.config.plugins, bindings) }
  await loader.create({ id: presetRow.id, name: 'cordis:agent-preset', config })
  await loader.await()
  assert.deepEqual(await presets.resolve('codex-strict'), { id: 'codex-strict' })

  // A second, co-mounted preset with one native tool of its own. Its Agents must
  // keep the host tools: the codex mask has to belong to the preset binding.
  await loader.create({
    id: 'preset-plain',
    name: 'cordis:agent-preset',
    config: {
      id: 'plain',
      name: 'Plain',
      plugins: [
        {
          id: 'tool-fs',
          name: 'cordis:tool-fs',
          config: { read: false, write: false, edit: false, readImage: false, applyPatch: true },
        },
      ],
    },
  })
  await loader.await()
  assert.deepEqual(await presets.resolve('plain'), { id: 'plain' })

  /** A host tool present before the preset mounts, as `working_directory` is. */
  const removeWorkingDirectory = host.tools.register(hostTool('working_directory'))
  t.after(() => removeWorkingDirectory())
  assert.ok(host.tools.get('working_directory'), 'the early host tool is registered')

  // The preset's plugin rows register their tools in the preset's own scope.
  const lease = await presets.acquireScope('codex-strict')
  t.after(() => lease[Symbol.asyncDispose]())

  /** A host tool added after the preset mounts, including a skill-shaped name. */
  const removeSkill = host.tools.register(hostTool('skill'))
  t.after(() => removeSkill())
  assert.deepEqual(
    host.tools.schemas(lease.key).map((tool: HostValue) => tool.name).sort(),
    [...CODEX_TOOLS, ...SKILL_TOOLS].sort(),
    'the deny lives in the preset scope, so that scope sees only the preset tools',
  )

  /**
   * Emulate one Agent the way the real loop does: a scoped context keyed by
   * the Agent object itself, published through the real AgentRegistry.
   */
  async function createAgent(id: string) {
    const session = host.sessions.create(id, { meta: { cwd: root } })
    const agent: { id: string; session: HostValue; ctx: HostValue } = { id: session.id, session, ctx: undefined }
    await mount(host, {
      name: id,
      inject: ['tools', 'systemPrompt'],
      async apply(ctx: HostValue) {
        const scope = createScope(ctx, agent)
        await scope.ctx.fiber.await()
        agent.ctx = scope.ctx
      },
    })
    const remove = await host.agents.register(agent)
    t.after(() => remove())
    return agent
  }

  const agent = await createAgent('preset-test-agent')
  await presets.mount(agent.ctx, 'codex-strict')
  const agentScope = scopeOf(agent.ctx)
  assert.equal(agentScope, agent, 'the Agent object is its own scope key')

  assert.deepEqual(
    host.tools.schemas(agentScope).map((tool: HostValue) => tool.name).sort(),
    [...CODEX_TOOLS, ...SKILL_TOOLS].sort(),
    'the Agent sees exactly the five Codex tools and the skill loader',
  )
  assert.equal(host.tools.get('working_directory', agentScope), undefined)
  // The preset's own `skill` row is visible; the host's tool of the same name
  // is shadowed rather than merged, so only one registration reaches the model.
  assert.ok(host.tools.get('skill', agentScope), 'the preset skill loader reaches the Agent')

  /** A host tool registered after the Agent exists is still masked dynamically. */
  host.tools.register(hostTool('mcp__demo__search'))
  assert.deepEqual(
    host.tools.schemas(agentScope).map((tool: HostValue) => tool.name).sort(),
    [...CODEX_TOOLS, ...SKILL_TOOLS].sort(),
    'a late host tool does not leak into an existing Agent scope',
  )

  const plainAgent = await createAgent('preset-test-plain')
  await presets.mount(plainAgent.ctx, 'plain')
  const plainScope = scopeOf(plainAgent.ctx)
  const plainTools = ['apply_patch', 'mcp__demo__search', 'skill', 'working_directory'].sort()
  assert.deepEqual(
    host.tools.schemas(plainScope).map((tool: HostValue) => tool.name).sort(),
    plainTools,
    'an Agent bound to another preset keeps the host tools',
  )

  // A blank-session switch re-parents the Agent scope (`recompose()` is the
  // bind step `select()` calls); the mask has to arrive and leave with that
  // parent, with no new `agent/created`.
  await presets.recompose(plainAgent.ctx, 'codex-strict')
  assert.deepEqual(
    host.tools.schemas(plainScope).map((tool: HostValue) => tool.name).sort(),
    [...CODEX_TOOLS, ...SKILL_TOOLS].sort(),
    'switching to codex-strict hides the host tools',
  )
  await presets.recompose(plainAgent.ctx, 'plain')
  assert.deepEqual(
    host.tools.schemas(plainScope).map((tool: HostValue) => tool.name).sort(),
    plainTools,
    'switching away from codex-strict restores the host tools',
  )

  // The extended preset from the same patch file masks only the deny-listed
  // built-ins; the remaining host tools stay visible next to the Codex tools.
  const extendedRow = rows.find((row: HostValue) => row.id === 'preset-codex-extended')
  assert.ok(extendedRow, 'the codex preset row is present')
  await loader.create({
    id: extendedRow.id,
    name: 'cordis:agent-preset',
    config: { ...extendedRow.config, plugins: builtinRows(extendedRow.config.plugins, bindings) },
  })
  await loader.await()
  const extendedAgent = await createAgent('preset-test-extended')
  await presets.mount(extendedAgent.ctx, 'codex')
  const extendedScope = scopeOf(extendedAgent.ctx)
  assert.deepEqual(
    host.tools.schemas(extendedScope).map((tool: HostValue) => tool.name).sort(),
    [...CODEX_TOOLS, 'mcp__demo__search', 'skill', 'working_directory'].sort(),
    'the extended preset keeps non-conflicting host tools',
  )
  host.tools.register(hostTool('read'))
  assert.equal(host.tools.get('read', extendedScope), undefined, 'a deny-listed built-in stays hidden when it registers late')
  host.tools.register(hostTool('web_search'))
  assert.ok(host.tools.get('web_search', extendedScope), 'a non-conflicting tool registers into an existing Agent scope')
  assert.deepEqual(
    host.tools.schemas(agentScope).map((tool: HostValue) => tool.name).sort(),
    [...CODEX_TOOLS, ...SKILL_TOOLS].sort(),
    'the strict preset is unaffected by the extended one',
  )

  // Every preset from the patch file mounts as a real Agent-preset tree. A row
  // whose service is missing shows up in `resolve()` as `broken`, so the
  // identity assertion doubles as the mount check for the new rows.
  const presetRows = new Map([
    ['preset-codex-ptc', 'codex-ptc'],
    ['preset-codex-creator', 'codex-creator'],
  ])
  for (const [rowId, id] of presetRows) {
    const row = rows.find((candidate: HostValue) => candidate.id === rowId)
    assert.ok(row, `${id} row is present in cordis.patch.yml`)
    await loader.create({
      id: row.id,
      name: 'cordis:agent-preset',
      config: { ...row.config, plugins: builtinRows(row.config.plugins, bindings) },
    })
    await loader.await()
  }
  const expectedPresets = [
    ['codex', 'Codex mode', 5],
    ['codex-strict', 'Codex strict mode', 6],
    ['codex-ptc', 'Codex PTC', 7],
    ['codex-creator', 'Codex Creator', 8],
  ]
  const resolved = await Promise.all(expectedPresets.map(async ([id]) => {
    const preset = await presets.resolve(id)
    const listed = (await presets.list()).find((entry: HostValue) => entry.id === id)
    return { preset, listed: { id: listed?.id, name: listed?.name, order: listed?.order, broken: listed?.broken } }
  }))
  assert.deepEqual(
    resolved.map(({ preset }) => preset),
    expectedPresets.map(([id]) => ({ id })),
    'all four presets resolve without a mount diagnostic',
  )
  assert.deepEqual(
    resolved.map(({ listed }) => listed),
    expectedPresets.map(([id, name, order]) => ({ id, name, order, broken: undefined })),
  )

  // The Creator preset shares the Codex mask (deny list) and adds its own tool
  // rows in the preset scope, which the mask does not cover.
  const creatorAgent = await createAgent('preset-test-creator')
  await presets.mount(creatorAgent.ctx, 'codex-creator')
  const creatorScope = scopeOf(creatorAgent.ctx)
  assert.deepEqual(
    host.tools.schemas(creatorScope).map((tool: HostValue) => tool.name).sort(),
    [...CREATOR_TOOLS, 'mcp__demo__search', 'web_search', 'working_directory'].sort(),
    'the Creator Agent sees the Codex tools, Cordis inspection, the skill loader and the host tools',
  )
  assert.ok(host.tools.get('working_directory', creatorScope), 'a non-conflicting host tool passes the Creator mask')
  assert.ok(host.tools.get('mcp__demo__search', creatorScope), 'an MCP tool passes the Creator mask')
  // The skill row's `customSkillDirs` expression must resolve this package's
  // own directory, or the ported skill would be registered but never found.
  const creatorSkills = await host.skills.list({ cwd: root, scope: creatorScope })
  assert.ok(
    creatorSkills.some((skill: HostValue) => skill.name === 'review-agent'),
    'the review-agent skill is discoverable inside the Creator preset',
  )

  // Snapshot the preset-scope prompt, then the Agent-scope prompt the model
  // actually receives. The preset persona replaces every inherited section.
  // The persona row is a complete section, so with no model route the
  // package's original persona is the whole prompt.
  const originalPersona = await readFile(new URL('../prompts/original.md', import.meta.url), 'utf8')
  const presetPrompt = await host.systemPrompt.assemble({ scope: lease.key })
  assert.deepEqual(await host.systemPrompt.assemble({ scope: lease.key }), presetPrompt)
  assert.equal(renderPrompt(presetPrompt), originalPersona, 'the complete persona is the whole prompt')
  t.diagnostic(JSON.stringify({ scope: 'preset', assembly: presetPrompt }))
  const agentPrompt = await host.systemPrompt.assemble({ scope: agentScope, agent })
  assert.deepEqual(await host.systemPrompt.assemble({ scope: agentScope, agent }), agentPrompt)
  assert.deepEqual(agentPrompt.tools.map((tool: HostValue) => tool.name).sort(), [...CODEX_TOOLS, ...SKILL_TOOLS].sort())
  t.diagnostic(JSON.stringify({ scope: 'agent', assembly: agentPrompt }))
})
