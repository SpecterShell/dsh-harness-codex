import { groupedProducts, indexById } from "../core/order-index.js";
import { lineTotal, totalOf } from "../core/totals.js";
import { formatCents } from "../lib/money.js";

export function describe(rows) {
  const index = indexById(rows);
  return {
    orders: index.size,
    products: groupedProducts(rows),
    total_cents: totalOf(rows),
    largest: rows.reduce(
      (best, row) => (best === null || lineTotal(row) > lineTotal(best) ? row : best),
      null,
    ),
  };
}

export function renderDescribe(rows) {
  const value = describe(rows);
  const largest = value.largest
    ? `${value.largest.orderId} ${formatCents(lineTotal(value.largest))}`
    : "none";
  return [
    `${value.orders} orders`,
    `products: ${value.products.join(", ") || "none"}`,
    `total: ${formatCents(value.total_cents)}`,
    `largest: ${largest}`,
  ].join("\n");
}
