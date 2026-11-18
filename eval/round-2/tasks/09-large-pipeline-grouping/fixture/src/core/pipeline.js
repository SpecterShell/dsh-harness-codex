import { readFileSync } from "node:fs";

import { rowsFromText } from "./rows.js";

export function loadRows(path) {
  return rowsFromText(readFileSync(path, "utf8"));
}

export function sortRows(rows) {
  return [...rows].sort((left, right) => {
    if (left.product !== right.product) return left.product < right.product ? -1 : 1;
    return left.orderId < right.orderId ? -1 : left.orderId > right.orderId ? 1 : 0;
  });
}
