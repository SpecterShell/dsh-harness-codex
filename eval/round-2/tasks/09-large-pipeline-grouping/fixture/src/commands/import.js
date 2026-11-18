import { writeFileSync } from "node:fs";

import { loadRows } from "../core/pipeline.js";

export function importCsv(path, destination) {
  const rows = loadRows(path);
  const payload = {
    rows,
    count: rows.length,
    regions: [...new Set(rows.map((row) => row.region))].sort(),
  };
  writeFileSync(destination, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}
