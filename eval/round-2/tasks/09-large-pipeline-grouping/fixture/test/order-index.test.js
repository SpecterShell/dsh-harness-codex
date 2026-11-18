import assert from "node:assert/strict";
import test from "node:test";

import { groupedProducts, indexById, indexByProduct, lookup, uniq } from "../src/core/order-index.js";

const rows = [
  { orderId: "1", product: "widget", region: "north", quantity: 1, unitPriceCents: 100 },
  { orderId: "2", product: "gadget", region: "south", quantity: 2, unitPriceCents: 200 },
  { orderId: "3", product: "widget", region: "east", quantity: 3, unitPriceCents: 300 },
];

test("index by id", () => {
  const index = indexById(rows);
  assert.equal(lookup(index, "2").product, "gadget");
  assert.equal(lookup(index, "9"), null);
});

test("duplicate ids are rejected", () => {
  assert.throws(() => indexById([...rows, { orderId: "1", product: "x" }]), /duplicate order id/);
});

test("index by product", () => {
  const index = indexByProduct(rows);
  assert.deepEqual([...index.keys()].sort(), ["gadget", "widget"]);
  assert.equal(index.get("widget").length, 2);
});

test("unique values and product order", () => {
  assert.deepEqual(uniq(["b", "a", "b"]), ["b", "a"]);
  assert.deepEqual(groupedProducts(rows), ["gadget", "widget"]);
});
