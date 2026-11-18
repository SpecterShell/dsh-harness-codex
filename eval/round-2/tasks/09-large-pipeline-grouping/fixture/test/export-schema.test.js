import assert from "node:assert/strict";
import test from "node:test";

import { checkExport, checkGroupPayload, checkProductPayload } from "../src/core/export-schema.js";

test("product payload errors", () => {
  assert.deepEqual(
    checkProductPayload({ rows: 1, total_cents: 10, products: [{ product: "a", rows: 1, total_cents: 10 }] }),
    [],
  );
  assert.ok(checkProductPayload({ rows: -1, total_cents: 10, products: [] }).includes("rows"));
});

test("group payload errors", () => {
  assert.deepEqual(
    checkGroupPayload({
      group_by: "region",
      grand_total_cents: 10,
      groups: [{ key: "east", rows: 1, total_cents: 10 }],
    }),
    [],
  );
  assert.ok(checkGroupPayload({ group_by: "region", grand_total_cents: 10, groups: [{ key: "east" }] }).length > 0);
});

test("dispatch", () => {
  assert.deepEqual(checkExport({ rows: 0, total_cents: 0, products: [] }), []);
});
