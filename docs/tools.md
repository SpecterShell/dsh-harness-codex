# Tools

[简体中文](tools.zh-Hans.md)

The presets expose five Codex tools. Their names, parameters and output text follow Codex, so models trained on Codex can use them directly. Codex PTC reaches them from inside `run_code`, and Creator adds its own tools.

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

### Examples

#### Fast command

A command that finishes inside the wait returns its exit code and output.

Input

```json
{
  "cmd": "git status --short"
}
```

Output

```text
Wall time: 0.1200 seconds
Process exited with code 0
Original token count: 3
Output:
 M src/app.ts
```

#### Command still running

A command that outlives the wait returns a session identifier. The session continues in the background.

Input

```json
{
  "cmd": "for i in 1 2 3; do echo tick $i; sleep 4; done",
  "yield_time_ms": 250
}
```

Output

```text
Wall time: 0.2500 seconds
Process running with session ID 15893
Original token count: 6
Output:
tick 1
```

When the command has finished, the reply carries `Process exited with code N` and no session identifier.

### Special cases

- Independent processes: two calls share no state, so a `cd` or an export in one is invisible to the next.
- Cancellation while the first wait runs kills the process. Cancellation of a `write_stdin` poll leaves it running.

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

### Examples

#### Poll until exit

Polling the session from the previous example with empty `chars` returns the remaining ticks, then the exit code.

Input

```json
{
  "session_id": 15893,
  "chars": "",
  "yield_time_ms": 10000
}
```

Output

```text
Wall time: 8.0000 seconds
Process exited with code 0
Original token count: 12
Output:
tick 2
tick 3
```

#### Write to a TTY session

A session started with `tty: true` accepts input. A non-TTY session rejects ordinary input with `stdin is closed`.

Input

```json
{
  "session_id": 31020,
  "chars": "codex\n",
  "yield_time_ms": 5000
}
```

Output

```text
Wall time: 0.3500 seconds
Process exited with code 0
Original token count: 11
Output:
codex hello codex
```

### Special cases

- A session identifier from another agent is rejected, as is an identifier whose process has already been collected.
- `Ctrl-C` as the whole `chars` value ends a non-TTY session instead of failing.

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
A src/util.ts
M src/app.ts
```

A partial failure reports the completed operations first, then the failed one with its patch line, then the ones that were not executed.

The implementation is this package's own port of Codex's patch parser and text updater, adapted to DSH's filesystem service and sandbox. It follows Codex's rules: a UTF-8 BOM is preserved, each source line keeps its own ending (CRLF, LF or a lone CR) and a replacement or inserted line takes the file's first ending, context lines matched by the fuzzy passes keep the spelling they have in the file, an empty patch is rejected, and an insertion marked `*** End of File` lands after the file's true last line. The JSON `input` field, the permission checks and the structured result are DSH's. With the free-form bridge enabled, GPT models receive this tool in Codex's grammar form. See [freeform.md](freeform.md).

## update_plan

Replaces the session's plan, shown in the To-dos panel.

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `plan` | array | required | The steps. Each item has a `step` text and a `status` of `pending`, `in_progress` or `completed`. |
| `explanation` | string | — | Optional explanation for this plan update. |

The reply is `Plan updated`. The plan is stored in the DSH todo projection, so it appears in the To-dos panel and survives session replay.

### Examples

#### Update the plan

Input

```json
{
  "plan": [
    { "step": "Inspect the failing test", "status": "completed" },
    { "step": "Fix the bug", "status": "in_progress" },
    { "step": "Run the suite", "status": "pending" }
  ]
}
```

Output

```text
Plan updated
```

### Special cases

- More than one step may be `in_progress`, matching Codex's handler.

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

### Examples

#### View an image

Input

```json
{
  "path": "/tmp/workspace/diagram.png"
}
```

Output

```text
<path>/tmp/workspace/diagram.png</path>
<type>image</type>
<content>
image/png image, 96x96 px, 356 bytes
</content>
```

The model receives the image attachment with the reply.

### Special cases

- A missing file, non-image bytes, or an image over the deployment's limits is rejected with the reason.
