/**
 * Local structural types for the compaction seam and the host services this
 * engine calls. DSH host packages are deliberately not dependencies (see
 * src/types.ts), so these declarations repeat only the members compaction
 * needs and let a host upgrade fail at the boundary.
 *
 * @module @spectershell/dsh-harness-codex/compaction/types
 */
import type { BaseContext } from '../types.js'

/** One text or media content block as the surface exposes it. */
export interface CompactionBlock {
  readonly type: string
  readonly text?: string
  readonly [key: string]: unknown
}

/** One model-visible message projected from a surface event. */
export interface CompactionMessage {
  readonly id: string
  readonly role: 'system' | 'developer' | 'user' | 'assistant' | 'tool'
  readonly content: readonly CompactionBlock[]
  readonly source?: { readonly kind?: string; readonly [key: string]: unknown }
  readonly [key: string]: unknown
}

/** One event from the append-only session log, narrowed to what is read here. */
export interface CompactionEvent {
  readonly type: string
  readonly seq: number
  readonly data: Record<string, unknown>
}

/** The session members compaction reads and writes. */
export interface CompactionSession {
  readonly id: unknown
  readonly seq: number
  readonly surface: {
    readonly nodes: readonly number[]
    readonly replaceGeneration: number
  }
  append<Data = { compactionId: string }>(
    type: string,
    data: unknown,
    ...opts: readonly unknown[]
  ): { readonly seq: number; readonly data: Data }
  eventAt(seq: number): CompactionEvent | undefined
  deriveMessages(): CompactionMessage[]
  deriveEventMessage(event: CompactionEvent): CompactionMessage | null
  requestHeader(): CompactionRequestHeader | undefined
  toolHistory(): unknown
}

/** The folded request header fields the summarizer reuses. */
export interface CompactionRequestHeader {
  readonly config: {
    readonly provider: string
    readonly model: string
    readonly maxTokens?: number
    readonly [key: string]: unknown
  }
  readonly tools?: readonly unknown[]
  readonly [key: string]: unknown
}

/** The agent facts automatic and manual compaction use. */
export interface CompactionAgent {
  readonly session: CompactionSession
  readonly options: {
    readonly provider?: string
    readonly model?: string
  }
}

/** The idle-agent capability manual compaction serializes through. */
export interface ManualCompactionAgent extends CompactionAgent {
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>
}

/** Why the policy is asking the engine to compact. */
export type CompactionTrigger = 'pressure' | 'context-overflow'

/** Stable failure classes expected from a manual compaction request. */
export type CompactionErrorCode = 'busy' | 'cancelled' | 'changed' | 'no-shrink' | 'summary' | 'commit' | 'persistence'

/** One successful compaction transaction, aggregate over every replacement. */
export interface CompactionResult {
  readonly compactionId: string
  readonly sourceCommandId?: string
  readonly startSeq: number
  readonly summarySeq: number
  readonly endSeq: number
  readonly summary: readonly CompactionBlock[]
  readonly shadowedRange: { readonly start: number; readonly end: number }
  readonly shadowedSeqs: readonly number[]
  readonly shadowedTokenCount: number
}

/** One priced surface node from the token meter. */
export interface TokenSurfaceNode {
  readonly seq: number
  readonly tokens: number
  readonly heuristicTokens: number
}

/** One token-meter snapshot. */
export interface TokenMeasurement {
  readonly totalTokens: number
  readonly surfaceTokens: number
  readonly nodes: readonly TokenSurfaceNode[]
}

/** The token-meter members compaction prices with. */
export interface TokenMeterService {
  measure(session: CompactionSession, header?: CompactionRequestHeader): TokenMeasurement
  estimateMessage(message: CompactionMessage): number
}

/** Provider/model capacity resolved for the summarization target. */
export interface ResolvedModelInfo {
  readonly context?: { readonly contextWindow: number }
  readonly defaultMaxTokens?: number
}

/** One raw chunk from `ctx.llm.stream()`. */
export type LlmStreamChunk =
  | { readonly type: 'block-start'; readonly index: number; readonly blockType: string }
  | { readonly type: 'text-delta'; readonly index: number; readonly text: string }
  | { readonly type: 'reasoning-delta'; readonly index: number; readonly text: string }
  | { readonly type: 'tool-call-delta'; readonly index: number; readonly argumentsDelta: string }
  | { readonly type: 'block-end'; readonly index: number; readonly block: CompactionBlock }
  | { readonly type: 'usage'; readonly usage: Record<string, number> }
  | { readonly type: 'finish'; readonly reason: { readonly kind: string; readonly failure?: { readonly message?: string } } }

/** One message sent in a one-shot request; the prompt has no durable identity. */
export interface RequestMessage {
  readonly role: CompactionMessage['role']
  readonly content: readonly CompactionBlock[]
  readonly source?: { readonly kind?: string; readonly [key: string]: unknown }
}

/** One one-shot summarization request. */
export interface SummaryRequest {
  readonly provider: string
  readonly model: string
  readonly messages: readonly RequestMessage[]
  readonly tools?: readonly unknown[]
  readonly toolHistory?: unknown
  readonly sessionId?: unknown
  readonly purpose: 'compaction'
  readonly signal: AbortSignal
}

/** The LLM members the summarizer calls. */
export interface LlmService {
  stream(options: SummaryRequest): AsyncIterable<LlmStreamChunk>
  resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<ResolvedModelInfo>
}

/** The session store member manual compaction flushes through. */
export interface SessionsService {
  flush(session: CompactionSession): Promise<boolean>
}

/** A pre-step decision as this row passes it through untouched. */
export interface StepDecision {
  readonly kind: 'reject' | 'enter'
  readonly messages: readonly unknown[]
  readonly [key: string]: unknown
}

/** The `agent/pre-step` payload fields compaction reads. */
export interface PreStepPayload {
  readonly agent: CompactionAgent
  readonly signal: AbortSignal
}

/** Waterfall listener that compacts before the next step starts. */
export type PreStepListener = (
  payload: PreStepPayload,
  next: () => Promise<StepDecision>,
) => Promise<StepDecision>

/** Context of the compaction row. */
export interface CompactionContext extends Omit<BaseContext, 'on'> {
  llm: LlmService
  tokenMeter: TokenMeterService
  sessions: SessionsService
  provide(name: string, value: unknown): () => void
  on(event: 'agent/pre-step', listener: PreStepListener): () => void
}
