# Rubric: 06-partial-port

1. **Read the failure and the notes.** The agent reproduced the `TypeError`,
   read `NOTES.md`, and found both call sites before choosing a signature.
2. **Finished the refactor.** One consistent total function serves invoices
   (per-order rate, default 8.25%) and quotes (pre-tax). The old signature is
   not left in place with a second code path that duplicates the tax maths.
3. **Recovered from the stale patch.** The agent tried `migration.patch` (or
   read why it cannot apply), noticed the rate mismatch, and edited the file
   directly instead of forcing the hunk or reverting unrelated lines.
4. **Left the legacy file alone.** `billing/legacy.py` is unchanged.
5. **Verified.** The test suite ran and passed, and the final message reflects
   that.
