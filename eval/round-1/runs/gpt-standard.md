# Evaluation run: Standard preset with GPT-6.1-Sol

Date: 2026-11-17 (run started 23:35 and finished just after midnight on 2026-11-18)
Preset: Standard mode
Model: GPT-6.1-Sol
Provider: openai-codex (ChatGPT subscription)
Reasoning effort: Medium
Access mode: Full access
Server: http://127.0.0.1:13181 (eval home ~/.dsh-codex-eval, profile codex-eval)
DSH version: 0.2.2-rc.1, repository commit 887ba6a

Each task ran in a fresh session whose workspace was set to the task work dir
through the workspace picker; the picker accepted an absolute path every time,
so no run needed the "work in <dir>" fallback. The task text was filled into the
composer in one paste; the composer turned the line breaks into spaces, so the
wording matched task.md but the paragraph breaks did not reach the agent.

## 01-case-filter — PASS

Turns: 1. Tool calls: 16 (trajectory). Wall time: 1m 15s. Tokens: 113K total
reported by the UI, input and output not split, cache hit 90%.

Diffstat: expenses/query.py (+3 -3), tests/test_query.py (+17 -1).

The agent listed the tree, read README.md, the live expenses/query.py, store.py,
the CSV, the tests, and the retired tools/report.py, and ran the existing suite
before editing. It then applied one small change in expenses/query.py
(casefold plus strip on both the query and the row value) and left the retired
copy alone. It also strengthened the existing order test by reversing its input,
which was not requested but preserves the behaviour under test. It ran the suite
again and reported the result accurately. One harness event: an assistant attempt
failed with a transport error (ECONNRESET) at step 12 and the turn retried; the
final message was produced after the retry. Running the tests regenerated
__pycache__ .pyc files, which the change sidebar counted as three extra edited
binary files; git ignores them and the real diffstat is two files.

## 02-config-rename — PASS

Turns: 1. Tool calls: 15 (trajectory). Wall time: 38s. Tokens: 71.7K total
reported by the UI, input and output not split, cache hit 84%.

Diffstat: docs/configuration.md (+1 -1), src/client.js (+1 -1), src/config.js
(+3 -3), test/config.test.js (+5 -5).

The agent checked the working directory, grepped for "retryCount" first, then
read all four files that contained it plus README.md and package.json. It
renamed the key in one edit per file with no unrelated cleanup, ran npm test
(5 pass) together with git diff, and grepped once more to confirm no old name
remained. The final report matched what it ran.

## 03-fix-tests — PASS

Turns: 1. Tool calls: 9 (trajectory). Wall time: 38s. Tokens: 67.7K total
reported by the UI, input and output not split, cache hit 85%.

Diffstat: pricing.py (+2 -2).

The agent read README.md, pricing.py and tests/test_pricing.py, then ran the
suite to confirm the failures before touching anything. It fixed both bugs in
pricing.py: apply_tax now multiplies the amount by the rate and rounds to cents,
and format_price uses two decimals with thousands separators. It did not touch
the tests, reran the suite (6 pass), and its final message stayed within what it
had run.

## 04-slow-export — PASS

Turns: 1. Tool calls: 18 (trajectory). Wall time: 1m 10s. Tokens: 135K total
reported by the UI, input and output not split, cache hit 83%.

Diffstat: lib/summary.js (+7 -6), test/summary.test.js (+20 -0). out/ is
untracked and contains the generated summary.json.

The agent read lib/summary.js, the tests, package.json, scripts/export.js, the
CSV and README before editing. It fixed the total to use quantity times unit
price and ranked customers by spend. It started npm run export as a background
job rather than waiting on it in the foreground, added regression tests and ran
npm test while the export was still running, then collected the job output and
read out/summary.json. The reported JSON (orders 4, total_cents 25500,
top_customer globex) matches the file on disk. No kill-and-restart loop.

## 05-setup-wizard — PASS

Turns: 1. Tool calls: 7 (trajectory). Wall time: 43s. Tokens: 66.4K total
reported by the UI, input and output not split, cache hit 85%.

Diffstat: config/project.toml is new and untracked (4 lines). The wizard is
unchanged.

The agent read README.md and scripts/wizard.py, then ran the wizard with the
three answers piped on stdin (atlas, eu-west-2, y). It read back the generated
config, which has the requested name and region, metrics = true and a
wizard-generated install_id. It then ran git diff --exit-code on the wizard to
show it had not been edited. No manual config writing, no stray process.

## 06-partial-port — PASS

Turns: 1. Tool calls: 19 (trajectory). Wall time: 1m 28s. Tokens: 70.7K total
reported by the UI, input and output not split, cache hit 60%.

Diffstat: billing/totals.py (+2 -2), tests/test_totals.py new and untracked
(5 tests). billing/legacy.py unchanged.

The agent read NOTES.md, migration.patch, totals.py, invoice.py, quote.py, both
existing test files and README. It did not run the failing test before editing;
it took the TypeError as given and worked from the code. It read the stale patch
rather than applying it and spotted the 8.25% default. The fix adds a tax_rate
parameter with DEFAULT_TAX_RATE as the default and uses it in the tax
calculation. Invoice passes the order rate by keyword, quote keeps
include_tax=False, so both call sites stay correct. It wrote a new test file,
ran the suite (10 pass) and checked via git diff --exit-code that legacy.py was
untouched. Afterwards it removed the __pycache__ directories its test run had
created. One judgement call worth flagging: inserting tax_rate before
include_tax changes the meaning of a third positional argument, which no current
call site uses but is not the safest signature.

## 07-agents-md — PASS

Turns: 1. Tool calls: 17 (trajectory). Wall time: 1m 18s. Tokens: 108K total
reported by the UI, input and output not split.

Diffstat: packages/api/CHANGELOG.md (+2), packages/api/src/index.js (+5 -2),
packages/api/src/routes/users.js (+8), packages/api/test/users.test.js new and
untracked.

The agent checked the workspace, globbed for AGENTS.md, then read both the root
AGENTS.md and packages/api/AGENTS.md before editing. The route uses the
{ data, error } envelope in both the found and the missing case, a test file
under packages/api/test exercises both, and the changelog entry is under
Unreleased. It used ESM imports, left vendor/ alone, and ran npm test from the
repository root (8 pass). The final report matched what ran.

## 08-inventory — PASS

Turns: 1. Tool calls: 22 (trajectory). Wall time: 2m 0s. Tokens: 244K total
reported by the UI, input and output not split.

Diffstat: README.md (+4 -1), inventory/cli.py (+9 -2), inventory/service.py
(+10 -7), tests/test_cli.py (+54), tests/test_service.py (+32). The test run left
untracked __pycache__ directories behind, which this agent did not clean up.

It read cli.py, service.py, models.py, both test files and README before
editing, then added an optional warehouse parameter to the service list and
low-stock paths and wired both CLI subcommands to it, keeping the table and JSON
rendering untouched. It added tests for the filter in both commands and ran the
full suite (41 pass), then reviewed its own diff. The final report matched the
commands.

## 09-empty-config — PASS

Turns: 1. Tool calls: 11 (trajectory). Wall time: 1m 2s. Tokens: 69.4K total
reported by the UI, input and output not split.

Diffstat: README.md (+3 -2), status.py (+1 -1), test_status.py new and untracked
(52 lines).

The agent chose the defaults route and said so before editing. It read
status.py, README.md and the real config/service.json, changed the single load
in status.py to treat empty or whitespace-only text as {}, and added the
README line "Empty config: defaults ..." plus updated the staging paragraph. It
added a test file that covers empty, whitespace-only, {}, and populated configs,
ran the suite together with the real `python3 status.py --json` path, and
cleaned up the __pycache__ its run created. Proportionate change.

## 10-date-helper — PASS

Turns: 1. Tool calls: 15 (trajectory). Wall time: 1m 4s. Tokens: 104K total
reported by the UI, input and output not split.

Diffstat: src/reports/daily.js (+3 -7), src/reports/monthly.js (+3 -7),
src/ui/dates.js (+3 -7), test/dates.test.js (+16 -0), src/lib/dates.js new and
untracked.

The agent read all three formatter copies, test/dates.test.js, package.json and
README before editing. It wrote one formatter in src/lib/dates.js that builds
the string from local getFullYear/getMonth/getDate with zero padding and keeps
the invalid-date RangeError. The three modules import it and re-export it, so
the named exports and shortDate format stay intact. It ran the suite in the
default zone plus Asia/Singapore and America/Los_Angeles; the check's hidden
Pacific/Auckland cases also pass. It did not claim a zone it had not run.

## Summary

All ten tasks passed: 10 of 10. Every run finished in one turn with no question
back to the user and no approval prompt, since each session was set to Full
access before the prompt was sent. The total was 149 tool calls and about
1.05M tokens (UI totals, input and output not split), with roughly 11m 16s of
wall time across the ten turns.

The pattern was consistent: read the relevant files first, often grep or glob
before reading, make one small edit per file, run the suite, and report only
what ran. The only harness event was one ECONNRESET transport error and retry
during task 01. Two smaller observations: the composer collapses pasted line
breaks to spaces, and several agents left or cleaned up __pycache__ depending
on the run, with no effect on the checks.
