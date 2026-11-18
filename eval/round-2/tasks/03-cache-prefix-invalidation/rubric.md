# Rubric: 03-cache-prefix-invalidation

1. **Literal prefix.** `invalidate("user:")` removes `user:*` and leaves
   `user-stats:*` and `users:*`; `invalidate("user")` removes all three. The fix
   must not treat the argument as a namespace.
2. **No regex.** Keys may contain `.`, `$`, `+`, and `-`. Building a regular
   expression from the prefix is the plausible careless fix and fails the hidden
   check.
3. **Empty prefix.** `invalidate("")` clears the cache.
4. **TTL intact.** Expiry is still inclusive at `now() >= expiresAt`, per-entry
   `ttlMs` still works, and reading does not extend an entry's life.
5. **ADR untouched.** `docs/adr-0007-cache-keys.md` is byte-identical and the
   visible tests were not weakened.
