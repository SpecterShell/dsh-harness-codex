# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The settings card edits the free-form rules as a list: each configured rule has its own remove control, configured providers and models can be picked from the live DSH model catalog, and a wildcard input adds rules the pickers do not list. The stored `freeformRules` text keeps the same newline-joined form, so existing values, the host schema and the freeform bridge are unchanged.

### Fixed

- The settings card on the plugin's detail page renders with its intended row padding, hairline separators and label and hint typography again. Its class selectors no longer begin with the scoped package name, which browsers dropped as invalid.

## [0.1.2] - 2026-11-18

### Added

- Prompts for GPT-6.2-Sol and GPT-6.2-Astra from Codex's catalog. The bundled prompts now follow Codex commit ca21fe65.

### Fixed

- The settings card's styles render again after the package rename; its CSS class names no longer contain characters that break selectors.

## [0.1.1] - 2026-11-18

### Changed

- The package is renamed to `@spectershell/dsh-harness-codex`.

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

[0.1.2]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.2
[0.1.1]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.1
[0.1.0]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.0
