/**
 * Codex patch syntax parser.
 *
 * This is a direct port of OpenAI Codex's `parse_patch` plus its streaming
 * state machine (see NOTICE for the source files and commit). Codex streams a
 * delta character by character because its standalone executable can apply a
 * patch before the whole tool call arrives; the preset only ever sees a
 * complete `input` string, so this port feeds every line through the same
 * state machine in one pass. Behavior, diagnostics and line numbering follow
 * the upstream state machine rather than a regular grammar, which is why a
 * malformed hunk rejects at the line where the state machine notices it.
 *
 * One deliberate difference: upstream accepts a `*** Environment ID:` preamble
 * because its handler can route the patch to a named executor. A DSH preset has
 * one filesystem, so accepting that header would silently ignore the model's
 * routing request; the parser rejects it instead.
 * @module @spectershell/dsh-harness-codex/patch/parser
 */
import { PatchParseError } from './types.ts'
import type { PatchChunk, PatchOperation } from './types.js'

/** Patch envelope markers; the trailing spaces on file headers are significant. */
const BEGIN_PATCH_MARKER = '*** Begin Patch'
const END_PATCH_MARKER = '*** End Patch'
const ADD_FILE_MARKER = '*** Add File: '
const DELETE_FILE_MARKER = '*** Delete File: '
const UPDATE_FILE_MARKER = '*** Update File: '
const MOVE_TO_MARKER = '*** Move to: '
const EOF_MARKER = '*** End of File'
const CHANGE_CONTEXT_MARKER = '@@ '
const EMPTY_CHANGE_CONTEXT_MARKER = '@@'
const ENVIRONMENT_ID_MARKER = '*** Environment ID:'

/**
 * Codex trims with Rust's `str::trim`, which removes Unicode `White_Space` but
 * leaves U+FEFF (a BOM) alone. JavaScript's `trim()` also removes U+FEFF, so the
 * parser must use this explicit class to keep BOM handling faithful.
 */
const WHITE_SPACE = /\p{White_Space}/u

/** Literal heredoc wrappers Codex tolerates around a patch. */
const HEREDOC_STARTERS: ReadonlySet<string> = new Set(['<<EOF', "<<'EOF'", '<<"EOF"'])

/** A line of the trimmed patch plus its one-based line in the model's input. */
interface InputLine {
  text: string
  number: number
}

/** Trim Rust-`White_Space` from the start of a string. */
export function trimStart(value: string): string {
  let start = 0
  while (start < value.length && WHITE_SPACE.test(value.charAt(start))) start += 1
  return value.slice(start)
}

/** Trim Rust-`White_Space` from the end of a string. */
export function trimEnd(value: string): string {
  let end = value.length
  while (end > 0 && WHITE_SPACE.test(value.charAt(end - 1))) end -= 1
  return value.slice(0, end)
}

/** Trim Rust-`White_Space` from both ends of a string. */
export function trimWhitespace(value: string): string {
  return trimEnd(trimStart(value))
}

/**
 * Split like Rust's `str::lines`: an LF or CRLF terminates a line, a trailing
 * lone CR belongs to the final unterminated line, and a final line terminator
 * does not create an extra empty line.
 * @param text - text to split.
 * @returns the logical lines, without terminators.
 */
function rustLines(text: string): string[] {
  if (text === '') return []
  const parts = text.split('\n')
  const endsWithNewline = text.endsWith('\n')
  for (let index = 0; index < parts.length - 1; index += 1) {
    const line = parts[index] as string
    if (line.endsWith('\r')) parts[index] = line.slice(0, -1)
  }
  if (endsWithNewline) parts.pop()
  return parts
}

/** Count LF occurrences; used to keep line numbers relative to the model's input. */
function countNewlines(text: string): number {
  let count = 0
  for (const character of text) if (character === '\n') count += 1
  return count
}

/**
 * Check the patch envelope exactly as Codex's strict boundary check does.
 * @param lines - candidate patch lines.
 * @throws PatchParseError when the Begin/End markers are missing.
 */
function checkPatchBoundaries(lines: readonly string[]): void {
  const first = lines[0]
  const last = lines.at(-1)
  // Empty input has no first line, and Codex reports that as a missing End
  // marker rather than a missing Begin marker.
  if (first === undefined) throw new PatchParseError("The last line of the patch must be '*** End Patch'")
  if (trimWhitespace(first) !== BEGIN_PATCH_MARKER) {
    throw new PatchParseError("The first line of the patch must be '*** Begin Patch'")
  }
  if (trimWhitespace(last as string) !== END_PATCH_MARKER) {
    throw new PatchParseError("The last line of the patch must be '*** End Patch'")
  }
}

/** Codex's diagnostic for a stray line where a hunk header belongs. */
function invalidHeaderMessage(trimmed: string): string {
  return `'${trimmed}' is not a valid hunk header. Valid hunk headers: `
    + "'*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'"
}

/** Codex's diagnostic for an update line with no recognized diff prefix. */
function unexpectedUpdateLine(line: string): PatchParseError {
  return new PatchParseError(
    `Unexpected line found in update hunk: '${line}'. Every line should start with `
    + "' ' (context line), '+' (added line), or '-' (removed line)",
  )
}

/** Create an empty update block anchored to its patch line. */
function newChunk(lineNumber: number): PatchChunk {
  return { lineNumber, oldLines: [], newLines: [], contextLineIndices: [], isEndOfFile: false }
}

/** True when a block carries no context, added or removed line. */
function emptyChunk(chunk: PatchChunk): boolean {
  return chunk.oldLines.length === 0 && chunk.newLines.length === 0
}

/** Parser state; mirrors Codex's `StreamingParserMode`. */
type ParserMode = 'notStarted' | 'started' | 'add' | 'delete' | 'update' | 'ended'

/** The update operation currently accepting lines, if any. */
type UpdateOperation = Extract<PatchOperation, { kind: 'update' }>

/**
 * Feed complete lines through Codex's hunk state machine.
 * @param lines - trimmed patch lines with their original line numbers.
 * @returns the parsed operations in patch order.
 * @throws PatchParseError for any syntax or state-machine violation.
 */
function scanHunks(lines: readonly InputLine[]): PatchOperation[] {
  const hunks: PatchOperation[] = []
  let mode: ParserMode = 'notStarted'
  /** Patch line of the `*** Update File:` header that opened the current hunk. */
  let updateHeaderLine = 0

  /** The current update operation; only valid in update mode. */
  function currentUpdate(): UpdateOperation | undefined {
    const last = hunks.at(-1)
    return last?.kind === 'update' ? last : undefined
  }

  /**
   * Codex checks the hunk that a header is about to close before switching
   * modes, so an empty `*** Update File:` block rejects before the next file
   * is started.
   */
  function ensureUpdateHunkIsNotEmpty(closedBy: string, lineNumber: number): void {
    if (mode !== 'update') return
    const update = currentUpdate()
    if (update === undefined) return
    if (update.chunks.length === 0) {
      throw new PatchParseError(`Update file hunk for path '${update.path}' is empty`, updateHeaderLine)
    }
    const last = update.chunks.at(-1)
    if (last !== undefined && emptyChunk(last)) {
      if (closedBy === END_PATCH_MARKER) throw new PatchParseError('Update hunk does not contain any lines', lineNumber)
      throw unexpectedUpdateLine(closedBy)
    }
  }

  /**
   * Handle every marker that may appear between content lines. The caller
   * chooses how much to trim: update content keeps leading spaces (an indented
   * marker is context), while other modes trim both ends.
   * @param header - the trimmed line compared against the markers.
   * @param lineNumber - one-based patch line of the marker.
   * @returns true when the line was a marker and was consumed.
   */
  function handleHeader(header: string, lineNumber: number): boolean {
    if (mode === 'started' && header.startsWith(ENVIRONMENT_ID_MARKER)) {
      throw new PatchParseError('apply_patch environment IDs are unsupported; the tool edits the Session working directory')
    }
    if (header === END_PATCH_MARKER) {
      ensureUpdateHunkIsNotEmpty(header, lineNumber)
      mode = 'ended'
      return true
    }
    if (header.startsWith(ADD_FILE_MARKER)) {
      ensureUpdateHunkIsNotEmpty(header, lineNumber)
      hunks.push({ kind: 'add', path: header.slice(ADD_FILE_MARKER.length), lineNumber, content: '' })
      mode = 'add'
      return true
    }
    if (header.startsWith(DELETE_FILE_MARKER)) {
      ensureUpdateHunkIsNotEmpty(header, lineNumber)
      hunks.push({ kind: 'delete', path: header.slice(DELETE_FILE_MARKER.length), lineNumber })
      mode = 'delete'
      return true
    }
    if (header.startsWith(UPDATE_FILE_MARKER)) {
      ensureUpdateHunkIsNotEmpty(header, lineNumber)
      hunks.push({ kind: 'update', path: header.slice(UPDATE_FILE_MARKER.length), lineNumber, chunks: [] })
      mode = 'update'
      updateHeaderLine = lineNumber
      return true
    }
    return false
  }

  /** Process one non-final line through the current mode. */
  function processLine(text: string, lineNumber: number): void {
    const trimmed = trimWhitespace(text)
    switch (mode) {
      case 'notStarted':
        if (trimmed === BEGIN_PATCH_MARKER) {
          mode = 'started'
          return
        }
        throw new PatchParseError("The first line of the patch must be '*** Begin Patch'")
      case 'started':
        if (handleHeader(trimmed, lineNumber)) return
        throw new PatchParseError(invalidHeaderMessage(trimmed), lineNumber)
      case 'add': {
        if (handleHeader(trimmed, lineNumber)) return
        // Added content keeps everything after the '+' byte for byte.
        if (text.startsWith('+')) {
          const operation = hunks.at(-1)
          if (operation?.kind === 'add') operation.content += `${text.slice(1)}\n`
          return
        }
        throw new PatchParseError(invalidHeaderMessage(trimmed), lineNumber)
      }
      case 'delete':
        if (handleHeader(trimmed, lineNumber)) return
        throw new PatchParseError(invalidHeaderMessage(trimmed), lineNumber)
      case 'update':
        processUpdateLine(text, lineNumber)
        return
      case 'ended':
        if (trimmed === '') return
        throw new PatchParseError("The last line of the patch must be '*** End Patch'")
    }
  }

  /** Process one update line, where trailing whitespace is ignored for markers. */
  function processUpdateLine(text: string, lineNumber: number): void {
    const updateLine = trimEnd(text)
    if (handleHeader(updateLine, lineNumber)) return
    const update = currentUpdate()
    if (update === undefined) throw new PatchParseError('update line outside an update hunk', lineNumber)
    const previous = update.chunks.at(-1)

    // After End of File only a new `@@` block (or a file header) may follow;
    // blank separator lines are ignored.
    if (previous?.isEndOfFile === true) {
      if (updateLine === '') return
      if (updateLine !== EMPTY_CHANGE_CONTEXT_MARKER && !updateLine.startsWith(CHANGE_CONTEXT_MARKER)) {
        throw new PatchParseError(`Expected update hunk to start with a @@ context marker, got: '${text}'`, lineNumber)
      }
    }

    if (update.chunks.length === 0 && update.moveTo === undefined && updateLine.startsWith(MOVE_TO_MARKER)) {
      update.moveTo = updateLine.slice(MOVE_TO_MARKER.length)
      return
    }

    if (
      (updateLine === EMPTY_CHANGE_CONTEXT_MARKER || updateLine.startsWith(CHANGE_CONTEXT_MARKER))
      && previous !== undefined && emptyChunk(previous)
    ) {
      throw unexpectedUpdateLine(text)
    }

    if (updateLine === EMPTY_CHANGE_CONTEXT_MARKER) {
      update.chunks.push(newChunk(lineNumber))
      return
    }

    if (updateLine.startsWith(CHANGE_CONTEXT_MARKER)) {
      const chunk = newChunk(lineNumber)
      chunk.context = updateLine.slice(CHANGE_CONTEXT_MARKER.length)
      update.chunks.push(chunk)
      return
    }

    if (updateLine === EOF_MARKER) {
      if (previous !== undefined && emptyChunk(previous)) {
        throw new PatchParseError('Update hunk does not contain any lines', lineNumber)
      }
      if (previous !== undefined) previous.isEndOfFile = true
      return
    }

    // A bare empty line is tolerated as empty context; `' '` alone is the
    // spelled form and goes through the context prefix below.
    if (text === '') {
      const chunk = previous ?? newChunk(lineNumber)
      if (previous === undefined) update.chunks.push(chunk)
      chunk.oldLines.push('')
      chunk.newLines.push('')
      chunk.contextLineIndices.push([chunk.oldLines.length - 1, chunk.newLines.length - 1])
      return
    }

    if (text.startsWith(' ')) {
      const chunk = previous ?? newChunk(lineNumber)
      if (previous === undefined) update.chunks.push(chunk)
      chunk.oldLines.push(text.slice(1))
      chunk.newLines.push(text.slice(1))
      chunk.contextLineIndices.push([chunk.oldLines.length - 1, chunk.newLines.length - 1])
      return
    }

    if (text.startsWith('+')) {
      const chunk = previous ?? newChunk(lineNumber)
      if (previous === undefined) update.chunks.push(chunk)
      chunk.newLines.push(text.slice(1))
      return
    }

    if (text.startsWith('-')) {
      const chunk = previous ?? newChunk(lineNumber)
      if (previous === undefined) update.chunks.push(chunk)
      chunk.oldLines.push(text.slice(1))
      return
    }

    if (previous !== undefined && (!emptyChunk(previous))) {
      throw new PatchParseError(`Expected update hunk to start with a @@ context marker, got: '${text}'`, lineNumber)
    }
    throw unexpectedUpdateLine(text)
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as InputLine
    const final = index === lines.length - 1
    // The last line is never terminated by an LF in Codex's stream, so its
    // `finish` step recognizes `*** End Patch` by itself, even inside an update
    // hunk. Mirror that instead of feeding it through the update rules.
    if (final && trimWhitespace(line.text) === END_PATCH_MARKER) {
      ensureUpdateHunkIsNotEmpty(trimWhitespace(line.text), line.number)
      mode = 'ended'
      continue
    }
    processLine(line.text, line.number)
  }

  if (mode !== 'ended') {
    throw new PatchParseError("The last line of the patch must be '*** End Patch'")
  }
  return hunks
}

/**
 * Parse a complete Codex patch.
 *
 * The input is trimmed with Rust whitespace rules, an optional literal heredoc
 * wrapper is removed, and line numbers stay relative to the model's original
 * input so a rejection can name the line the model actually wrote.
 * @param patch - model-supplied patch text.
 * @returns ordered file operations; an envelope with no operations yields `[]`.
 * @throws PatchParseError for malformed syntax or an Environment ID preamble.
 */
export function parsePatch(patch: string): PatchOperation[] {
  const leading = patch.slice(0, patch.length - trimStart(patch).length)
  let lineOffset = countNewlines(leading)
  const candidate = rustLines(trimWhitespace(patch))
  let lines: string[]
  try {
    checkPatchBoundaries(candidate)
    lines = candidate
  } catch (error) {
    const last = candidate.at(-1)
    const wrapped = candidate.length >= 4
      && HEREDOC_STARTERS.has(candidate[0] as string)
      && last !== undefined && last.endsWith('EOF')
    if (!wrapped) throw error
    const inner = candidate.slice(1, -1)
    checkPatchBoundaries(inner)
    lines = inner
    lineOffset += 1
  }
  // Codex joins the trimmed lines with LFs and feeds that stream to a parser
  // that strips one trailing CR per terminated line, so a `\r\r\n` sequence
  // loses both CRs (the first split already removed one). Every line except the
  // unterminated last one can therefore lose one more CR.
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index] as string
    if (line.endsWith('\r')) lines[index] = line.slice(0, -1)
  }
  return scanHunks(lines.map((text, index) => ({ text, number: lineOffset + index + 1 })))
}
