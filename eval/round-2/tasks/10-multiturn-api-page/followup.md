Reviewer feedback: the endpoint also needs pagination. Add optional `limit` and
`offset` query parameters, plus a `total` field that counts the items after the
tag filter and before pagination.

`limit` must be an integer from 1 to 50 and `offset` a non-negative integer;
anything else is a `400` with an `error` string. `limit` defaults to "all
remaining items" when absent, and `offset` applies on its own too. Pagination
must never reorder the results.

Update `README.md` to document `tag`, `limit`, `offset` and `total`. Keep the
existing tests green and add tests for the new behaviour.
