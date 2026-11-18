# Rubric: 10-date-helper

1. **Found all copies.** The agent searched for the duplicated formatter and
   identified all three files before editing.
2. **Correct local-date logic.** The helper builds the date from local year,
   month and day, so a local midnight does not slip into the previous UTC day.
3. **One helper, three users.** `src/lib/dates.js` holds the implementation, and
   the three modules keep their public exports while delegating to it. No fourth
   copy is left behind.
4. **Verified across timezones.** Tests pass under a positive-offset zone such
   as Pacific/Auckland, not just the machine's default. The final message does
   not claim a check it did not run.
5. **Behaviour preserved.** The daily and monthly summaries still group by day
   and month, and `shortDate` keeps its format.
