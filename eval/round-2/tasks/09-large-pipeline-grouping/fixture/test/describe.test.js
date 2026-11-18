import assert from "node:assert/strict";
import test from "node:test";

import { describe } from "../src/commands/describe.js";

test("describe picks the largest line", () => {
  const rows = [
    { orderId: "1", product: "widget", quantity: 1, unitPriceCents: 100 },
    { orderId: "2", product: "widget", quantity: 4, unitPriceCents: 100 },
  ];
  const value = describe(rows);
  assert.equal(value.total_cents, 500);
  assert.equal(value.largest.orderId, "2");
  assert.deepEqual(value.products, ["widget"]);
});
