# items API

A tiny in-process HTTP handler. The server adapter is not committed; call
`items.handler.handle(method, path, query)` directly.

```
GET /items
```

returns `200` with `{"items": [...]}`. Items keep the order of
`data/items.json`. Unknown paths are `404`.
