# dsh-harness-codex

[![CI](https://github.com/SpecterShell/dsh-harness-codex/actions/workflows/ci.yml/badge.svg)](https://github.com/SpecterShell/dsh-harness-codex/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-harness-codex)](https://www.npmjs.com/package/dsh-harness-codex)

[简体中文](README.zh-Hans.md)

An agent preset for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) that reproduces the working style of OpenAI Codex. The agent reads and searches through the shell, edits files with `apply_patch`, and runs each command in its own process. Tool names, schemas, output formats and prompts follow Codex, so GPT models operate as they were trained to. Other models receive the same tools with a prompt written for them.

## Installation

```sh
dsh plugin --profile web add dsh-harness-codex
```

After restarting DSH, the **Codex-inspired** preset is available when a session is started. The package requires DSH 0.2.2-rc.1 or a later 0.2 release and Node.js 24.9 or newer.

## Tools

| Tool | Description |
| --- | --- |
| `exec_command` | Runs a command in a new process. Returns its output, or a session identifier if it is still running. |
| `write_stdin` | Polls a running session, or sends input to one started with `tty: true`. |
| `apply_patch` | Edits files with a Codex patch. |
| `update_plan` | Updates the plan shown in the To-dos panel. |
| `view_image` | Shows a local image to the model. |

## Presets

The package declares two presets.

**Codex-inspired** is the strict preset. The model sees the five Codex tools and nothing else; tools contributed by other profile plugins are hidden.

**Codex-extended** pairs the same Codex tools with the host's non-conflicting tools. It hides only the built-ins that duplicate a Codex tool (`read`, `write`, `edit`, `glob`, `grep`, `read_image`, `bash`, `pwsh`, `todo_write`) and lets everything else through, including tools from plugins installed later.

User-level and project-level `AGENTS.md` files continue to apply in both.

## Prompts

The preset selects a system prompt from the model. GPT models receive Codex's own prompt for that model, taken from Codex's model catalog. Other models receive [prompts/original.md](prompts/original.md).

| File | Used for |
| --- | --- |
| [prompts/original.md](prompts/original.md) | Every non-OpenAI model |
| [prompts/codex/prompt.md](prompts/codex/prompt.md) | OpenAI-style models outside the catalog |
| [prompts/codex/gpt-5.5.md](prompts/codex/gpt-5.5.md) | gpt-5.5 |
| [prompts/codex/gpt-5.6-sol.md](prompts/codex/gpt-5.6-sol.md) | gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, codex-auto-review |
| [prompts/codex/gpt-6-astra.md](prompts/codex/gpt-6-astra.md) | gpt-6-astra, gpt-6.1-terra |
| [prompts/codex/gpt-6-luna.md](prompts/codex/gpt-6-luna.md) | gpt-6-luna |
| [prompts/codex/gpt-6-sol.md](prompts/codex/gpt-6-sol.md) | gpt-6-sol |
| [prompts/codex/gpt-6.1-sol.md](prompts/codex/gpt-6.1-sol.md) | gpt-6.1-sol |
| [prompts/codex/gpt-daybreak-blue-latest.md](prompts/codex/gpt-daybreak-blue-latest.md) | gpt-daybreak-blue-latest |
| [prompts/codex/gpt-daybreak-red-latest.md](prompts/codex/gpt-daybreak-red-latest.md) | gpt-daybreak-red-latest |
| [prompts/codex/compact-prompt.md](prompts/codex/compact-prompt.md) | Compaction request |
| [prompts/codex/compact-summary-prefix.md](prompts/codex/compact-summary-prefix.md) | Compaction summary prefix |

The catalog files are generated from a Codex checkout; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Free-form patches

Codex presents `apply_patch` to GPT models as a free-form grammar tool rather than a JSON function. This package can reproduce that behavior on any provider that speaks the OpenAI Responses API, including the ChatGPT subscription, OpenRouter and compatible endpoints. The feature is disabled by default. See [docs/freeform.md](docs/freeform.md).

## Documentation

- [Configuration](docs/configuration.md)
- [Free-form patches](docs/freeform.md)
- [Differences from Codex](docs/differences.md)
- [Benchmark](docs/benchmark.md)
- [Changelog](CHANGELOG.md)

## Development

```sh
pnpm install
pnpm build
pnpm test
```

The tests require a DSH installation (`npm install -g @deepseek-ai/dsh`). [CONTRIBUTING.md](CONTRIBUTING.md) describes how to link a local build into a test profile and how to run the evaluation.

## License

Apache-2.0. Attribution for the bundled Codex material is in [NOTICE](NOTICE).
