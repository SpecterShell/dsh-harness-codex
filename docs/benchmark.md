# Benchmark

This document compares the Codex-inspired preset with DSH's Standard preset on the same models. The tasks, scripts and raw notes are in [eval/](../eval/).

## Round 1 (2026-11-17)

Run with DSH 0.2.2-rc.1 and dsh-harness-codex 0.1.0.

- Ten coding tasks in Python and Node: bug fixes, a rename across files, failing tests, a slow export, an interactive setup wizard, a half-finished refactor, nested `AGENTS.md` rules, an 824-line codebase, an ambiguous configuration and a date refactor.
- Two presets, Codex-inspired and Standard.
- Two models: DeepSeek-V4.1-Flash on High, and GPT-6.1-Sol on Medium through the ChatGPT subscription. Free-form `apply_patch` was enabled for GPT with Codex-inspired.
- One run per task, preset and model, 40 runs in total, each in a fresh session on a fresh copy of the task. Full access, a separate DSH home, no global instructions.

Each task has a check script and a short rubric for reading the transcript.

### Results

All 40 runs passed their checks, each in one turn.

| Preset | Model | Tool calls (total / median) | Wall time (total / median) |
| --- | --- | --- | --- |
| Codex-inspired | DeepSeek-V4.1-Flash | 85 / 8 | 2m 45s / 13.5 s |
| Standard | DeepSeek-V4.1-Flash | 117 / 12 | 2m 51s / 15.5 s |
| Codex-inspired | GPT-6.1-Sol | 50 / 5 | 6m 16s / 36 s |
| Standard | GPT-6.1-Sol | 149 / 15.5 | 11m 16s / 67 s |

On GPT, Codex-inspired made a third of the tool calls and took about half the time. Its runs read several files in one command and patched once, while Standard took more, smaller steps. On DeepSeek, Codex-inspired made 27% fewer calls and the wall time was about the same.

Codex-inspired also used fewer tokens on both models, roughly a third of Standard. The four slices counted tokens differently, so the direction is reliable and the size is approximate. Per-run numbers are in [eval/round-1/results.md](../eval/round-1/results.md).

### Rubric observations

Every run read the code before editing, kept the diff small and reported only what it had run. No run touched the decoy files.

The weakest point was reproducing a failure before fixing it. GPT with Codex-inspired skipped that step on two tasks, and no run clearly reproduced the error in the refactor task.

The two presets handled long and interactive commands differently. Codex-inspired continued the process with `write_stdin` or answered the wizard over a TTY, while Standard used background jobs and piped input. Both approaches succeeded.

### Limits

Every run passed, so this round does not separate the presets on correctness. There was one run per cell, the tasks are small, and nothing ran under approvals. The free-form patch bridge was enabled for only one slice, so part of that slice's advantage may come from the bridge. The full write-up is in [eval/round-1/analysis.md](../eval/round-1/analysis.md).

## Round 2 (2026-11-18)

Run with DSH 0.2.2-rc.3 and dsh-harness-codex at commit `4a0f9bf`. The models are the same as in round 1 and the conditions are stricter.

- Ten tasks built for this round: hidden tests copied in only by the check, protected files that must remain byte-identical, one multi-turn task, two tasks under Workspace Write, a dev-server lifecycle, a genuinely flaky suite and two large fixtures.
- Five cells: Codex-inspired and Standard on DeepSeek-V4.1-Flash (High), Codex-inspired and Standard on GPT-6.1-Sol (Medium), and an ablation cell that repeats the Codex-inspired GPT configuration with the free-form `apply_patch` overlay disabled.
- Three repeats per task and cell, 150 runs in total, each in a fresh session on a fresh copy of the task. One run in flight, no network for the tasks, access mode read from each task's `access.txt`.

### Results

| Cell | Preset | Model | Passes | Tool calls, median | Input tok, median | Output tok, median | Wall time, median |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CI-DS | Codex-inspired | DeepSeek-V4.1-Flash | 30/30 | 16.5 | 6,453 | 7,948.5 | 49.0 s |
| ST-DS | Standard | DeepSeek-V4.1-Flash | 30/30 | 21 | 8,661 | 10,032 | 62.6 s |
| CI-GPT | Codex-inspired | GPT-6.1-Sol | 30/30 | 6.5 | 11,626 | 2,519 | 82.1 s |
| ST-GPT | Standard | GPT-6.1-Sol | 29/30 | 24.5 | 24,389 | 3,138 | 144.5 s |
| ABL-GPT | Codex-inspired, bridge off | GPT-6.1-Sol | 30/30 | 6.5 | 14,068.5 | 2,881.5 | 89.35 s |

Medians are the median of the ten per-task medians in each cell, not sums over tasks. Tasks differ enough in size that totals would be dominated by two of them. The raw runs and the medians per task are in [eval/round-2/results.md](../eval/round-2/results.md).

149 of 150 runs passed. The miss was 05-flaky-reconcile repeat 2 under Standard with GPT. The fix and its evidence were correct, but the command recorded in `docs/testing.md` wrapped the seed loop in `$(... 2>&1)` and the check's extraction turned it into `python3 -m unittest discover -s tests 2`.

The preset gap is large on GPT, where Codex-inspired made about a quarter of Standard's tool calls and took about half the wall time. On DeepSeek it is smaller: 16.5 against 21 calls and 49.0 against 62.6 seconds. The traps held. Protected files stayed identical in every cell, task 06 refused outside paths with the script's own error and left the sentinel absent, no run asked for escalation, the dev server was started and stopped with port 48173 free afterwards, the flaky suite was diagnosed with seeds before any edit, the follow-ups were answered on top of turn one, and the 7 MB log was never printed.

The ablation cell matched CI-GPT run for run, 30/30 with the same median call count. The only observable difference was the wire encoding of `apply_patch`: `ctc_` call ids with the bridge, `fc_` ids without it, while the logged tool schema was identical in both. On this suite the free-form bridge is neutral.

The full analysis, including the trap outcomes and the harness findings for the protocol, is in [eval/round-2/analysis.md](../eval/round-2/analysis.md).
