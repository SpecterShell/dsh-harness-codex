import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv, rowsFromCsv } from "../src/lib/csv.js";

test("parses quoted fields with commas", () => {
  const rows = parseCsv('a,b\n1,"x, y"\n');
  assert.deepEqual(rows, [["a", "b"], ["1", "x, y"]]);
});

test("parses escaped quotes", () => {
  const rows = parseCsv('a\n"say ""hi"""\n');
  assert.deepEqual(rows, [["a"], ['say "hi"']]);
});

test("maps rows to objects", () => {
  const rows = rowsFromCsv("a,b\n1,2\n", { required: ["a"] });
  assert.deepEqual(rows, [{ a: "1", b: "2" }]);
});
