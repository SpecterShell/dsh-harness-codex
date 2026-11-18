The items endpoint should support filtering by tag. `GET /items?tag=office`
must return only items with that tag, in the same order as `data/items.json`.
Without a tag, the response must be exactly what it is today. Keep the handler
callable as `handle(method, path, query)`.
