# Rubric: 01-case-filter

1. **Inspected before editing.** The agent found that `expenses/query.py` is the
   live filter and that `tools/report.py` is the retired copy, rather than
   patching the first similar function it found.
2. **Minimal fix.** The change is a small comparison fix in `expenses/query.py`.
   Loading, CSV format and return order are untouched, and the retired copy was
   left alone.
3. **Handled both sides.** Matching ignores case in the data and in the query,
   including extra spaces, not just one of them.
4. **Verified.** The agent ran the test suite, and the final report matches the
   commands it ran.
