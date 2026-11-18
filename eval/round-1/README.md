# Preset evaluation suite

Round 1: ten small coding tasks for comparing the `Codex-inspired` preset with
`Standard` on the same model. Each task starts from a fresh fixture and ends
with an automatic check plus a short human rubric. The point is to see how the
two presets work, not to produce a score. [Round 2](../round-2/README.md) adds ten
harder tasks and stricter checks.

## Layout

```
eval/round-1/
  setup.sh                    copy a fixture into an empty work dir and commit it
  run-check.sh                run one task's check and print PASS or FAIL
  results.md                  round-1 table to fill in while running tasks
  analysis.md                 round-1 comparison write-up
  verification.md             round-1 fail-before/pass-after record for the checks
  runs/                       notes from the four round-1 slices
  tasks/<nn-slug>/            round-1 task directories
    task.md                   prompt to paste into a new session, verbatim
    fixture/                  starting repository
    check.sh                  automatic check, no network
    rubric.md                 review criteria for a human
    solution.patch            reference fix in git apply format (re-verification only)

```

The checks are behaviour checks. They do not look for a particular tool or a
particular diff style. Task 07 also checks that an instruction from a nested
`AGENTS.md` was followed, because that is the behaviour under test.

## Running one task by hand

Use a separate DSH home and profile, as described under "Trying a local build"
in [CONTRIBUTING.md](../CONTRIBUTING.md). Do not reuse the profile from
day-to-day sessions, since global instructions and skills would change the
result. For the ChatGPT rows, install `dsh-codex-subscription` in that profile
and sign in first.

1. Pick a task and prepare a fresh work dir. Setup refuses to touch a non-empty
   directory, so use a new path per run.

   ```sh
   eval/round-1/setup.sh eval/round-1/tasks/03-fix-tests /tmp/eval-03-standard-deepseek
   ```

2. Open the Web UI and create a new session. Set the workspace to the work dir,
   choose the preset, the model and the reasoning effort before typing. Use the
   same access mode for both presets. The tasks do not need network, but they do
   need to write inside the work dir.

3. Paste `task.md` verbatim. Do not add hints, do not mention the rubric, and do
   not answer questions the agent did not ask. If the agent asks a question that
   the prompt leaves open, answer it as a normal user would and note the answer.

4. Wait until the turn finishes. Record the session link before closing the tab.

5. Run the check against the work dir:

   ```sh
   eval/round-1/run-check.sh eval/round-1/tasks/03-fix-tests /tmp/eval-03-standard-deepseek
   ```

6. Read the transcript once and fill the rubric. Record anything that would not
   show up in the pass/fail result, such as a wrong first fix, a failed patch, a
   command that had to be polled, or a final message that claims more than the
   commands show.

A task is finished when the check prints PASS and the rubric is filled. If the
agent stops early, do not prompt it again for the scored run. A follow-up turn
is a different run; note it in the comments instead.

## What to record per run

Put one row per task, preset and model in `results.md`.

- preset (`Codex-inspired` or `Standard`), exactly as the session header shows it
- model id and reasoning effort
- result: PASS or FAIL
- number of turns (user-visible assistant turns)
- number of tool calls (the Trajectory tab counts them)
- input and output tokens, when the UI shows them
- wall time from sending the prompt to the turn ending
- notable behaviour: wrong first attempt, failed patch, commands polled, tests
  run before editing, files touched outside the task, claim that does not match
  the commands shown

The turn and tool counts matter more than wall time here. A preset that reads
first and edits once looks different from one that patches three times and then
runs the tests.

## Verifying the checks

Every task ships with `solution.patch`. To confirm a check still passes on a
known-good tree:

```sh
tmp=$(mktemp -d)
eval/round-1/setup.sh eval/round-1/tasks/03-fix-tests "$tmp"
git -C "$tmp" apply "$PWD/eval/round-1/tasks/03-fix-tests/solution.patch"
eval/round-1/run-check.sh eval/round-1/tasks/03-fix-tests "$tmp"
```

The same check must print FAIL on an untouched fixture. Both directions are
recorded in [verification.md](verification.md). The patches exist only to keep
the checks honest; they are not a style reference and are not part of any task
presented to an agent.

## Tasks

| Task | What it exercises |
| --- | --- |
| 01-case-filter | reading the used implementation instead of a decoy copy, small fix |
| 02-config-rename | searching a codebase and renaming one key across code, tests and docs |
| 03-fix-tests | running a failing test suite and fixing two independent bugs |
| 04-slow-export | a command that outlives the first wait, then a wrong generated result |
| 05-setup-wizard | feeding answers to an interactive setup script |
| 06-partial-port | recovering from a stale patch and finishing a half-applied refactor |
| 07-agents-md | following a root and a nested `AGENTS.md`, including a changelog rule |
| 08-inventory | adding a filter through a small multi-module Python service |
| 09-empty-config | choosing and documenting a behaviour the prompt leaves open |
| 10-date-helper | removing three duplicated formatters and keeping local-date output |

Fixtures are under 300 lines except task 08, which is around 800 lines across
several modules so that finding the right place takes real reading.

## Round 2

[../round-2/](../round-2/README.md) keeps this layout and adds hidden checks,
protected files, two multi-turn tasks, two Workspace Write tasks and larger
fixtures. Its results are in [../round-2/results.md](../round-2/results.md).

## Results

Fill [results.md](results.md) for round 1 and
[../round-2/results.md](../round-2/results.md) for round 2. The model column initially
has two entries: `DeepSeek-V4.1-Flash` and the newest ChatGPT subscription model
available in the evaluation profile. Replace the latter with the exact model id
shown by the UI before running, and keep one model string per run so rows stay
comparable.
