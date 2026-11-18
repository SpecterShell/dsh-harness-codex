/**
 * Behavior proofs for the Codex-faithful apply_patch row.
 *
 * The tool registry, host filesystem (bare and sandbox-enforcing), session
 * store and working-directory resolver are the installed implementations. The
 * tests call the registered tool exactly as the Agent loop would, then inspect
 * the bytes on disk, so every Codex-specific rule is checked against real file
 * contents rather than an intermediate string.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary } from './fixtures/native-host.ts'
import type { HostValue } from './fixtures/native-host.ts'
import * as patchPlugin from '../src/patch/index.ts'
import { canonicalPatchTool } from '../src/freeform/bridge.ts'

const { Context } = await native('cordis')
const { ToolsService, validateJsonSchemaValue } = await native('dsh-tools')
const { SystemPrompt } = await native('dsh-system-prompt')
const { SessionProjectionRegistry } = await native('dsh-session-projection')
const { SessionStore } = await native('dsh-session')
const { LocalFileSystem } = await native('dsh-fs-local')
const { WorkingDirectoryService } = await native('dsh-working-directory')

/** Include the fenced backend only when a test asks for confinement. */
const { SandboxPolicyService } = await native('dsh-sandbox-policy')
const sandboxedFs = await native('dsh-fs-sandbox')

/** The confinement a fixture mounts; `local` is the bare backend. */
type FsMode = 'local' | 'read-only' | 'workspace-write'

interface HostOptions {
  fs?: FsMode
  workspaceRoot?: string
}

/**
 * Mount the real services the tool needs. A sandbox mode swaps the bare local
 * filesystem for the fenced one and adds the policy service it requires.
 */
async function mountHost(t: TestContext, options: HostOptions = {}) {
  const root = await temporary(t)
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  // ToolsService injects the prompt registry, so mount that first.
  await mount(ctx, SystemPrompt)
  await mount(ctx, ToolsService)
  await mount(ctx, SessionStore)
  // The working-directory resolver injects the projection registry and `fs`,
  // so mount both before it or the patch row never activates.
  await mount(ctx, SessionProjectionRegistry)
  if (options.fs === undefined || options.fs === 'local') {
    await mount(ctx, LocalFileSystem, { cwd: root })
  } else {
    await mount(ctx, SandboxPolicyService, {
      mode: options.fs,
      workspaceRoot: options.workspaceRoot ?? root,
    })
    await mount(ctx, sandboxedFs.SandboxedFileSystem ?? sandboxedFs.default, { cwd: root })
  }
  await mount(ctx, WorkingDirectoryService, { defaultDirectory: root })
  await mount(ctx, patchPlugin)
  const session = ctx.sessions.create('patch-session', { meta: { cwd: root } })
  return { ctx, root, session }
}

/** The execution fields the tool body reads from the Agent loop. */
function execution(ctx: HostValue, session: HostValue, signal = new AbortController().signal) {
  return { agent: { ctx, session, options: {} }, callId: 'patch-call', signal }
}

/** Invoke the registered tool the way the loop does. */
async function apply(ctx: HostValue, session: HostValue, patch: string, extra: HostValue = {}) {
  const tool = ctx.tools.get('apply_patch')
  assert.ok(tool, 'apply_patch is registered')
  return tool.execute({ input: patch, ...extra }, execution(ctx, session))
}

/** The registered tool definition, for output-schema and render checks. */
function toolOf(ctx: HostValue) {
  const tool = ctx.tools.get('apply_patch')
  assert.ok(tool)
  return tool
}

/** Read a file as UTF-8, asserting existence first for clearer failures. */
async function text(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

/** One update patch against a relative path. */
function updatePatch(path: string, body: string): string {
  return `*** Begin Patch\n*** Update File: ${path}\n${body}\n*** End Patch`
}

await test('the registered schema keeps the canonical free-form input shape', async t => {
  const { ctx } = await mountHost(t)
  const tool = toolOf(ctx)
  assert.deepEqual(validateJsonSchemaValue(tool.output.schema, {
    phase: 'commit',
    cancelled: false,
    operations: [],
    affectedPaths: [],
  }), [])

  const schema = ctx.tools.schemas().find((candidate: HostValue) => candidate.name === 'apply_patch')
  assert.equal(schema.parameters.type, 'object')
  assert.equal(schema.parameters.additionalProperties, false)
  assert.deepEqual(schema.parameters.required, ['input'])
  assert.equal(schema.parameters.properties.input.type, 'string')
  // The freeform bridge replaces only a tool this predicate accepts, so the
  // grammar-tool path keeps working without the native tool-fs row.
  assert.equal(canonicalPatchTool({ name: 'apply_patch', parameters: schema.parameters }), true)
  assert.deepEqual(Object.keys(schema.parameters.properties), ['input'], 'a bare composition advertises no escalation fields')
})

await test('add, update, delete and move report Codex status lines', async t => {
  const { ctx, root, session } = await mountHost(t)
  const added = await apply(ctx, session, '*** Begin Patch\n*** Add File: dir/new.txt\n+hello\n+world\n*** End Patch')
  assert.equal(await text(join(root, 'dir/new.txt')), 'hello\nworld\n')
  assert.deepEqual(added.operations.map((operation: HostValue) => [operation.kind, operation.status]), [['add', 'completed']])
  assert.deepEqual(added.affectedPaths, [join(root, 'dir/new.txt')])
  assert.deepEqual(toolOf(ctx).output.render(undefined, added), [
    { type: 'text', text: `Success. Updated the following files:\nA ${join(root, 'dir/new.txt')}` },
  ])

  await writeFile(join(root, 'modify.txt'), 'old\n')
  const updated = await apply(ctx, session, updatePatch('modify.txt', '@@\n-old\n+new'))
  assert.equal(await text(join(root, 'modify.txt')), 'new\n')
  assert.deepEqual(
    updated.operations.map((operation: HostValue) => [operation.kind, operation.status]),
    [['update', 'completed']],
  )

  const moved = await apply(
    ctx,
    session,
    '*** Begin Patch\n*** Update File: dir/new.txt\n*** Move to: moved/target.txt\n'
      + '@@\n-hello\n+HELLO\n*** End Patch',
  )
  assert.equal(await stat(join(root, 'dir/new.txt')).then(() => true, () => false), false)
  assert.equal(await text(join(root, 'moved/target.txt')), 'HELLO\nworld\n')
  assert.equal(moved.operations[0].kind, 'move')
  assert.deepEqual(toolOf(ctx).output.render(undefined, moved), [
    { type: 'text', text: `Success. Updated the following files:\nM ${join(root, 'moved/target.txt')}` },
  ])

  const deleted = await apply(ctx, session, '*** Begin Patch\n*** Delete File: modify.txt\n*** End Patch')
  assert.equal(await stat(join(root, 'modify.txt')).then(() => true, () => false), false)
  assert.deepEqual(deleted.operations.map((operation: HostValue) => [operation.kind, operation.status]), [['delete', 'completed']])
  assert.deepEqual(toolOf(ctx).output.render(undefined, deleted), [
    { type: 'text', text: `Success. Updated the following files:\nD ${join(root, 'modify.txt')}` },
  ])
})

await test('an empty added file is allowed, and Unicode paths resolve', async t => {
  const { ctx, root, session } = await mountHost(t)
  await apply(ctx, session, '*** Begin Patch\n*** Add File: empty.txt\n*** End Patch')
  assert.equal(await text(join(root, 'empty.txt')), '')
  await apply(ctx, session, '*** Begin Patch\n*** Add File: 目录/文件.txt\n+内容\n*** End Patch')
  assert.equal(await text(join(root, '目录/文件.txt')), '内容\n')
})

await test('a UTF-8 BOM survives edits, can be removed by an explicit patch line, and cannot start a patch', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'bom.txt'), '\uFEFFone\ntwo\n')
  await apply(ctx, session, updatePatch('bom.txt', '@@\n-two\n+TWO'))
  assert.equal(await text(join(root, 'bom.txt')), '\uFEFFone\nTWO\n')

  // The BOM is ordinary text on line 1: a patch line that spells it matches
  // that line and removes it.
  await apply(ctx, session, updatePatch('bom.txt', '@@\n-\uFEFFone\n+one'))
  assert.equal(await text(join(root, 'bom.txt')), 'one\nTWO\n')

  await writeFile(join(root, 'bom2.txt'), '\uFEFFalpha\n')
  await assert.rejects(
    apply(ctx, session, `\uFEFF*** Begin Patch\n*** Add File: rejected.txt\n+x\n*** End Patch`),
    /invalid patch: The first line of the patch must be '\*\*\* Begin Patch'/u,
  )
  assert.equal(await stat(join(root, 'rejected.txt')).then(() => true, () => false), false)

  // Matching does not strip the BOM: a first-line context without it cannot
  // locate the BOM-prefixed line even through the loosest trim pass.
  await writeFile(join(root, 'bom3.txt'), '\uFEFFalpha\nbeta\n')
  await assert.rejects(apply(ctx, session, updatePatch('bom3.txt', '@@\n alpha\n-beta\n+B')), /Failed to find expected lines/u)
  assert.equal(await text(join(root, 'bom3.txt')), '\uFEFFalpha\nbeta\n')
})

await test('CRLF files keep per-line endings and inserted lines take the first ending', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'crlf.txt'), 'a\r\nb\r\n')
  await apply(ctx, session, updatePatch('crlf.txt', '@@\n-b\n+B\n+c'))
  assert.equal(await text(join(root, 'crlf.txt')), 'a\r\nB\r\nc\r\n')

  // Unchanged lines keep their own ending in a mixed file; a replacement line
  // uses the file's first ending.
  await writeFile(join(root, 'mixed.txt'), 'a\r\nb\nc\n')
  await apply(ctx, session, updatePatch('mixed.txt', '@@\n c\n+tail'))
  assert.equal(await text(join(root, 'mixed.txt')), 'a\r\nb\nc\ntail\r\n')
})

await test('a lone CR is a real line ending', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'cr.txt'), 'a\rb\rc\r')
  await apply(ctx, session, updatePatch('cr.txt', '@@\n-b\n+B'))
  assert.equal(await text(join(root, 'cr.txt')), 'a\rB\rc\r')
})

await test('fuzzy whitespace matching preserves the source context spelling', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'fuzzy.txt'), 'alpha   \nbeta\ngamma\n')
  await apply(ctx, session, updatePatch('fuzzy.txt', '@@\n alpha\n-beta\n+BETA'))
  // The trailing spaces belong to the unchanged context line and stay put even
  // though the patch spelled it without them.
  assert.equal(await text(join(root, 'fuzzy.txt')), 'alpha   \nBETA\ngamma\n')
})

await test('punctuation normalization matches but does not rewrite context', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'punct.txt'), 'note: it\u2019s \u2014 fine\nvalue\n')
  await apply(ctx, session, updatePatch('punct.txt', "@@\n note: it's - fine\n-value\n+VALUE"))
  assert.equal(await text(join(root, 'punct.txt')), 'note: it\u2019s \u2014 fine\nVALUE\n')
})

await test('an insert-only hunk at End of File appends after every source line', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'tail.txt'), 'a\n\n')
  await apply(ctx, session, updatePatch('tail.txt', '@@\n+z\n*** End of File'))
  assert.equal(await text(join(root, 'tail.txt')), 'a\n\nz\n')
})

await test('End of File anchors only the tail candidate, so an earlier match is rejected', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'eof.txt'), 'a\nb\nc\n')
  await assert.rejects(
    apply(ctx, session, updatePatch('eof.txt', '@@\n a\n b\n*** End of File')),
    /Failed to find expected lines in .*eof\.txt:\na\nb/u,
  )
  assert.equal(await text(join(root, 'eof.txt')), 'a\nb\nc\n')
})

await test('stale context rejects the whole patch without changing anything', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'stale.txt'), 'a\nb\n')
  const patch = '*** Begin Patch\n'
    + '*** Update File: stale.txt\n@@\n-a\n+A\n'
    + '*** Update File: stale.txt2\n@@\n-missing\n+M\n'
    + '*** End Patch'
  await writeFile(join(root, 'stale.txt2'), 'present\n')
  await assert.rejects(
    apply(ctx, session, patch),
    /Patch rejected before any change \(1 problems\):\n- operation 2 \(update .*stale\.txt2, patch line 6\): Failed to find expected lines/u,
  )
  assert.equal(await text(join(root, 'stale.txt')), 'a\nb\n')
  assert.equal(await text(join(root, 'stale.txt2')), 'present\n')
})

await test('malformed input and empty patches are rejected', async t => {
  const { ctx, session } = await mountHost(t)
  await assert.rejects(apply(ctx, session, 'not a patch'), /invalid patch: The first line of the patch must be/u)
  await assert.rejects(apply(ctx, session, '*** Begin Patch\n*** Nope\n*** End Patch'), /invalid hunk at line 2/u)
  await assert.rejects(apply(ctx, session, '*** Begin Patch\n*** Add File: x\n+x'), /invalid patch: The last line of the patch must be/u)
  await assert.rejects(apply(ctx, session, '*** Begin Patch\n*** End Patch'), /patch rejected: empty patch/u)
  await assert.rejects(
    apply(ctx, session, '*** Begin Patch\n*** Environment ID: remote\n*** Add File: x\n+x\n*** End Patch'),
    /invalid patch: apply_patch environment IDs are unsupported/u,
  )
})


await test('an update can replace an empty file and use an @@ text anchor', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'empty-update.txt'), '')
  await apply(ctx, session, updatePatch('empty-update.txt', '@@\n+first'))
  assert.equal(await text(join(root, 'empty-update.txt')), 'first\n')

  await writeFile(join(root, 'anchored.txt'), 'one\ntwo\nthree\n')
  await apply(ctx, session, updatePatch('anchored.txt', '@@ one\n-two\n+TWO'))
  assert.equal(await text(join(root, 'anchored.txt')), 'one\nTWO\nthree\n')
})

await test('multiple chunks in one update apply in order and preserve context', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'chunks.txt'), 'a\nb\nc\nd\ne\nf\n')
  const patch = '*** Begin Patch\n*** Update File: chunks.txt\n'
    + '@@\n a\n-b\n+B\n'
    + '@@\n d\n-e\n+E\n'
    + '*** End Patch'
  await apply(ctx, session, patch)
  assert.equal(await text(join(root, 'chunks.txt')), 'a\nB\nc\nd\nE\nf\n')
})

await test('a trailing empty old line is retried without its sentinel', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'sentinel.txt'), 'a\nb\n')
  await apply(ctx, session, updatePatch('sentinel.txt', '@@\n a\n-b\n-\n+c'))
  assert.equal(await text(join(root, 'sentinel.txt')), 'a\nc\n')
})

await test('two operations on the same resolved file are rejected', async t => {
  const { ctx, root, session } = await mountHost(t)
  await writeFile(join(root, 'twice.txt'), 'a\n')
  const patch = '*** Begin Patch\n'
    + '*** Update File: twice.txt\n@@\n-a\n+b\n'
    + '*** Update File: twice.txt\n@@\n-b\n+c\n'
    + '*** End Patch'
  await assert.rejects(apply(ctx, session, patch), /multiple operations target .*twice\.txt/u)
  assert.equal(await text(join(root, 'twice.txt')), 'a\n')
})

await test('a confined filesystem denies writes and advertises escalation', async t => {
  const { ctx, root, session } = await mountHost(t, { fs: 'read-only' })
  const schema = ctx.tools.schemas().find((candidate: HostValue) => candidate.name === 'apply_patch')
  assert.deepEqual(schema.parameters.properties.sandbox_permissions.enum, ['use_default', 'require_escalated'])
  await assert.rejects(
    apply(ctx, session, '*** Begin Patch\n*** Add File: denied.txt\n+x\n*** End Patch'),
    /Patch rejected before any change \(1 problems\):[\s\S]*read-only/u,
  )
  assert.equal(await stat(join(root, 'denied.txt')).then(() => true, () => false), false)
})


await test('require_escalated asks the host and writes with the approved mode', async t => {
  const { ctx, root, session } = await mountHost(t, { fs: 'read-only' })
  const requests: HostValue[] = []
  let outcome = 'allowed-once'
  await mount(ctx, {
    name: 'fixture-approval',
    apply(context: HostValue) {
      context.provide('approval', {
        request: async (request: HostValue) => {
          requests.push(request)
          return outcome
        },
      })
    },
  })
  const justification = 'the fixture must write this file'
  await apply(ctx, session, '*** Begin Patch\n*** Add File: escalated.txt\n+x\n*** End Patch', {
    sandbox_permissions: 'require_escalated',
    justification,
  })
  assert.equal(await text(join(root, 'escalated.txt')), 'x\n')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].toolName, 'apply_patch')
  assert.deepEqual(requests[0].displayReason, {
    en: `Allow this file operation to run without the sandbox: ${justification}`,
    zh: `允许这次文件操作在沙箱外执行：${justification}`,
  })

  outcome = 'rejected'
  await assert.rejects(
    apply(ctx, session, '*** Begin Patch\n*** Add File: refused.txt\n+x\n*** End Patch', {
      sandbox_permissions: 'require_escalated',
      justification,
    }),
    /the user rejected writing this patch without the sandbox/u,
  )
  assert.equal(await stat(join(root, 'refused.txt')).then(() => true, () => false), false)
})

await test('a commit failure stops later operations and reports completed, failed and skipped', async t => {
  const { ctx, root, session } = await mountHost(t, { fs: 'workspace-write' })
  // The platform temp area is writable under workspace-write, so escaping the
  // workspace needs a directory outside it (and outside the temp roots).
  const escape = process.platform === 'win32'
    ? `C:\\dsh-patch-escape-${process.pid}\\outside.txt`
    : `/dsh-patch-escape-${process.pid}/outside.txt`
  const patch = '*** Begin Patch\n'
    + '*** Add File: inside.txt\n+ok\n'
    + `*** Add File: ${escape}\n+no\n`
    + '*** Add File: after.txt\n+never\n'
    + '*** End Patch'
  const value = await apply(ctx, session, patch)
  assert.equal(await text(join(root, 'inside.txt')), 'ok\n')
  assert.equal(await stat(escape).then(() => true, () => false), false)
  assert.deepEqual(value.operations.map((operation: HostValue) => operation.status), ['completed', 'failed', 'skipped'])
  assert.equal(value.cancelled, false)
  assert.deepEqual(value.affectedPaths, [join(root, 'inside.txt')])
  const rendered = toolOf(ctx).output.render(undefined, value)[0].text as string
  assert.match(rendered, /^Patch stopped after 1 of 3 operations\./u)
  assert.match(rendered, /Completed:\nA \/.*inside\.txt/u)
  assert.ok(rendered.includes(`Failed:\n- operation 2 (add ${escape}, patch line 4): cannot write`))
  assert.match(rendered, /Not executed:/u)
  assert.match(rendered, /- operation 3 \(add .*after\.txt\)/u)
  assert.deepEqual(validateJsonSchemaValue(toolOf(ctx).output.schema, value), [])
})
