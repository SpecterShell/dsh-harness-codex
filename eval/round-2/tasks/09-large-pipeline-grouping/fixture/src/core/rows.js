import { rowsFromCsv } from "../lib/csv.js";
import { parseCents } from "../lib/money.js";

const REQUIRED = ["order_id", "region", "product", "quantity", "unit_price_cents"];

export function normalizeRow(raw) {
  return {
    orderId: String(raw.order_id).trim(),
    region: String(raw.region ?? "").trim(),
    product: String(raw.product).trim(),
    quantity: Number.parseInt(raw.quantity, 10),
    unitPriceCents: parseCents(raw.unit_price_cents),
  };
}

export function validateRow(row) {
  const errors = [];
  if (!row.orderId) errors.push("order_id");
  if (!row.product) errors.push("product");
  if (!Number.isInteger(row.quantity) || row.quantity < 1) errors.push("quantity");
  if (!Number.isInteger(row.unitPriceCents) || row.unitPriceCents < 0) {
    errors.push("unit_price_cents");
  }
  return errors;
}

export function rowsFromText(text) {
  return rowsFromCsv(text, { required: REQUIRED })
    .map(normalizeRow)
    .filter((row) => {
      const errors = validateRow(row);
      if (errors.length > 0) {
        throw new Error(`invalid row ${row.orderId || "?"}: ${errors.join(", ")}`);
      }
      return true;
    });
}
