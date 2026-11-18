import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "..", "data", "items.json"), "utf8"));

export function allItems() {
  return data;
}

export function itemById(id) {
  return data.find((item) => String(item.id) === String(id));
}
