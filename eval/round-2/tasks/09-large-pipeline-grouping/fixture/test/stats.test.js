import assert from "node:assert/strict";
import test from "node:test";

import { stats } from "../src/commands/stats.js";

test("stats over an empty selection", () => {
  assert.deepEqual(stats([]), {
    rows: 0,
    products: 0,
    units: 0,
    min_quantity: 0,
    max_quantity: 0,
    min_unit_price_cents: 0,
    max_unit_price_cents: 0,
    total_cents: 0,
  });
});
