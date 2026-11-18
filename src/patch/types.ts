/**
 * Parsed patch shapes and match-failure records for the Codex apply_patch port.
 *
 * These are local to the module: they describe syntax only, never a filesystem
 * target, so parsing stays pure and the executor owns path resolution.
 * @module @spectershell/dsh-harness-codex/patch/types
 */

/** One contiguous update block: an optional `@@` anchor plus its changed span. */
export interface PatchChunk {
  /** One-based patch line where this block starts, as the model wrote it. */
  lineNumber: number
  /** Text after `@@ `, used only as a search anchor. */
  context?: string
  /** Context and removed lines, prefixes and line endings stripped. */
  oldLines: string[]
  /** Context and added lines, prefixes and line endings stripped. */
  newLines: string[]
  /**
   * `[old, new]` index pairs for lines parsed as context. The applier keeps
   * those source lines in place, so an unchanged line keeps its exact spelling
   * and line ending instead of taking the patch's spelling.
   */
  contextLineIndices: Array<[number, number]>
  /** Whether the next marker is `*** End of File`. */
  isEndOfFile: boolean
}

/** One file operation in patch order; a move is an update with a destination. */
export type PatchOperation =
  | {
    kind: 'add'
    path: string
    /** One-based patch line of the `*** Add File:` marker. */
    lineNumber: number
    /** Added lines joined with LF, one LF per line, as Codex does. */
    content: string
  }
  | { kind: 'delete'; path: string; lineNumber: number }
  | {
    kind: 'update'
    path: string
    lineNumber: number
    moveTo?: string
    chunks: PatchChunk[]
  }

/**
 * Syntax rejection. The message keeps Codex's `ParseError` display wording so a
 * model that knows the upstream tool reads the same sentence.
 */
export class PatchParseError extends Error {
  /** One-based patch line for a hunk error; undefined for a whole-patch error. */
  readonly lineNumber: number | undefined

  /**
   * @param message - Codex's own explanation, without the display wrapper.
   * @param lineNumber - hunk line, omitted for errors that concern the patch envelope.
   */
  constructor(message: string, lineNumber?: number) {
    super(lineNumber === undefined ? `invalid patch: ${message}` : `invalid hunk at line ${lineNumber}, ${message}`)
    this.name = 'PatchParseError'
    this.lineNumber = lineNumber
  }
}

/** The first hunk whose anchor or old lines could not be located. */
export interface PatchMatchFailure {
  /** Model-facing Codex diagnostic, including the path where relevant. */
  message: string
  /** One-based patch line of the hunk that failed. */
  lineNumber: number
}
