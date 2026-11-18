import { formatCents } from "../lib/money.js";
import { table } from "../lib/format.js";
import { summarize, groupRows } from "../core/aggregate.js";

export function renderReport(rows, { groupBy = null } = {}) {
  if (groupBy) {
    const groups = groupRows(rows, groupBy);
    return table(
      [groupBy.toUpperCase(), "ROWS", "TOTAL"],
      groups.map((group) => [group.key, group.rows, formatCents(group.totalCents)]),
    );
  }
  const summary = summarize(rows);
  return table(
    ["PRODUCT", "ROWS", "TOTAL"],
    summary.products.map((entry) => [entry.product, entry.rows, formatCents(entry.totalCents)]),
  );
}

export function runReport({ rows, groupBy = null, write = console.log }) {
  write(renderReport(rows, { groupBy }));
}
