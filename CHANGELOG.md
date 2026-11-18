# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The presets now carry the per-preset header note the built-in presets use, and each mounts the `time-context` row as the built-ins do.

### Added

- Every preset now mounts the delegation group (subagents, messaging and workflows), matching DSH's standard preset. The Agent Team tools are no longer absent from the Codex presets.

### Changed

- The preset ids were renamed. `codex` is now the preset that keeps non-conflicting host tools (previously `codex-extended`), and the strict preset that hides them is `codex-strict`. `codex-ptc` and `codex-creator` now use the same fixed deny list as `codex`, so tools from plugins installed later stay available in every preset except `codex-strict`. The `cordis.patch.yml` row ids are unchanged.

## [0.2.1] - 2026-11-18

### Fixed

- The provider and model dropdowns on the settings page populate again. The client now injects the remotes plugin, without which the catalog call never ran.
- The documentation describes the current code: the four presets, this package's own `apply_patch`, and the bundled review-agent skill.

## [0.2.0] - 2026-11-18

### Changed

- `apply_patch` is now this package's own Codex-faithful implementation, replacing the native `dsh-tool-fs` row. It preserves UTF-8 BOMs and per-line endings (including CR-only files), keeps source context lines on fuzzy matches, appends insertions at the true end of file, and rejects empty patches, matching Codex HEAD.
- The presets are renamed. `codex-inspired` is now `codex` with the display name **Codex mode**, and `codex-extended` keeps its id with the display name **Codex+ mode**. The `cordis.patch.yml` row ids (`preset-codex-inspired`, `preset-codex-extended`) are unchanged, so existing profile overrides keep targeting the same rows.

### Added

- The **Codex PTC** preset (`codex-ptc`) reaches the Codex tools through `run_code`, carries the delegation group from DSH's standard preset, keeps the inherited prompt below the Codex persona and leaves the free-form patch bridge off.
- The **Codex Creator** preset (`codex-creator`) adds the tools for writing DSH plugins to the strict Codex set: Cordis runtime inspection, the skill loader, and the plugin manager and market tools when the profile exposes a plugin context.
- The `review-agent` skill, adapted from Codex's review-agent sample under the Apache License 2.0. The Codex mode, Codex+ mode and Creator presets mount a skill provider for this package's `skills/` directory and the `skill` tool.
- The settings card edits the free-form rules as a list: each configured rule has its own remove control, configured providers and models can be picked from the live DSH model catalog, and a wildcard input adds rules the pickers do not list. The stored `freeformRules` text keeps the same newline-joined form, so existing values, the host schema and the freeform bridge are unchanged.

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

[0.2.1]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.2.1
[0.2.0]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.2.0
[0.1.2]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.2
[0.1.1]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.1
[0.1.0]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.0
