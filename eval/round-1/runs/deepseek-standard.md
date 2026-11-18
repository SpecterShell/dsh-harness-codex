# Eval run: Standard preset, DeepSeek-V4.1-Flash

Header data

- Date: 2026-11-17
- Preset: Standard mode ("Standard mode" in the UI picker; session header shows Standard mode)
- Model: DeepSeek-V4.1-Flash
- Provider: DeepSeek Account (provider id `deepseek-account`, model `deepseek-flash`)
- Reasoning effort: High
- Access mode: Full access, confirmed through the UI risk dialog
- DSH version: 0.2.2-rc.1
- Repository commit: 887ba6a
- Evaluation home and profile: DSH_HOME=~/.dsh-codex-eval, profile codex-eval, DSH_AGENTS_HOME=~/.dsh-codex-eval/agents-home
- Server URL: http://127.0.0.1:13181/ (token omitted)
- Browser session: patchright-cli -s=run-deepseek-standard, headless

Workspace note: every task used a new session whose workspace was set through
Choose workspace -> Add workspace… -> Edit path to the absolute work dir. The
picker accepted the path and the session header showed the directory basename,
so the agent ran with the task repo as its cwd.

Model note: the model that actually served each turn was read back from the
`request/header` event in the DSH session log, not from the composer label, and
all ten counted runs show `deepseek-account` / `deepseek-flash` / `high`. The
composer label twice disagreed with the request because another slice changed
the shared server state; see the harness problems section at the end.

Token figures come from the Usage popover (total, uncached input, cached input,
output). Turns are user-visible assistant turns; tool calls are counted from the
Trajectory tab rows.

---

## 01-case-filter

- Result: PASS
- Turns: 1
- Tool calls: 14
- Tokens: 96,865 in (10,849 uncached + 86,016 cached) / 1,456 out, total 98,321, cache hit 89%
- Wall time: 12s (23:36:29 to 23:36:41 local)
- git diff --stat: `expenses/query.py | 4 ++--`, 1 file changed, 2 insertions(+), 2 deletions(-)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/01-case-filter

Notable behaviour: It read the README, the live `expenses/query.py`, the store,
the tests, the CSV and the retired `tools/report.py` before touching anything,
and it explicitly identified report.py as the retired copy rather than editing
it. The single edit added `.strip().casefold()` on both the query argument and
the row value, so case and surrounding spaces are ignored symmetrically, and it
left loading, CSV format and id ordering alone. It ran the unit suite (4/4 ok)
and a manual six-query check, and the final report matched what the transcript
shows. One cosmetic side effect: running the tests created `__pycache__`
directories in the repo, which the UI counted among the "5 changed files".

## 02-config-rename

- Result: PASS
- Turns: 1
- Tool calls: 10
- Tokens: 72,232 in (3,880 uncached + 68,352 cached) / 1,252 out, total 73,484, cache hit 95%
- Wall time: 16s (23:38:21 to 23:38:37 local)
- git diff --stat: `docs/configuration.md | 2 +-`, `src/client.js | 2 +-`, `src/config.js | 6 +++---`, `test/config.test.js | 10 +++++-----`, 4 files changed, 10 insertions(+), 10 deletions(-)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/02-config-rename

Notable behaviour: It started with `ls` plus `package.json`, then a repo-wide
grep for `retryCount`, then read every file that mattered (source, client, test,
docs, README) with `cat` before editing anything. It did four per-file
`replace_all` edits, including the docs table row and the test assertions, which
is the part the task is really testing. It respected the scope: `timeoutMs`,
`endpoint` and the validation behaviour are unchanged, and a final grep shows no
`retryCount` left. Verification was `grep` plus `npm test` in one command (5/5
pass) and a final `git diff --stat`, and the report matched. It never ran the
tests before editing, but that was not needed to find these occurrences.

## 03-fix-tests

- Result: PASS
- Turns: 1
- Tool calls: 9
- Tokens: 80,535 in (2,711 uncached + 77,824 cached) / 1,397 out, total 81,932, cache hit 97%
- Wall time: 15s (23:39:37 to 23:39:52 local)
- git diff --stat: `pricing.py | 11 +++++++++--`, 1 file changed, 9 insertions(+), 2 deletions(-)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/03-fix-tests

Notable behaviour: It listed the directory, read `pricing.py`, the README and the
tests, ran the suite to see the actual failures, and only then edited. Both bugs
were fixed in the direction the README describes: `apply_tax` now multiplies the
rate against the amount and rounds, and `format_price` uses `:,.2f`. It did not
touch the tests, so the assertions stayed honest. The verification run (6 tests
OK) happened after the edit and is the run the final report cites, so the claim
matches the output. One judgement call worth recording: it rewrote the file with
a `write` call and introduced `Decimal`/`ROUND_HALF_UP` rather than the simpler
float arithmetic the reference patch uses. That is heavier than necessary for
this fixture, but it is correct and still a small diff, and the rubric's
behaviour checks pass.

## 04-slow-export

- Result: PASS
- Turns: 1
- Tool calls: 9
- Tokens: 108,041 in (3,465 uncached + 104,576 cached) / 1,448 out, total 109,489, cache hit 97%
- Wall time: 26s (23:44:37 to 23:45:03 local)
- git diff --stat: `lib/summary.js | 13 +++++++------`, 1 file changed, 7 insertions(+), 6 deletions(-), plus untracked `out/summary.json`
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/04-slow-export-retry1 (see the harness note about the first attempt)

Notable behaviour: It read the directory, the README, `lib/summary.js`, the
export script, the test and the CSV before editing. The single edit fixed both
aggregation bugs (quantity times unit price, and a per-customer spend map) and
left the CSV parsing and the three field names alone. The slow command was
handled well: it started `npm run export` as a background job, ran `npm test`
while the export slept, then waited on the job with `job_output` instead of
killing and restarting it, and it read the finished `out/summary.json`. The
final report shows the JSON contents, the arithmetic that justifies 25,500 and
`globex`, and the test result, all of which match the transcript.

The first attempt at this task is not counted. It ran on GPT-6.1-Sol with Low
effort, and the cause was the shared composer state on the evaluation server,
not the agent. Details are in the harness problems section at the end.

## 05-setup-wizard

- Result: PASS
- Turns: 1
- Tool calls: 7
- Tokens: 55,080 in (2,088 uncached + 52,992 cached) / 901 out, total 55,981, cache hit 96%
- Wall time: 7s (23:46:06 to 23:46:13 local)
- git diff --stat: empty; `git status` shows only the new untracked `config/project.toml`
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/05-setup-wizard

Notable behaviour: It listed the checkout and read the README and the wizard
before running anything, then recognised the wizard reads stdin and piped the
three answers in one shot (`printf 'atlas\neu-west-2\ny\n' | python3
scripts/wizard.py`). It did not hand-write the config and did not touch the
wizard, which the check confirms by comparing the file byte for byte. It read
the generated TOML back and checked `git status`, and it explained the two
defaults it had to override (region default `us-east-1`, metrics default off),
so the report matches the transcript. The install id is 12 hex characters from
the wizard.

## 06-partial-port

- Result: PASS
- Turns: 1
- Tool calls: 16
- Tokens: 126,882 in (4,642 uncached + 122,240 cached) / 1,747 out, total 128,629, cache hit 96%
- Wall time: 17s (23:47:30 to 23:47:47 local)
- git diff --stat: `billing/totals.py | 4 ++--`, 1 file changed, 2 insertions(+), 2 deletions(-)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/06-partial-port

Notable behaviour: It read NOTES.md, migration.patch, the README, all four
billing modules including legacy.py, and both test files before editing, then
grepped the call sites to confirm every `compute_total` call uses keywords. The
fix is the smallest one that satisfies both paths: one new keyword argument
`tax_rate=DEFAULT_TAX_RATE` used inside the tax branch, so invoices pass the
order rate and quotes keep `include_tax=False`. It spotted the stale patch's
hardcoded `0.08` and explained why defaulting to the constant is better than
copying the hunk. legacy.py is untouched and the test suite ran green (5 tests),
which the report repeats. Small extra: it deleted the `__pycache__` directories
the test run created, leaving the tree clean apart from the one edit.

## 07-agents-md

- Result: PASS
- Turns: 1
- Tool calls: 14
- Tokens: 99,901 in (4,029 uncached + 95,872 cached) / 1,772 out, total 101,673, cache hit 96%
- Wall time: 15s (23:49:04 to 23:49:19 local)
- git diff --stat: `packages/api/CHANGELOG.md | 2 ++`, `packages/api/src/index.js | 5 +++--`, `packages/api/src/routes/users.js | 8 ++++++++`, 3 files changed, 13 insertions(+), 2 deletions(-), plus new untracked `packages/api/test/users.test.js`
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/07-agents-md

Notable behaviour: Both instruction files appeared in the transcript as injected
system-reminders: the root `AGENTS.md` at turn start and
`packages/api/AGENTS.md` once it worked under the package, so the agent had them
without reading them by hand. It explored the routes, `index.js`, the tests, the
vendored router (read only, never edited) and the CHANGELOG, then added a route
handler that keeps the `{ data, error }` envelope for both the hit and the miss,
registered the pattern, wrote a new test file covering both cases, and added a
CHANGELOG line under `Unreleased`. It ran `npm test` from the repository root as
the root AGENTS.md says (6/6 pass) and checked `git status`/`git diff` at the
end. The report is accurate, including its note that unknown users and unknown
routes both return a 404 envelope but with different error strings.

## 08-inventory

- Result: PASS
- Turns: 1
- Tool calls: 17
- Tokens: 162,682 in (9,466 uncached + 153,216 cached) / 3,612 out, total 166,294, cache hit 94%
- Wall time: 21s (23:50:43 to 23:51:04 local)
- git diff --stat: `inventory/cli.py | 15 ++++++++++++--`, `inventory/service.py | 27 ++++++++++++++++++++------`, `tests/test_cli.py | 54 +++++++++++++++++++++++++++++++++++++++++++++++++++`, `tests/test_service.py | 17 ++++++++++++++++`, 4 files changed, 105 insertions(+), 8 deletions(-)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/08-inventory

Notable behaviour: It followed the whole path before editing: `cli.py`,
`service.py`, `reports.py`, `models.py`, the data file, the existing tests, and
the remaining modules, then made the filter part of the service
(`list_items(warehouse=None)`, `low_stock(warehouse=None)`) and threaded it
through the two subparsers and the dispatch. Output formatting and the JSON
shape are untouched, so the no-flag behaviour is the old behaviour. It added both
service-level and CLI-level tests (including an unknown-warehouse case and a
no-filter regression check), ran the full suite (43 tests OK) and did manual CLI
runs for `list --warehouse ams`, `low-stock --warehouse ams --json` and the
no-flag JSON. The report matches. As in task 01, running the tests left
`__pycache__` files that the UI counted among the changed files.

## 09-empty-config

- Result: PASS
- Turns: 1
- Tool calls: 5
- Tokens: 68,266 in (2,474 uncached + 65,792 cached) / 1,544 out, total 69,810, cache hit 96%
- Wall time: 14s (23:52:29 to 23:52:43 local)
- git diff --stat: `README.md | 7 +++++--`, `status.py | 4 +++-`, 2 files changed, 8 insertions(+), 3 deletions(-)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/09-empty-config

Notable behaviour: It looked at the files, reproduced the crash with
`python3 status.py --json` against the checked-in empty config, then picked
"defaults" and said why (the staging window is short and a status command
should still answer). The code change is one expression plus a comment, and the
README gets `Empty config: defaults` exactly as the task asked, with the stale
"crashes with a traceback" sentence replaced. It verified empty, whitespace-only,
partial and full configs in both text and JSON modes, and the final message names
the chosen behaviour first. The default path and the `--config` path share the
same code, so both are covered.

## 10-date-helper

- Result: PASS
- Turns: 1
- Tool calls: 16
- Tokens: 111,217 in (4,081 uncached + 107,136 cached) / 4,588 out, total 115,805, cache hit 96%
- Wall time: 28s (23:54:17 to 23:54:45 local)
- git diff --stat: `src/reports/daily.js | 10 +++-------`, `src/reports/monthly.js | 10 +++-------`, `src/ui/dates.js | 10 +++-------`, 3 files changed, 9 insertions(+), 21 deletions(-), plus new untracked `src/lib/dates.js` (21 lines)
- Workspace set: yes, /tmp/codex-eval-runs/deepseek-standard/10-date-helper

Notable behaviour: It found all three copies by reading the listed files plus the
tests and README, named the real cause (`toISOString()` renders the UTC date),
and moved the implementation into `src/lib/dates.js` built from
`getFullYear`/`getMonth`/`getDate`. Each of the three modules keeps its
`formatDate` export and now re-exports the shared helper; `shortDate` and both
summaries still work and a final grep shows no fourth implementation. It ran the
suite in four zones (Asia/Singapore, America/Los_Angeles, UTC and
Pacific/Kiritimati), which is stronger than the rubric asks. Mid-turn it noticed
that a bare `YYYY-MM-DD` string parses as UTC midnight and could reintroduce the
same off-by-one, so it made the helper treat bare dates as local; that is a small
scope addition, but it is documented and covered by the tests it ran.

---

## Harness and environment problems

These are issues with the evaluation setup, kept separate from agent behaviour.

1. Shared composer state between slices. The four slices drive one DSH server
   (port 13181, profile codex-eval) and the preset, model and effort selection in
   the composer is server state, not per-browser state. Other clients changed my
   selection twice: at 23:37 the preset showed Codex-inspired without any action
   of mine, and at 23:44 the model showed GPT-6.1-Sol with Low effort. The UI
   label is also not trustworthy on its own: the first 04 attempt displayed
   DeepSeek-V4.1-Flash / High while the request that reached the model was
   `openai-codex` / `gpt-6.1-sol` / `low`, which I confirmed from the
   `request/header` event in the session log. That attempt is excluded from the
   results and task 04 was re-run. From 05 on I read the session log right after
   sending and confirmed `deepseek-account` / `deepseek-flash` / `high` before
   counting the run; all counted runs are verified that way.

2. Workspace selection resets the model and access mode. Adding or switching the
   workspace often left the composer back on GPT-6.1-Sol at Low or Medium effort,
   and every new session started at Workspace Write, so Full access had to be
   granted again for each task through the confirmation dialog. Selecting the
   model as the last step before sending was the only order that held.

3. Stale composer labels. On one empty session the model button showed
   GPT-6.1-Sol while the open picker showed DeepSeek-V4.1-Flash checked and High.
   The two surfaces disagreed, so only the session log settled it.

4. Shared snapshot directory. patchright-cli writes snapshots under the shared
   checkout `.patchright-cli/`. Because all slices run from the same cwd, taking
   "the latest yml" returned another agent's snapshot with unrelated refs and UI
   state. I only used the path printed by my own command after that.

5. Trajectory rendering strips leading underscores from file names. `__init__.py`
   appears as `init.py` and `__pycache__` as `pycache`, which makes a transcript
   about renames and new files slightly misleading.

6. Session log directory naming. Multiple sessions exist per workspace directory
   (empty sessions from the New session button), so the first `ls` hit is not
   necessarily the run that contains the turn. Reading the first session file
   gave empty configs until I matched the log that holds the user prompt.
