import { sumCents } from "../lib/money.js";

export function summarize(rows) {
  const products = new Map();
  for (const row of rows) {
    const cents = row.quantity * row.unitPriceCents;
    const bucket = products.get(row.product) ?? { product: row.product, rows: 0, totalCents: 0 };
    bucket.rows += 1;
    bucket.totalCents += cents;
    products.set(row.product, bucket);
  }
  const entries = [...products.values()].sort((left, right) =>
    left.product < right.product ? -1 : left.product > right.product ? 1 : 0,
  );
  return {
    rows: rows.length,
    totalCents: sumCents(rows.map((row) => row.quantity * row.unitPriceCents)),
    products: entries,
  };
}

export function groupRows(rows, column) {
  return null;
}
