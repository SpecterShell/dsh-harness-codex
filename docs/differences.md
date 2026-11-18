# Differences from Codex

This preset follows [OpenAI Codex](https://github.com/openai/codex) at commit [0184dfa6](https://github.com/openai/codex/tree/0184dfa6a48f0110dd9c6835522492908e5abcf3). It runs inside DeepSeek Harness with DSH's agent loop, sandbox and approvals, so some behaviors differ. Each item below states the reason.

## exec_command and write_stdin

- The `shell` and `login` options are absent, because the DSH shell service always runs bash and has no login mode.
- The `prefix_rule` and `with_additional_permissions` options are absent, because DSH approvals have no equivalent.
- `require_escalated` runs that one command in DSH's `danger-full-access` mode after approval. This is the closest DSH mode to Codex's unsandboxed execution.
- Without a TTY, stderr follows stdout rather than interleaving with it, because DSH returns the two streams separately.
- Tokens are counted as bytes divided by 4, rounded up, as Codex does. DSH's token meter only measures whole messages.
- A session belongs to the agent that started it. One copy of the plugin serves every agent using the preset, so another agent cannot use the session identifier.
- `write_stdin` maps a bare Ctrl-C (`\u0003`) on a non-TTY session to killing the process. Codex sends SIGINT; the DSH shell service only exposes termination, so the signal differs.

## apply_patch

By default `apply_patch` is a JSON function with an `input` field. Codex presents GPT models with a free-form grammar tool. The Codex form can be enabled per provider and model; see [freeform.md](freeform.md).

## update_plan and view_image

- `update_plan` accepts several steps marked `in_progress`. Codex's description asks for one, but its handler accepts more, and this adapter follows the handler.
- `view_image` accepts only `path`. Codex adds `detail` and `environment_id` for some models, for which DSH has no equivalent.

## Prompts

GPT models receive the prompt Codex uses for that model, taken from Codex's model catalog. Unknown GPT-style models receive Codex's fallback prompt. Every other model receives [prompts/original.md](../prompts/original.md), because Codex's prompts describe Codex itself.

The Codex prompts mention Codex features this preset does not provide, such as hosted web search.

## Instructions and context

- DSH retains two user-level instruction roots, `~/.dsh/AGENTS.md` and the shared agents home. Codex reads one Codex home, preferring `AGENTS.override.md`.
- Codex joins user and project documents into one `# AGENTS.md instructions` block. In this preset they arrive as separate system-reminder messages, with `--- project-doc ---` starting the project message.
- Project documents load regardless of project trust and are re-read at every step. Codex skips untrusted projects and re-reads project documents only when the environment selection changes.
- The project budget is 32 KiB, as in Codex. DSH additionally applies 32 KiB to the user-level file; Codex places no budget on user instructions.
- When the budget cuts a project file inside a multi-byte character, this preset stops before the character. Codex cuts at the byte and may display a replacement character.
- Compaction follows Codex's local rule: the model receives a summary, then the newest original user messages that fit in 20,000 tokens, in chronological order. Tool results and other steps are dropped, and an older summary is replaced rather than kept as a user message. DSH's leading system and developer messages remain in place instead of being rebuilt from the session configuration.
- Automatic compaction runs before a step at 90% of the model's context window. Codex can also compact at a separate turn-end threshold or in the background, which this preset leaves to the step boundary. The prompt that started the turn is not on the session surface yet, so it arrives after the summary instead of counting as a kept user message. Automatic compaction is skipped when it would not shrink the context; manual compaction always proceeds.
- Tools contributed by the profile are hidden, so the model sees the Codex surface and nothing else. Exceptions can be permitted; see [configuration.md](configuration.md).
