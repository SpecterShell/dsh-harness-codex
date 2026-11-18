/**
 * Codex's sequential line matcher.
 *
 * A patch hunk names source lines the model remembered, which are often close
 * to but not byte-identical with what is on disk (trailing spaces, indentation,
 * typographic punctuation). Upstream tries four progressively looser passes,
 * each over the whole remaining file, and returns the first match. Porting the
 * pass order matters: the strictest match wins even when a later line would
 * match more loosely, and the search starts at the running cursor rather than
 * at the beginning of the file.
 * @module @spectershell/dsh-harness-codex/patch/seek-sequence
 */
import { trimEnd, trimWhitespace } from './parser.ts'

/**
 * Map typographic punctuation to ASCII for the loosest pass, after trimming.
 * @param value - one source or pattern line.
 * @returns the line with Codex's punctuation substitutions applied.
 */
function normalizePunctuation(value: string): string {
  return trimWhitespace(value)
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .replace(/[\u2018-\u201B]/gu, "'")
    .replace(/[\u201C-\u201F]/gu, '"')
    .replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/gu, ' ')
}

/** The four matching passes in Codex's order. */
const PASSES: ReadonlyArray<(line: string) => string> = [
  line => line,
  line => trimEnd(line),
  line => trimWhitespace(line),
  normalizePunctuation,
]

/**
 * Find a pattern of source lines at or after `start`.
 *
 * An empty pattern is a no-op match at `start`. An `eof` hunk may match only at
 * the single tail candidate `max(start, lineCount - pattern.length)`; upstream
 * does not fall back to earlier candidates, so a pattern that appears earlier
 * but not at the end is rejected.
 * @param lines - current source lines, without line endings.
 * @param pattern - hunk old lines to locate.
 * @param start - running zero-based cursor.
 * @param eof - whether the hunk carries `*** End of File`.
 * @returns the zero-based start index of the first match, or undefined.
 */
export function seekSequence(
  lines: readonly string[],
  pattern: readonly string[],
  start: number,
  eof: boolean,
): number | undefined {
  if (pattern.length === 0) return start
  if (pattern.length > lines.length) return undefined
  const last = lines.length - pattern.length
  const first = eof ? Math.max(start, last) : start
  for (const normalize of PASSES) {
    for (let index = first; index <= last; index += 1) {
      let matched = true
      for (let offset = 0; offset < pattern.length; offset += 1) {
        const expected = pattern[offset] as string
        const actual = lines[index + offset] as string
        if (normalize(actual) !== normalize(expected)) {
          matched = false
          break
        }
      }
      if (matched) return index
    }
  }
  return undefined
}
