/**
 * Resolve native public entry points from an explicit host installation.
 * Tests must share Cordis and scope identities with that host, so installing a
 * second dependency graph in this design repository would invalidate the proof.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { join, dirname, isAbsolute } from 'node:path'
import type { TestContext } from 'node:test'

/** Fixture locale shape; both languages are asserted to share these keys. */
interface Locale {
  errors: {
    anchor: string
    version: string
    temporary: string
  }
  tests: Record<string, string>
  fixture: Record<string, string>
}

/**
 * A host module loaded from the external installation. Its API belongs to the
 * host, not to this package, so the fixture treats it as a dynamic namespace.
 */
type NativeModule = Record<string, any>

/**
 * A host-owned value (context, session, service) in tests. The host packages
 * are intentionally not dependencies, so their types are not available here;
 * tests assert behavior rather than host internals.
 */
export type HostValue = any

/** A mounted plugin fiber owned by the calling test context. */
export interface HostFiber {
  await(): Promise<void>
  dispose(): void | Promise<void>
}

/** The Cordis context members these fixtures use to mount a plugin. */
export interface MountableContext {
  plugin(plugin: unknown, config?: unknown): HostFiber
}

export const english = JSON.parse(await readFile(new URL('../locales/en.json', import.meta.url), 'utf8')) as Locale
export const chinese = JSON.parse(await readFile(new URL('../locales/zh-Hans.json', import.meta.url), 'utf8')) as Locale

/**
 * Find the installed host manifest from the `dsh` command.
 *
 * A pnpm shim is a shell script that records the exact entry it launches as
 * `cmd-shim-target=<dir>/lib/bin.js`. An npm global install instead exposes
 * `dsh` as a symlink to `<prefix>/@deepseek-ai/dsh/lib/bin.js`, so the shim
 * parse is empty and the manifest is found by resolving the symlink and
 * walking up to the owning package.json.
 */
async function installedAnchor(): Promise<string | undefined> {
  try {
    const executable = execFileSync('which', ['dsh'], { encoding: 'utf8' }).trim()
    const shim = await readFile(executable, 'utf8')
    const target = /cmd-shim-target=(\S+)\/lib\/bin\.js/.exec(shim)?.[1]
    if (target !== undefined) return join(target, 'package.json')

    for (let directory = dirname(await realpath(executable)); ; directory = dirname(directory)) {
      const manifest = join(directory, 'package.json')
      try {
        const parsed = JSON.parse(await readFile(manifest, 'utf8')) as { name?: unknown }
        if (parsed.name === '@deepseek-ai/dsh') return manifest
      } catch {
        // Not this directory's manifest; keep walking toward the install root.
      }
      if (dirname(directory) === directory) return undefined
    }
  } catch {
    return undefined
  }
}

const anchor = process.env.DSH_NATIVE_ANCHOR ?? await installedAnchor()
assert.ok(anchor !== undefined, english.errors.anchor)
assert.ok(isAbsolute(anchor), english.errors.anchor)
const hostManifest = JSON.parse(await readFile(anchor, 'utf8')) as { version?: unknown }
assert.equal(hostManifest.version, '0.2.2-rc.3', english.errors.version)
const require = createRequire(anchor)

/** Import a public native entry without private subpath access or live mounting. */
export async function native(name: string): Promise<NativeModule> {
  return import(require.resolve(`@deepseek-ai/${name}`))
}

/** Capture exact package provenance for reproducibility instead of semver guesses. */
export async function provenance(names: string[]): Promise<Array<{ name: string; version: string; manifestPath: string }>> {
  return Promise.all(names.map(async name => {
    const manifestPath = await realpath(require.resolve(`@deepseek-ai/${name}/package.json`))
    const { version } = JSON.parse(await readFile(manifestPath, 'utf8')) as { version: string }
    return { name: `@deepseek-ai/${name}`, version, manifestPath }
  }))
}

/** Mount and await a native plugin; teardown remains owned by the root Fiber. */
export async function mount(ctx: MountableContext, plugin: unknown, config?: unknown): Promise<HostFiber> {
  const fiber = ctx.plugin(plugin, config)
  await fiber.await()
  return fiber
}

/** Own a unique temporary root and check its identity before recursive cleanup. */
export async function temporary(t: TestContext): Promise<string> {
  const parent = await realpath(tmpdir())
  const path = await mkdtemp(join(parent, 'dsh-codex-proof-'))
  t.after(async () => {
    assert.equal(dirname(path), parent, english.errors.temporary)
    assert.equal(await realpath(path), path, english.errors.temporary)
    await rm(path, { recursive: true })
  })
  return path
}
