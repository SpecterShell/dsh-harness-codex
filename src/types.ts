/**
 * Local structural types for the DSH host services this bundle uses.
 *
 * DSH host packages are deliberately not dependencies: this bundle runs inside
 * the host's Cordis graph, so a second installed copy would split service and
 * scope identities. These declarations therefore describe only the members the
 * plugins here actually call. A host upgrade that keeps those members keeps
 * this package compiling; anything else should fail at the boundary, not be
 * papered over with `any`.
 *
 * @module @spectershell/dsh-harness-codex/types
 */
import type { Readable } from 'node:stream'
import type { CodexSettingsService } from './config.js'

/** Minimal logger face shared by the Cordis context and the bridge instance. */
export interface Logger {
  debug?(message: string): void
  info(message: string): void
  warn(message: string): void
}

/** Cordis lifecycle and event surface used by these plugins. */
export type EventListener = (...args: never[]) => unknown

/** The effect, event, emit and logger members every plugin row may call. */
export interface BaseContext {
  effect(callback: () => void | (() => void), label?: string): void
  on(event: string, listener: EventListener, options?: { readonly prepend?: boolean }): () => void
  emit(event: string, ...args: unknown[]): void
  logger: Logger
}

/** A JSON Schema node accepted by the tool registry. */
export interface JsonSchema {
  type?: string
  description?: string
  enum?: readonly string[]
  properties?: Record<string, JsonSchema>
  required?: readonly string[]
  additionalProperties?: boolean
  items?: JsonSchema
}

/** The dimensions Codex reports when an attachment was downscaled. */
export interface ImageDimensions {
  width: number
  height: number
}

/** Durable image reference returned by the attachment store. */
export interface AttachmentRef {
  attachmentId: string
  mediaType: string
  bytes: number
  width: number
  height: number
  name?: string
  originalDimensions?: ImageDimensions
}

/** Deployment image limits the tool checks before reading bytes. */
export interface ImageLimits {
  readonly mediaTypes: readonly string[]
  readonly maxImageBytes: number
  readonly maxMessageImageBytes: number
  readonly maxImageDimension: number
  readonly maxImagePixels: number
}

/** Canonical structured value of the `view_image` tool. */
export interface ViewImageResult {
  path: string
  image: AttachmentRef
}

/** Text or image content block a tool renderer emits. */
export type ToolContentBlock =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly attachment: AttachmentRef }

/** Canonical output contract declared by every registered tool. */
export interface ToolOutput<Value> {
  readonly schema: JsonSchema
  render(args: unknown, value: Value): readonly ToolContentBlock[]
}

/** One model-facing tool definition, narrowed to the members we register. */
export interface ToolDefinition<Args = unknown, Value = unknown> {
  name: string
  description: string
  parameters: JsonSchema
  output: ToolOutput<Value>
  isConcurrencySafe?: () => boolean
  execute(args: Args, exec: ToolExecution): Value | Promise<Value>
}

/** Provider/model selection attached to an Agent or a request header. */
export interface ModelSelection {
  provider?: string
  model?: string
}

/** Agent options the persona and image plugins read. */
export interface AgentOptions {
  provider?: string
  model?: string
}

/** One committed session event the project-instruction row inspects. */
export interface SessionSurfaceEvent {
  readonly type: string
  readonly data: {
    readonly source?: { readonly kind?: string; readonly digest?: string }
    readonly content?: readonly InstructionTextBlock[]
  }
}

/** Session members used by the tool and instruction plugins. */
export interface Session {
  append(type: string, data: unknown): unknown
  requestHeader(): { config?: ModelSelection } | undefined
  readonly surface: { readonly nodes: readonly number[] }
  eventAt(seq: number): SessionSurfaceEvent | undefined
}

/** The Agent facts a tool call reads. */
export interface Agent {
  id?: string
  session: Session
  options: AgentOptions
}

/** Execution identity and cancellation handed to a tool body. */
export interface ToolExecution {
  readonly agent?: Agent
  readonly callId: string
  readonly signal: AbortSignal
}

/** Model-supplied `exec_command` arguments, as the tool validates them. */
export interface ExecCommandArgs {
  cmd?: string
  workdir?: string
  tty?: boolean
  yield_time_ms?: number
  max_output_tokens?: number
  sandbox_permissions?: string
  justification?: string
}

/** Model-supplied `write_stdin` arguments, as the tool validates them. */
export interface WriteStdinArgs {
  session_id?: number
  chars?: string
  yield_time_ms?: number
  max_output_tokens?: number
}

/** The visible names and restriction operation used by the surface plugin. */
export interface ToolsView {
  readonly restrictableNames: ReadonlySet<string>
}

/** Tool and scope registry members used by these plugins. */
export interface ToolsService {
  register<Args, Value>(definition: ToolDefinition<Args, Value>): () => void
  view(scope?: unknown): ToolsView
  restrict(filter: { deny?: readonly string[]; allow?: readonly string[] }): () => void
}

/** A prompt section as accepted by the system-prompt registry. */
export interface PromptContext {
  modelSelection?: { model?: string }
  agent?: { options?: AgentOptions }
}

/** One complete or partial prompt section. */
export interface SystemPromptSection {
  name: string
  order: number
  text: string | ((context: PromptContext) => string)
  complete?: boolean
  interpolate?: boolean
}

/** System-prompt registry members the persona plugin uses. */
export interface SystemPromptService {
  section(section: SystemPromptSection): () => void
  getSectionOrder(name: string): number
}

/** Filesystem target identity; only the display path is read here. */
export interface FsTarget {
  displayPath: string
}

/** Filesystem metadata subset used for existence and version facts. */
export interface FsInfo {
  version: unknown
  type: 'file' | 'directory' | 'other'
  size?: number
}

/** Filesystem service members the image and instruction plugins use. */
export interface FileSystemService {
  resolve(path: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<FsTarget>
  stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined>
  readBytes(target: FsTarget, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>
  readByteRange(target: FsTarget, range: { offset: number; length: number }, signal?: AbortSignal): Promise<Uint8Array>
  processPath(target: FsTarget): string
}

/** Image persistence members the image tool uses. */
export interface AttachmentStore {
  readonly imageLimits: ImageLimits
  saveImage(input: { data: Uint8Array; mediaType: string; name?: string }): Promise<AttachmentRef>
}

/** Working-directory resolver used by the exec and image tools. */
export interface WorkingDirectoryService {
  ensure(agent: Agent, signal: AbortSignal): Promise<string>
}

/** Resolved model capabilities the image tool checks. */
export interface ModelInfo {
  inputModalities?: readonly string[]
}

/** One registered LLM adapter route; the freeform bridge inspects the shape. */
export interface AdapterRegistration {
  adapter?: unknown
  provider?: string | { id?: string }
}

/** LLM service members the image and freeform plugins use. */
export interface LlmService {
  adapters?: Map<string, AdapterRegistration>
  resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<ModelInfo>
}

/** One incremental shell-output read. */
export interface ShellProcessRead {
  delta: string
  lossy: boolean
}

/** A shell execution handle as the exec plugin consumes it. */
export interface ShellExecution {
  status: 'running' | 'completed' | 'killed'
  done: Promise<void>
  readOutput(): ShellProcessRead
  result(): Promise<{ exitCode: number | null; signal: string | null }>
  kill(): boolean
}

/** The request fields the exec plugin fills before resolving a shell call. */
export interface ShellExecRequest {
  command: string
  onExpiry?: 'kill' | 'none'
  workdir?: string
  timeoutMs?: number
  stdoutMaxBytes?: number
  stdin?: string
  env?: Record<string, string>
  dshEnv?: Record<string, string>
  sandboxPolicy?: SandboxExecutionPolicy
  signal?: AbortSignal
}

/** A fully resolved shell spec. */
export interface ShellExecSpec {
  command: string
  workdir: string
  timeoutMs: number
  onExpiry: 'kill' | 'none'
  stdoutMaxBytes: number
  stdin?: string
  env?: Record<string, string>
  dshEnv?: Record<string, string>
  sandboxPolicy?: SandboxExecutionPolicy
  signal?: AbortSignal
}

/** Shell executor members the exec plugin uses. */
export interface ShellExecutorService {
  readonly sandboxMode?: string
  resolve(request: ShellExecRequest): ShellExecSpec
  execute(spec: ShellExecSpec): Promise<ShellExecution>
}

/** Terminal outcome as the exec terminal wrapper reads it. */
export interface SubprocessOutcome {
  exitCode: number | null
  signal: string | null
}

/** One allocated terminal session. */
export interface SubprocessTerminalHandle {
  readonly output: Readable
  readonly done: Promise<SubprocessOutcome>
  write(data: string): Promise<void>
  terminate(): Promise<void>
}

/** The terminal-spawn fields the exec plugin supplies. */
export interface SubprocessTerminalSpawnSpec {
  argv: readonly string[]
  cwd: string
  env?: Record<string, string>
  rows: number
  cols: number
  terminalType: string
  graceMs: number
  signal?: AbortSignal
}

/** Subprocess runtime members the exec plugin uses. */
export interface SubprocessRuntimeService {
  spawnTerminal(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle>
}

/** File-effect policy carried per confined execution. */
export interface SandboxExecutionPolicy {
  mode: 'read-only' | 'workspace-write' | 'danger-full-access'
  workspaceRoot: string
  additionalWritableRoots?: readonly string[]
  sessionId?: unknown
}

/** Sandbox provider output and operation used by the exec plugin. */
export interface SandboxProviderService {
  confine(
    argv: readonly string[],
    policy: SandboxExecutionPolicy,
    signal: AbortSignal,
  ): Promise<{ argv: string[] }>
}

/** Standing-policy resolver used by the exec plugin. */
export interface SandboxPolicyService {
  resolve(options: { session?: Session }): SandboxExecutionPolicy
}

/** One approval request for unsandboxed execution. */
export interface ApprovalRequest {
  agent: Agent
  toolName: string
  callId: string
  reason: string
  displayReason: Record<string, string>
  signal: AbortSignal
}

/** Approval service used for Codex's `require_escalated`. */
export interface ApprovalService {
  request(request: ApprovalRequest): Promise<string>
}

/** Managed `DSH_*` environment snapshot. */
export interface ShellEnvService {
  collect(execution: ToolExecution): Record<string, string>
}

/** Todo status shared by Codex's plan schema and the DSH projection. */
export type TodoStatus = 'pending' | 'in_progress' | 'completed'

/** One projected todo item. */
export interface TodoItem {
  content: string
  status: TodoStatus
}

/** The `todos` projection state. */
export type TodoList = TodoItem[]

/** One committed session event as the plan projection reads it. */
export interface SessionEvent {
  readonly type: string
  readonly data: { readonly todos: TodoList | null }
}

/** One session-projection unit. */
export interface ProjectionDefinition<K extends string, S> {
  key: K
  stateSchema: { parse(value: unknown): S }
  init(): S
  apply(state: S, event: SessionEvent): S
  wire?: {
    viewSchema: { parse(value: unknown): S }
    view(state: S): S
    summary?: boolean
  }
  stateVersion: number
}

/** Session-projection registry member the plan plugin uses. */
export interface SessionProjectionsService {
  register<K extends string, S>(definition: ProjectionDefinition<K, S>): Promise<unknown>
}

/** Context of the persona row. */
export interface PersonaContext extends BaseContext {
  systemPrompt: SystemPromptService
}

/** Context of the plan row. */
export interface PlanContext extends BaseContext {
  tools: ToolsService
  sessionProjections: SessionProjectionsService
}

/** Context of the surface row. */
export interface SurfaceContext extends BaseContext {
  tools: ToolsService
  get<K extends keyof SettingsServices>(name: K): SettingsServices[K] | undefined
}

/** Optional services the image row reaches through `ctx.get`. */
export interface ImageServices {
  llm: LlmService
}

/** Context of the image row. */
export interface ImageContext extends BaseContext {
  tools: ToolsService
  fs: FileSystemService
  attachments: AttachmentStore
  workingDirectory: WorkingDirectoryService
  get<K extends keyof ImageServices>(name: K): ImageServices[K] | undefined
}

/** Optional services the exec row reaches through `ctx.get`. */
export interface ExecServices {
  shellEnv: ShellEnvService
  workingDirectory: WorkingDirectoryService
  sandboxPolicy: SandboxPolicyService
  sandbox: SandboxProviderService
  approval: ApprovalService
}

/** Context of the exec row. */
export interface ExecContext extends BaseContext {
  tools: ToolsService
  shell: ShellExecutorService
  subprocess: SubprocessRuntimeService
  get<K extends keyof ExecServices>(name: K): ExecServices[K] | undefined
}

/** Context of the freeform row. */
export interface FreeformContext extends BaseContext {
  llm: LlmService
  get<K extends keyof SettingsServices>(name: K): SettingsServices[K] | undefined
}

/** Optional services this package's host entry contributes to the preset rows. */
export interface SettingsServices {
  /** Live values from the host entry; absent when the host entry is not mounted. */
  codexSettings: CodexSettingsService
}

/** One incremental output read from an exec process wrapper. */
export interface ProcessRead {
  text: string
  lossy: boolean
}

/** Exit facts shared by both process wrappers. */
export interface ProcessOutcome {
  exitCode: number | null
  signal: string | null
}

/** Fields both exec process wrappers expose to the tool bodies. */
export interface BaseExecProcess {
  exited: Promise<void>
  running(): boolean
  read(): ProcessRead
  settle(): Promise<ProcessOutcome>
  kill(): void
}

/** A pipe process never accepts stdin after the call. */
export interface PipeExecProcess extends BaseExecProcess {
  tty: false
}

/** A terminal process accepts writes for an open session. */
export interface TerminalExecProcess extends BaseExecProcess {
  tty: true
  write(chars: string): Promise<void>
}

/** The two process shapes the session table owns. */
export type ExecProcess = PipeExecProcess | TerminalExecProcess

/** One project instruction file retained by the Codex-style loader. */
export interface ProjectInstructionFile {
  absolutePath: string
  content: string
}

/** One text block in a producer-injected user message. */
export interface InstructionTextBlock {
  readonly type: 'text'
  readonly text: string
}

/** Source identity of the project-document message this preset injects. */
export interface ProjectInstructionSource {
  readonly kind: 'project-instructions'
  readonly form: 'instructions'
  readonly changes: readonly never[]
  /** Digest of the project-doc text this message made visible; `''` text has a fixed digest. */
  readonly digest: string
}

/** User-role message carrying project docs, injected like the native loader. */
export interface ProjectInstructionMessage {
  readonly id: string
  readonly role: 'user'
  readonly content: readonly InstructionTextBlock[]
  readonly source: ProjectInstructionSource
}

/** A step decision as this row passes it through and appends to. */
export interface PreStepDecision {
  readonly kind: 'reject' | 'enter'
  readonly messages: readonly ProjectInstructionMessage[]
  readonly startsRequestSeries?: true
}

/** The `agent/pre-step` payload fields this row reads. */
export interface PreStepPayload {
  readonly agent: Agent
  readonly signal: AbortSignal
}

/** Waterfall listener that may insert one project-instruction message. */
export type PreStepListener = (
  payload: PreStepPayload,
  next: () => Promise<PreStepDecision>,
) => Promise<PreStepDecision>

/** Optional services the instructions row reaches through `ctx.get`. */
export interface InstructionServices {
  fs: FileSystemService
  codexSettings: CodexSettingsService
}

/** Context of the project-instructions row. */
export interface InstructionsContext {
  workingDirectory: WorkingDirectoryService
  get<K extends keyof InstructionServices>(name: K): InstructionServices[K] | undefined
  on(event: 'agent/pre-step', listener: PreStepListener, options?: { readonly prepend?: boolean }): () => void
}
