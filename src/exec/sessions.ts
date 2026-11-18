import { randomInt } from 'node:crypto'
import type { ExecProcess } from '../types.js'

/** Codex's per-conversation process cap (`MAX_UNIFIED_EXEC_PROCESSES`). */
const MAX_SESSIONS_PER_OWNER = 64

/** Codex never prunes the most recently used processes (`process_id_to_prune_from_meta`). */
const PROTECTED_RECENT = 8

/** One owned process in the unified exec table. */
export interface ExecSessionEntry {
  owner: string | undefined
  process: ExecProcess
}

/**
 * Unified exec session table. One plugin instance serves every Agent that
 * selects the preset, so ownership is stored with each entry and checked on
 * every `write_stdin` call rather than captured when the plugin loads.
 *
 * A finished process stays in the table until a poll observes its exit, which
 * is how Codex lets `write_stdin` collect the final output even when the
 * process finished between two calls. Codex allocates random ids in
 * `1000..99999` (`UnifiedExecProcessManager::allocate_process_id`); we do the
 * same and retry on collision.
 *
 * Map insertion order doubles as least-recently-used order: `get` moves an
 * entry to the end, so pruning can walk from the front.
 */
export class ExecSessions {
  #sessions = new Map<number, ExecSessionEntry>()

  /**
   * Store a live process under a fresh numeric id, first pruning one of the
   * owner's sessions if it already holds Codex's maximum.
   * @param owner - Agent identity that started it, or undefined for agentless calls.
   * @param process - plugin process wrapper (pipe or terminal).
   * @returns the session id to expose to the model.
   */
  add(owner: string | undefined, process: ExecProcess): number {
    this.#prune(owner)
    let id: number
    do {
      id = randomInt(1_000, 100_000)
    } while (this.#sessions.has(id))
    this.#sessions.set(id, { owner, process })
    return id
  }

  /**
   * Resolve a session for its owner. Unknown and finished-before-polled ids are
   * one error (the process is gone either way); a different owner is a distinct
   * error so an Agent cannot drive another Agent's terminal.
   * @param id - numeric session id from `write_stdin`.
   * @param owner - calling Agent identity.
   * @returns the stored entry.
   */
  get(id: number, owner: string | undefined): ExecSessionEntry {
    const entry = this.#sessions.get(id)
    if (entry === undefined) throw new Error(`Unknown process id ${id}`)
    if (entry.owner !== owner) throw new Error(`session ${id} belongs to a different agent`)
    this.#sessions.delete(id)
    this.#sessions.set(id, entry)
    return entry
  }

  /** Drop a session after its final output has been returned. */
  remove(id: number): void {
    this.#sessions.delete(id)
  }

  /** Terminate every live process when the plugin unloads. */
  dispose(): void {
    for (const entry of this.#sessions.values()) entry.process.kill()
    this.#sessions.clear()
  }

  /** Terminate every process one owner started, when that owner is disposed. */
  disposeOwner(owner: string): void {
    for (const [id, entry] of this.#sessions) {
      if (entry.owner !== owner) continue
      entry.process.kill()
      this.#sessions.delete(id)
    }
  }

  /**
   * Make room for one more session, following Codex: skip the most recently
   * used few, then evict the oldest exited process, else the oldest live one.
   */
  #prune(owner: string | undefined): void {
    const ids = [...this.#sessions].filter(([, entry]) => entry.owner === owner).map(([id]) => id)
    if (ids.length < MAX_SESSIONS_PER_OWNER) return
    const candidates = ids.slice(0, -PROTECTED_RECENT)
    const victim = candidates.find(id => !this.#sessions.get(id)!.process.running()) ?? candidates[0]
    this.#sessions.get(victim)!.process.kill()
    this.#sessions.delete(victim)
  }
}
