import { writeFileSync } from "node:fs";

import { summarize, groupRows } from "../core/aggregate.js";

export function buildExport(rows, { groupBy = null } = {}) {
  if (!groupBy) {
    const summary = summarize(rows);
    return {
      rows: summary.rows,
      total_cents: summary.totalCents,
      products: summary.products.map((entry) => ({
        product: entry.product,
        rows: entry.rows,
        total_cents: entry.totalCents,
      })),
    };
  }
  return {
    group_by: groupBy,
    groups: groupRows(rows, groupBy),
    grand_total_cents: rows.reduce((total, row) => total + row.quantity * row.unitPriceCents, 0),
  };
}

export function writeExport(rows, path, options = {}) {
  const payload = buildExport(rows, options);
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}
