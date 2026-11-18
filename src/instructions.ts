/**
 * Codex-ordered project instruction files for the Codex-inspired preset.
 *
 * DSH's native `agent-instructions` row loads every candidate in a directory,
 * so it cannot express Codex's first-present rule (`AGENTS.override.md` wins
 * over `AGENTS.md`). This row leaves the native row responsible for the
 * user-level `AGENTS.md` and reads the project chain itself: walk from the
 * project root down to the working directory, take one candidate per
 * directory, and stop when Codex's 32 KiB project-doc budget is spent.
 *
 * The project docs enter the step through the same seam the native row uses:
 * an `agent/pre-step` waterfall listener appends one identified user message.
 * There is no inbox or file-touch reconciliation because the chain is small
 * and recomputed at every step, which also picks up a working-directory
 * change. Codex reads project docs only when its environment selection changes;
 * this row is deliberately a little fresher.
 *
 * @module dsh-harness-codex/instructions
 */
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import type {
  Agent,
  FileSystemService,
  FsTarget,
  InstructionTextBlock,
  InstructionsContext,
  ProjectInstructionFile,
  ProjectInstructionMessage,
} from './types.js'

/** Cordis plugin name. */
export const name = 'project-instructions'

/** The working-directory resolver this row needs. */
export const inject = ['workingDirectory']

/** Codex's preferred project doc name (`core/src/agents_md.rs`). */
const OVERRIDE = 'AGENTS.override.md'

/** Codex's base project doc name (`core/src/agents_md.rs`). */
const BASE = 'AGENTS.md'

/** Codex's default project-root marker (`config/defaults.toml`). */
const DEFAULT_MARKERS = ['.git']

/** Codex's default project-doc budget (`config/defaults.toml`). */
const DEFAULT_MAX_BYTES = 32 * 1024

/** Codex's transition marker between user and project docs. */
const PROJECT_DOC_SEPARATOR = '--- project-doc ---'

/** Codex's world-state notice when project docs change. */
const REPLACEMENT_NOTICE = 'These AGENTS.md instructions replace all previously provided AGENTS.md instructions.'

/** Codex's world-state notice when project docs disappear. */
const REMOVAL_NOTICE = 'The previously provided AGENTS.md instructions no longer apply.'

/** Content identity used to decide whether the visible project docs changed. */
function projectDigest(text: string): string {
  return createHash('sha1').update(text).digest('hex')
}

/** The digest of no project docs, used by removal messages. */
const EMPTY_DIGEST = projectDigest('')

/** The row config. Omitted values match Codex's defaults. */
export interface InstructionsConfig {
  /** UTF-8 byte cap across the project chain. Non-positive disables it. */
  maxBytes?: number
  /** Child names that identify the project root. Empty means the cwd only. */
  projectRootMarkers?: string[]
  /** Filenames tried after `AGENTS.md`, in order. Codex's default is empty. */
  fallbackFilenames?: string[]
}

/** Inputs to one project-chain read. */
export interface ProjectInstructionsOptions {
  cwd: string
  fs: FileSystemService
  maxBytes?: number
  projectRootMarkers?: readonly string[]
  fallbackFilenames?: readonly string[]
  signal?: AbortSignal
}

/** The retained files and their Codex-style concatenation. */
export interface ProjectInstructions {
  text: string
  files: ProjectInstructionFile[]
}

/** A candidate that exists as a regular file. */
interface Candidate {
  target: FsTarget
  absolutePath: string
}

/**
 * Read the project instruction chain Codex would read.
 *
 * The root is the nearest ancestor with a configured marker, or the working
 * directory when there is none. Directories are visited root first. Each
 * directory contributes at most its first present candidate, and files stop
 * when the byte budget is exhausted. Whitespace-only files never consume the
 * budget, matching Codex.
 * @param options - working directory, host filesystem, and Codex's controls.
 * @returns files in model order and their `\n\n`-joined text.
 */
export async function readProjectInstructions(options: ProjectInstructionsOptions): Promise<ProjectInstructions> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  if (!(maxBytes > 0) || !Number.isFinite(maxBytes)) return { text: '', files: [] }
  const fs = options.fs
  const signal = options.signal
  const cwd = resolve(options.cwd)
  const root = await findProjectRoot(cwd, options.projectRootMarkers ?? DEFAULT_MARKERS, fs, signal)
  const names = candidateNames(options.fallbackFilenames)
  const files: ProjectInstructionFile[] = []
  let remaining = maxBytes
  for (const directory of ancestorChain(root, cwd)) {
    if (remaining <= 0) break
    const candidate = await firstCandidate(directory, names, fs, signal)
    if (candidate === undefined) continue
    const content = await readBounded(fs, candidate.target, remaining, signal)
    if (content === undefined || content.trim().length === 0) continue
    files.push({ absolutePath: candidate.absolutePath, content })
    remaining -= Buffer.byteLength(content, 'utf8')
  }
  return { text: files.map((file) => file.content).join('\n\n'), files }
}

/**
 * Inject one project-document user message into a step when the chain changed.
 * @param ctx - agent scope that injects the working directory.
 * @param config - optional Codex controls.
 */
export function apply(ctx: InstructionsContext, config: InstructionsConfig = {}): void {
  const configuredMaxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES
  const projectRootMarkers = config.projectRootMarkers ?? DEFAULT_MARKERS
  const fallbackFilenames = config.fallbackFilenames ?? []
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    const fs = ctx.get('fs')
    if (fs === undefined) return decision
    const cwd = await ctx.workingDirectory.ensure(payload.agent, payload.signal)
    // Read the live budget on every step: a settings save should change what
    // the next step reads, not what the row resolved at mount.
    const maxBytes = ctx.get('codexSettings')?.instructionsMaxBytes() ?? configuredMaxBytes
    const { text } = await readProjectInstructions({
      cwd,
      fs,
      maxBytes,
      projectRootMarkers,
      fallbackFilenames,
      signal: payload.signal,
    })
    const visible = visibleProjectDigest(payload.agent)
    const digest = projectDigest(text)
    if (visible === digest) return decision
    // Nothing was shown before and nothing is there now: no message is needed.
    if (text.length === 0 && visible === undefined) return decision
    const body = text.length === 0
      ? REMOVAL_NOTICE
      : projectBody(text, visible !== undefined && visible !== EMPTY_DIGEST)
    return { ...decision, messages: [...decision.messages, projectInstructionMessage(body, digest)] }
  })
}

/** Digest of the project docs the newest committed project message made visible. */
function visibleProjectDigest(agent: Agent): string | undefined {
  for (const seq of agent.session.surface.nodes.toReversed()) {
    const event = agent.session.eventAt(seq)
    if (event?.type !== 'user/message' || event.data.source?.kind !== 'project-instructions') continue
    const digest = event.data.source.digest
    if (typeof digest === 'string') return digest
  }
  return undefined
}

/** Candidate filenames in Codex's order, dropping path-shaped fallbacks. */
function candidateNames(fallbackFilenames: readonly string[] = []): readonly string[] {
  const names = [OVERRIDE, BASE]
  for (const candidate of fallbackFilenames) {
    if (candidate.length === 0 || candidate === '.' || candidate === '..') continue
    if (candidate.includes('/') || candidate.includes('\\') || candidate.includes('\0')) continue
    if (names.includes(candidate)) continue
    names.push(candidate)
  }
  return names
}

/** Walk upward to the first marker directory; fall back to the cwd. */
async function findProjectRoot(
  cwd: string,
  markers: readonly string[],
  fs: FileSystemService,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (markers.length === 0) return cwd
  let directory = cwd
  for (;;) {
    for (const marker of markers) {
      if (await exists(join(directory, marker), fs, signal)) return directory
    }
    const parent = dirname(directory)
    if (parent === directory) return cwd
    directory = parent
  }
}

/** Probe one path without letting a missing marker hide readable docs. */
async function exists(path: string, fs: FileSystemService, signal: AbortSignal | undefined): Promise<boolean> {
  try {
    const target = await fs.resolve(path, { signal })
    return (await fs.stat(target, signal)) !== undefined
  } catch {
    signal?.throwIfAborted()
    return false
  }
}

/** Inclusive root-to-cwd directory chain, broadest first. */
function ancestorChain(root: string, cwd: string): string[] {
  const chain: string[] = []
  let current = cwd
  while (current !== root) {
    chain.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  chain.push(root)
  return chain.reverse()
}

/** The first candidate in one directory that is a regular file. */
async function firstCandidate(
  directory: string,
  names: readonly string[],
  fs: FileSystemService,
  signal: AbortSignal | undefined,
): Promise<Candidate | undefined> {
  for (const name of names) {
    const absolutePath = join(directory, name)
    try {
      const target = await fs.resolve(absolutePath, { signal })
      if ((await fs.stat(target, signal))?.type === 'file') return { target, absolutePath }
    } catch {
      signal?.throwIfAborted()
    }
  }
  return undefined
}

/** Read at most `maxBytes` of one file, trimming an incomplete UTF-8 tail. */
async function readBounded(
  fs: FileSystemService,
  target: FsTarget,
  maxBytes: number,
  signal: AbortSignal | undefined,
): Promise<string | undefined> {
  try {
    const info = await fs.stat(target, signal)
    if (info?.type !== 'file') return undefined
    const size = info.size
    if (size === undefined) return decodePrefix(await fs.readBytes(target, signal, maxBytes), false)
    if (size === 0) return ''
    const bytes = await fs.readByteRange(target, { offset: 0, length: Math.min(size, maxBytes) }, signal)
    return decodePrefix(bytes, size > maxBytes)
  } catch {
    signal?.throwIfAborted()
    return undefined
  }
}

/**
 * Decode a byte prefix, dropping a trailing partial character so the retained
 * text never exceeds the byte budget and never contains U+FFFD from clipping.
 */
function decodePrefix(bytes: Uint8Array, clipped: boolean): string {
  let end = bytes.length
  if (clipped && end > 0) {
    let lead = end - 1
    while (lead > 0 && (bytes[lead]! & 0xc0) === 0x80) lead -= 1
    const byte = bytes[lead]!
    const need = (byte & 0x80) === 0
      ? 1
      : (byte & 0xe0) === 0xc0
        ? 2
        : (byte & 0xf0) === 0xe0
          ? 3
          : (byte & 0xf8) === 0xf0
            ? 4
            : 1
    if (lead + need > end) end = lead
  }
  return Buffer.from(bytes.subarray(0, end)).toString('utf8')
}

/** Wrap text in the reminder frame the native instruction row also uses. */
function frame(body: string): string {
  const escaped = body.replaceAll('</system-reminder>', '<\\/system-reminder>')
  return `<system-reminder>\n${escaped}\n</system-reminder>`
}

/** Codex's project transition marker plus the project docs. */
function projectBody(text: string, replacement: boolean): string {
  const notice = replacement ? `${REPLACEMENT_NOTICE}\n\n` : ''
  return `${notice}${PROJECT_DOC_SEPARATOR}\n\n${text}`
}

/** Build the identified user message appended to the step. */
function projectInstructionMessage(body: string, digest: string): ProjectInstructionMessage {
  const content: InstructionTextBlock[] = [{ type: 'text', text: frame(body) }]
  return {
    id: randomUUID(),
    role: 'user',
    content,
    source: { kind: 'project-instructions', form: 'instructions', changes: [], digest },
  }
}
