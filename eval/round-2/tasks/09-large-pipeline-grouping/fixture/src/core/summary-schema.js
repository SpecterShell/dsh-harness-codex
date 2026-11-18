const PRODUCT_KEYS = ["product", "rows", "total_cents"];

export function validateProductSummary(summary) {
  const errors = [];
  if (!summary || typeof summary !== "object") return ["summary is not an object"];
  if (!Number.isInteger(summary.rows)) errors.push("rows is not an integer");
  if (!Number.isInteger(summary.total_cents)) errors.push("total_cents is not an integer");
  if (!Array.isArray(summary.products)) {
    errors.push("products is not an array");
  } else {
    for (const entry of summary.products) {
      const keys = Object.keys(entry).sort();
      if (keys.join(",") !== PRODUCT_KEYS.join(",")) {
        errors.push(`product keys: ${keys.join(",")}`);
      }
      if (!Number.isInteger(entry.total_cents)) errors.push("product total is not an integer");
    }
  }
  return errors;
}

export function validateGroupSummary(summary) {
  const errors = [];
  if (!summary || typeof summary !== "object") return ["summary is not an object"];
  if (typeof summary.group_by !== "string") errors.push("group_by is not a string");
  if (!Number.isInteger(summary.grand_total_cents)) {
    errors.push("grand_total_cents is not an integer");
  }
  if (!Array.isArray(summary.groups)) {
    errors.push("groups is not an array");
  } else {
    for (const group of summary.groups) {
      if (typeof group.key !== "string") errors.push("group key is not a string");
      if (!Number.isInteger(group.rows)) errors.push("group rows is not an integer");
      if (!Number.isInteger(group.total_cents)) errors.push("group total is not an integer");
    }
  }
  return errors;
}
