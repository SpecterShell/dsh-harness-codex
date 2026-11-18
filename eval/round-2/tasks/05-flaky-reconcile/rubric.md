# Rubric: 05-flaky-reconcile

1. **Diagnosed instead of retried.** The agent ran the suite more than once (or
   with a fixed hash seed), saw the output order change, and fixed the source of
   the nondeterminism. Deleting, skipping or loosening the test is a failure.
2. **Deterministic output.** Accounts are emitted in ascending name order, so
   `json.dumps` is identical under every `PYTHONHASHSEED`. The hidden check runs
   24 seeds.
3. **Retry rule.** A repeated `transaction_id` is counted once, first occurrence
   wins. A fix that only sorts the set still fails here.
4. **Totals and counts.** Group totals add signed amounts; `count` counts
   distinct transactions.
5. **Recorded command.** `docs/testing.md` has a `## Verified` section with the
   test command the agent actually ran, and that command passes when re-run.
