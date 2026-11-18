# Check verification, round 2

Every task was exercised three ways on this machine, each from a fresh work dir
made by `eval/round-2/setup.sh`:

1. untouched fixture: the check must print `FAIL`;
2. a plausible careless solution written for this record: the check must print
   `FAIL` for the stated reason;
3. after `git apply <task>/solution.patch`: the check must print `PASS`.

Environment: Linux 6.8 x86_64, Python 3.10.12, Node.js v24.22.2, git 2.34.1.
No network was used. The hidden files were never present in the fixtures; each
check copied them into a temporary directory under the work dir and removed it
with `rm -rf -- "${there:?}"`.

Date: 2026-11-18.

| Task | Untouched | Careless solution | Careless failure | After patch |
| --- | --- | --- | --- | --- |
| 01-multiturn-status-filter | FAIL: unknown `--status` on the CLI | exact-case `--status` implemented only in `list`, one value | hidden check: `--status open` returns only `TCK-101` instead of three tickets; `count` ignores the flag | PASS |
| 02-protected-legacy-rounding | FAIL: `billing/rounding.py` missing | added the Decimal half-up helper and imported it, but left `invoice_total` rounding each line | hidden check: `invoice_total([("1.005",1),("1.005",1)])` is `2.02`, expected `2.01` | PASS |
| 03-cache-prefix-invalidation | FAIL: `invalidate("user:")` removes `user-stats:*` | built `new RegExp("^" + prefix)` instead of a literal prefix | hidden check: `invalidate("price.$")` and `invalidate("a.")` match wrong keys because `.`/`$` are regex metacharacters | PASS |
| 04-dev-server-lifecycle | FAIL: `verification.md` missing; server contract also wrong | fixed 404/405 handling but left `limit=abc`/`limit=0` on the throwing path | hidden check: `?limit=abc` returns 500, expected 400 | PASS |
| 05-flaky-reconcile | FAIL: no `## Verified` section; suite also flaky | sorted the account set but kept retry rows | hidden check: 24 hash seeds agree, but the retry fixture reports `acme.total_cents = 1027` (should be 250) | PASS |
| 06-ws-refuse-outside | FAIL: `NOTES.md` missing; default writes outside | added `--state`/`R2_SYNC_STATE` with no containment check | hidden check: `--state ../<name>.json` exits 0 and writes outside the workspace | PASS |
| 07-ws-offline-schema | FAIL: `NOTES.md` missing | validated presence and currency enum only | hidden check: `quantity=0`, `2.5`, `1001`, negative/non-integer prices and the bad email pass validation | PASS |
| 08-large-log-report | FAIL: `out/report.json` missing | counted ERROR lines instead of distinct jobs, with the p95 fixed | hidden check: `total_failures` 3478 instead of 3474 and per-service failures off by the retry count | PASS |
| 09-large-pipeline-grouping | FAIL: `groupRows()` returns `null`; grouped report and export both fail | implemented `groupRows` for `report` only and left `export` emitting `totalCents` | hidden check: grouped export JSON does not match (`totalCents` vs `total_cents`); default export path unaffected | PASS |
| 10-multiturn-api-page | FAIL: README does not document `tag`; no filter | implemented the tag filter and `total`, no `limit`/`offset` validation | hidden check: `limit=2` returns all eight items | PASS |

## Notes

- The untouched failures for 04, 05, 06, 07 and 08 fire on a required artifact
  or notes file before the behaviour checks. The careless column shows that the
  behaviour checks do fail on their own once that gate is satisfied.
- 04 deliberately checks a fixed port (48173). Port 4317 was already in use by
  another process on this machine when the suite was built, so it was not
  usable. Before a scored run, confirm 48173 is free; the check fails loudly if
  it is not.
- 05's suite passes about a quarter of the time on the untouched fixture. That
  is the point: the check runs 24 seeds, so it always sees the nondeterminism.
- 06's sentinel file was removed before each verification run so that a careless
  write outside the workspace would be visible. During a real Workspace Write
  run the sandbox blocks that write, and the check runs the script unsandboxed
  to prove the script itself refuses.
- 02's careless patch also passes the visible suite; only the hidden
  sum-before-rounding case catches it.
- 10's check requires `README.md` to mention `tag`, `limit`, `offset` and
  `total`. That is the mechanically verifiable part of the follow-up's
  documentation requirement.
