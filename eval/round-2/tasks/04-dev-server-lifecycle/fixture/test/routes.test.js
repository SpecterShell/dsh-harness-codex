import assert from "node:assert/strict";
import test from "node:test";

import { route } from "../server/routes.js";

test("health", () => {
  const result = route("GET", "/health");
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body), { status: "ok" });
});

test("list with default limit", () => {
  const result = route("GET", "/api/items");
  assert.equal(result.status, 200);
  const body = JSON.parse(result.body);
  assert.equal(body.items.length, 5);
  assert.equal(body.total, 5);
});

test("list with limit", () => {
  const body = JSON.parse(route("GET", "/api/items?limit=2").body);
  assert.deepEqual(body.items.map((item) => item.id), [1, 2]);
});

test("lookup one item", () => {
  const body = JSON.parse(route("GET", "/api/items/3").body);
  assert.equal(body.name, "stapler");
});
