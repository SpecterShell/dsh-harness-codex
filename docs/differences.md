# Differences from Codex

This preset follows [OpenAI Codex](https://github.com/openai/codex) at commit [ca21fe65](https://github.com/openai/codex/tree/ca21fe65d18a9b6326759fb4263c65dfbb645aa5). It runs inside DeepSeek Harness with DSH's agent loop, sandbox and approvals, so some behaviors differ. Each item below states the reason.

## exec_command and write_stdin

- The `shell` and `login` options are absent, because the DSH shell service always runs bash and has no login mode.
- The `prefix_rule` and `with_additional_permissions` options are absent, because DSH approvals have no equivalent.
- `require_escalated` runs that one command in DSH's `danger-full-access` mode after approval. This is the closest DSH mode to Codex's unsandboxed execution.
- Without a TTY, stderr follows stdout rather than interleaving with it, because DSH returns the two streams separately.
- Tokens are counted as bytes divided by 4, rounded up, as Codex does. DSH's token meter only measures whole messages.
- A session belongs to the agent that started it. One copy of the plugin serves every agent using the preset, so another agent cannot use the session identifier.
- `write_stdin` maps a bare Ctrl-C (`\u0003`) on a non-TTY session to killing the process. Codex sends SIGINT. The DSH shell service only exposes termination, so the signal differs.

## apply_patch

By default `apply_patch` is a JSON function with an `input` field. Codex presents GPT models with a free-form grammar tool. The Codex form can be enabled per provider and model. See [freeform.md](freeform.md).

The tool itself is this package's port of Codex's parser and text updater, so it produces the same file results: BOMs and per-line endings survive, fuzzy matches keep the source spelling of context lines, an empty patch is rejected, and `*** End of File` inserts after the last line. Three differences remain, all in how a call is reported:

- The tool returns DSH's structured commit value and renders the text from it. A successful patch prints Codex's `Success. Updated the following files:` block with `A`, `M` and `D` lines, though the paths are resolved paths rather than the spelling used in the patch. A stopped patch prints the operation report (completed, failed, not executed), where Codex stops at the failure and returns its error text.
- The DSH Web UI presents the call in its tool card and shows the rendered result text. The diff card the native DSH patch tool registered is not part of this row; Codex renders the patch diff in its own terminal interface.
- A sandbox denial and a refused escalation use DSH's text. A denial arrives as `Patch rejected before any change (N problems): ...` followed by the filesystem's own message, and a refused approval reads `the user rejected writing this patch without the sandbox`.

## update_plan and view_image

- `update_plan` accepts several steps marked `in_progress`. Codex's description asks for one, but its handler accepts more, and this adapter follows the handler.
- `view_image` accepts only `path`. Codex adds `detail` and `environment_id` for some models, for which DSH has no equivalent.

## Prompts

All four presets mount the same persona row, so they pick the system prompt the same way. GPT models receive the prompt Codex uses for that model, taken from Codex's model catalog. Unknown GPT-style models receive Codex's fallback prompt. Every other model receives [prompts/original.md](../prompts/original.md), because Codex's prompts describe Codex itself.

The persona is a complete prompt by default: it replaces every inherited prompt section. Codex PTC sets `complete: false` so the PTC transport instructions and tool SDK, which come from rows outside the persona, render below the Codex prompt.

The Codex prompts mention Codex features this preset does not provide, such as hosted web search.

## Codex PTC

The `codex-ptc` preset exposes the same Codex tools through `run_code`: `run_code` is the only tool the model calls directly, and every other tool in the preset is reached from inside the program. Because the transport rejects any other direct tool call, the free-form patch bridge stays off; there is no direct `apply_patch` call for a grammar tool to replace.

## Instructions and context

- DSH retains two user-level instruction roots, `~/.dsh/AGENTS.md` and the shared agents home. Codex reads one Codex home, preferring `AGENTS.override.md`.
- Codex joins user and project documents into one `# AGENTS.md instructions` block. In this preset they arrive as separate system-reminder messages, with `--- project-doc ---` starting the project message.
- Project documents load regardless of project trust and are re-read at every step. Codex skips untrusted projects and re-reads project documents only when the environment selection changes.
- The project budget is 32 KiB, as in Codex. DSH additionally applies 32 KiB to the user-level file. Codex places no budget on user instructions.
- When the budget cuts a project file inside a multi-byte character, this preset stops before the character. Codex cuts at the byte and may display a replacement character.
- Compaction follows Codex's local rule: the model receives a summary, then the newest original user messages that fit in 20,000 tokens, in chronological order. Tool results and other steps are dropped, and an older summary is replaced rather than kept as a user message. DSH's leading system and developer messages remain in place instead of being rebuilt from the session configuration.
- Automatic compaction runs before a step at 90% of the model's context window. Codex can also compact at a separate turn-end threshold or in the background, which this preset leaves to the step boundary. The prompt that started the turn is not on the session surface yet, so it arrives after the summary instead of counting as a kept user message. Automatic compaction is skipped when it would not shrink the context. Manual compaction always proceeds.
- Tools contributed by the profile follow each preset's surface rule. Codex mode and Creator hide every host tool except the names listed in `allow`; Codex+ and PTC deny only the built-ins that duplicate a Codex tool, so tools from plugins installed later stay available. See [configuration.md](configuration.md).
