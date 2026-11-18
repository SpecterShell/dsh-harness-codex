# Round 1 results

One row per task, preset and model, filled from the four run files under
`eval/runs/`. Numbers are copied from those files, and sums are labelled as
sums. Where a run file does not record a number, the cell says `not recorded`.

## Run metadata

- Date: 2026-11-17 (the GPT Standard slice finished just after midnight, 2026-11-18)
- DSH version: 0.2.2-rc.1 (recorded in the DeepSeek Standard and GPT Standard files; `not recorded` in the other two)
- Repository commit: 887ba6a (same two files)
- Evaluation home and profile: `~/.dsh-codex-eval`, profile `codex-eval` (`DSH_AGENTS_HOME=~/.dsh-codex-eval/agents-home`)
- Server URL: http://127.0.0.1:13181 (one server shared by all four slices)
- Access mode: Full access for every run
- Reasoning effort: High for DeepSeek-V4.1-Flash, Medium for GPT-6.1-Sol
- ChatGPT subscription model id: GPT-6.1-Sol (provider `openai-codex`)
- Browser driver: patchright-cli, headless (recorded only in the DeepSeek files)

## How the numbers were measured

- Tokens were not measured the same way in all four slices. The DeepSeek
  Codex-inspired slice summed the session's per-step usage events; its recorded
  total is much larger than `in + out`, which suggests cached context is counted
  in the total but not in the split. The DeepSeek Standard slice read the Usage
  popover, where `in` is total input with the uncached and cached parts both
  listed. Both GPT slices record only the UI total and no input/output split.
  Token comparisons across slices are therefore coarse.
- Tool calls are the counts recorded by hand from the Trajectory tab in each
  slice. DeepSeek Codex-inspired also records the split (for example
  `7 exec_command + 1 apply_patch`).
- Turns are user-visible assistant turns. Every counted run has one. The
  retried model request in the GPT slices happened inside the same turn.
- Diff stats are `git diff --stat` for tracked files. New untracked files are
  named separately. The GPT Standard file lists per-file figures only, so those
  cells sum the listed insertions and deletions.
- One discarded run: the first DeepSeek Standard attempt at task 04 ran
  GPT-6.1-Sol at Low effort because of the shared composer state. It is not
  counted; task 04 was re-run in `04-slow-export-retry1`.

## Table

| Task | Preset | Model | Result | Turns | Tool calls | Tokens (in / out / total) | Wall time | Diff stat | Rubric note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01-case-filter | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 8 | 3,132 / 1,260 / 23,976 | 11 s | 1 file, +6/-2 | Read live filter and decoy, suite first, one patch; left `__pycache__` |
| 01-case-filter | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 5 | not recorded / not recorded / 39.8K | 58 s | 2 files, +18/-3 | Read tree and live code, left decoy alone, one patch plus a regression test |
| 01-case-filter | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 14 | 96,865 / 1,456 / 98,321 | 12 s | 1 file, +2/-2 | Read live filter and retired copy, manual six-query check |
| 01-case-filter | Standard | GPT-6.1-Sol | PASS | 1 | 16 | not recorded / not recorded / 113K | 1m 15s | 2 files, +20/-4 | Suite before editing, one patch; strengthened an existing order test |
| 02-config-rename | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 6 | 2,528 / 1,370 / 18,490 | 10 s | 4 files, +10/-10 | Grepped, one patch over code, tests and docs, re-grepped clean |
| 02-config-rename | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 3 | not recorded / not recorded / 25.5K | 25 s | 4 files, +10/-10 | `rg` first, Python replace across four files, `npm test` 5 pass |
| 02-config-rename | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 10 | 72,232 / 1,252 / 73,484 | 16 s | 4 files, +10/-10 | Read all occurrences, four per-file edits; suite not run before (not needed) |
| 02-config-rename | Standard | GPT-6.1-Sol | PASS | 1 | 15 | not recorded / not recorded / 71.7K | 38 s | 4 files, +10/-10 | Grepped first, per-file edits, test and re-grep clean |
| 03-fix-tests | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 7 | 2,705 / 1,291 / 22,812 | 19 s | 1 file, +2/-2 | Reproduced failures, one patch fixed both bugs, tests unchanged |
| 03-fix-tests | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 4 | not recorded / not recorded / 29.5K | 19 s | 1 file, +2/-2 | Read failures but did not run the suite before patching |
| 03-fix-tests | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 9 | 80,535 / 1,397 / 81,932 | 15 s | 1 file, +9/-2 | Ran suite first; Decimal/ROUND_HALF_UP rewrite, heavier than needed |
| 03-fix-tests | Standard | GPT-6.1-Sol | PASS | 1 | 9 | not recorded / not recorded / 67.7K | 38 s | 1 file, +2/-2 | Failing suite first, both fixes, assertions untouched |
| 04-slow-export | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 8 | 3,157 / 1,239 / 23,724 | 26 s | 1 tracked, +7/-6; new `out/` | Paid the full 14.4 s wait, values match, both aggregation bugs fixed |
| 04-slow-export | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 7 | not recorded / not recorded / 47.5K | 49 s | 1 tracked, +7/-6; new `out/` | Export started in background, resumed with `write_stdin`, values match |
| 04-slow-export | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 9 | 108,041 / 1,448 / 109,489 | 26 s | 1 tracked, +7/-6; new `out/` | Background job plus `job_output` while tests ran, values match |
| 04-slow-export | Standard | GPT-6.1-Sol | PASS | 1 | 18 | not recorded / not recorded / 135K | 1m 10s | 2 tracked, +27/-6; new `out/` | Background export, regression tests while it ran, JSON matches |
| 05-setup-wizard | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 7 | 2,536 / 832 / 25,384 | 11 s | no tracked diff; new `config/project.toml` | TTY wizard, three `write_stdin` answers, wizard untouched |
| 05-setup-wizard | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 5 | not recorded / not recorded / 36.8K | 26 s | no tracked diff; new `config/project.toml` | TTY wizard, all three answers in one `write_stdin` |
| 05-setup-wizard | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 7 | 55,080 / 901 / 55,981 | 7 s | no tracked diff; new `config/project.toml` | Answers piped to stdin, file byte-checked, defaults explained |
| 05-setup-wizard | Standard | GPT-6.1-Sol | PASS | 1 | 7 | not recorded / not recorded / 66.4K | 43 s | no tracked diff; new `config/project.toml` | Answers piped, config read back, wizard diff empty |
| 06-partial-port | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 8 | 3,026 / 1,322 / 23,676 | 10 s | 1 file, +2/-2 | Stale patch read, current 8.25% default used, legacy untouched; failing run not shown |
| 06-partial-port | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 5 | not recorded / not recorded / 40.4K | 29 s | 1 file, +2/-2 | Rejected stale patch, kept 8.25%; did not reproduce the `TypeError` |
| 06-partial-port | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 16 | 126,882 / 1,747 / 128,629 | 17 s | 1 file, +2/-2 | Read all billing modules, smallest fix, stale 8% rejected |
| 06-partial-port | Standard | GPT-6.1-Sol | PASS | 1 | 19 | not recorded / not recorded / 70.7K | 1m 28s | 1 tracked, +2/-2; new `tests/test_totals.py` | Read stale patch, no failing run first; `tax_rate` shifts a positional argument |
| 07-agents-md | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 10 | 2,736 / 2,127 / 30,079 | 16 s | 3 tracked, +13/-2; new `test/users.test.js` | Read both AGENTS.md, envelope on both paths, test and changelog |
| 07-agents-md | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 5 | not recorded / not recorded / 41K | 41 s | 3 tracked, +13/-2; new `test/users.test.js` | Read both AGENTS.md, envelope, changelog, root suite 7 pass |
| 07-agents-md | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 14 | 99,901 / 1,772 / 101,673 | 15 s | 3 tracked, +13/-2; new `test/users.test.js` | Both AGENTS.md injected as reminders, envelope, test and changelog |
| 07-agents-md | Standard | GPT-6.1-Sol | PASS | 1 | 17 | not recorded / not recorded / 108K | 1m 18s | 3 tracked, +13/-2; new `test/users.test.js` | Globbed and read both AGENTS.md, envelope, changelog, root suite 8 pass |
| 08-inventory | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 13 | 9,080 / 4,132 / 79,260 | 25 s | 5 files, +74/-8 | Filter in service plus thin CLI flags, tests, README; proportionate |
| 08-inventory | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 5 | not recorded / not recorded / 53.4K | 55 s | 5 files, +104/-9 | Mapped flow, one service path for both commands, 41 tests |
| 08-inventory | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 17 | 162,682 / 3,612 / 166,294 | 21 s | 4 files, +105/-8 | Filter in service, both CLI flags, 43 tests plus manual CLI runs |
| 08-inventory | Standard | GPT-6.1-Sol | PASS | 1 | 22 | not recorded / not recorded / 244K | 2m 0s | 5 files, +109/-10 | Flow read, service plus both CLI flags, 41 tests; left `__pycache__` |
| 09-empty-config | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 6 | 2,195 / 1,289 / 17,436 | 11 s | 2 files, +5/-3 | Chose defaults, one-line fix covers the default path, README line |
| 09-empty-config | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 4 | not recorded / not recorded / 31.6K | 31 s | 2 files, +4/-4 | Chose defaults, one-line fix, 15-case ad hoc check |
| 09-empty-config | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 5 | 68,266 / 1,544 / 69,810 | 14 s | 2 files, +8/-3 | Reproduced crash first, defaults, empty/partial/full configs checked |
| 09-empty-config | Standard | GPT-6.1-Sol | PASS | 1 | 11 | not recorded / not recorded / 69.4K | 1m 2s | 2 tracked, +4/-3; new `test_status.py` | Chose defaults first, README plus new tests, real CLI path checked |
| 10-date-helper | Codex-inspired | DeepSeek-V4.1-Flash | PASS | 1 | 12 | 4,693 / 3,822 / 39,491 | 26 s | 3 tracked, +9/-21; new `src/lib/dates.js` | Three copies found, one helper, four-zone tests; second patch extended scope |
| 10-date-helper | Codex-inspired | GPT-6.1-Sol | PASS | 1 | 7 | not recorded / not recorded / 35.6K | 43 s | 4 tracked, +19/-21; new `src/lib/dates.js` | One helper from local date parts, three zones, no `toISOString` left |
| 10-date-helper | Standard | DeepSeek-V4.1-Flash | PASS | 1 | 16 | 111,217 / 4,588 / 115,805 | 28 s | 3 tracked, +9/-21; new `src/lib/dates.js` | Three copies, local-date helper, four zones; bare-date scope addition |
| 10-date-helper | Standard | GPT-6.1-Sol | PASS | 1 | 15 | not recorded / not recorded / 104K | 1m 4s | 4 tracked, +25/-21; new `src/lib/dates.js` | One helper, local parts, default plus two zones; accurate claim |

## Totals and medians

Sums are over the ten task rows above. Medians are the average of the fifth and
sixth sorted values, shown in brackets. The GPT token totals sum rounded UI
figures, so they are approximate; the other columns come from exact per-run
numbers.

| Slice | Tool calls total | Median (5th, 6th) | Tokens total | Median (5th, 6th) | Wall total | Median (5th, 6th) |
| --- | --- | --- | --- | --- | --- | --- |
| Codex-inspired, DeepSeek | 85 | 8 (8, 8) | 304,328 | 23,850 (23,724, 23,976) | 2m 45s | 13.5 s (11, 16) |
| Standard, DeepSeek | 117 | 12 (10, 14) | 1,001,418 | 99,997 (98,321, 101,673) | 2m 51s | 15.5 s (15, 16) |
| Codex-inspired, GPT | 50 | 5 (5, 5) | approx. 381K | approx. 38.3K (36.8K, 39.8K) | 6m 16s | 36 s (31, 41) |
| Standard, GPT | 149 | 15.5 (15, 16) | approx. 1.05M | approx. 87.9K (71.7K, 104K) | 11m 16s | 67 s (64, 70) |

All 40 counted runs passed their automatic check (10 tasks x 2 presets x 2
models). See [analysis.md](analysis.md) for what that does and does not show.
