/**
 * End-to-end proof of the opt-in freeform bridge.
 *
 * The LLM service, the installed @deepseek-ai/dsh-llm-pi-ai adapter and the
 * pi-ai wire code are real. The only double is a local Responses server, which
 * records the request body and writes SSE. DSH history is built with the real
 * message constructors, so the bridge is tested on the same objects the Agent
 * loop would hand it.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TestContext } from 'node:test'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { native, mount } from './fixtures/native-host.ts'
import type { HostFiber, HostValue } from './fixtures/native-host.ts'
import type { FreeformConfig } from '../src/freeform/index.ts'

const { Context } = await native('cordis')
const {
  LlmRuntime,
  BlockAssembler,
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage
} = await native('dsh-llm')
const { createScope } = await native('dsh-scope')
const { agentEvents } = await native('dsh-agent')
const piAi = await native('dsh-llm-pi-ai')
const freeform = await import('../src/freeform/index.ts')

const PROVIDER = 'fixture'
const MODEL = 'gpt-test'
const API_KEY_ENV = 'DSH_FREEFORM_TEST_KEY'
const PATCH = '*** Begin Patch\n*** Add File: hello.txt\n+hello\n*** End Patch\n'
const FREEFORM_DESCRIPTION = 'The `apply_patch` tool can be used to edit files. This is a FREEFORM tool, so do not wrap the patch in JSON.'
const GRAMMAR = await readFile(new URL('../assets/codex/apply_patch.lark', import.meta.url), 'utf8')
const GRAMMAR_SHA256 = 'd6367f4826ed608c424b0a308f3d6163527df63c22513d089b91863552f8bfeb'
const PATCH_TOOL = {
  name: 'apply_patch',
  description: 'Create, update, delete, or move UTF-8 text files with one Codex-style patch.',
  parameters: {
    type: 'object',
    properties: { input: { type: 'string', description: 'Codex patch text.' } },
    required: ['input'],
    additionalProperties: false
  }
}

/** One recorded request to the fake Responses endpoint. */
interface RecordedRequest {
  url: string | undefined
  body: any
}

/** What a reply builder receives for one recorded request. */
interface ReplyContext {
  url: string | undefined
  body: any
  index: number
}

/** Build the SSE events for one request. */
type Reply = (context: ReplyContext) => HostValue[] | Promise<HostValue[]>

function userMessage(text = 'Edit the file.') {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

/** The assembled request shape the adapter entry points receive. */
interface GenerateRequest {
  provider: string
  model: string
  system: string
  messages: unknown[]
  tools: unknown[]
  signal: AbortSignal
}

function request(
  signal: AbortSignal,
  { messages = [userMessage()], tools = [structuredClone(PATCH_TOOL)] }: { messages?: unknown[]; tools?: unknown[] } = {},
): GenerateRequest {
  return {
    provider: PROVIDER,
    model: MODEL,
    system: 'You are a coding agent.',
    messages,
    tools,
    signal
  }
}

function textEvents(text = 'ok'): Array<Record<string, unknown>> {
  const item = { type: 'message', role: 'assistant', id: 'msg_1', content: [{ type: 'output_text', text }] }
  return [
    { type: 'response.created', response: { id: 'resp_text', status: 'in_progress' } },
    { type: 'response.output_item.added', output_index: 0, item: { type: 'message', role: 'assistant', id: 'msg_1', content: [] } },
    { type: 'response.output_text.delta', output_index: 0, delta: text },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'resp_text', status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }
  ]
}

function customEvents(input: string): Array<Record<string, unknown>> {
  const item = { type: 'custom_tool_call', id: 'ctc_1', call_id: 'call_1', name: 'apply_patch', input }
  return [
    { type: 'response.created', response: { id: 'resp_tool', status: 'in_progress' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, input: '' } },
    { type: 'response.custom_tool_call_input.delta', output_index: 0, delta: input },
    { type: 'response.custom_tool_call_input.done', output_index: 0, input },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'resp_tool', status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }
  ]
}

function completionsEvents(text = 'ok'): Array<Record<string, unknown>> {
  return [
    { id: 'chatcmpl_1', object: 'chat.completion.chunk', created: 0, model: MODEL, choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }] },
    { id: 'chatcmpl_1', object: 'chat.completion.chunk', created: 0, model: MODEL, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
  ]
}

/** Record every request and answer it with one of the response event builders. */
async function fakeServer(t: TestContext, reply: Reply = () => textEvents()) {
  const requests: RecordedRequest[] = []
  const handler = reply
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    let body: any
    try {
      body = JSON.parse(raw)
    } catch {
      body = undefined
    }
    requests.push({ url: req.url, body })
    try {
      const events = await handler({ url: req.url, body, index: requests.length - 1 })
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'close' })
      for (const event of events) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      res.end('data: [DONE]\n\n')
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: String(error) } }))
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  t.after(async () => {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  const address = server.address()
  assert.ok(address !== null && typeof address === 'object')
  return {
    requests,
    baseURL: `http://127.0.0.1:${address.port}/v1`
  }
}

/** Mount the real host LLM service and the real pi-ai adapter over a fake endpoint. */
async function setup(
  t: TestContext,
  { api = 'openai-responses', reply, bridgeConfig }: {
    api?: string
    reply?: Reply
    bridgeConfig?: FreeformConfig
  } = {},
) {
  const server = await fakeServer(t, reply)
  process.env[API_KEY_ENV] = 'test-key'
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await mount(ctx, LlmRuntime)
  await mount(ctx, piAi, {
    providers: {
      [PROVIDER]: {
        api,
        baseURL: server.baseURL,
        apiKeyEnv: API_KEY_ENV,
        models: [{ id: MODEL }]
      }
    }
  })
  const presetKey = {}
  const preset = createScope(ctx, presetKey)
  await preset.ctx.fiber.await()
  t.after(() => preset.dispose())
  let bridgeFiber: HostFiber | undefined
  if (bridgeConfig !== undefined) bridgeFiber = await mount(preset.ctx, freeform, bridgeConfig)
  return { ctx, server, preset, presetKey, bridgeFiber }
}

/** Emit the preset-scoped event that marks one request's exact signal. */
async function markRequest(ctx: HostValue, presetKey: HostValue, signal: AbortSignal) {
  const agent = { id: 'freeform-agent' }
  const scope = createScope(ctx, agent, { parent: presetKey })
  await scope.ctx.fiber.await()
  await agentEvents(scope.ctx, agent).waterfall(
    'agent/request',
    { turn: 0, step: 0, signal },
    () => Promise.resolve(undefined)
  )
}

async function collect(stream: AsyncIterable<unknown>) {
  const chunks: unknown[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return chunks
}

/** Dispatch through the production prepareCall boundary. */
async function call(ctx: HostValue, options: ReturnType<typeof request>) {
  const prepared = await ctx.llm.prepareCall({ provider: options.provider, model: options.model }, options.signal)
  return collect(prepared.stream(options))
}

function assembledToolCall(chunks: unknown[]) {
  const assembler = new BlockAssembler()
  for (const chunk of chunks) assembler.push(chunk)
  const call = assembler.blocks().find((block: HostValue) => block.type === 'tool-call')
  assert.ok(call, 'the stream carries a tool call')
  return call
}

function assertFunctionTool(tool: HostValue, description: string = PATCH_TOOL.description) {
  if (tool.type === 'function' && tool.function !== undefined) {
    assert.equal(tool.function.name, 'apply_patch')
    assert.equal(tool.function.description, description)
    assert.deepEqual(tool.function.parameters, PATCH_TOOL.parameters)
    return
  }
  assert.equal(tool.type, 'function')
  assert.equal(tool.name, 'apply_patch')
  assert.equal(tool.description, description)
  assert.deepEqual(tool.parameters, PATCH_TOOL.parameters)
  assert.equal(tool.format, undefined)
}

test('grammar asset is the pinned Codex file', () => {
  assert.equal(createHash('sha256').update(GRAMMAR).digest('hex'), GRAMMAR_SHA256)
})

test('the settings schema materializes the documented defaults', () => {
  assert.deepEqual(freeform.Config({ enabled: false }), {
    enabled: false,
    rules: [],
    codexCatalog: false
  })
  assert.deepEqual(freeform.Config({ enabled: true, rules: [{ provider: 'openai-codex' }] }), {
    enabled: true,
    rules: [{ provider: 'openai-codex' }],
    codexCatalog: false
  })
  assert.throws(() => freeform.Config({ enabled: 'yes' }))
})

test('the preset listener preserves the agent/request waterfall', async t => {
  const { ctx, presetKey } = await setup(t, {
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER }] }
  })
  const agent = { id: 'waterfall-agent' }
  const scope = createScope(ctx, agent, { parent: presetKey })
  await scope.ctx.fiber.await()
  const seed = { provider: PROVIDER, model: MODEL }
  const result = await agentEvents(scope.ctx, agent).waterfall(
    'agent/request',
    { turn: 0, step: 0, signal: new AbortController().signal },
    () => Promise.resolve(seed)
  )
  assert.equal(result, seed)
})

test('a matching preset request sends the custom tool and maps the custom call back', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    reply: () => customEvents(PATCH),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER, model: 'gpt-*' }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  const chunks = await call(ctx, request(signal))

  const custom = server.requests[0].body.tools
  assert.equal(custom.length, 1)
  assert.deepEqual(custom[0], {
    type: 'custom',
    name: 'apply_patch',
    description: FREEFORM_DESCRIPTION,
    format: { type: 'grammar', syntax: 'lark', definition: GRAMMAR }
  })

  const toolCall = assembledToolCall(chunks)
  assert.equal(toolCall.name, 'apply_patch')
  assert.deepEqual(JSON.parse(toolCall.arguments), { input: PATCH })
})

test('the adapter stream entry point is bridged too', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    reply: () => customEvents(PATCH),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER, model: MODEL }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  const adapter = [...ctx.llm.adapters.values()][0].adapter
  const chunks = await collect(adapter.stream(request(signal)))
  assert.equal(server.requests[0].body.tools[0].type, 'custom')
  assert.deepEqual(JSON.parse(assembledToolCall(chunks).arguments), { input: PATCH })
})

test('canonical history is replayed as custom tool call and output', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    reply: () => textEvents('done'),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  const messages = [
    userMessage('Edit the file.'),
    createAssistantMessage({
      content: [{ type: 'tool-call', id: 'call_prior', name: 'apply_patch', arguments: JSON.stringify({ input: PATCH }) }],
      source: { provider: PROVIDER, model: MODEL }
    }),
    createToolResultMessage({ callId: 'call_prior', content: [{ type: 'text', text: 'Applied' }], isError: false })
  ]
  await call(ctx, request(signal, { messages }))

  const body = server.requests[0].body
  const customCall = body.input.find((item: HostValue) => item.type === 'custom_tool_call')
  const customOutput = body.input.find((item: HostValue) => item.type === 'custom_tool_call_output')
  assert.ok(customCall, 'the prior assistant tool call is a custom_tool_call')
  assert.equal(customCall.call_id, 'call_prior')
  assert.equal(customCall.name, 'apply_patch')
  assert.equal(customCall.input, PATCH)
  assert.ok(customOutput, 'the prior tool result is a custom_tool_call_output')
  assert.equal(customOutput.call_id, 'call_prior')
  assert.equal(customOutput.output, 'Applied')
  assert.equal(body.input.some((item: HostValue) => item.type === 'function_call' || item.type === 'function_call_output'), false)
})

test('JSON-wrapped model input is normalized to the canonical argument', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    reply: ({ index }) => customEvents(index === 0 ? JSON.stringify({ patch: PATCH }) : JSON.stringify({ input: PATCH })),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  const first = await call(ctx, request(signal))
  assert.deepEqual(JSON.parse(assembledToolCall(first).arguments), { input: PATCH })
  const second = await call(ctx, request(signal))
  assert.deepEqual(JSON.parse(assembledToolCall(second).arguments), { input: PATCH })
  assert.equal(server.requests.length, 2)
})

test('disabled leaves the request body byte-for-byte unchanged', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    reply: () => textEvents(),
    bridgeConfig: { enabled: false, rules: [{ provider: PROVIDER }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  await call(ctx, request(signal))
  const withDisabledBridge = server.requests[0].body

  const controlKey = {}
  const controlPreset = createScope(ctx, controlKey)
  await controlPreset.ctx.fiber.await()
  const controlSignal = new AbortController().signal
  await markRequest(ctx, controlKey, controlSignal)
  await call(ctx, request(controlSignal))
  assert.deepEqual(withDisabledBridge, server.requests[1].body)
  assertFunctionTool(withDisabledBridge.tools[0])
})

test('a missing rule match leaves apply_patch a function tool', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    reply: () => textEvents(),
    bridgeConfig: { enabled: true, rules: [{ provider: 'openrouter', model: 'openai/gpt-*' }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  await call(ctx, request(signal))
  assertFunctionTool(server.requests[0].body.tools[0])
})

test('a non-Responses route is left alone', async t => {
  const { ctx, server, presetKey } = await setup(t, {
    api: 'openai-completions',
    reply: () => completionsEvents(),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER }] }
  })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  await collect(ctx.llm.stream(request(signal)))
  assert.equal(server.requests[0].url, '/v1/chat/completions')
  assertFunctionTool(server.requests[0].body.tools[0])
})

test('a request from another preset is not bridged', async t => {
  const { ctx, server } = await setup(t, {
    reply: () => textEvents(),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER }] }
  })
  // The freeform row lives in the first preset. A second preset's Agent has a
  // scope that does not chain through it, so its request signal is never marked.
  const otherKey = {}
  const otherPreset = createScope(ctx, otherKey)
  await otherPreset.ctx.fiber.await()
  const signal = new AbortController().signal
  await markRequest(ctx, otherKey, signal)
  await call(ctx, request(signal))
  assertFunctionTool(server.requests[0].body.tools[0])
})

test('binds a proxy-wrapped registered adapter', async t => {
  const { ctx, server, presetKey, preset } = await setup(t, { reply: () => customEvents(PATCH) })
  const registration = [...ctx.llm.adapters.values()][0]
  const inner = registration.adapter
  // The subscription plugin registers a Proxy chain, not the bare adapter.
  // Binding follows the registered instance instead of importing a guessed
  // module copy, so this wrapper must not make the bridge inert.
  registration.adapter = new Proxy(inner, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  await mount(preset.ctx, freeform, { enabled: true, rules: [{ provider: PROVIDER }] })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  const chunks = await call(ctx, request(signal))
  assert.equal(server.requests[0].body.tools[0].type, 'custom')
  assert.deepEqual(JSON.parse(assembledToolCall(chunks).arguments), { input: PATCH })
})

test('disposing the row restores the adapter and leaves later requests unchanged', async t => {
  const { ctx, server, presetKey, preset } = await setup(t, {
    reply: () => textEvents()
  })
  const adapter = [...ctx.llm.adapters.values()][0].adapter
  const prototype = Object.getPrototypeOf(adapter)
  const original = { prepareCall: prototype.prepareCall, stream: prototype.stream }
  const bridgeFiber = await mount(preset.ctx, freeform, { enabled: true, rules: [{ provider: PROVIDER }] })
  assert.notEqual(prototype.prepareCall, original.prepareCall, 'the row patched the registered adapter prototype')

  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  await bridgeFiber.dispose()
  assert.equal(prototype.prepareCall, original.prepareCall, 'disposal restored prepareCall')
  assert.equal(prototype.stream, original.stream, 'disposal restored stream')

  await call(ctx, request(signal))
  assertFunctionTool(server.requests[0].body.tools[0])
})

test('two mounted rows share one patch and dispose independently', async t => {
  const { ctx, server, presetKey, preset, bridgeFiber } = await setup(t, {
    reply: ({ index }) => index < 2 ? customEvents(PATCH) : textEvents(),
    bridgeConfig: { enabled: true, rules: [{ provider: PROVIDER }] }
  })
  assert.ok(bridgeFiber !== undefined)
  const second = await mount(preset.ctx, freeform, { enabled: true, rules: [{ provider: PROVIDER }] })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)

  await call(ctx, request(signal))
  const firstBody = server.requests[0].body
  assert.equal(firstBody.tools.length, 1)
  assert.equal(firstBody.tools[0].type, 'custom')
  assert.equal(firstBody.tools[0].description, FREEFORM_DESCRIPTION)

  await bridgeFiber.dispose()
  await call(ctx, request(signal))
  assert.equal(server.requests[1].body.tools[0].type, 'custom', 'the second row still bridges')

  await second.dispose()
  await call(ctx, request(signal))
  assertFunctionTool(server.requests[2].body.tools[0])
})

test('codexCatalog enables namespaced catalog slugs without a rule', async t => {
  const server = await fakeServer(t, () => customEvents(PATCH))
  process.env[API_KEY_ENV] = 'test-key'
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await mount(ctx, LlmRuntime)
  await mount(ctx, piAi, {
    providers: {
      [PROVIDER]: {
        api: 'openai-responses',
        baseURL: server.baseURL,
        apiKeyEnv: API_KEY_ENV,
        models: [{ id: 'openai/gpt-6.1-sol' }]
      }
    }
  })
  const presetKey = {}
  const preset = createScope(ctx, presetKey)
  await preset.ctx.fiber.await()
  t.after(() => preset.dispose())
  await mount(preset.ctx, freeform, { enabled: true, rules: [], codexCatalog: true })
  const signal = new AbortController().signal
  await markRequest(ctx, presetKey, signal)
  const options = { ...request(signal), model: 'openai/gpt-6.1-sol' }
  await call(ctx, options)
  assert.equal(server.requests[0].body.tools[0].type, 'custom')
})
