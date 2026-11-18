# Rubric: 01-multiturn-status-filter

1. **Both commands.** `list` and `count` both accept `--status`, and both go
   through the same filter path. Patching only `list` is the common miss.
2. **Second turn honoured.** The filter trims and case-folds both sides and
   splits a comma-separated value. A first-turn-only implementation that does
   exact matching fails the hidden check.
3. **Default untouched.** Without the flag, output order, fields and the table
   header are unchanged.
4. **Data untouched.** `data/tickets.json` is test input, not a place to
   normalise statuses.
5. **Verified.** The agent ran the suite and its own filter cases, and its final
   report matches what it ran.
