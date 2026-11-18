The items service does not match its README. Missing routes, missing items and
unsupported methods all come back as `200`, and `?limit=abc` produces a `500`.
Fix the server so status codes and JSON errors follow `README.md`.

Verify it the way a user would: start the real server on port 48173, query
`/health`, `/api/items?limit=2`, an invalid limit, a missing item and an unknown
route, then stop the server. Leave nothing listening on 48173. Write
`verification.md` with the exact commands you used, the port, a table of request
and observed status, and the command that stopped the server. Run `npm test` too.
