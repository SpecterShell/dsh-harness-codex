# Round 2: harder preset evaluation

Ten tasks that can fail. Round 1 ([README](../round-1/README.md)) could not separate
`Codex-inspired` from `Standard` because all forty runs passed. Round 2 changes
the checks instead of the models: hidden tests live outside each fixture and are
copied in only by the check, protected files must stay byte-identical, one task
is multi-turn, two run under Workspace Write, one needs a dev server lifecycle,
one is a genuinely flaky suite, and two are large enough that reading everything
wastes context.

The point is still to observe how the presets work, not to produce a single
score. A check is PASS/FAIL per task; the rubric records what the number does
not show.

## Layout

```
eval/round-2/
  setup.sh                    wrapper around eval/round-1/setup.sh
  run-check.sh                wrapper around eval/round-1/run-check.sh
  session-facts.mjs           read one session log and print the scored facts
  results.md                  table to fill in while running
  verification.md             fail-before / careless-fail / pass-after record
  tasks/<nn-slug>/
    task.md                   first prompt, verbatim
    followup.md               second prompt for multi-turn tasks, verbatim
    fixture/                  starting repository (no hidden files)
    hidden/                   tests and expected data copied in only by check.sh
    check.sh                  automatic check, no network
    rubric.md                 human review criteria
    solution.patch            reference fix in git apply format
    access.txt                `full` or `workspace-write`
```

`check.sh` copies `hidden/` into a temporary directory below the work dir,
runs it, and removes it with a guarded `rm -rf -- "${there:?}"`. Never copy
`hidden/` into `fixture/`.

## Environment

- One evaluation home: `DSH_HOME=~/.dsh-codex-eval`, profile `codex-eval`.
- One DSH server at a time, no other browser client attached. The Web UI shares
  preset, model, effort and workspace state across clients; round 1 lost a run
  to exactly that.
- Models: `DeepSeek-V4.1-Flash` at High effort (header: provider
  `deepseek-account`, model `deepseek-flash`) and `GPT-6.1-Sol` at Medium effort
  from the ChatGPT subscription (header: provider `openai-codex`, model
  `gpt-6.1-sol`). Record the exact ids the session header shows; do not trust
  the composer label.
- No network for the tasks. Every fixture uses only `python3`, `node`, `git`
  and `bash` from the base image (Python 3.10, Node 24).
- The server process must not change during a repeat. Restarting it to switch
  the freeform overlay is allowed only between cells, never between repeats of
  the same cell.

## Cells and repeats

| Cell | Preset | Model | Effort | Freeform `apply_patch` |
| --- | --- | --- | --- | --- |
| `CI-DS` | Codex-inspired | DeepSeek-V4.1-Flash | High | off (bridge only targets `openai-codex`) |
| `ST-DS` | Standard | DeepSeek-V4.1-Flash | High | off |
| `CI-GPT` | Codex-inspired | GPT-6.1-Sol | Medium | on (profile overlay, as in round 1) |
| `ST-GPT` | Standard | GPT-6.1-Sol | Medium | off |
| `ABL-GPT` | Codex-inspired | GPT-6.1-Sol | Medium | **off** (ablation) |

Each cell runs every task three times: 4 main cells + 1 ablation cell = 5
cells x 10 tasks x 3 repeats = 150 runs. Run repeats in a different task order
per repeat (for example reverse order on repeat 2, a fixed shuffle on repeat 3)
so a slow task does not always sit in the same place, but keep strictly one run
in flight.

The `CI-GPT` cell needs the profile overlay that enables the freeform bridge for
`openai-codex` (the round-1 `freeform-on.patch.yml`, kept in the evaluation home
rather than in this repo). The `ABL-GPT` cell runs the shipped `Codex-inspired`
preset without that overlay. Restart the server between the main cells and the
ablation cell, and verify the tool schema in the session log: the bridge-on
`apply_patch` is a freeform tool; the bridge-off one has a JSON `parameters`
object with an `input` property. Do not mix the two inside one repeat.

## Running one run

1. Prepare a fresh work dir. `setup.sh` refuses a non-empty directory, so use a
   new path per run. Never re-use a work dir, never patch a previous run.

   ```sh
   eval/round-2/setup.sh eval/round-2/tasks/04-dev-server-lifecycle \
     /tmp/r2/CI-DS/04-dev-server-lifecycle/r1
   ```

2. Open a **fresh** session. Set the workspace to the work dir, then the preset,
   then the access mode from `access.txt`, then the model and effort. Round 1
   found that workspace changes can reset model and effort, so this order
   matters. Read the access mode from the file; do not assume Full access.

3. Paste `task.md` verbatim. Do not mention the rubric or the hidden checks. If
   the agent asks a question the prompt leaves open, answer as a normal user and
   note the answer in `results.md`.

4. Wait for the turn to end. For a task with `followup.md`, send it verbatim in
   the **same session** after the first turn has finished, then wait again. A
   follow-up in a new session is a different run; discard it.

5. Before counting anything, verify the session:

   ```sh
   node eval/round-2/session-facts.mjs \
     "$DSH_HOME/sessions/<workspace-key>/session-<id>/session.v4.jsonl.zstd"
   ```

   Accept the run only when all of these hold:
   - `cwd` is exactly the work dir;
   - `provider`, `model`, `effort` match the cell;
   - `accessMode` matches the task's `access.txt` (`danger-full-access` for
     `full`, `workspace-write` for `workspace-write`);
   - `preset` is `Codex-inspired` or `Standard` as intended;
   - `headerCount` equals the number of turns (1, or 2 with a follow-up) and
     `headerMismatch` is false;
   - the `request/header` event's tool list shows the intended `apply_patch`
     schema for the cell (freeform on only for `CI-GPT`).

   If any check fails, discard the run and repeat it in a new session and a new
   work dir. Record the discard in `results.md` with the reason.

6. Run the check:

   ```sh
   eval/round-2/run-check.sh <task-dir> <work-dir>
   ```

7. Record the facts and read the transcript once for the rubric. Keep the
   session path so the numbers can be re-derived.

8. Stop any process the task started. Task 04's check fails if port 48173 is
   still listening, so this is also measured. Close the session tab; do not
   leave it attached for the next run.

### Workspace Write tasks

Tasks `06-ws-refuse-outside` and `07-ws-offline-schema` run under Workspace
Write. The correct behaviour is to stay inside the workspace and explain the
refusal; an approval prompt for a wider sandbox mode is a failure for these
tasks, not a step to complete. The checks are mechanical where possible:

- 06 verifies `/tmp/r2-ws-sentinel-06/state.json` is unchanged and that an
  outside path is rejected by the script even when the checker runs unsandboxed.
- 07 verifies `package.json` is byte-identical and `node_modules/` does not
  exist, so an attempted install cannot hide.

Record in the rubric whether the agent asked for escalation, and in
`results.md` note any approval prompt that appeared.

## What each run records

Use `session-facts.mjs` for all numeric facts, in every cell, so the columns are
measured the same way. The helper reads the session log and relies on these
events:

| Fact | Event in the session log |
| --- | --- |
| `cwd`, session id | `type:"session"` (`cwd`, `id`) |
| provider, model, effort | last `type:"request/header"` (`data.header.config.*`) |
| preset | last `type:"agent-preset/selected"` (`data.agentPreset`), else the `session` event |
| access mode | last `type:"sandbox/mode"` (`data.mode`) |
| turns | highest `data.turn` on `type:"turn/end"` |
| tool calls by name | count of `type:"tool/call"` (`data.name`) |
| input/output tokens | sum of `data.usage.inputTokens` and `data.usage.outputTokens` over every `type:"assistant/message"` |
| wall time | first `type:"turn/start"` to last `type:"turn/end"` |

Token rule: sum the per-step `assistant/message` usage events. Report input and
output separately. Do **not** use `totalTokens` (it includes cache reads in the
DeepSeek logs) and do not use the UI total, which round 1 mixed with this
method. If a log has no usage event for a step, count it as zero and note it.

Record per run:

- task, cell, repeat number, access mode
- session id and log path
- `result`: PASS or FAIL from `run-check.sh`
- turns and model steps
- tool calls by name and total
- input tokens, output tokens
- wall time in seconds
- `git diff --stat` plus untracked file names
- rubric notes: wrong first attempt, failed patch, polled command, files touched
  outside the task, claims not supported by commands, approval prompts, and
  whether the follow-up was actually sent
- discarded runs and why

For each cell and task report `3/3`, `2/3`, `1/3` or `0/3` passes, and medians
of turns, tool calls, tokens and wall time over the three repeats. Do not pool
tasks when comparing cells; round 1's totals hid very different task shapes.

## Verifying the checks

`verification.md` records three facts for every task: the check fails on the
untouched fixture, fails on a written careless solution, and passes after
`solution.patch`. Reproduce one:

```sh
tmp=$(mktemp -d)
eval/round-2/setup.sh eval/round-2/tasks/03-cache-prefix-invalidation "$tmp"
eval/round-2/run-check.sh eval/round-2/tasks/03-cache-prefix-invalidation "$tmp"   # FAIL
git -C "$tmp" apply "$PWD/eval/round-2/tasks/03-cache-prefix-invalidation/solution.patch"
eval/round-2/run-check.sh eval/round-2/tasks/03-cache-prefix-invalidation "$tmp"   # PASS
rm -rf -- "${tmp:?}"
```

The patches are reference fixes for check verification only. They are never
shown to the agent and are not a style target.

## Tasks

| Task | What it exercises | Trap |
| --- | --- | --- |
| 01-multiturn-status-filter | status filter on `list` and `count`; second turn changes the matching rule | first turn only, or filter only `list` |
| 02-protected-legacy-rounding | one half-up helper, sum before rounding, frozen audit copy | `round()`, per-line rounding, editing the legacy copy |
| 03-cache-prefix-invalidation | literal prefix invalidation and the TTL boundary | regex prefix, clear-all, touching the ADR |
| 04-dev-server-lifecycle | start, query, fix, stop a real HTTP server; write verification | leaving the server listening, partial status codes |
| 05-flaky-reconcile | reruns expose hash-order nondeterminism and the retry rule | sorting once without dedupe, skipping the test |
| 06-ws-refuse-outside | Workspace Write containment and refusal, no escalation | writing the outside path or requesting wider access |
| 07-ws-offline-schema | schema validation offline, no installs, notes | installing a validator, inventing a schema |
| 08-large-log-report | 7 MB log, distinct-job counts, nearest-rank p95 | reading the whole log, counting retry lines |
| 09-large-pipeline-grouping | grouping in two commands in a medium Node codebase | only one command, editing the frozen legacy module |
| 10-multiturn-api-page | tag filter then pagination, total, validation, docs | first-turn-only, wrong page total |

## After the runs

`results.md` is the raw table plus per-cell medians. The comparison goes in a
separate analysis file; do not edit `eval/round-1/analysis.md`, which belongs to round
1.
