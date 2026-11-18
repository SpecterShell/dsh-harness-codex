import assert from "node:assert/strict";
import test from "node:test";

import { buildExport } from "../src/commands/export.js";

test("default export has products and total", () => {
  const payload = buildExport([
    { product: "widget", quantity: 2, unitPriceCents: 1250 },
  ]);
  assert.deepEqual(payload, {
    rows: 1,
    total_cents: 2500,
    products: [{ product: "widget", rows: 1, total_cents: 2500 }],
  });
});
