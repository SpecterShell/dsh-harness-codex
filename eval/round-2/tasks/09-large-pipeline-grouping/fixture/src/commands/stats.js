import { summarize } from "../core/aggregate.js";
import { applyFilters } from "../core/filters.js";

export function stats(rows, filters = {}) {
  const selected = applyFilters(rows, filters);
  const summary = summarize(selected);
  const quantities = selected.map((row) => row.quantity);
  const prices = selected.map((row) => row.unitPriceCents);
  return {
    rows: selected.length,
    products: summary.products.length,
    units: quantities.reduce((total, value) => total + value, 0),
    min_quantity: quantities.length ? Math.min(...quantities) : 0,
    max_quantity: quantities.length ? Math.max(...quantities) : 0,
    min_unit_price_cents: prices.length ? Math.min(...prices) : 0,
    max_unit_price_cents: prices.length ? Math.max(...prices) : 0,
    total_cents: summary.totalCents,
  };
}

export function runStats({ rows, write = console.log }) {
  write(JSON.stringify(stats(rows), null, 2));
}
