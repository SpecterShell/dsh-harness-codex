# Free-form patches

Codex presents `apply_patch` to GPT models as a custom tool with a Lark grammar: the model produces a raw patch, and the API constrains the output to the grammar. DSH only supports JSON function tools, so by default this preset's `apply_patch` accepts the patch as a JSON string field named `input`.

The `freeform-patch` row sends the Codex form instead, for the providers and models selected by its rules. Any route that uses the OpenAI Responses API is supported.

## Settings

```yaml
- id: freeform-patch
  name: @spectershell/dsh-harness-codex/freeform
  config:
    enabled: false
    rules:
      - provider: openrouter
        model: openai/gpt-*
      - provider: openai-codex
      - model: gpt-6*
    codexCatalog: false
```

A rule may name a provider, a model, or both. An omitted field matches anything, and `*` is a wildcard.

`codexCatalog: true` enables the bridge for every model in Codex's own catalog, matched with Codex's prefix rules. For example, `openai/gpt-6.1-sol` is treated as `gpt-6.1-sol`.

See [configuration.md](configuration.md) for the procedure for changing a row.

### ChatGPT subscription

[dsh-codex-subscription](https://www.npmjs.com/package/dsh-codex-subscription) registers the provider `openai-codex`:

```yaml
rules:
  - provider: openai-codex
```

### OpenRouter

An OpenRouter route should be configured with `api: openai-responses` and `baseURL: https://openrouter.ai/api/v1`, after which:

```yaml
rules:
  - provider: openrouter
    model: openai/gpt-*
```

A single model should be tested first, because some gateways reject custom tools.

### Other Responses endpoints

Certain providers document this configuration for Codex itself; see for example the [z.ai guide](https://docs.z.ai/devpack/tool/codex). The route is added with `api: openai-responses`, then matched by name:

```yaml
rules:
  - provider: zai
    model: glm-5.3
```

`codexCatalog` covers OpenAI models only, so an explicit rule is required for other providers.

## How it works

The session history is not modified. DSH continues to record each `apply_patch` call as `{"input": "<patch>"}`. The translation is applied only to the request sent to the provider and to the reply that returns. A session may therefore switch between a GPT model and another provider at any point.

The bridge applies only to requests from agents using this preset, and only when a rule matches and the route uses a Responses API (`openai-responses`, `openai-codex-responses` or `azure-openai-responses`). Other presets are unaffected.

A patch wrapped in JSON by the model despite the grammar is unwrapped before it is stored.

## Caveats

DSH has no public mechanism for sending a custom tool, so the bridge patches two methods of DSH's internal pi-ai adapter. It has been tested with `@deepseek-ai/dsh-llm-pi-ai` 0.2.2-rc.1 and 0.2.2-rc.3, both with pi-ai 1.5.2. If a later DSH release changes those methods, the bridge logs a warning and leaves `apply_patch` as a JSON function.

The ChatGPT subscription route has been verified by hand. The Azure route has not been tested.

While a model streams a patch wrapped in JSON, the streamed preview may briefly display the wrapper. The stored call is not affected.

## Disabling

Set `enabled: false` or remove the row. The adapter returns to normal once no preset uses the bridge.
