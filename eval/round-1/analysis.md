# Round 1 analysis: preset comparison

Forty runs, ten tasks on each preset and model, all passed the automatic check,
all in one turn, with no questions and no approval. The suite cannot separate
the presets on correctness. It does show what each preset spent: Codex-inspired
used fewer tool calls and less wall time than Standard on both models.

| Slice | Tool calls, total / median | Tokens, total / median | Wall time, total / median |
| --- | --- | --- | --- |
| Codex-inspired, DeepSeek | 85 / 8 | 304,328 / 23,850 | 2m 45s / 13.5 s |
| Standard, DeepSeek | 117 / 12 | 1,001,418 / 99,997 | 2m 51s / 15.5 s |
| Codex-inspired, GPT | 50 / 5 | approx. 381K / 38.3K | 6m 16s / 36 s |
| Standard, GPT | 149 / 15.5 | approx. 1.05M / 87.9K | 11m 16s / 67 s |

Medians average the fifth and sixth sorted per-task values; totals are the sums
of the ten task rows in [results.md](results.md), where the arithmetic inputs
are listed. On DeepSeek, Codex-inspired made 27% fewer calls, 85 against 117,
and finished six seconds faster over ten tasks, which is noise. On GPT the gap
is large: 50 calls against 149, 6m 16s against 11m 16s, median turn 36 seconds
against 67. The GPT Codex runs read several files per command and patched
once; the Standard runs took more, smaller steps.

Token figures are not comparable across slices. The DeepSeek Codex slice summed
usage events, the DeepSeek Standard slice read the Usage popover, and the GPT
slices recorded only a UI total with no input/output split. In the Codex slice
the total is much larger than `in + out`, so the split and the total do not use
the same accounting. Codex-inspired totals are near a third of Standard totals
on both models, but accounting and extra test-writing explain part of that.
Treat the direction as reliable and the size as uncertain. Full per-run numbers
are in [results.md](results.md).

## Rubric differences

All forty runs read before editing, and none touched the decoy in task 01, the
legacy billing module in task 06, or `vendor/` in task 07. The difference was
batching. GPT Codex often finished in three to five calls, while DeepSeek
Standard often needed ten to seventeen for the same task. Both routes satisfy
the inspection item.

Failure reproduction separates runs more than presets. Task 03 was reproduced
first by DeepSeek Codex, DeepSeek Standard and GPT Standard. GPT Codex read the
failing assertions but did not run the suite, and said so. Task 06 asked for
the `TypeError` to be reproduced; none of the four recorded doing it, and only
the GPT files mention skipping it. The DeepSeek runs leave that item
unevidenced.

Diffs stayed small. DeepSeek Standard task 03 rewrote `pricing.py` with
`Decimal` and `ROUND_HALF_UP`, nine added lines and two removed, where two
runs made the same fix in four changed lines. GPT Standard task 06 inserted
`tax_rate` before `include_tax`, shifting the meaning of a third positional
argument. Both DeepSeek runs on task 10 handled bare
`YYYY-MM-DD` strings beyond the prompt, and GPT Standard task 01 strengthened
an unrequested test. Test additions varied by run rather than preset.

Every run re-ran the suite and quoted output it had seen; no report
overclaimed. Extra verification varied: timezone sweeps in task 10,
config-shape checks in task 09, manual CLI runs in task 08. GPT Codex was
leaner, with one ad hoc check in task 09. DeepSeek Codex task 04 paid the full
14.4 second export in the foreground and reported it, while the other three
overlapped it with tests.

Task 07 exposed a loading difference. DeepSeek Codex found and read both
`AGENTS.md` files, and both GPT runs read them explicitly, but DeepSeek
Standard had them injected as reminders and never searched. The check passes
either way, so the task measures instruction loading as well as compliance. On
the awkward commands, all four handled both. The slow export was a long
foreground yield in DeepSeek Codex, a `write_stdin` resume in GPT Codex, or a
background job in both Standard runs. The wizard was a TTY with `write_stdin`
in both Codex runs and piped stdin in both Standard runs. No config was
hand-written and no process was left behind.

## Harness problems

These belong to the evaluation setup. Preset, model, effort and workspace are
shared server state, so each browser client changes them for the
others. The first DeepSeek Standard task 04 run displayed DeepSeek at High
while the request that reached the model was `openai-codex` / `gpt-6.1-sol` /
`low`; it was discarded and re-run. A workspace path was overwritten mid-typing
in DeepSeek Codex task 02, and one header briefly showed Standard mode for a
Codex run.

New sessions start on Standard and Workspace Write. Adding or switching the
workspace can reset model and effort, and selecting Codex-inspired on the GPT
slice reset the model to DeepSeek High. Full access was selected again for each
task. The order that held was workspace, preset, access, then model and effort,
with the request header checked in the session log before counting.

The composer flattened pasted line breaks to spaces, so the GPT Standard
prompts kept their wording but lost paragraph breaks. One model request failed
with `ECONNRESET` during GPT Standard task 01 and the turn retried and
finished; GPT Codex task 01 also showed a retry banner for two seconds and
finished. Shared patchright snapshots, the trajectory view stripping leading
underscores from file names, and several session logs per workspace were
smaller irritations.

## Limits

All forty runs passed, so the checks do not discriminate. One run per cell,
with no repeats or interleaving, leaves provider noise unmeasured. The tasks
are small and single-turn, mostly under 300 lines except task 08. The free-form
patch bridge was on only for GPT Codex-inspired, so its edit path differs from
the other three by construction. Full access everywhere means no approval
handling was exercised. Tokens were measured differently per slice, and effort
differed by model (High against Medium), so model and effort are not separated.

## For a second round

1. Make the checks discriminate: hidden tests, or a plausible wrong fix that
   still passes the visible suite, with rubric items scored separately. Forty
   passes out of forty cannot separate them.
2. Isolate state and repeat: one server and profile per slice, or per-session
   composer state, with the request header asserted before a run is recorded.
   Then run three repeats per cell in randomized order and report medians.
3. Add difficulty where the presets should diverge: a requirement change
   mid-run, a Workspace Write task that needs approval, a flaky suite, a larger
   repository. Use the same edit bridge and effort everywhere, and collect usage
   events uniformly.
