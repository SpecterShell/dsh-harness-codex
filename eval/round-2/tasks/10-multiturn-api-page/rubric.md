# Rubric: 10-multiturn-api-page

1. **Tag filter.** `tag` filters by exact tag value and keeps file order, and a
   missing tag returns every item.
2. **Second turn honoured.** `limit`, `offset` and `total` are implemented.
   The first-turn-only solution returns no `total` and fails the hidden check.
3. **Validation.** `limit` 1-50 and `offset` >= 0, integers only, `400` with an
   `error` string otherwise. `total` counts after filtering, before paging.
4. **No reordering.** Pagination slices the already-ordered list; `tag` and
   paging compose.
5. **Docs and tests.** `README.md` documents `tag`, `limit`, `offset`, `total`;
   tests were added, not weakened; `data/items.json` is untouched.
