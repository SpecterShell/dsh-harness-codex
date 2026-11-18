// Hidden validator check for task 07. Copied one level below the repo root.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function run(file) {
  const result = spawnSync(process.execPath, ["src/import.mjs", file], {
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin" },
  });
  let body;
  try {
    body = JSON.parse(result.stdout);
  } catch {
    throw new Error(`stdout is not JSON: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return { code: result.status, body };
}

const good = run(join(here, "good.csv"));
assert.equal(good.code, 0, JSON.stringify(good.body));
assert.deepEqual(good.body, { valid: true, rows: 5 });

const bad = run(join(here, "bad.csv"));
assert.equal(bad.code, 1, JSON.stringify(bad.body));
assert.equal(bad.body.valid, false);
assert.deepEqual(bad.body.errors, [
  { line: 4, fields: ["order_id"] },
  { line: 5, fields: ["currency"] },
  { line: 6, fields: ["quantity"] },
  { line: 7, fields: ["quantity"] },
  { line: 8, fields: ["quantity"] },
  { line: 9, fields: ["unit_price_cents"] },
  { line: 10, fields: ["unit_price_cents"] },
  { line: 11, fields: ["email"] },
]);
console.log("hidden validator checks ok");
