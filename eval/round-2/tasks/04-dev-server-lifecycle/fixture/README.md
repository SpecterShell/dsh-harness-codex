# items-service

A small read-only HTTP API.

```
PORT=4317 node server/index.js
```

Endpoints:

- `GET /health` returns `{"status":"ok"}`.
- `GET /api/items?limit=N&offset=M` returns `{"items":[...],"total":5}`.
  `limit` defaults to 10, must be an integer from 1 to 100, and `offset` must be
  a non-negative integer. Anything else is a client error.
- `GET /api/items/<id>` returns one item or a 404.
- Unknown routes are 404. Unsupported methods on a known route are 405 with an
  `Allow` header.

Every error response is JSON with an `error` string.
