/**
 * Codex's local-compaction history shape, independent of the DSH session
 * plumbing: keep the newest user text that fits in 20,000 approximate tokens,
 * restore it oldest-first, and drop everything else in favour of one summary.
 *
 * Codex counts a message's UTF-8 bytes divided by four. When the oldest kept
 * message crosses the budget it keeps the head and tail of the text with a
 * `…N tokens truncated…` marker, exactly as
 * codex-rs/utils/string/src/truncate.rs does.
 *
 * @module dsh-harness-codex/compaction/history
 */
import type { CompactionBlock, CompactionMessage, CompactionSession } from './types.js'

/** Codex's per-compaction user-message budget (`COMPACT_USER_MESSAGE_MAX_TOKENS`). */
export const KEPT_USER_MESSAGE_MAX_TOKENS = 20_000

/** Approximate tokens from UTF-8 bytes, matching Codex's four bytes per token. */
export function approxTokenCount(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4)
}

/** Join the non-empty text blocks of a message, as Codex's `content_items_to_text` does. */
export function messageText(content: readonly CompactionBlock[]): string {
  return content
    .filter((block): block is CompactionBlock & { text: string } => block.type === 'text' && typeof block.text === 'string' && block.text.length > 0)
    .map(block => block.text)
    .join('\n')
}

/** One kept user message and the content that replaces it. */
export interface KeptUserMessage {
  /** Surface position of the original event inside the compacted range. */
  readonly index: number
  readonly message: CompactionMessage
  readonly content: readonly CompactionBlock[]
}

/** Move an offset back to the previous UTF-8 boundary. */
function floorBoundary(bytes: Buffer, offset: number): number {
  let index = offset
  while (index > 0 && (bytes[index]! & 0xc0) === 0x80) index -= 1
  return index
}

/** Move an offset forward to the next UTF-8 boundary. */
function ceilBoundary(bytes: Buffer, offset: number): number {
  let index = offset
  while (index < bytes.length && (bytes[index]! & 0xc0) === 0x80) index += 1
  return index
}

/**
 * Keep the head and tail of an over-budget text and insert Codex's marker.
 * The marker sits outside the retained byte budget, like the upstream helper.
 */
export function truncateText(text: string, maxTokens: number): CompactionBlock[] {
  const maxBytes = maxTokens * 4
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= maxBytes) return [{ type: 'text', text }]
  const left = Math.floor(maxBytes / 2)
  const right = maxBytes - left
  const head = bytes.subarray(0, floorBoundary(bytes, left)).toString('utf8')
  const tail = bytes.subarray(ceilBoundary(bytes, bytes.length - right)).toString('utf8')
  const removed = bytes.length - maxBytes
  const marker = `…${Math.ceil(removed / 4)} tokens truncated…`
  return [
    { type: 'text', text: head },
    { type: 'text', text: marker },
    { type: 'text', text: tail },
  ]
}

/**
 * Project one user message into its replacement content. Text-only messages
 * within budget keep their blocks; media is dropped; the oldest kept message
 * may be truncated to the remaining budget.
 */
function retainedContent(message: CompactionMessage, remaining: number): CompactionBlock[] {
  const text = messageText(message.content)
  const tokens = approxTokenCount(text)
  const textBlocks = message.content.filter(block => block.type === 'text')
  if (tokens <= remaining) {
    return textBlocks.length === 0
      ? [{ type: 'text', text: '' }]
      : textBlocks.map(block => ({ type: 'text', text: block.text ?? '' }))
  }
  return truncateText(text, remaining)
}

/**
 * Select the user messages Codex would keep, newest first while the budget
 * lasts, then return them in chronological order. Messages produced by
 * compaction itself (the summary) and context injected by other producers are
 * not original user messages and are skipped.
 */
export function collectKeptUserMessages(
  session: CompactionSession,
  startIndex: number,
  endIndex: number,
  summaryPrefix: string,
  maxTokens = KEPT_USER_MESSAGE_MAX_TOKENS,
): KeptUserMessage[] {
  const summaryMarker = `${summaryPrefix}\n`
  const candidates: Array<{ index: number; message: CompactionMessage; tokens: number }> = []
  for (let index = startIndex; index <= endIndex; index += 1) {
    const event = session.eventAt(session.surface.nodes[index]!)
    if (event?.type !== 'user/message') continue
    const message = session.deriveEventMessage(event)
    if (message === null || message.role !== 'user' || message.source?.kind !== 'user') continue
    const text = messageText(message.content)
    if (text.startsWith(summaryMarker)) continue
    candidates.push({ index, message, tokens: approxTokenCount(text) })
  }

  let remaining = maxTokens
  const selected = new Map<number, KeptUserMessage>()
  for (let offset = candidates.length - 1; offset >= 0; offset -= 1) {
    if (remaining === 0) break
    const candidate = candidates[offset]!
    selected.set(candidate.index, {
      index: candidate.index,
      message: candidate.message,
      content: retainedContent(candidate.message, remaining),
    })
    remaining = Math.max(0, remaining - candidate.tokens)
  }
  return [...selected.values()].sort((left, right) => left.index - right.index)
}
