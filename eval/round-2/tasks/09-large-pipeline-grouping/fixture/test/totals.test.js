import assert from "node:assert/strict";
import test from "node:test";

import { averageLine, perProduct, share, totalOf } from "../src/core/totals.js";

const rows = [
  { product: "widget", quantity: 2, unitPriceCents: 100 },
  { product: "widget", quantity: 1, unitPriceCents: 200 },
  { product: "gizmo", quantity: 1, unitPriceCents: 400 },
];

test("total and average", () => {
  assert.equal(totalOf(rows), 800);
  assert.equal(averageLine(rows), 267);
});

test("per product map", () => {
  assert.deepEqual([...perProduct(rows).entries()], [["gizmo", 400], ["widget", 400]]);
});

test("share", () => {
  assert.equal(share(rows, "gizmo"), 0.5);
  assert.equal(share([], "gizmo"), 0);
});
