/**
 * Small structural guards shared by the plugins.
 *
 * @module dsh-harness-codex/guards
 */

/** True for non-null objects, whose own properties are safe to read. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The message of a thrown value, for wrapping host failures without losing them. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
