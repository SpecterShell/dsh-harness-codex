/**
 * Wire-level freeform bridge for the preset's `apply_patch` tool.
 *
 * DSH stores `apply_patch` calls as ordinary function calls with an `input`
 * string. OpenAI Responses API models expect a custom grammar tool instead.
 * pi-ai already knows how to speak that protocol when a tool carries
 * `constrainedSampling` and the model's compat allows grammar tools, and it
 * already parses `custom_tool_call` responses back into a tool call whose
 * arguments are `{ input: <raw> }`. So this bridge only adapts the pi-ai
 * boundary: it adds the grammar metadata and compat flag to one outgoing
 * request, and normalizes a JSON-wrapped incoming patch. Stored history never
 * changes shape, so a session can switch between freeform and JSON models.
 *
 * The bridge binds the exact `PiAiAdapter` prototype behind the adapters
 * registered with `ctx.llm`, not a module-level guess. Two installed copies of
 * `dsh-llm-pi-ai` therefore cannot make it silently inert: whichever copy
 * serves the route is found through its registered instance, and if its
 * methods do not look like the verified shape nothing is patched. The
 * snapshot/receiver technique follows Anionex/dsh-smarter-edit's MIT-licensed
 * freeform bridge, which faced the same missing DSH seam.
 * @module dsh-harness-codex/freeform/bridge
 */
import { errorMessage, isRecord } from '../guards.ts'
import { FREEFORM_DESCRIPTION, RESPONSES_APIS } from './spec.ts'
import type { LlmService, Logger } from '../types.js'
import type { Matcher } from './rules.js'

/** One active preset-scope bridge. */
export interface BridgeInstance {
  logger: Logger
  llm: LlmService | undefined
  grammar: string
  matcher: Matcher
  version: string
  signals: WeakSet<object>
  warned: Set<string>
  matches(provider: string, model: string): boolean
}

/** The prototype methods the bridge installs and restores. */
type Boundary = (...args: unknown[]) => unknown

/** The verified pi-ai adapter boundary, found only through a registered instance. */
interface AdapterPrototype {
  [name: string]: unknown
  constructor?: { name?: string }
}

/** One patched prototype and the original methods needed to restore it. */
interface PrototypeRecord {
  originalPrepareCall: Boundary
  originalStream: Boundary
  prepareCall?: Boundary
  stream?: Boundary
  copy: number
}

/** Cross-module state: active preset instances and patched prototypes. */
interface BridgeState {
  instances: Set<BridgeInstance>
  prototypes: Map<AdapterPrototype, PrototypeRecord>
  copies: number
}

/** The adapter object `this` the wrappers receive. */
interface BridgeAdapter {
  current(): unknown
  prepareCall(...args: unknown[]): unknown
  stream(...args: unknown[]): unknown
  streamWithSnapshot(...args: unknown[]): unknown
}

/** Global state, so a second module instance or preset revision cannot patch twice. */
const STATE: unique symbol = Symbol.for('dsh-harness-codex/freeform-bridge')
const globalRoot = globalThis as typeof globalThis & { [STATE]?: BridgeState }

/** The methods every verified adapter prototype must expose. */
const BOUNDARY_METHODS = ['current', 'prepareCall', 'stream', 'streamWithSnapshot'] as const

/** Shared bridge state: active preset instances and patched prototypes. */
function bridgeState(): BridgeState {
  return globalRoot[STATE] ??= {
    instances: new Set(),
    prototypes: new Map(),
    copies: 0
  }
}

/**
 * Activate one preset-scope bridge instance.
 * @param instance - compiled rules, grammar, logger, llm service, and signal marks.
 * @returns cleanup that removes this instance and restores patches when none remain.
 */
export function activateBridge(instance: BridgeInstance): () => void {
  const state = bridgeState()
  state.instances.add(instance)
  try {
    bindBridgeAdapters(instance)
  } catch (error) {
    state.instances.delete(instance)
    throw error
  }
  return () => {
    state.instances.delete(instance)
    if (state.instances.size > 0) return
    for (const [prototype, record] of state.prototypes) {
      // Restore only what is still ours: a later third-party wrapper on top of
      // the bridge owns the current value and must not be clobbered.
      let restored = false
      if (prototype.prepareCall === record.prepareCall) {
        Object.defineProperty(prototype, 'prepareCall', {
          configurable: true,
          writable: true,
          value: record.originalPrepareCall
        })
        restored = true
      }
      if (prototype.stream === record.stream) {
        Object.defineProperty(prototype, 'stream', {
          configurable: true,
          writable: true,
          value: record.originalStream
        })
        restored = true
      }
      if (restored) state.prototypes.delete(prototype)
    }
  }
}

/** Return the bridge boundary methods this adapter prototype must expose. */
function hasBoundary(prototype: AdapterPrototype): boolean {
  return BOUNDARY_METHODS.every(
    name => typeof prototype[name] === 'function'
  )
}

/**
 * Follow an adapter (which may be a Proxy) to the prototype that owns the
 * request boundary. The class name is only a hint; the method shape is the
 * contract this bridge depends on.
 */
function inspectAdapter(adapter: unknown): { prototype: AdapterPrototype; incomplete?: boolean } | undefined {
  if (!isRecord(adapter) && typeof adapter !== 'function') return undefined
  let named: AdapterPrototype | undefined
  for (
    let prototype = Object.getPrototypeOf(adapter) as AdapterPrototype | null;
    prototype !== null && prototype !== (Object.prototype as unknown);
    prototype = Object.getPrototypeOf(prototype) as AdapterPrototype | null
  ) {
    if (hasBoundary(prototype)) return { prototype }
    if (prototype.constructor?.name === 'PiAiAdapter') named = prototype
  }
  return named === undefined ? undefined : { prototype: named, incomplete: true }
}

/** Bind every registered adapter that looks like the verified pi-ai adapter. */
export function bindBridgeAdapters(instance: BridgeInstance): void {
  if (!bridgeState().instances.has(instance)) return
  const adapters = instance.llm?.adapters
  if (!(adapters instanceof Map)) {
    instance.logger.warn('freeform: the host LLM service does not expose its adapter registry; apply_patch will stay a JSON function tool')
    return
  }
  let bound = 0
  for (const registration of adapters.values()) {
    const inspected = inspectAdapter(registration?.adapter)
    if (inspected === undefined) continue
    if (inspected.incomplete === true) {
      instance.logger.warn(
        'freeform: a registered pi-ai adapter does not expose current/stream/prepareCall/streamWithSnapshot; '
        + 'apply_patch will stay a JSON function tool'
      )
      continue
    }
    try {
      bindPrototype(instance, inspected.prototype)
    } catch (error) {
      instance.logger.warn(`freeform: could not patch the pi-ai adapter prototype; apply_patch will stay a JSON function tool (${errorMessage(error)})`)
      continue
    }
    bound += 1
  }
  if (bound === 0 && adapters.size > 0) {
    instance.logger.debug?.('freeform: no pi-ai adapter among the registered routes; apply_patch will stay a JSON function tool')
  }
}

/** Human-readable provider route for the bind log. */
function providerLabel(provider: unknown): string {
  if (isRecord(provider) && typeof provider.id === 'string') return provider.id
  return provider === undefined || provider === null ? 'unknown' : String(provider)
}

/** Install the wrappers once; later preset revisions only add their instance. */
function bindPrototype(instance: BridgeInstance, prototype: AdapterPrototype): void {
  const state = bridgeState()
  if (state.prototypes.has(prototype)) return
  const record: PrototypeRecord = {
    originalPrepareCall: prototype.prepareCall as Boundary,
    originalStream: prototype.stream as Boundary,
    copy: ++state.copies
  }
  record.prepareCall = function prepareCall(this: BridgeAdapter, provider: unknown, model: unknown, signal: unknown) {
    return bridgePrepareCall(this, record, provider, model, signal)
  }
  record.stream = function stream(this: BridgeAdapter, options: unknown) {
    return bridgeStream(this, record, options)
  }
  Object.defineProperty(prototype, 'prepareCall', {
    configurable: true,
    writable: true,
    value: record.prepareCall
  })
  Object.defineProperty(prototype, 'stream', {
    configurable: true,
    writable: true,
    value: record.stream
  })
  state.prototypes.set(prototype, record)
  const routes = [...(instance.llm?.adapters?.values() ?? [])]
    .filter(registration => inspectAdapter(registration.adapter)?.prototype === prototype)
    .map(registration => providerLabel(registration.provider))
  instance.logger.info(
    `freeform: bound ${prototype.constructor?.name ?? 'pi-ai adapter'} copy #${record.copy} `
    + `for provider route(s): ${routes.join(', ') || 'none'} `
    + `(host dsh-llm-pi-ai resolve: ${instance.version})`
  )
}

/** The preset instance that marked this exact request signal, if any. */
function markedInstance(signal: unknown): BridgeInstance | undefined {
  if (!isRecord(signal)) return undefined
  for (const instance of bridgeState().instances) {
    if (instance.signals.has(signal)) return instance
  }
  return undefined
}

/**
 * Decide whether one adapter call is in scope, and produce its bridged
 * snapshot. Rules are checked before the snapshot so requests from other
 * presets cost one WeakSet lookup and nothing else.
 */
function bridgeGate(
  base: BridgeAdapter,
  provider: unknown,
  model: unknown,
  signal: unknown,
): { snapshot: Record<string, unknown> } | undefined {
  const instance = markedInstance(signal)
  if (instance === undefined || typeof provider !== 'string' || typeof model !== 'string') return undefined
  if (!instance.matches(provider, model)) return undefined
  let snapshot: unknown
  try {
    snapshot = base.current()
  } catch {
    return undefined
  }
  const models = isRecord(snapshot) ? snapshot.models : undefined
  if (!isRecord(models) || typeof models.getModel !== 'function') return undefined
  const getModel = models.getModel as (provider: string, model: string) => { api?: unknown } | undefined
  const resolved = getModel.call(models, provider, model)
  if (resolved === undefined || !RESPONSES_APIS.has(resolved.api as string)) return undefined
  const bridged = bridgeSnapshot(snapshot as Record<string, unknown>, instance)
  return bridged === undefined ? undefined : { snapshot: bridged }
}

/** A view of the adapter whose `current()` returns the request-local snapshot. */
function bridgedReceiver(base: BridgeAdapter, snapshot: Record<string, unknown>): BridgeAdapter {
  const receiver: BridgeAdapter = Object.create(base)
  receiver.current = () => snapshot
  return receiver
}

function bridgePrepareCall(
  base: BridgeAdapter,
  record: PrototypeRecord,
  provider: unknown,
  model: unknown,
  signal: unknown,
): unknown {
  const gate = bridgeGate(base, provider, model, signal)
  if (gate === undefined) return record.originalPrepareCall.call(base, provider, model, signal)
  return record.originalPrepareCall.call(bridgedReceiver(base, gate.snapshot), provider, model, signal)
}

function bridgeStream(base: BridgeAdapter, record: PrototypeRecord, options: unknown): unknown {
  const optionsRecord = isRecord(options) ? options : undefined
  // Auxiliary requests (compaction summaries, titles) share the turn's signal;
  // they carry a purpose and must not pick up the grammar tool.
  if (optionsRecord?.purpose !== undefined) return record.originalStream.call(base, options)
  const gate = bridgeGate(base, optionsRecord?.provider, optionsRecord?.model, optionsRecord?.signal)
  if (gate === undefined) return record.originalStream.call(base, options)
  return record.originalStream.call(bridgedReceiver(base, gate.snapshot), options)
}

/** Copy one snapshot with a `models.streamSimple` that bridges a single request. */
function bridgeSnapshot(snapshot: Record<string, unknown>, instance: BridgeInstance): Record<string, unknown> | undefined {
  const models = snapshot.models
  if (!isRecord(models) || typeof models.streamSimple !== 'function') {
    warnOnce(instance, 'streamSimple', 'freeform: the pi-ai Models snapshot has no streamSimple; apply_patch will stay a JSON function tool')
    return undefined
  }
  const bridged = new Proxy(models, {
    get(target, property) {
      if (property === 'streamSimple') {
        return (model: unknown, context: unknown, options: unknown) => bridgeStreamSimple(target, model, context, options, instance)
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  return { ...snapshot, models: bridged }
}

function bridgeStreamSimple(
  models: Record<string, unknown>,
  model: unknown,
  context: unknown,
  options: unknown,
  instance: BridgeInstance,
): unknown {
  if (!isRecord(model) || typeof model.api !== 'string' || !RESPONSES_APIS.has(model.api)) {
    return callStreamSimple(models, model, context, options)
  }
  const bridgedContext = bridgeContext(context, instance)
  if (bridgedContext === undefined) return callStreamSimple(models, model, context, options)
  const compat = isRecord(model.compat) ? model.compat : {}
  const bridgedModel = {
    ...model,
    compat: { ...compat, supportsOpenAIGrammarTools: true }
  }
  return normalizeResponseStream(callStreamSimple(models, bridgedModel, bridgedContext, options))
}

/** Call the snapshot's own streamSimple without losing its `this`. */
function callStreamSimple(
  models: Record<string, unknown>,
  model: unknown,
  context: unknown,
  options: unknown,
): unknown {
  const streamSimple = models.streamSimple as (model: unknown, context: unknown, options: unknown) => unknown
  return streamSimple.call(models, model, context, options)
}

/** Add the grammar declaration to the apply_patch tool in the pi-ai context. */
function bridgeContext(context: unknown, instance: BridgeInstance): Record<string, unknown> | undefined {
  if (!isRecord(context)) return undefined
  const tools = bridgeTools(context.tools, instance)
  let messages: unknown = context.messages
  let messagesChanged = false
  if (Array.isArray(messages)) {
    messages = messages.map((message: unknown) => {
      if (!isRecord(message) || message.role !== 'system' || !Array.isArray(message.toolsAdded)) return message
      const added = bridgeTools(message.toolsAdded, instance)
      if (added === undefined) return message
      messagesChanged = true
      return { ...message, toolsAdded: added }
    })
  }
  if (tools === undefined && !messagesChanged) return undefined
  return {
    ...context,
    ...(tools === undefined ? {} : { tools }),
    ...(messagesChanged ? { messages } : {})
  }
}

/** Replace only the canonical single-string input tool, never a same-named other tool. */
function bridgeTools(tools: unknown, instance: BridgeInstance): unknown[] | undefined {
  if (!Array.isArray(tools)) return undefined
  let changed = false
  const bridged = tools.map((tool: unknown) => {
    if (!isRecord(tool) || tool.name !== 'apply_patch') return tool
    if (!canonicalPatchTool(tool)) {
      warnOnce(instance, 'schema', 'freeform: apply_patch does not have the expected single string input schema; apply_patch will stay a JSON function tool')
      return tool
    }
    changed = true
    return {
      ...tool,
      description: FREEFORM_DESCRIPTION,
      constrainedSampling: {
        type: 'grammar',
        variants: { openai_lark: instance.grammar }
      }
    }
  })
  return changed ? bridged : undefined
}

/** The one schema pi-ai's grammar-tool inference accepts. */
function canonicalPatchTool(tool: unknown): boolean {
  if (!isRecord(tool)) return false
  const parameters = tool.parameters
  if (!isRecord(parameters) || Array.isArray(parameters)) return false
  if (parameters.type !== 'object' || !Array.isArray(parameters.required) || parameters.required.length !== 1) return false
  if (parameters.required[0] !== 'input') return false
  const properties = parameters.properties
  if (!isRecord(properties)) return false
  const property = properties.input
  return isRecord(property) && property.type === 'string'
}

/** Keep the raw patch as pi-ai's `{ input }` argument, unwrapping JSON envelopes. */
function normalizeResponseStream(source: unknown): AsyncIterable<unknown> {
  return (async function* () {
    for await (const event of source as AsyncIterable<unknown>) {
      if (isRecord(event) && event.type === 'toolcall_end') yield normalizeToolCallEnd(event)
      else if (isRecord(event) && event.type === 'done') yield normalizeDone(event)
      else yield event
    }
  })()
}

function normalizeToolCallEnd(event: Record<string, unknown>): Record<string, unknown> {
  const toolCall = event.toolCall
  if (!isRecord(toolCall) || toolCall.name !== 'apply_patch') return event
  const argumentsValue = normalizeArguments(toolCall.arguments)
  if (argumentsValue === undefined) return event
  return { ...event, toolCall: { ...toolCall, arguments: argumentsValue } }
}

function normalizeDone(event: Record<string, unknown>): Record<string, unknown> {
  const message = event.message
  if (!isRecord(message)) return event
  const content = message.content
  if (!Array.isArray(content)) return event
  let changed = false
  const normalized = content.map((block: unknown) => {
    if (!isRecord(block) || block.type !== 'toolCall' || block.name !== 'apply_patch') return block
    const argumentsValue = normalizeArguments(block.arguments)
    if (argumentsValue === undefined) return block
    changed = true
    return { ...block, arguments: argumentsValue }
  })
  return changed ? { ...event, message: { ...message, content: normalized } } : event
}

/** Canonical arguments, or undefined when there is nothing to normalize. */
function normalizeArguments(argumentsValue: unknown): { input: string } | undefined {
  if (!isRecord(argumentsValue) || Array.isArray(argumentsValue)) return undefined
  const raw = typeof argumentsValue.input === 'string' ? argumentsValue.input : argumentsValue.patch
  if (typeof raw !== 'string') return undefined
  const input = normalizePatchText(raw)
  return input === raw && argumentsValue.input === raw ? undefined : { input }
}

/**
 * Accept a patch the model wrapped in JSON despite the freeform tool.
 * Only a JSON object with a string `input` or `patch` is unwrapped; all other
 * text is returned unchanged so the tool reports the model's own error.
 */
function normalizePatchText(text: string): string {
  let current = text
  for (let depth = 0; depth < 4; depth += 1) {
    if (current.trimStart().startsWith('*** Begin Patch')) return current
    if (!current.trimStart().startsWith('{')) return text
    let parsed: unknown
    try {
      parsed = JSON.parse(current)
    } catch {
      return text
    }
    if (!isRecord(parsed) || Array.isArray(parsed)) return text
    const wrapped = typeof parsed.input === 'string' ? parsed.input : parsed.patch
    if (typeof wrapped !== 'string') return text
    current = wrapped
  }
  return current
}

function warnOnce(instance: BridgeInstance, key: string, message: string): void {
  if (instance.warned.has(key)) return
  instance.warned.add(key)
  instance.logger.warn(message)
}
