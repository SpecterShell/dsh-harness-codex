import { readFileSync } from "node:fs";

import { validateRow } from "./validate.mjs";

function parseCsv(text) {
  const lines = text.trimEnd().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line, index) => {
    const values = line.split(",");
    const row = { line: index + 2 };
    header.forEach((name, column) => {
      row[name] = values[column] ?? "";
    });
    return row;
  });
}

export function run(path) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const errors = [];
  for (const row of rows) {
    const fields = validateRow(row);
    if (fields.length > 0) errors.push({ line: row.line, fields });
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = run(process.argv[2]);
  if (errors.length === 0) {
    console.log(JSON.stringify({ valid: true, rows: 3 }));
  } else {
    console.log(JSON.stringify({ valid: false, errors }));
    process.exitCode = 1;
  }
}
