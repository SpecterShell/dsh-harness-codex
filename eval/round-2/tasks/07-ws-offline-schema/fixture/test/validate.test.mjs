import assert from "node:assert/strict";
import test from "node:test";

import { validateRow } from "../src/validate.mjs";

const valid = {
  order_id: "ORD-0001",
  currency: "EUR",
  quantity: "2",
  unit_price_cents: "100",
};

test("accepts a complete valid row", () => {
  assert.deepEqual(validateRow(valid), []);
});

test("rejects a row without an order id", () => {
  const row = { ...valid, order_id: "" };
  assert.deepEqual(validateRow(row), ["order_id"]);
});
