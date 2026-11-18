# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The package is now written in TypeScript and ships compiled JavaScript and type declarations in `lib/`. Plugin entry points keep their names.
- Project instruction loading now follows Codex: `AGENTS.override.md` wins over `AGENTS.md` in each directory, files load from the project root to the working directory under Codex's 32 KiB budget, and user-level instructions still come from DSH.
- Compaction now follows Codex's local rule: the newest original user messages up to 20,000 tokens plus a summary. `/compact` uses the same engine.
- The documentation was rewritten in a formal register and reorganized. Planning notes and validation logs were removed from the package. Configuration, free-form patches, differences from Codex and the benchmark are now available in Simplified Chinese, linked from the Chinese README.

### Added

- A settings card on the Plugins page for free-form patch rules, the tools kept visible and the project instruction budget. It is backed by a live `codexSettings` service, so saved values reach the preset rows without a restart.
- `write_stdin` accepts Codex's bare Ctrl-C input on a non-TTY session and ends the process.

### Fixed

- `exec_command` no longer leaves a process running when the turn is cancelled after the wait or when output collection fails, and `write_stdin` kills the process when a write or read fails.
- Processes of a disposed agent are terminated instead of running until the preset unloads.
- TTY commands now get Codex's environment overrides (no colors, no pagers) and their buffered output is capped at 1 MiB like the pipe path.
- Automatic compaction skips a replacement that would not shrink the context, so small-window sessions no longer pay for a summary call at every step.
- A failed session save after a successful compaction no longer records a second, failed close marker.
- The free-form bridge leaves auxiliary requests (compaction summaries, titles) alone and restores the adapter correctly when another wrapper sits on top.
- `view_image` maps two more attachment-store errors (`IMAGES_TOO_LARGE`, `UNSUPPORTED_IMAGE_TYPE`) to actionable messages.
- A settings page on the plugin's detail page and a matching Settings form. Free-form patch rules, the surface allow list and the instruction budget apply live without a restart.
- A Codex-extended preset that hides only the built-in tools overlapping with the Codex ones and keeps other host tools available.
- CI on Linux and macOS, CodeQL, OpenSSF Scorecard and Dependabot.
- Releases publish to npm with provenance and attach the package tarball, an SBOM and checksums, with build provenance and SBOM attestations.

## [0.1.0] - 2026-11-17

### Added

- The Codex-inspired agent preset.
- `exec_command` and `write_stdin`, with one process per command, session ids for running commands, TTY sessions and Codex's output format.
- `update_plan` on top of DSH's to-do list, and `view_image` on top of DSH's image reader.
- Codex's per-model system prompts for GPT models, and an original prompt for other models.
- Hiding of profile tools inside the preset.
- Opt-in free-form `apply_patch` for OpenAI Responses API routes.

[Unreleased]: https://github.com/SpecterShell/dsh-harness-codex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SpecterShell/dsh-harness-codex/releases/tag/v0.1.0
