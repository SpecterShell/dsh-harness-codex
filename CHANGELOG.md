# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-18

First public release, under the Apache-2.0 license.

### Added

- The Codex-inspired preset: `exec_command` and `write_stdin` with one process per command, session ids for running commands, TTY sessions and Codex's output format; `update_plan` on top of DSH's to-do list; `view_image` on top of DSH's image reader; and `apply_patch` from DSH's filesystem tools.
- The Codex-extended preset, which hides only the built-in tools that overlap with the Codex ones and keeps other host tools available.
- Codex's per-model system prompts for GPT models, and an original prompt for other models.
- Codex-style project instructions: `AGENTS.override.md` wins over `AGENTS.md` in each directory, files load from the project root to the working directory under Codex's 32 KiB budget, and user-level instructions still come from DSH.
- Codex-style local compaction: the newest original user messages up to 20,000 tokens plus a summary, with `/compact` on the same engine.
- An opt-in free-form `apply_patch` bridge for OpenAI Responses API routes.
- A settings form on the plugin's detail page and in DSH settings, backed by a live `codexSettings` service, for the free-form rules, the tools kept visible and the project instruction budget.
- CI on Linux and macOS, CodeQL, OpenSSF Scorecard and Dependabot. Releases carry a build-provenance attestation and stage on npm with provenance.

[0.1.0]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.0
