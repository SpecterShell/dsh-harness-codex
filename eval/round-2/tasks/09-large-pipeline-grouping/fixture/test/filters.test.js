import assert from "node:assert/strict";
import test from "node:test";

import { applyFilters, byRegion } from "../src/core/filters.js";

const rows = [
  { product: "widget", region: "north", quantity: 2, unitPriceCents: 100 },
  { product: "gadget", region: "south", quantity: 1, unitPriceCents: 900 },
  { product: "widget", region: "south", quantity: 5, unitPriceCents: 100 },
];

test("byRegion", () => {
  assert.deepEqual(byRegion(rows, "south").map((row) => row.product), ["gadget", "widget"]);
});

test("combined filters", () => {
  const result = applyFilters(rows, { product: "widget", minQuantity: 3 });
  assert.equal(result.length, 1);
  assert.equal(result[0].region, "south");
});
