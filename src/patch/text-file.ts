/**
 * Line-ending-preserving source file model.
 *
 * Codex stores every source line together with its own line ending instead of
 * normalizing the file. That lets an edit leave untouched lines byte-identical,
 * give inserted lines the file's first ending style, and treat a lone CR as a
 * real line ending. A BOM survives because it is just text on the first line;
 * nothing strips it.
 * @module @spectershell/dsh-harness-codex/patch/text-file
 */

/** One of the three line terminators Codex recognizes. */
export type LineEnding = '\n' | '\r\n' | '\r'

/** One source line and the terminator that followed it, if any. */
interface SourceLine {
  text: string
  ending: LineEnding | undefined
}

/** Replace `oldLength` source lines starting at `start` with `lines`. */
export interface Replacement {
  start: number
  oldLength: number
  lines: string[]
}

/** A parsed file whose unchanged lines keep their original spelling and endings. */
export class SourceFile {
  private lines: SourceLine[]
  private readonly preferredEnding: LineEnding

  /**
   * @param lines - parsed source lines.
   * @param preferredEnding - ending assigned to inserted lines and to a final line that had none.
   */
  constructor(lines: SourceLine[], preferredEnding: LineEnding) {
    this.lines = lines
    this.preferredEnding = preferredEnding
  }

  /**
   * Split file contents into lines while retaining each line's terminator.
   *
   * The first terminator encountered becomes the preferred style for inserted
   * lines; a file with no terminator defaults to LF. An unterminated final line
   * is kept as a line with no ending so a later insertion can give it one.
   * @param contents - decoded UTF-8 file contents, including any BOM.
   * @returns the parsed source file.
   */
  static parse(contents: string): SourceFile {
    const lines: SourceLine[] = []
    let preferred: LineEnding | undefined
    let lineStart = 0
    let cursor = 0
    while (cursor < contents.length) {
      const character = contents[cursor]
      let ending: LineEnding | undefined
      let width = 0
      if (character === '\r') {
        if (contents[cursor + 1] === '\n') {
          ending = '\r\n'
          width = 2
        } else {
          ending = '\r'
          width = 1
        }
      } else if (character === '\n') {
        ending = '\n'
        width = 1
      }
      if (ending === undefined) {
        cursor += 1
        continue
      }
      preferred ??= ending
      lines.push({ text: contents.slice(lineStart, cursor), ending })
      cursor += width
      lineStart = cursor
    }
    if (lineStart < contents.length) lines.push({ text: contents.slice(lineStart), ending: undefined })
    return new SourceFile(lines, preferred ?? '\n')
  }

  /**
   * The source lines without their terminators, as the matcher sees them.
   * @returns a copy in file order.
   */
  lineTexts(): string[] {
    return this.lines.map(line => line.text)
  }

  /**
   * Rebuild the file from sorted, non-overlapping replacements.
   *
   * Unchanged source lines are copied verbatim (an unchanged context line
   * keeps its whitespace and terminator). Replacement lines take the preferred
   * ending, and every remaining line receives an ending if it lacked one, which
   * reproduces Codex's historical trailing-newline behavior.
   * @param replacements - replacements sorted by ascending start index.
   */
  applyReplacements(replacements: readonly Replacement[]): void {
    const rebuilt: SourceLine[] = []
    let sourceIndex = 0
    for (const replacement of replacements) {
      while (sourceIndex < replacement.start) {
        rebuilt.push(this.lines[sourceIndex] as SourceLine)
        sourceIndex += 1
      }
      sourceIndex += replacement.oldLength
      for (const text of replacement.lines) rebuilt.push({ text, ending: this.preferredEnding })
    }
    while (sourceIndex < this.lines.length) {
      rebuilt.push(this.lines[sourceIndex] as SourceLine)
      sourceIndex += 1
    }
    for (const line of rebuilt) {
      if (line.ending === undefined) line.ending = this.preferredEnding
    }
    this.lines = rebuilt
  }

  /**
   * Serialize the file back to text.
   * @returns the rebuilt contents with each line's own ending.
   */
  contents(): string {
    let result = ''
    for (const line of this.lines) {
      result += line.text
      if (line.ending !== undefined) result += line.ending
    }
    return result
  }
}
