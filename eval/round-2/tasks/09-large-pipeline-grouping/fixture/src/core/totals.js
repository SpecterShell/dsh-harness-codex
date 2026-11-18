import { sumCents } from "../lib/money.js";

export function lineTotal(row) {
  return row.quantity * row.unitPriceCents;
}

export function totalOf(rows) {
  return sumCents(rows.map(lineTotal));
}

export function averageLine(rows) {
  if (rows.length === 0) return 0;
  return Math.round(totalOf(rows) / rows.length);
}

export function perProduct(rows) {
  const totals = new Map();
  for (const row of rows) {
    totals.set(row.product, (totals.get(row.product) ?? 0) + lineTotal(row));
  }
  return new Map([...totals.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  ));
}

export function share(rows, product) {
  const total = totalOf(rows);
  if (total === 0) return 0;
  return totalOf(rows.filter((row) => row.product === product)) / total;
}
