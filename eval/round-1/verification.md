# Check verification, 2026-11-17

Every check was run twice on this machine: once on an untouched fixture, where
it must fail, and once after applying the task's `solution.patch`, where it must
pass.

Environment: Linux 6.8.0 x86_64, Python 3.10.12, Node.js v24.22.2, git 2.34.1.
Each run used `eval/setup.sh` with a fresh temporary directory. No network was
used.

| Task | Untouched | After patch | Failure seen on the untouched fixture |
| --- | --- | --- | --- |
| 01-case-filter | FAIL | PASS | unit tests failed (3 failures) |
| 02-config-rename | FAIL | PASS | `retryCount` still present in source, client and test |
| 03-fix-tests | FAIL | PASS | unit tests failed (5 failures) |
| 04-slow-export | FAIL | PASS | `out/summary.json` missing |
| 05-setup-wizard | FAIL | PASS | `config/project.toml` missing |
| 06-partial-port | FAIL | PASS | unit tests failed with `TypeError` (3 errors) |
| 07-agents-md | FAIL | PASS | the users route does not exist |
| 08-inventory | FAIL | PASS | `--warehouse` is not accepted by the CLI |
| 09-empty-config | FAIL | PASS | README has no `Empty config:` line |
| 10-date-helper | FAIL | PASS | `src/lib/dates.js` missing; timezone tests fail |

Notes:

- Task 04's patch includes the generated `out/summary.json`. The check first
  confirms the file exists, then re-runs the export with `FAST=1` to confirm the
  code produces it.
- Task 09's patch picks `defaults`. The check was also run against a temporary
  tree that picked `error` and documented it; that tree passed too.
- Task 08's fixture is 824 lines. The other fixtures are 131 lines or fewer.
- Task 06's check passes only when `billing/legacy.py` is byte-identical to the
  fixture, and task 07's check passes only when `vendor/` is unchanged.
