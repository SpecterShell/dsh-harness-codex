/**
 * Codex-style local compaction for the codex-inspired preset.
 *
 * Codex does not keep a recent stretch of the conversation. It sends the
 * current history plus a compaction prompt, then replaces the history with the
 * newest original user messages that fit in 20,000 tokens, in chronological
 * order, followed by one user-role summary. This engine provides the same
 * `ctx.compaction` service as `@deepseek-ai/dsh-compaction-basic`, but builds
 * that shape from DSH's public session surface:
 *
 * - every kept user message is a `user/message` copy replacing the span that
 *   ends at the original message, so the surviving order matches Codex;
 * - each replacement is preceded by the compaction seam's shadow-price event,
 *   so the token meter prices it exactly;
 * - the summary is the last node and carries `compactCheckpointSource`, the
 *   same marker every DSH backend uses;
 * - `compaction/start` / `compaction/end` bracket the transaction, and a failed
 *   or cancelled summary leaves the previous surface untouched.
 *
 * The compaction prompt and summary prefix are copied byte for byte from
 * Codex; see ../../NOTICE.
 *
 * @module dsh-harness-codex/compaction
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { approxTokenCount, collectKeptUserMessages, KEPT_USER_MESSAGE_MAX_TOKENS, messageText } from './history.ts'
import type {
  CompactionAgent,
  CompactionBlock,
  CompactionContext,
  CompactionErrorCode,
  CompactionMessage,
  CompactionResult,
  CompactionSession,
  CompactionTrigger,
  ManualCompactionAgent,
  PreStepListener,
  RequestMessage,
  SummaryRequest,
  TokenMeasurement,
} from './types.js'

/** Diagnostic plugin name. */
export const name = 'compaction-codex'

/** The services the engine reads. */
export const inject = ['llm', 'tokenMeter', 'sessions']

/** Codex's local compaction prompt (`prompts/templates/compact/prompt.md`). */
export const COMPACT_PROMPT = readFileSync(new URL('../../prompts/codex/compact-prompt.md', import.meta.url), 'utf8')

/** Codex's summary prefix (`prompts/templates/compact/summary_prefix.md`). */
export const SUMMARY_PREFIX = readFileSync(new URL('../../prompts/codex/compact-summary-prefix.md', import.meta.url), 'utf8')

/** Codex's default auto-compaction trigger is 90% of the model context window. */
const AUTO_COMPACT_RATIO = 0.9

const SUMMARY_START = 'compaction/start'
const SUMMARY_EVENT = 'compaction/summary'
const SUMMARY_END = 'compaction/end'
const PRUNE_EVENT = 'compaction/prune'

const BUSY_MESSAGE = 'Compaction is unavailable because this process has an active compaction, or the agent is not idle.'
const CANCELLED_MESSAGE = 'Compaction cancelled.'
const CHANGED_MESSAGE = 'The history selected for compaction changed before it could be replaced. The attempt is recorded in the session log.'
const SUMMARY_MESSAGE = 'Compaction could not produce a useful summary. The attempt is recorded in the session log.'
const COMMIT_MESSAGE = 'Compaction did not finish cleanly; some session history may have changed. Inspect the current session state before retrying.'
const PERSISTENCE_MESSAGE = 'Compaction finished, but the session could not be saved.'

/** Expected compaction failure with a stable class for the caller. */
export class CompactionFailure extends Error {
  readonly code: CompactionErrorCode

  readonly name = 'ManualCompactionError'

  constructor(code: CompactionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
  }
}

/** One routed provider/model the summarizer uses. */
interface Target {
  readonly provider: string
  readonly model: string
}

/** Options common to automatic and manual compaction. */
interface CommitOptions {
  /** Open turn that owns the bracket, or null for a standalone manual run. */
  readonly owner: number | null
  readonly sourceCommandId?: string
  readonly flush?: boolean
  readonly measurement?: TokenMeasurement
  /** Refuse the transaction when the summary would not shrink the surface. */
  readonly shrinkCheck?: boolean
}

/** The public engine face mounted as `ctx.compaction`. */
interface Engine {
  compactIfNeeded(agent: CompactionAgent, trigger: CompactionTrigger, signal: AbortSignal): Promise<CompactionResult | null>
  compactNow(agent: ManualCompactionAgent, signal: AbortSignal, sourceCommandId?: string): Promise<CompactionResult | null>
  compactRegion(start: number, end: number, agent: CompactionAgent, signal?: AbortSignal): Promise<CompactionResult>
}

/** Report a failure message without leaking a non-Error throw. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The signal's abort reason, or a plain cancellation error. */
function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error(CANCELLED_MESSAGE)
}

/** The routed target from the latest header, falling back to Agent options. */
function routedTarget(agent: CompactionAgent): Target | undefined {
  const config = agent.session.requestHeader()?.config
  if (config !== undefined && config.provider.length > 0 && config.model.length > 0) {
    return { provider: config.provider, model: config.model }
  }
  const provider = agent.options.provider
  const model = agent.options.model
  if (provider !== undefined && provider.length > 0 && model !== undefined && model.length > 0) {
    return { provider, model }
  }
  return undefined
}

/** The open turn number, or null when the log currently sits between turns. */
function openTurn(session: CompactionSession): number | null {
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const event = session.eventAt(seq)
    if (event?.type === 'turn/start') return Number(event.data.turn)
    if (event?.type === 'turn/end') return null
  }
  return null
}

/** Reject a new transaction while a durable start marker has no close. */
function assertCompactionInactive(session: CompactionSession): void {
  let latestSeed = -1
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const event = session.eventAt(seq)
    if (event === undefined) continue
    if (event.type === 'session/end-seed') {
      latestSeed = Math.max(latestSeed, seq)
      continue
    }
    if (event.type === SUMMARY_START) {
      if (latestSeed > seq) return
      throw new CompactionFailure('busy', BUSY_MESSAGE)
    }
    if (event.type === SUMMARY_END) return
  }
}

/** The first node after the leading system/developer context. */
function firstCompactableIndex(session: CompactionSession): number {
  const nodes = session.surface.nodes
  let index = 0
  while (index < nodes.length) {
    const event = session.eventAt(nodes[index]!)
    if (event?.type !== 'system/message' && event?.type !== 'developer/message') break
    index += 1
  }
  return index
}

/** Whether the cut after each node is balanced; index i means "before node i". */
function balancedCuts(session: CompactionSession): boolean[] {
  const cuts = [true]
  let open = 0
  for (const seq of session.surface.nodes) {
    const event = session.eventAt(seq)
    if (event?.type === 'assistant/message') {
      const message = event.data.message as { content?: readonly CompactionBlock[] } | undefined
      open += message?.content?.filter(block => block.type === 'tool-call').length ?? 0
    } else if (event?.type === 'tool/result') {
      open -= 1
    }
    cuts.push(open === 0)
  }
  return cuts
}

/** True when two surface snapshots contain the same nodes in the same order. */
function sameSurface(session: CompactionSession, nodes: readonly number[]): boolean {
  const current = session.surface.nodes
  if (current.length !== nodes.length) return false
  return nodes.every((seq, index) => current[index] === seq)
}

/** True when the priced surface still matches the snapshot the summary used. */
function sameMeasurement(left: TokenMeasurement, right: TokenMeasurement): boolean {
  if (left.nodes.length !== right.nodes.length) return false
  return left.nodes.every((node, index) => {
    const other = right.nodes[index]
    return other !== undefined && node.seq === other.seq && node.heuristicTokens === other.heuristicTokens
  })
}

/** Total heuristic price of a set of surface nodes. */
function priceOf(measurement: TokenMeasurement, seqs: readonly number[]): number {
  const prices = new Map(measurement.nodes.map(node => [node.seq, node.heuristicTokens]))
  return seqs.reduce((total, seq) => total + (prices.get(seq) ?? 0), 0)
}

/** The `shadowedRange` boundary for a non-empty surface span. */
function rangeOf(seqs: readonly number[]): { start: number; end: number } {
  return { start: seqs[0]!, end: seqs[seqs.length - 1]! }
}

/** One replacement user message for a kept original user message. */
function copyOf(message: CompactionMessage, content: readonly CompactionBlock[]): CompactionMessage {
  return { ...message, id: randomUUID(), content }
}

/** The checkpoint source shared with every DSH compaction backend. */
function checkpointSource(compactionId: string, sourceCommandId?: string): Record<string, unknown> {
  return {
    kind: 'compact-checkpoint',
    compactionId,
    ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
  }
}

/**
 * Run the one-shot summarization call. The conversation's own messages and
 * tool schemas are replayed first and the compaction prompt is the final user
 * message, so a provider with a warm prefix cache can reuse it. Only text is
 * accepted; an error, abort, or token-cap finish fails the transaction.
 */
async function summarize(
  ctx: CompactionContext,
  request: SummaryRequest,
): Promise<{ text: string; usage?: Record<string, number> }> {
  const deltas = new Map<number, string>()
  const blocks = new Map<number, string>()
  let usage: Record<string, number> | undefined
  let finish: { kind: string; failure?: { message?: string } } | undefined
  for await (const chunk of ctx.llm.stream(request)) {
    switch (chunk.type) {
      case 'text-delta':
        deltas.set(chunk.index, (deltas.get(chunk.index) ?? '') + chunk.text)
        break
      case 'block-end':
        if (chunk.block.type === 'text') blocks.set(chunk.index, chunk.block.text ?? '')
        break
      case 'usage':
        usage = chunk.usage
        break
      case 'finish':
        finish = chunk.reason
        break
      default:
        break
    }
  }
  if (request.signal.aborted) throw abortReason(request.signal)
  if (finish?.kind === 'error' || finish?.kind === 'aborted') {
    throw new Error(finish.failure?.message ?? SUMMARY_MESSAGE)
  }
  if (finish?.kind === 'max-tokens') throw new Error('summarization truncated at the token cap (incomplete summary)')
  const indexes = [...new Set([...deltas.keys(), ...blocks.keys()])].sort((left, right) => left - right)
  const parts = indexes
    .map(index => blocks.get(index) ?? deltas.get(index) ?? '')
    .filter(text => text.length > 0)
  const text = parts.join('\n')
  if (text.trim().length === 0) throw new Error('summarization produced no text summary content')
  return { text, ...(usage === undefined ? {} : { usage }) }
}

/** Create the engine over one plugin context. */
function createEngine(ctx: CompactionContext): Engine {
  // Last measured surface size at which automatic compaction failed to shrink;
  // skip further attempts until new content arrives, so a small-window session
  // does not pay for a summary call at every step.
  let declinedTokens: number | undefined

  async function commit(
    agent: CompactionAgent,
    signal: AbortSignal,
    target: Target,
    startIndex: number,
    endIndex: number,
    options: CommitOptions,
  ): Promise<CompactionResult> {
    const session = agent.session
    assertCompactionInactive(session)
    const nodes = [...session.surface.nodes]
    const range = nodes.slice(startIndex, endIndex + 1)
    if (range.length === 0) throw new CompactionFailure('summary', SUMMARY_MESSAGE)

    const measurement = options.measurement ?? ctx.tokenMeter.measure(session, session.requestHeader())
    const compactionId = randomUUID()
    const startData = {
      compactionId,
      turn: options.owner,
      ...(options.sourceCommandId === undefined ? {} : { sourceCommandId: options.sourceCommandId }),
    }
    const startEvent = session.append(SUMMARY_START, startData)
    let replacing = false
    let closed = false

    try {
      const header = session.requestHeader()
      const prompt: RequestMessage = {
        role: 'user',
        content: [{ type: 'text', text: COMPACT_PROMPT }],
      }
      const request: SummaryRequest = {
        provider: target.provider,
        model: target.model,
        messages: [...session.deriveMessages(), prompt],
        ...(header?.tools === undefined ? {} : { tools: header.tools }),
        toolHistory: session.toolHistory(),
        sessionId: session.id,
        purpose: 'compaction',
        signal,
      }
      const summarized = await summarize(ctx, request)
      signal.throwIfAborted()
      if (!sameSurface(session, nodes)
        || !sameMeasurement(measurement, ctx.tokenMeter.measure(session, session.requestHeader()))) {
        throw new CompactionFailure('changed', CHANGED_MESSAGE)
      }

      const kept = collectKeptUserMessages(session, startIndex, endIndex, SUMMARY_PREFIX, KEPT_USER_MESSAGE_MAX_TOKENS)
      const summaryText = `${SUMMARY_PREFIX}\n${summarized.text}`

      // Codex assumes the replacement is smaller than what it removes. On a
      // small context window it need not be, and recompacting a non-shrinking
      // surface would rewrite history on every step, so the automatic path
      // refuses it. Manual compaction proceeds regardless, as Codex does.
      const summaryTokens = approxTokenCount(summaryText)
      const keptTokens = kept.reduce((total, item) => total + approxTokenCount(messageText(item.content)), 0)
      const droppedTokens = priceOf(measurement, range) - keptTokens
      if (options.shrinkCheck === true && summaryTokens >= droppedTokens) {
        throw new CompactionFailure(
          'no-shrink',
          'Compaction would not shrink the context; the attempt is recorded in the session log.',
        )
      }

      const summaryBlocks: CompactionBlock[] = [{ type: 'text', text: summaryText }]
      const summaryMessage: CompactionMessage = {
        id: randomUUID(),
        role: 'user',
        content: summaryBlocks,
        source: checkpointSource(compactionId, options.sourceCommandId),
      }

      replacing = true
      let cursor = startIndex
      for (const item of kept) {
        const keptSeq = nodes[item.index]!
        const current = session.surface.nodes
        const endPosition = current.indexOf(keptSeq)
        if (endPosition < cursor) throw new CompactionFailure('changed', CHANGED_MESSAGE)
        const seqs = current.slice(cursor, endPosition + 1)
        const message = copyOf(item.message, item.content)
        const prune = session.append(PRUNE_EVENT, {
          shadowedRange: rangeOf(seqs),
          shadowedSeqs: seqs,
          shadowedTokenCount: priceOf(measurement, seqs),
        })
        session.append('user/message', message, {
          surfaceOp: { op: 'replace', startSeq: seqs[0]!, endSeq: seqs[seqs.length - 1]! },
          sourceEventSeqs: [prune.seq, ...seqs],
        })
        cursor += 1
      }

      const tailStart = session.surface.nodes.indexOf(nodes[endIndex]!)
      const tailSeqs = tailStart >= cursor ? session.surface.nodes.slice(cursor, tailStart + 1) : []
      const event = session.append(SUMMARY_EVENT, {
        compactionId,
        ...(options.sourceCommandId === undefined ? {} : { sourceCommandId: options.sourceCommandId }),
        summary: summaryBlocks,
        rawOutput: [{ type: 'text', text: summarized.text }],
        llmStreamCall: true,
        shadowedRange: tailSeqs.length > 0 ? rangeOf(tailSeqs) : rangeOf([nodes[endIndex]!]),
        shadowedSeqs: tailSeqs,
        shadowedTokenCount: priceOf(measurement, tailSeqs),
        provider: target.provider,
        model: target.model,
        ...(summarized.usage === undefined ? {} : { usage: summarized.usage }),
      })
      if (tailSeqs.length > 0) {
        session.append('user/message', summaryMessage, {
          surfaceOp: { op: 'replace', startSeq: tailSeqs[0]!, endSeq: tailSeqs[tailSeqs.length - 1]! },
          sourceEventSeqs: [event.seq, ...tailSeqs],
        })
      } else {
        session.append('user/message', summaryMessage, {
          surfaceOp: 'append',
          sourceEventSeqs: [event.seq],
        })
      }

      const endEvent = session.append(SUMMARY_END, {
        compactionId,
        ...(options.sourceCommandId === undefined ? {} : { sourceCommandId: options.sourceCommandId }),
        turn: options.owner,
      })
      closed = true
      if (options.flush === true) {
        try {
          await ctx.sessions.flush(session)
        } catch (error) {
          throw new CompactionFailure('persistence', PERSISTENCE_MESSAGE, { cause: error })
        }
      }
      return {
        compactionId,
        ...(options.sourceCommandId === undefined ? {} : { sourceCommandId: options.sourceCommandId }),
        startSeq: startEvent.seq,
        summarySeq: event.seq,
        endSeq: endEvent.seq,
        summary: summaryBlocks,
        shadowedRange: rangeOf(range),
        shadowedSeqs: range,
        shadowedTokenCount: priceOf(measurement, range),
      }
    } catch (error) {
      if (!closed) {
        try {
          session.append(SUMMARY_END, { ...startData, error: messageOf(error) })
        } catch {
          // A close failure must not hide the original compaction failure.
        }
      }
      if (error instanceof CompactionFailure) throw error
      throw new CompactionFailure(replacing ? 'commit' : 'summary', replacing ? COMMIT_MESSAGE : SUMMARY_MESSAGE, { cause: error })
    }
  }

  async function compactIfNeeded(
    agent: CompactionAgent,
    trigger: CompactionTrigger,
    signal: AbortSignal,
  ): Promise<CompactionResult | null> {
    signal.throwIfAborted()
    const target = routedTarget(agent)
    if (target === undefined) return null
    const header = agent.session.requestHeader()
    const measurement = ctx.tokenMeter.measure(agent.session, header)
    let underPressure = trigger === 'context-overflow'
    if (!underPressure) {
      const info = await ctx.llm.resolveModelInfo(target.provider, target.model, signal)
      const contextWindow = info.context?.contextWindow
      if (contextWindow === undefined || contextWindow <= 0) return null
      underPressure = measurement.totalTokens >= Math.floor(contextWindow * AUTO_COMPACT_RATIO)
    }
    if (!underPressure) return null
    const session = agent.session
    if (declinedTokens !== undefined && measurement.totalTokens <= declinedTokens) return null
    const startIndex = firstCompactableIndex(session)
    const endIndex = session.surface.nodes.length - 1
    if (startIndex > endIndex) return null
    const cuts = balancedCuts(session)
    if (cuts[startIndex] !== true || cuts[endIndex + 1] !== true) return null
    try {
      const result = await commit(agent, signal, target, startIndex, endIndex, {
        owner: openTurn(session),
        measurement,
        shrinkCheck: true,
      })
      declinedTokens = undefined
      return result
    } catch (error) {
      if (error instanceof CompactionFailure && error.code === 'no-shrink') {
        declinedTokens = measurement.totalTokens
        return null
      }
      throw error
    }
  }

  function compactNow(
    agent: ManualCompactionAgent,
    signal: AbortSignal,
    sourceCommandId?: string,
  ): Promise<CompactionResult | null> {
    signal.throwIfAborted()
    try {
      return agent.runMaintenance(async agentSignal => {
        const operationSignal = AbortSignal.any([agentSignal, signal])
        try {
          operationSignal.throwIfAborted()
          const target = routedTarget(agent)
          if (target === undefined) throw new CompactionFailure('summary', SUMMARY_MESSAGE)
          const session = agent.session
          assertCompactionInactive(session)
          const startIndex = firstCompactableIndex(session)
          const endIndex = session.surface.nodes.length - 1
          if (startIndex > endIndex) return null
          const cuts = balancedCuts(session)
          if (cuts[startIndex] !== true || cuts[endIndex + 1] !== true) return null
          return await commit(agent, operationSignal, target, startIndex, endIndex, {
            owner: null,
            sourceCommandId,
            flush: true,
          })
        } catch (error) {
          if (agentSignal.aborted && operationSignal.reason === agentSignal.reason) {
            throw new CompactionFailure('cancelled', CANCELLED_MESSAGE, { cause: error })
          }
          operationSignal.throwIfAborted()
          throw error
        }
      })
    } catch (error) {
      throw new CompactionFailure('busy', BUSY_MESSAGE, { cause: error })
    }
  }

  async function compactRegion(
    start: number,
    end: number,
    agent: CompactionAgent,
    signal?: AbortSignal,
  ): Promise<CompactionResult> {
    const session = agent.session
    const nodes = session.surface.nodes
    const startIndex = nodes.indexOf(start)
    const endIndex = nodes.indexOf(end)
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
      throw new CompactionFailure('changed', CHANGED_MESSAGE)
    }
    const cuts = balancedCuts(session)
    if (cuts[startIndex] !== true || cuts[endIndex + 1] !== true) {
      throw new CompactionFailure('changed', CHANGED_MESSAGE)
    }
    const target = routedTarget(agent)
    if (target === undefined) throw new CompactionFailure('summary', SUMMARY_MESSAGE)
    const operationSignal = signal ?? new AbortController().signal
    return commit(agent, operationSignal, target, startIndex, endIndex, {
      owner: openTurn(session),
    })
  }

  return { compactIfNeeded, compactNow, compactRegion }
}

/**
 * Mount the Codex compaction engine and its automatic pressure listener.
 * @param ctx - the isolated compaction group context.
 */
export function apply(ctx: CompactionContext): void {
  const engine = createEngine(ctx)
  ctx.provide('compaction', engine)
  const listener: PreStepListener = async (payload, next) => {
    if (!payload.signal.aborted) {
      try {
        await engine.compactIfNeeded(payload.agent, 'pressure', payload.signal)
      } catch (error) {
        ctx.logger.warn(`step compaction failed: ${messageOf(error)}; continuing the turn`)
      }
    }
    return next()
  }
  ctx.on('agent/pre-step', listener)
}
