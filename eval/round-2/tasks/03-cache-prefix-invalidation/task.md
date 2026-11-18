`invalidate("user:")` in `src/cache.mjs` also drops `user-stats:*` keys. The
contract is in `docs/adr-0007-cache-keys.md`: a prefix match is literal and the
caller passes the separator when it wants namespace isolation.

Fix the cache so invalidation follows that document, including keys containing
`.`, `$` or `-`, and an empty prefix. Keep the TTL behaviour (expiry boundary,
per-entry override, reads never extend expiry). Do not edit the ADR. Run the
suite when you are done.
