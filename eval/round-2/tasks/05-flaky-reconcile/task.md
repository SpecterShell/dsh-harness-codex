The reconcile suite is flaky: it sometimes passes and sometimes fails with no
code change. Find why and fix the cause. While you are there, make the result
match `README.md` exactly, including the retry rule for repeated
`transaction_id` values.

Do not edit `tests/test_reconcile.py`; the test is not the bug. Once the suite
is stable, add a `## Verified` section to `docs/testing.md` with the exact test
command you ran, so a reviewer can repeat it.
