/**
 * Codex-compatible output formatting for the unified exec tools.
 *
 * The header layout and truncation marker are reproduced from Codex's
 * `ExecCommandToolOutput::response_header` / `response_text` in
 * `codex-rs/core/src/tools/context.rs` and its token truncation helper
 * `codex-rs/utils/string/src/truncate.rs`.
 *
 * DSH's token meter prices whole model messages for context pressure; it has
 * no injectable counter for an arbitrary string. We therefore use the same
 * approximation Codex uses for this output (`ceil(utf8Bytes / 4)`), and byte
 * budgets (`tokens * 4`) exactly as Codex's `TruncationPolicy::Tokens` does.
 */

/**
 * Codex's collection cap is 1 MiB (262_144 approximate tokens), which is the
 * widest a response could ever need before its own budget applies.
 */
const MAX_OUTPUT_TOKENS = 262_144

/** The fixed density heuristic Codex uses for unified exec output. */
export function approxTokenCount(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4)
}

/** Clamp a requested response budget the way Codex's model truncation policy does. */
export function resolveMaxTokens(requested: number | undefined): number {
  if (requested === undefined) return 10_000
  if (!Number.isFinite(requested) || requested < 0) {
    throw new Error(`invalid max_output_tokens: expected a non-negative number, got ${JSON.stringify(requested)}`)
  }
  return Math.min(Math.floor(requested), MAX_OUTPUT_TOKENS)
}

/**
 * Truncate the middle of `text` to `maxTokens * 4` UTF-8 bytes, keeping a
 * prefix and suffix and reporting the original token count. This mirrors
 * `formatted_truncate_text` from Codex, including its warning header, its
 * "Total output lines" count, and the `…N tokens truncated…` marker.
 * @param text - the output produced since the previous response.
 * @param maxTokens - token budget for this response.
 * @returns the possibly truncated text and its pre-truncation token count.
 */
export function truncateOutput(text: string, maxTokens: number): { text: string; original: number } {
  const bytes = Buffer.from(text, 'utf8')
  const maxBytes = maxTokens * 4
  const original = approxTokenCount(text)
  if (bytes.length <= maxBytes) return { text, original }

  const leftBudget = Math.floor(maxBytes / 2)
  const rightBudget = maxBytes - leftBudget
  const start = floorBoundary(bytes, leftBudget)
  const end = ceilBoundary(bytes, bytes.length - rightBudget)
  const removed = Math.ceil((bytes.length - maxBytes) / 4)
  const marker = `…${removed} tokens truncated…`
  const snippet = `${bytes.subarray(0, start).toString('utf8')}${marker}${bytes.subarray(end).toString('utf8')}`
  const header = `Warning: truncated output (original token count: ${original})\nTotal output lines: ${countLines(text)}\n\n`
  return { text: `${header}${snippet}`, original }
}

/** One unified exec response before it is rendered. */
export interface ExecOutputResult {
  chunkId?: string
  wallTimeSeconds: number
  exitCode?: number
  sessionId?: number
  originalTokenCount?: number
  output: string
}

/**
 * Render one unified exec response. Codex joins the optional metadata
 * sections with newlines, always ends the header with `Output:`, and appends
 * exactly one newline before the body (even when the body is empty).
 * @param result - response metadata and the already-truncated `output` body.
 * @returns the exact model-visible text.
 */
export function formatExecOutput(result: ExecOutputResult): string {
  const sections: string[] = []
  if (result.chunkId !== undefined && result.chunkId.length > 0) sections.push(`Chunk ID: ${result.chunkId}`)
  sections.push(`Wall time: ${result.wallTimeSeconds.toFixed(4)} seconds`)
  if (result.exitCode !== undefined) sections.push(`Process exited with code ${result.exitCode}`)
  if (result.sessionId !== undefined) sections.push(`Process running with session ID ${result.sessionId}`)
  if (result.originalTokenCount !== undefined) sections.push(`Original token count: ${result.originalTokenCount}`)
  sections.push('Output:')
  return `${sections.join('\n')}\n${result.output}`
}

/** Codex generates a six lowercase hex digit chunk id for each response. */
export function generateChunkId(): string {
  let id = ''
  for (let index = 0; index < 6; index += 1) id += Math.floor(Math.random() * 16).toString(16)
  return id
}

/** Rust's `str::lines()` does not count a trailing newline as another line. */
function countLines(text: string): number {
  if (text.length === 0) return 0
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}

/** Move down to the nearest UTF-8 character boundary, like Rust's `floor_char_boundary`. */
function floorBoundary(bytes: Buffer, index: number): number {
  let at = Math.min(Math.max(index, 0), bytes.length)
  while (at > 0 && (bytes[at] & 0xc0) === 0x80) at -= 1
  return at
}

/** Move up to the nearest UTF-8 character boundary, like Rust's `ceil_char_boundary`. */
function ceilBoundary(bytes: Buffer, index: number): number {
  let at = Math.min(Math.max(index, 0), bytes.length)
  while (at < bytes.length && (bytes[at] & 0xc0) === 0x80) at += 1
  return at
}
