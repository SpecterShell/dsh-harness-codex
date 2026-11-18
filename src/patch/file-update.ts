/**
 * Turn parsed update blocks into a new file text.
 *
 * Port of OpenAI Codex's `file_update.rs`: locate each block's old lines with
 * the sequential matcher, then replace only the spans between explicitly
 * marked context lines. Splitting at context lines is what keeps source
 * context byte-identical when a fuzzy pass matched it, and it is why an
 * insertion-only block appends after every source line rather than before a
 * trailing blank one.
 * @module @spectershell/dsh-harness-codex/patch/file-update
 */
import { seekSequence } from './seek-sequence.ts'
import { SourceFile } from './text-file.ts'
import type { Replacement } from './text-file.js'
import type { PatchChunk, PatchMatchFailure } from './types.js'

/** Result of deriving new contents, or the block that could not be matched. */
export type DerivedUpdate =
  | { ok: true; after: string }
  | { ok: false; failure: PatchMatchFailure }

/**
 * Locate every chunk and record the source spans to replace.
 * @param originalLines - source lines without terminators.
 * @param path - display path named in a failure message.
 * @param chunks - ordered chunks of one update hunk.
 * @returns sorted non-overlapping replacements, or the first match failure.
 */
function computeReplacements(
  originalLines: readonly string[],
  path: string,
  chunks: readonly PatchChunk[],
): { ok: true; replacements: Replacement[] } | { ok: false; failure: PatchMatchFailure } {
  const replacements: Replacement[] = []
  let lineIndex = 0

  for (const chunk of chunks) {
    if (chunk.context !== undefined) {
      const found = seekSequence(originalLines, [chunk.context], lineIndex, false)
      if (found === undefined) {
        return {
          ok: false,
          failure: { message: `Failed to find context '${chunk.context}' in ${path}`, lineNumber: chunk.lineNumber },
        }
      }
      lineIndex = found + 1
    }

    // An insertion-only block has no position of its own, so Codex appends it
    // after the last source line. The cursor deliberately does not advance.
    if (chunk.oldLines.length === 0) {
      replacements.push({ start: originalLines.length, oldLength: 0, lines: [...chunk.newLines] })
      continue
    }

    let pattern = chunk.oldLines
    let newLines = chunk.newLines
    let found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile)
    if (found === undefined && pattern.at(-1) === '') {
      // A trailing empty old line represents the file's final newline, which
      // the line model stores on the preceding line rather than as a separate
      // element. Retry without the sentinel, and drop the matching sentinel
      // from the replacement when present.
      pattern = pattern.slice(0, -1)
      if (newLines.at(-1) === '') newLines = newLines.slice(0, -1)
      found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile)
    }
    if (found === undefined) {
      return {
        ok: false,
        failure: {
          message: `Failed to find expected lines in ${path}:\n${chunk.oldLines.join('\n')}`,
          lineNumber: chunk.lineNumber,
        },
      }
    }

    // Emit a replacement only for the span between context lines; the context
    // lines themselves stay in the source file with their original bytes.
    let oldStart = 0
    let newStart = 0
    for (const [oldContext, newContext] of chunk.contextLineIndices) {
      // A trailing context line can have been removed with the sentinel above.
      if (oldContext >= pattern.length || newContext >= newLines.length) break
      if (oldStart !== oldContext || newStart !== newContext) {
        replacements.push({
          start: found + oldStart,
          oldLength: oldContext - oldStart,
          lines: newLines.slice(newStart, newContext),
        })
      }
      oldStart = oldContext + 1
      newStart = newContext + 1
    }
    if (oldStart !== pattern.length || newStart !== newLines.length) {
      replacements.push({
        start: found + oldStart,
        oldLength: pattern.length - oldStart,
        lines: newLines.slice(newStart),
      })
    }
    lineIndex = found + pattern.length
  }

  // Applying replacements back to front in the file is easiest when they are
  // sorted forward; the insertion-only case can produce equal starts, and the
  // stable sort keeps patch order there.
  replacements.sort((left, right) => left.start - right.start)
  return { ok: true, replacements }
}

/**
 * Derive the new text for one update from the current source text.
 * @param originalContents - decoded source text, including any BOM.
 * @param path - display path used in failure messages.
 * @param chunks - ordered update blocks.
 * @returns the rebuilt text, or the first block that did not match.
 */
export function deriveNewContents(
  originalContents: string,
  path: string,
  chunks: readonly PatchChunk[],
): DerivedUpdate {
  const source = SourceFile.parse(originalContents)
  const computed = computeReplacements(source.lineTexts(), path, chunks)
  if (!computed.ok) return computed
  source.applyReplacements(computed.replacements)
  return { ok: true, after: source.contents() }
}
