import assert from "node:assert/strict";
import test from "node:test";

import { createCache } from "../src/cache.mjs";

function clock(start = 0) {
  let value = start;
  return { now: () => value, advance: (ms) => { value += ms; } };
}

test("stores values and returns them", () => {
  const cache = createCache();
  cache.set("user:1", "ada");
  assert.equal(cache.get("user:1"), "ada");
  assert.equal(cache.get("user:2"), undefined);
});

test("entries expire at the ttl boundary", () => {
  const time = clock();
  const cache = createCache({ ttlMs: 100, now: time.now });
  cache.set("user:1", "ada");
  time.advance(99);
  assert.equal(cache.get("user:1"), "ada");
  time.advance(1);
  assert.equal(cache.get("user:1"), undefined);
});

test("per-entry ttl overrides the default", () => {
  const time = clock();
  const cache = createCache({ ttlMs: 100, now: time.now });
  cache.set("slow:1", "value", { ttlMs: 500 });
  time.advance(200);
  assert.equal(cache.get("slow:1"), "value");
});

test("invalidate removes keys with the given prefix", () => {
  const cache = createCache();
  cache.set("user:1", "a");
  cache.set("user:2", "b");
  cache.set("admin:1", "c");
  cache.invalidate("user:");
  assert.deepEqual(cache.keys().sort(), ["admin:1"]);
});

test("delete removes one key", () => {
  const cache = createCache();
  cache.set("user:1", "a");
  assert.equal(cache.delete("user:1"), true);
  assert.equal(cache.delete("user:1"), false);
});
