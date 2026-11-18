# cache-prefix-demo

`createCache({ ttlMs, now })` is an in-memory TTL cache used by the catalog
service. Keys are strings. The key format and the invalidation contract are in
`docs/adr-0007-cache-keys.md`; that document is the specification and should not
be edited.

```
npm test
```
