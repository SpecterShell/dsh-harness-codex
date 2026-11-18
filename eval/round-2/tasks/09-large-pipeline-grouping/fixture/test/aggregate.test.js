import assert from "node:assert/strict";
import test from "node:test";

import { summarize } from "../src/core/aggregate.js";

const rows = [
  { product: "widget", quantity: 2, unitPriceCents: 100 },
  { product: "widget", quantity: 1, unitPriceCents: 50 },
  { product: "gizmo", quantity: 3, unitPriceCents: 200 },
];

test("summarize totals per product and overall", () => {
  const summary = summarize(rows);
  assert.equal(summary.rows, 3);
  assert.equal(summary.totalCents, 850);
  assert.deepEqual(summary.products, [
    { product: "gizmo", rows: 1, totalCents: 600 },
    { product: "widget", rows: 2, totalCents: 250 },
  ]);
});
