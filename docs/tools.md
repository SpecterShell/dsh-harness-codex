# Tools

[简体中文](tools.zh-Hans.md)

The presets expose five tools. Their names, parameters and output text follow Codex, so models trained on Codex can use them directly.

## exec_command

Runs a shell command in a new process and returns its output. A command that is still running when the wait ends returns a session identifier instead of an exit code, and the session continues in the background.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `cmd` | string | required | Shell command to execute. |
| `workdir` | string | turn's working directory | Working directory for the command. |
| `tty` | boolean | `false` | `true` allocates a PTY. Omitted or `false` uses plain pipes. |
| `yield_time_ms` | number | 10000 | Wait before yielding output. Effective range is 250–30000 ms. |
| `max_output_tokens` | number | 10000 | Output token budget. Larger requests are capped. |
| `sandbox_permissions` | string | `use_default` | `require_escalated` retries the command outside the sandbox, after user approval. Only present when the deployment confines commands. |
| `justification` | string | — | One sentence for the user, required with `require_escalated`. |

Every call starts a fresh process: `cd`, exported variables and shell functions do not carry over to the next call. Output is collected incrementally, so a session's replies never repeat or lose bytes. Output is capped at 1 MiB per process, and each reply is truncated to its token budget in Codex's format, keeping the head and tail.

A reply looks like:

```text
Chunk ID: 3f2a91
Wall time: 10.0000 seconds
Process running with session ID 15893
Original token count: 42
Output:
tick 1
```

When the command has finished, the reply carries `Process exited with code N` and no session identifier.

## write_stdin

Polls a running session for new output, or sends input to one started with `tty: true`.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `session_id` | number | required | Identifier from a running `exec_command` reply. |
| `chars` | string | empty | Bytes to write to the session. Empty polls without writing. |
| `yield_time_ms` | number | 250 | Wait before yielding. Writes cap at 30000 ms, and empty polls clamp to 5000–300000 ms. |
| `max_output_tokens` | number | 10000 | Output token budget. |

Sessions belong to the agent that started them, so a session identifier cannot be used from another agent. Non-TTY sessions close their stdin: writing ordinary text fails, and the bare control character `Ctrl-C` ends the process. Sessions that finish keep their final output available for one last poll, and are dropped afterwards. An agent may hold at most 64 sessions. The oldest are terminated when the cap is reached, and ending the agent or unloading the preset terminates everything it left running.

The reply uses the same format as `exec_command`, with the output produced since the previous reply for that session.

## apply_patch

Creates, updates, moves and deletes UTF-8 text files with a Codex patch:

```text
*** Begin Patch
*** Update File: src/app.ts
@@
-const old = true
+const old = false
*** End Patch
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `input` | string | required | The patch text. |
| `sandbox_permissions` | string | `use_default` | `require_escalated` retries the patch outside the sandbox, after user approval. Only present when the deployment confines file writes. |
| `justification` | string | — | One sentence for the user, required with `require_escalated`. |

The grammar supports `*** Add File`, `*** Update File`, `*** Delete File` and `*** Move to:`. The whole patch is checked before anything is written, and a rejected patch changes nothing. When application starts, operations run in order and stop at the first failure. There is no rollback, so the report lists what was already changed:

```text
Success. Updated the following files:
- update src/app.ts
- add src/util.ts
```

A partial failure reports the completed operations first, then the failed one with its patch line, then the ones that were not executed.

The implementation is DSH's own, including its permission checks. With the free-form bridge enabled, GPT models receive this tool in Codex's grammar form. See [freeform.md](freeform.md).

## update_plan

Replaces the session's plan, shown in the To-dos panel.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `plan` | array | required | The steps. Each item has a `step` text and a `status` of `pending`, `in_progress` or `completed`. |
| `explanation` | string | — | Optional explanation for this plan update. |

The reply is `Plan updated`. The plan is stored in the DSH todo projection, so it appears in the To-dos panel and survives session replay.

## view_image

Reads a local image file and attaches it to the conversation so the model can see it.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | string | required | Local filesystem path to an image file. |

PNG, JPEG, WebP and GIF are accepted, subject to the deployment's size and pixel limits. The tool refuses models without image input. A downscaled image reports the scale factor so coordinates can be converted back to the original file. The reply carries the image as an attachment, with a text envelope:

```text
<path>/tmp/diagram.png</path>
<type>image</type>
<content>
image/png image, 96x96 px, 356 bytes
</content>
```
