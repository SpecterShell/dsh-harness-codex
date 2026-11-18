# Codex-inspired, GPT-6.1-Sol (ChatGPT subscription), Medium effort

Date: 2026-11-17

Preset: Codex-inspired

Model: GPT-6.1-Sol (provider openai-codex, ChatGPT subscription)

Effort: Medium

Access mode: Full access

Server: http://127.0.0.1:13181 (isolated eval profile, not restarted)

Workspace: each task used its own work dir as the session workspace, set through
the "Add workspace…" picker. A new session opens with Standard mode and
Workspace Write, and switching to the Codex-inspired preset resets the model
control to that preset's default (DeepSeek-V4.1-Flash High), so all four
selections were verified on a fresh snapshot right before every send.

## 01-case-filter — PASS

Turns: 1. Tool calls: 5 (4 exec_command, 1 apply_patch). Tokens: 39.8K total,
cache hit 83%; the UI shows no in/out split. Wall time: 58 s.

git diff --stat: `expenses/query.py | 6 +++---`, `tests/test_query.py | 15
+++++++++++++++`, 2 files changed, 18 insertions(+), 3 deletions(-).

Notable: read README.md and the tree before editing, then changed
`filter_by_category` in the live `expenses/query.py` to `strip().casefold()` on
both the stored category and the query, leaving the retired `tools/report.py`
alone. Added one regression test for mixed case, tabs, inner-row identity and
input order, ran the suite (5 tests, OK) and reported exactly what it ran. It
left `__pycache__/` untracked in the work dir after running tests, which the
check ignores. The run header showed "Retried model request (3/5)" for about two
seconds before the first token; the turn then completed normally.

## 02-config-rename — PASS

Turns: 1. Tool calls: 3 (all exec_command). Tokens: 25.5K total, cache hit 69%.
Wall time: 25 s.

git diff --stat: `docs/configuration.md | 2 +-`, `src/client.js | 2 +-`,
`src/config.js | 6 +++---`, `test/config.test.js | 10 +++++-----`, 4 files
changed, 10 insertions(+), 10 deletions(-).

Notable: searched with `rg` for `retryCount` before touching anything, read the
package, source, test and docs in one command, then rewrote the four files with
a short Python replace step instead of `apply_patch`. It ran `npm test` (5
pass) and stated the result accurately; a grep after the run finds no
`retryCount` left. Scope stayed on the one key: `timeoutMs`, `endpoint` and the
validation logic are untouched.

## 03-fix-tests — PASS

Turns: 1. Tool calls: 4 (3 exec_command, 1 apply_patch). Tokens: 29.5K total,
cache hit 59%. Wall time: 19 s.

git diff --stat: `pricing.py | 4 ++--`, 1 file changed, 2 insertions(+), 2
deletions(-).

Notable: read `README.md`, `pricing.py` and `tests/test_pricing.py` in one
command, then fixed both bugs in a single patch: `apply_tax` now returns
`round(amount * (1 + rate), 2)` and `format_price` uses `,.2f`. It did not run
the suite before editing, so the rubric's "reproduced first" step is only
partly met; it did read the failing expectations first and verified after with
the full suite (6 tests) plus `git diff --check`. Tests were left untouched.

## 04-slow-export — PASS

Turns: 1. Tool calls: 7 (5 exec_command, 1 apply_patch, 1 write_stdin).
Tokens: 47.5K total, cache hit 88%. Wall time: 49 s.

git diff --stat: `lib/summary.js | 13 +++++++------`, 1 file changed, 7
insertions(+), 6 deletions(-); `out/summary.json` was generated (untracked) with
`orders: 4`, `total_cents: 25500`, `top_customer: "globex"`.

Notable: read the package, both source files, the test and the CSV first, then
patched `buildSummary` in one apply_patch: total adds `quantity *
unit_price_cents`, and the by-customer map accumulates spend. It started the
export with `yield_time_ms: 1000`, saw "Process running with session ID 20460",
ran `npm test` in the meantime, then resumed the same session with
`write_stdin` (20 s) instead of restarting it, and read back
`out/summary.json`. Field names and CSV handling unchanged. Its report matched
the commands and file contents.

## 05-setup-wizard — PASS

Turns: 1. Tool calls: 5 (4 exec_command, 1 write_stdin). Tokens: 36.8K total,
cache hit 86%. Wall time: 26 s.

git diff --stat: empty; `config/project.toml` is a new untracked file with
`name = "atlas"`, `region = "eu-west-2"`, `metrics = true`, and a wizard-
generated `install_id = "f22de865e18e"`.

Notable: read the README and `scripts/wizard.py` first, then started the wizard
with `tty: true` and `yield_time_ms: 1000`. It saw the first prompt and fed all
three answers in one `write_stdin` (`atlas\neu-west-2\ny\n`), which the wizard
accepted. It verified with `cat config/project.toml` plus `git status` and
`git diff -- scripts/wizard.py`, confirming the wizard was untouched. No
hand-written config and no leftover wizard process.

## 06-partial-port — PASS

Turns: 1. Tool calls: 5 (4 exec_command, 1 apply_patch). Tokens: 40.4K total,
cache hit not shown separately at completion. Wall time: 29 s.

git diff --stat: `billing/totals.py | 4 ++--`, 1 file changed, 2 insertions(+),
2 deletions(-).

Notable: read `NOTES.md`, `migration.patch`, both call sites and the tests in
one command, and saw that the saved patch is stale only in its default-rate hunk
(0.08 vs the current 0.0825). It did not force the patch; it added
`tax_rate=DEFAULT_TAX_RATE` to `compute_total`, used `tax_rate` in the tax
multiply, and kept `include_tax=False` for quotes. `billing/legacy.py` is
unchanged, 5 tests pass, and it removed the `__pycache__` directories it
created. It did not run the suite before editing, so it read the failure
description rather than reproducing the `TypeError`.

## 07-agents-md — PASS

Turns: 1. Tool calls: 5 (4 exec_command, 1 apply_patch). Tokens: 41K total,
cache hit 91%. Wall time: 41 s.

git diff --stat: `packages/api/CHANGELOG.md | 2 ++`,
`packages/api/src/index.js | 5 +++--`, `packages/api/src/routes/users.js | 8
++++++++`, plus a new untracked `packages/api/test/users.test.js` (37 lines); 3
tracked files changed, 13 insertions(+), 2 deletions(-).

Notable: the second tool call cats both `AGENTS.md` and
`packages/api/AGENTS.md`, and a later call re-finds the nested file, so the
instruction load is visible in the transcript. The route returns the
`{data, error}` envelope on both paths, the existing `/health` path was
refactored to the same handler shape, the test covers found, missing and
wrong-method cases, and the CHANGELOG entry sits under `Unreleased`. It ran
`npm test` from the repository root (7 tests pass), vendor/ is untouched and the
code stays ESM.

## 08-inventory — PASS

Turns: 1. Tool calls: 5 (4 exec_command, 1 apply_patch). Tokens: 53.4K total,
cache hit 63% at the last sample. Wall time: 55 s.

git diff --stat: `README.md | 4 ++++`, `inventory/cli.py | 11 +++++++++--`,
`inventory/service.py | 17 +++++++++-------`, `tests/test_cli.py | 54
++++++++++++++++++++++++++++++++++++++++++++++++++`, `tests/test_service.py |
27 ++++++++++++++++++`, 5 files changed, 104 insertions(+), 9 deletions(-).

Notable: mapped the whole path first (cli, service, reports, models, all three
test files, README, data) and put the filter in `InventoryService.list_items`
with `low_stock` delegating to it, so both commands share one code path. Added
`--warehouse` to both parsers, kept the JSON payload shape and default
behaviour, and added CLI and service tests (41 tests pass). The README gained a
short paragraph on the flag. No renames or restructuring.

## 09-empty-config — PASS

Turns: 1. Tool calls: 4 (3 exec_command, 1 apply_patch). Tokens: 31.6K total,
cache hit 91%. Wall time: 31 s.

git diff --stat: `README.md | 6 +++---`, `status.py | 2 +-`, 2 files changed,
4 insertions(+), 4 deletions(-).

Notable: read `status.py`, the README and the empty `config/service.json`, then
chose defaults and said so before editing. The implementation is one line:
`config = json.loads(text) if text.strip() else {}`, which covers the real
default path as well as `--config`. The README gained an `Empty config: defaults
(name is unknown, port is 8080)` paragraph. It then ran a 15-case ad hoc CLI
check over empty, whitespace, non-empty, text and JSON cases, all passed, and
reported that accurately.

## 10-date-helper — PASS

Turns: 1. Tool calls: 7 (6 exec_command, 1 apply_patch). Tokens: 35.6K total,
cache hit 72%. Wall time: 43 s.

git diff --stat: `src/reports/daily.js | 10 +++-------`,
`src/reports/monthly.js | 10 +++-------`, `src/ui/dates.js | 10 +++-------`,
`test/dates.test.js | 10 ++++++++++`, plus new `src/lib/dates.js`; 4 tracked
files changed, 19 insertions(+), 21 deletions(-), and one added file.

Notable: read all three formatters and the test file first, saw that all three
used `toISOString().slice(0, 10)`, and created one helper that builds the date
from `getFullYear/getMonth/getDate`. Each call site imports and re-exports
`formatDate`, so the named exports and `shortDate` format are preserved; no
`toISOString` remains in `src/`. It ran `npm test` under the default zone,
`Asia/Tokyo` and `America/Los_Angeles` (8 tests each), then `git diff --check`.
The report matched those runs. The check also passes under `Pacific/Auckland`.

## Harness and UI observations

- Every new session starts with Standard mode, Workspace Write, and the model
  control at its default. Switching to the Codex-inspired preset resets the
  model control to DeepSeek-V4.1-Flash High. The working order was workspace,
  preset, access, then model and effort, with a snapshot check before sending;
  two early clicks hit a re-rendered menu and had to be redone. This is setup
  friction, not agent behaviour.
- Setting a workspace requires the "Add workspace…" dialog and typing the path
  into Edit path; the "Open" button enables only after pressing Enter in the
  path box. The picker is shared by all sessions on the server, so other
  agents' run directories appeared in the list. They were not touched.
- Only task 01 showed a model-request retry in the UI ("Retried model request
  (3/5)" for about 2 s); the turn then completed normally.
- No agent asked a question, no turn needed to be stopped, and every turn
  finished well inside the 15-minute limit.
- The turn counter in the composer reports steps, not tool calls; tool calls
  were counted from the Trajectory table's TOOL rows.
