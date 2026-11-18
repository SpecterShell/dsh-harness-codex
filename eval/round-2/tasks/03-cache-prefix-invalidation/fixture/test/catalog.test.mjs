import assert from "node:assert/strict";
import test from "node:test";

import { createCatalog } from "../src/catalog.mjs";

test("add invalidates catalog entries", () => {
  const catalog = createCatalog();
  catalog.add({ id: 1, name: "pen" });
  assert.equal(catalog.read(1).name, "pen");
  catalog.add({ id: 1, name: "pencil" });
  assert.equal(catalog.read(1).name, "pencil");
});

test("add does not touch user keys", () => {
  const catalog = createCatalog();
  catalog.cache.set("user:1", "ada");
  catalog.add({ id: 1, name: "pen" });
  assert.equal(catalog.cache.get("user:1"), "ada");
});
