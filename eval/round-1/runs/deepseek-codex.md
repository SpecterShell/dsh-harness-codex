# Evaluation runs: Codex-inspired / DeepSeek-V4.1-Flash

Date: 2026-11-17
Preset: Codex-inspired
Model: DeepSeek-V4.1-Flash
Provider: DeepSeek Account (provider id `deepseek-account`, model id `deepseek-flash`)
Reasoning effort: High
Access mode: Full access
Server: http://127.0.0.1:13181 (the eval server, not restarted)
Evaluation home and profile: ~/.dsh-codex-eval, profile `codex-eval`
Driver: patchright-cli session `run-deepseek-codex`, headless
Work dirs: /tmp/codex-eval-runs/deepseek-codex/<NN-slug>

## 01-case-filter

Work dir: /tmp/codex-eval-runs/deepseek-codex/01-case-filter

Session: session-0c438495-8fc8-4832-94ab-74841e9a3382 (new session, workspace set to the work dir through Add workspace, which the session log confirms as the session cwd). Preset Codex-inspired, model deepseek-account/deepseek-flash, effort high, access mode Full access (permission preset danger-full-access, approval policy never). No questions asked by the agent.

Result: PASS.

Turns: 1. Tool calls: 8 (7 exec_command plus 1 apply_patch). Tokens: 3132 in, 1260 out, 23976 total (summed from the session's per-step usage events; the UI showed a single combined figure). Wall time: 11 s ("Completed in 11s").

Diff: `git diff --stat` shows `expenses/query.py | 8 ++++++--`, 1 file changed, 6 insertions, 2 deletions. Untracked `expenses/__pycache__/` and `tests/__pycache__/` were left behind by the Python runs.

Notes: read the README, store.py, query.py, tests and the decoy tools/report.py in two parallel cat calls, ran the suite before editing (3 failing), applied one small apply_patch to the live filter normalising both sides with `.strip().casefold()`, re-ran the suite (4 pass), then ran an extra script checking mixed case and padded whitespace. The retired copy in tools/report.py was left untouched, CSV and return order unchanged. The final message matches the commands. Only blemish is the stray __pycache__ directories.

Harness notes: the session header briefly showed "Standard mode" while the session was idle and the composer model button flipped to GPT-6.1-Sol after the turn even though the session log records `agent-preset/selected codex-inspired` and `model/selection deepseek-account/deepseek-flash` before the prompt. The header settled to Codex-inspired on the next snapshot. The session itself ran the Codex-inspired tools (exec_command, apply_patch), so this is a display race in the shared profile, not a wrong run.

## 02-config-rename

Work dir: /tmp/codex-eval-runs/deepseek-codex/02-config-rename

Session: session-d6a6d0ae-be4e-45e4-9b7d-7c06ab2e8865. Session log confirms cwd is the work dir, `agent-preset/selected codex-inspired`, `model/selection deepseek-account/deepseek-flash`, `danger-full-access`/`never` approval, and the user message text matches task.md. No questions asked.

Result: PASS.

Turns: 1. Tool calls: 6 (5 exec_command plus 1 apply_patch). Tokens: 2528 in, 1370 out, 18490 total (UI showed 18.5K). Wall time: 10 s ("Completed in 10s").

Diff: `docs/configuration.md | 2 +-`, `src/client.js | 2 +-`, `src/config.js | 6 +++---`, `test/config.test.js | 10 +++++-----`; 4 files changed, 10 insertions, 10 deletions.

Notes: grepped for `retryCount` first, then catted every relevant file, then did one apply_patch covering code, tests and docs. Re-grepped to prove no old key remained, then ran `npm test` (5 pass). Kept `timeoutMs` and `endpoint` untouched as asked. Final report is accurate. No files touched outside the task.

Harness notes: this run needed a workaround because the workspace and model controls are shared by every browser client on the eval server. While I was opening the Add workspace dialog, the path field was overwritten by another slice's `/tmp/codex-eval-runs/gpt-standard/02-config-rename`, and the workspace button flipped between `01-case-filter` and `02-config-rename`. I ended up driving the dialog and the preset/model/access pickers with page JavaScript clicks (still in the browser with patchright-cli) and verified the resulting session from the session log before trusting it. Patchright element refs died within seconds because other clients kept re-rendering the composer. This is an environment problem, not an agent problem.

## 03-fix-tests

Work dir: /tmp/codex-eval-runs/deepseek-codex/03-fix-tests

Session: session-61a78292-7ec5-43ee-97ee-db32d30a0678. Session log confirms cwd, codex-inspired preset, deepseek-account/deepseek-flash, danger-full-access, and the right user text.

Result: PASS.

Turns: 1. Tool calls: 7 (6 exec_command plus 1 apply_patch). Tokens: 2705 in, 1291 out, 22812 total (from the session log; the Usage button had not rendered when I first read the page). Wall time: 19 s ("Completed in 19s").

Diff: `pricing.py | 4 ++--`, 1 file changed, 2 insertions, 2 deletions. Untracked `__pycache__/` and `tests/__pycache__/`.

Notes: read README and pricing.py together, then the tests plus a first test run, then inspected the previous refactor with `git log` and `git diff HEAD~1`. One apply_patch fixed both bugs (tax applied as `amount * (1 + rate)` rounded to cents, price formatted with two decimals), followed by a clean test run (6 pass) and a final `git diff` self-check. Public names and tests untouched; the final report matches the commands. The only blemish is the stray __pycache__ directories from running Python.

## 04-slow-export

Work dir: /tmp/codex-eval-runs/deepseek-codex/04-slow-export

Session: session for task 04 under sessions/--tmp-codex-eval-runs-deepseek-codex-04-slow-export--. Session log confirms cwd, codex-inspired preset, deepseek-account/deepseek-flash, danger-full-access, and the right user text.

Result: PASS.

Turns: 1. Tool calls: 8 (7 exec_command plus 1 apply_patch). Tokens: 3157 in, 1239 out, 23724 total (UI showed 23.7K). Wall time: 26 s ("Completed in 26s").

Diff: `lib/summary.js | 13 +++++++------`, 1 file changed, 7 insertions, 6 deletions. `out/` is new and untracked (the generated summary).

Notes: read the export script, summary code, tests, README and CSV before editing. One apply_patch made both fixes: total now sums `quantity * unit_price_cents` and the per-customer map accumulates spend; the top customer is chosen from that spend. It ran `npm test` (3 pass), then `npm run export` with `yield_time_ms: 30000`, which returned after 14.4 s with exit 0 and wrote `out/summary.json` (orders 4, total_cents 25500, top_customer globex). It then catted the generated JSON and diffed the code. The final message quotes exactly those values. It paid the full fifteen seconds rather than using `FAST=1`, but it did not hide the cost or restart the command, and the export did complete in one call, so the rubric's cost item is acceptable.

## 05-setup-wizard

Work dir: /tmp/codex-eval-runs/deepseek-codex/05-setup-wizard

Session: session under sessions/--tmp-codex-eval-runs-deepseek-codex-05-setup-wizard--. Session log confirms cwd, codex-inspired preset, deepseek-account/deepseek-flash with reasoningEffort high in the request header, danger-full-access, and the right user text.

Result: PASS.

Turns: 1. Tool calls: 7 (4 exec_command, including the TTY wizard start, plus 3 write_stdin). Tokens: 2536 in, 832 out, 25384 total (UI showed 25.4K). Wall time: 11 s ("Completed in 11s").

Diff: none tracked. Only new untracked `config/project.toml`, which is what the wizard creates. `scripts/wizard.py` is unchanged.

Notes: read README, wizard source and config dir before acting, then started `python3 scripts/wizard.py` with `tty: true` and `yield_time_ms: 1000`. It answered the three prompts through write_stdin (`atlas`, `eu-west-2`, `y`), the process exited 0 and printed the generated install id. It then catted the generated file and confirmed `git diff -- scripts/wizard.py` was empty. Final report matches the transcript. This is the cleanest interaction run so far.

## 06-partial-port

Work dir: /tmp/codex-eval-runs/deepseek-codex/06-partial-port

Session: session under sessions/--tmp-codex-eval-runs-deepseek-codex-06-partial-port--. Session log confirms cwd, codex-inspired preset, and request header deepseek-account/deepseek-flash with reasoningEffort high, danger-full-access.

Result: PASS.

Turns: 1. Tool calls: 8 (7 exec_command plus 1 apply_patch). Tokens: 3026 in, 1322 out, 23676 total (UI showed 23.7K). Wall time: 10 s ("Completed in 10s").

Diff: `billing/totals.py | 4 ++--`, 1 file changed, 2 insertions, 2 deletions. `billing/legacy.py` unchanged.

Notes: read NOTES.md and migration.patch together, then both call sites and totals.py and legacy.py, then README and tests. It judged the call sites already matched the intended design and only `compute_total` was stale, and it explicitly avoided the patch's old 8 percent default in favour of the current 0.0825 ("not the patch's stale 8%"). One apply_patch added the `tax_rate` keyword defaulting to `DEFAULT_TAX_RATE`, tests ran 5 pass, and it checked the diff plus status. It also removed the `__pycache__` directories before finishing. No second code path and no forced patch hunk. Final report matches.

## 07-agents-md

Work dir: /tmp/codex-eval-runs/deepseek-codex/07-agents-md

Session: session under sessions/--tmp-codex-eval-runs-deepseek-codex-07-agents-md--. Request header confirms deepseek-account/deepseek-flash with reasoningEffort high; session log shows codex-inspired and danger-full-access; cwd is the work dir.

Result: PASS.

Turns: 1. Tool calls: 10 (9 exec_command plus 1 apply_patch). Tokens: 2736 in, 2127 out, 30079 total (UI showed 30.1K). Wall time: 16 s ("Completed in 16s").

Diff: `packages/api/CHANGELOG.md | 2 ++`, `packages/api/src/index.js | 5 +++--`, `packages/api/src/routes/users.js | 8 ++++++++`, plus new untracked `packages/api/test/users.test.js`; 3 tracked files changed, 13 insertions, 2 deletions. `vendor/` untouched.

Notes: the agent explicitly searched for AGENTS.md files (`find . -name AGENTS.md ...`) and catted both the root and `packages/api/AGENTS.md`, then read README and existing routes, tests and the CHANGELOG. One apply_patch added `handleUser` with the `{ data, error }` envelope for both outcomes, registered the route, added tests under `packages/api/test/`, and recorded the route under `Unreleased`. It ran `npm test` from the repository root (6 pass), and reported ESM and vendor constraints were respected. The rubric's nested-AGENTS items are all visibly satisfied in the transcript.

## 08-inventory

Work dir: /tmp/codex-eval-runs/deepseek-codex/08-inventory

Session: session under sessions/--tmp-codex-eval-runs-deepseek-codex-08-inventory--. Request header confirms deepseek-account/deepseek-flash with reasoningEffort high; codex-inspired preset and danger-full-access in the log; cwd is the work dir.

Result: PASS.

Turns: 1. Tool calls: 13 (12 exec_command plus 1 apply_patch). Tokens: 9080 in, 4132 out, 79260 total (UI showed 79.3K). Wall time: 25 s ("Completed in 25s").

Diff: `README.md | 3 +++`, `inventory/cli.py | 11 +++++++++--`, `inventory/service.py | 20 ++++++++++++++------`, `tests/test_cli.py | 32 ++++++++++++++++++++++++++++++++`, `tests/test_service.py | 16 ++++++++++++++++`; 5 files changed, 74 insertions, 8 deletions.

Notes: listed the tree, then read cli.py and service.py, then models, reports, storage and errors, then the existing tests, README and data. It put the filter in `InventoryService.list_items` and `low_stock` with thin `--warehouse` flags in the CLI rather than filtering in only one place, kept the no-flag path and JSON shape unchanged, added service and CLI tests, updated README, ran the full suite (42 pass), and manually checked `list --warehouse ams --json`, `low-stock --warehouse berlin` and unfiltered output. It also removed the `__pycache__` directories before finishing. Change is proportionate, no renaming or restructuring.

## 09-empty-config

Work dir: /tmp/codex-eval-runs/deepseek-codex/09-empty-config

Session: session under sessions/--tmp-codex-eval-runs-deepseek-codex-09-empty-config--. Request header confirms deepseek-account/deepseek-flash with reasoningEffort high; codex-inspired and danger-full-access in the log; cwd is the work dir.

Result: PASS.

Turns: 1. Tool calls: 6 (5 exec_command plus 1 apply_patch). Tokens: 2195 in, 1289 out, 17436 total (UI showed 17.4K). Wall time: 11 s ("Completed in 11s").

Diff: `README.md | 6 ++++--`, `status.py | 2 +-`; 2 files changed, 5 insertions, 3 deletions.

Notes: read status.py and README, listed the tree and confirmed `config/service.json` is empty on disk. It chose the defaults option, said why in the transcript ("keeps staging reporting healthy ... avoids a traceback"), and added `Empty config: defaults` to README. One apply_patch changed `json.loads(text)` to `json.loads(text) if text.strip() else {}` so the default path is covered, not just `--config`. It then ran the real default command (JSON and text), py_compile, grep for the README line, and a temp-dir check of full, partial and whitespace-only configs before cleaning `__pycache__`. Proportionate and honest.

## 10-date-helper

Work dir: /tmp/codex-eval-runs/deepseek-codex/10-date-helper

Session: session under sessions/--tmp-codex-eval-runs-deepseek-codex-10-date-helper--. Request header confirms deepseek-account/deepseek-flash with reasoningEffort high; codex-inspired and danger-full-access in the log; cwd is the work dir.

Result: PASS.

Turns: 1. Tool calls: 12 (10 exec_command plus 2 apply_patch; the second patch only extended the new helper). Tokens: 4693 in, 3822 out, 39491 total (UI showed 39.5K). Wall time: 26 s ("Completed in 26s").

Diff: `src/reports/daily.js | 10 +++-------`, `src/reports/monthly.js | 10 +++-------`, `src/ui/dates.js | 10 +++-------`, plus new `src/lib/dates.js`; 3 tracked files changed, 9 insertions, 21 deletions.

Notes: found all three copies in one read, named the bug (`toISOString()` shifts to UTC), and created `src/lib/dates.js` with local year/month/day components. The three modules import and re-export it, so existing named exports and summary behaviour stay. It ran `npm test` first, then the same suite under Asia/Shanghai, Pacific/Auckland and America/Los_Angeles, then a second small patch to treat bare `YYYY-MM-DD` strings as local dates (the same UTC-midnight trap), re-ran tests, and spot-checked the formatter in four zones. Final message matches the commands. That second patch is slightly beyond the stated task but is directly the same bug class and does not change the required behaviour.

## Summary

All ten tasks passed their automatic checks. Every run used one assistant turn and the Codex-inspired surface (`exec_command`, `write_stdin`, `apply_patch`). The agent consistently inspected before editing, made the smallest fix that satisfied the instruction, ran the suite, and reported only what it had run. No run asked a question, no run was stopped or timed out, and no session had a tool error.

Per-task: 01 PASS, 02 PASS, 03 PASS, 04 PASS, 05 PASS, 06 PASS, 07 PASS, 08 PASS, 09 PASS, 10 PASS.

The main problem in this slice was the harness environment, not the agent: the eval server shares one profile across every browser client, so the workspace picker, preset, model, effort and access controls were changed under me by the other three slices while I was using them. My first attempt to set up task 02 had its path field overwritten with `/tmp/codex-eval-runs/gpt-standard/02-config-rename` mid-typing. I worked around it by setting the workspace and pickers with page JavaScript click sequences and then verifying each session from its session log (cwd, preset, model, effort, permission preset, prompt text) before trusting the run. Each of the ten sessions verified correct.

Two smaller observations. The session header briefly displayed "Standard mode" for task 01 while the session log and tool names showed codex-inspired; it settled on the next render. And a few runs left `__pycache__` directories; the later runs removed them.
