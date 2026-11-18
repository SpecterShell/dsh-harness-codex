/**
 * Test public instruction discovery/read exports against an owned nested project.
 * This establishes reusable filesystem/configuration seams. Agent inbox admission,
 * trust-policy integration and scoped producer replacement require later fixtures.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { native, mount, temporary, english } from '../fixtures/native-host.ts'
import type { HostValue } from '../fixtures/native-host.ts'

const { Context } = await native('cordis')
const { LocalFileSystem } = await native('dsh-fs-local')
const { discoverBaselineInstructionFiles, loadBaselineInstructions } = await native('dsh-agent-instructions')

await test(english.tests.instructions, { timeout: 15000 }, async t => {
  const root = await temporary(t)
  const cwd = join(root, 'project')
  const nested = join(cwd, 'child')
  const dshHome = join(root, 'dsh-home')
  const agentsHome = join(root, 'agents-home')
  for (const directory of [join(cwd, '.git'), nested, dshHome, agentsHome]) await mkdir(directory, { recursive: true })
  for (const [path, text] of [
    [join(dshHome, 'AGENTS.md'), 'USER_GLOBAL_SENTINEL'],
    [join(agentsHome, 'AGENTS.md'), 'AGENTS_GLOBAL_SENTINEL'],
    [join(cwd, 'AGENTS.md'), 'ROOT_BASE_SENTINEL'],
    [join(cwd, 'AGENTS.override.md'), 'ROOT_OVERRIDE_SENTINEL'],
    [join(nested, 'AGENTS.md'), 'CHILD_BASE_SENTINEL'],
  ]) await writeFile(path, text)
  const host = new Context()
  t.after(() => host.fiber.dispose())
  await mount(host, LocalFileSystem, { cwd })
  const options = { cwd, dshHome, agentsHome, maxBytes: 32768, localInstructionFileCandidates: [], instructionFileCandidates: ['AGENTS.override.md', 'AGENTS.md'] }
  const files = await discoverBaselineInstructionFiles(options)
  assert.deepEqual(files.map((file: HostValue) => file.absolutePath), [join(dshHome, 'AGENTS.md'), join(agentsHome, 'AGENTS.md'), join(cwd, 'AGENTS.override.md'), join(cwd, 'AGENTS.md')])
  const rootInstructions = await loadBaselineInstructions(options, host.fs)
  assert.match(rootInstructions.text, /USER_GLOBAL_SENTINEL/)
  assert.match(rootInstructions.text, /AGENTS_GLOBAL_SENTINEL/)
  // A candidate order alone does not implement first-present override selection.
  assert.match(rootInstructions.text, /ROOT_OVERRIDE_SENTINEL/)
  assert.match(rootInstructions.text, /ROOT_BASE_SENTINEL/)
  assert.doesNotMatch(rootInstructions.text, /CHILD_BASE_SENTINEL/)
  const nestedInstructions = await loadBaselineInstructions({ ...options, cwd: nested }, host.fs)
  assert.match(nestedInstructions.text, /CHILD_BASE_SENTINEL/)
  await writeFile(join(nested, 'AGENTS.md'), 'CHILD_REFRESHED_SENTINEL')
  const refreshed = await loadBaselineInstructions({ ...options, cwd: nested }, host.fs)
  assert.match(refreshed.text, /CHILD_REFRESHED_SENTINEL/)
  assert.doesNotMatch(refreshed.text, /CHILD_BASE_SENTINEL/)
  // The existing loader can retain both user-global roots while omitting projects.
  const globalOnly = await loadBaselineInstructions({ ...options, cwd: nested, instructionFileCandidates: [] }, host.fs)
  assert.match(globalOnly.text, /USER_GLOBAL_SENTINEL/)
  assert.match(globalOnly.text, /AGENTS_GLOBAL_SENTINEL/)
  assert.doesNotMatch(globalOnly.text, /ROOT_|CHILD_/)
})
