// Hidden grouping check for task 09. Copied one level below the repo root.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function cli(...args) {
  const result = spawnSync(process.execPath, ["src/cli.js", ...args], {
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin" },
  });
  assert.equal(result.status, 0, `cli failed: ${args.join(" ")}\n${result.stderr}`);
  return result.stdout;
}

function json(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

const defaultReport = readFileSync(join(here, "default-report.txt"), "utf8");
assert.equal(cli("report", "--data", "data/sales.csv"), defaultReport);

const defaultExport = json(join(here, "default-export.json"));
assert.deepEqual(json(join(here, "current-default.json")), defaultExport);

const groupedReport = readFileSync(join(here, "grouped-report.txt"), "utf8");
assert.equal(cli("report", "--data", "data/sales.csv", "--group-by", "region"), groupedReport);

const currentGrouped = join(here, "current-grouped.json");
cli("export", "--data", "data/sales.csv", "--group-by", "region", "--out", currentGrouped);
assert.deepEqual(json(currentGrouped), json(join(here, "grouped-export.json")));

const edge = join(here, "edge.csv");
assert.equal(
  cli("report", "--data", edge, "--group-by", "region"),
  readFileSync(join(here, "edge-report.txt"), "utf8"),
);

const edgeOut = join(here, "edge-out.json");
cli("export", "--data", edge, "--group-by", "region", "--out", edgeOut);
assert.deepEqual(json(edgeOut), json(join(here, "edge-export.json")));

console.log("hidden grouping checks ok");
