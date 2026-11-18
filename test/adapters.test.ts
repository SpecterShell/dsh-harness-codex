/**
 * Prove the two Codex adapters against real host services.
 *
 * The todo projection, filesystem, attachment store and working directory are
 * the installed implementations. The only double is the optional `llm` route:
 * the image path asks it for declared input modalities, and mounting a real
 * provider would need credentials and network access. That double is explicit
 * below rather than a hidden stub.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'
import * as planPlugin from '../src/plan.ts'
import * as imagePlugin from '../src/image.ts'

const { Context } = await native('cordis')
const { SystemPrompt } = await native('dsh-system-prompt')
const { ToolsService, validateJsonSchemaValue } = await native('dsh-tools')
const { SessionStore } = await native('dsh-session')
const { SessionProjectionRegistry } = await native('dsh-session-projection')
const { LocalFileSystem } = await native('dsh-fs-local')
const { LocalAttachmentStore } = await native('dsh-attachment-local')
const { WorkingDirectoryService } = await native('dsh-working-directory')
const todoPlugin = await native('dsh-tool-todo')

/** A valid 1x1 RGB PNG; the attachment store passes clean 8-bit RGB through. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

/**
 * Mount the installed services the adapters use. The image services are added
 * only for the image tests so the plan fixture stays minimal.
 */
async function mountHost(t: TestContext, { images = false }: { images?: boolean } = {}) {
  const root = await temporary(t)
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await mount(ctx, SessionProjectionRegistry)
  await mount(ctx, SystemPrompt)
  await mount(ctx, ToolsService)
  await mount(ctx, SessionStore)
  await mount(ctx, LocalFileSystem, { cwd: root })
  if (images) {
    await mount(ctx, LocalAttachmentStore, { dshHome: join(root, 'dsh-home') })
    await mount(ctx, WorkingDirectoryService, { defaultDirectory: root })
  }
  return { ctx, root }
}

/** The execution fields these tools read: agent session, route and cancellation. */
function execution(ctx: HostValue, session: HostValue, model = 'fixture-model') {
  return {
    agent: { ctx, session, options: { provider: 'fixture', model } },
    signal: new AbortController().signal,
  }
}

/** Declare image input for the fixture route without mounting a real provider. */
async function mountImageRoute(ctx: HostValue) {
  await mount(ctx, {
    name: 'fixture-llm',
    apply(ctx: HostValue) {
      ctx.provide('llm', {
        resolveModelInfo: async (_provider: string, model: string) => ({ inputModalities: model === 'vision-model' ? ['image'] : [] }),
      })
    },
  })
}

await test('update_plan owns the todo projection and returns Codex output', async t => {
  const { ctx } = await mountHost(t)
  await mount(ctx, planPlugin)
  const session = ctx.sessions.create('plan-alone')
  const tool = ctx.tools.get('update_plan')
  assert.ok(tool)

  const args = {
    explanation: 'Fixture plan',
    plan: [
      { step: 'Inspect workspace', status: 'in_progress' },
      { step: 'Report results', status: 'pending' },
    ],
  }
  const output = await tool.execute(args, execution(ctx, session))
  assert.equal(output, 'Plan updated')
  assert.deepEqual(validateJsonSchemaValue(tool.output.schema, output), [])
  assert.deepEqual(tool.output.render(args, output), [{ type: 'text', text: 'Plan updated' }])
  assert.deepEqual(ctx.sessionProjections.snapshot(session, ['todos']).values.todos, [
    { content: 'Inspect workspace', status: 'in_progress' },
    { content: 'Report results', status: 'pending' },
  ])

  const schema = ctx.tools.schemas().find((candidate: HostValue) => candidate.name === 'update_plan')
  assert.deepEqual(schema.parameters.required, ['plan'])
  assert.deepEqual(schema.parameters.properties.plan.items.properties.status.enum, [
    'pending',
    'in_progress',
    'completed',
  ])
})

await test('update_plan shares todo_write state and accepts parallel steps like Codex', async t => {
  const { ctx } = await mountHost(t)
  await mount(ctx, todoPlugin, { allowParallelInProgress: false })
  await mount(ctx, planPlugin)
  assert.equal(ctx.tools.get('todo_write').name, 'todo_write')
  const session = ctx.sessions.create('plan-shared')
  const tool = ctx.tools.get('update_plan')

  const args = {
    plan: [
      { step: 'Inspect workspace', status: 'in_progress' },
      { step: 'Report results', status: 'pending' },
    ],
  }
  assert.equal(await tool.execute(args, execution(ctx, session)), 'Plan updated')
  const stored = [
    { content: 'Inspect workspace', status: 'in_progress' },
    { content: 'Report results', status: 'pending' },
  ]
  assert.deepEqual(ctx.sessionProjections.snapshot(session, ['todos']).values.todos, stored)

  // Codex's handler accepts several in_progress steps despite its description.
  const parallel = { plan: [
    { step: 'First', status: 'in_progress' },
    { step: 'Second', status: 'in_progress' },
  ] }
  assert.equal(await tool.execute(parallel, execution(ctx, session)), 'Plan updated')
  stored.splice(0, 2, { content: 'First', status: 'in_progress' }, { content: 'Second', status: 'in_progress' })
  assert.deepEqual(ctx.sessionProjections.snapshot(session, ['todos']).values.todos, stored)
})

await test('view_image returns the native image attachment for a real PNG', { timeout: 15000 }, async t => {
  const { ctx, root } = await mountHost(t, { images: true })
  await mountImageRoute(ctx)
  await mount(ctx, imagePlugin)
  const session = ctx.sessions.create('image', { meta: { cwd: root } })
  const path = join(root, 'pixel.png')
  await writeFile(path, PNG)
  const tool = ctx.tools.get('view_image')
  assert.ok(tool)

  const args = { path }
  const output = await tool.execute(args, execution(ctx, session, 'vision-model'))
  await assert.rejects(tool.execute(args, execution(ctx, session, 'text-model')), /do not support image inputs/u)
  assert.equal(output.path, path)
  assert.deepEqual(validateJsonSchemaValue(tool.output.schema, output), [])
  assert.match(output.image.attachmentId, /^sha256:/u)
  assert.equal(output.image.mediaType, 'image/png')
  assert.equal(output.image.width, 1)
  assert.equal(output.image.height, 1)
  assert.equal(output.image.bytes, PNG.length)

  const blocks = tool.output.render(args, output)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].type, 'text')
  assert.match(blocks[0].text, new RegExp(`image/png image, 1x1 px, ${PNG.length} bytes`, 'u'))
  assert.equal(blocks[1].type, 'image')
  assert.equal(blocks[1].attachment.attachmentId, output.image.attachmentId)
  const stored = await ctx.attachments.readImage(blocks[1].attachment)
  assert.deepEqual(Buffer.from(stored.data), PNG)

  const schema = ctx.tools.schemas().find((candidate: HostValue) => candidate.name === 'view_image')
  assert.deepEqual(schema.parameters.required, ['path'])
  assert.deepEqual(Object.keys(schema.parameters.properties), ['path'])
})

await test('view_image rejects a missing file and non-image bytes', { timeout: 15000 }, async t => {
  const { ctx, root } = await mountHost(t, { images: true })
  await mountImageRoute(ctx)
  await mount(ctx, imagePlugin)
  const session = ctx.sessions.create('image-errors', { meta: { cwd: root } })
  const tool = ctx.tools.get('view_image')
  const exec = execution(ctx, session, 'vision-model')

  await assert.rejects(tool.execute({ path: join(root, 'missing.png') }, exec), /not found/u)
  const fake = join(root, 'fake.png')
  await writeFile(fake, 'not an image')
  await assert.rejects(tool.execute({ path: fake }, exec), /not a supported image format/u)
})
