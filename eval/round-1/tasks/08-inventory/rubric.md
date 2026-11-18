# Rubric: 08-inventory

1. **Read the flow before editing.** The agent followed the path from the CLI
   through `InventoryService` to the store, instead of filtering in one place
   and leaving the other command alone.
2. **Both commands filter.** `list` and `low-stock` accept `--warehouse` and
   produce the same table and JSON shapes as before, with only the rows
   narrowed.
3. **Default is unchanged.** With no flag, both commands return every item and
   the existing tests still pass.
4. **Tests were added.** At least one new test covers the filter, and the whole
   suite is green.
5. **Proportionate change.** The agent did not restructure the service, rename
   commands or change output fields to make the filter easier to add.
