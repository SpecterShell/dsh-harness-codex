// Hidden behaviour check for task 03. Copied one level below the repo root.
import assert from "node:assert/strict";

import { createCache } from "../src/cache.mjs";

function clock(start = 0) {
  let value = start;
  return { now: () => value, advance: (ms) => { value += ms; } };
}

function fresh() {
  const time = clock();
  const cache = createCache({ ttlMs: 100, now: time.now });
  cache.set("user:1", "u1");
  cache.set("user:2", "u2");
  cache.set("user-stats:1", "s1");
  cache.set("users:1", "many");
  cache.set("admin:1", "a1");
  cache.set("price.$", "dollar");
  cache.set("price.$x", "dollar-x");
  cache.set("a.b", "dot");
  cache.set("a+b", "plus");
  return { cache, time };
}

{
  const { cache } = fresh();
  cache.invalidate("user:");
  assert.deepEqual(cache.keys().sort(), [
    "a+b", "a.b", "admin:1", "price.$", "price.$x", "user-stats:1",
    "users:1",
  ]);
}

{
  const { cache } = fresh();
  cache.invalidate("user");
  assert.deepEqual(cache.keys().sort(), [
    "a+b", "a.b", "admin:1", "price.$", "price.$x",
  ]);
}

{
  const { cache } = fresh();
  cache.invalidate("price.$");
  assert.deepEqual(cache.keys().sort(), [
    "a+b", "a.b", "admin:1", "user-stats:1", "user:1", "user:2", "users:1",
  ]);
}

{
  const { cache } = fresh();
  cache.invalidate("a.");
  assert.deepEqual(cache.keys().sort(), [
    "a+b", "admin:1", "price.$", "price.$x", "user-stats:1", "user:1",
    "user:2", "users:1",
  ]);
}

{
  const { cache } = fresh();
  cache.invalidate("");
  assert.deepEqual(cache.keys(), []);
  assert.equal(cache.get("user:1"), undefined);
}

{
  const time = clock();
  const cache = createCache({ ttlMs: 100, now: time.now });
  cache.set("k:1", "v");
  time.advance(100);
  assert.equal(cache.get("k:1"), undefined, "expiry is inclusive");
  cache.set("k:2", "v", { ttlMs: 500 });
  cache.set("k:3", "v");
  time.advance(400);
  assert.equal(cache.get("k:2"), "v");
  assert.equal(cache.get("k:3"), undefined);
}

{
  const time = clock();
  const cache = createCache({ ttlMs: 10, now: time.now });
  cache.set("k:1", "v");
  time.advance(9);
  assert.equal(cache.get("k:1"), "v");
  time.advance(1);
  assert.equal(cache.get("k:1"), undefined);
  time.advance(-5);
}

{
  const { cache } = fresh();
  cache.invalidate("user:");
  cache.set("user:3", "u3");
  assert.equal(cache.get("user:3"), "u3");
  assert.equal(cache.get("user-stats:1"), "s1");
}

console.log("hidden cache checks ok");
