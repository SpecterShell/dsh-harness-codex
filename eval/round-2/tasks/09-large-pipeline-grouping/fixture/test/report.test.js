import assert from "node:assert/strict";
import test from "node:test";

import { renderReport } from "../src/commands/report.js";

test("default report lists products", () => {
  const output = renderReport([
    { product: "widget", quantity: 1, unitPriceCents: 1250 },
    { product: "gizmo", quantity: 2, unitPriceCents: 500 },
  ]);
  assert.match(output, /^PRODUCT\s+ROWS\s+TOTAL/);
  assert.match(output, /gizmo\s+1\s+\$10\.00/);
  assert.match(output, /widget\s+1\s+\$12\.50/);
});
