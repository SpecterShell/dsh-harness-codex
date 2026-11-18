const GROUP_KEYS = ["key", "rows", "total_cents"];

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function describeMismatch(actual, expected) {
  const keys = Object.keys(actual).sort();
  return `keys ${keys.join(",")} != ${expected.join(",")}`;
}

export function checkProductPayload(payload) {
  const errors = [];
  if (!Number.isInteger(payload.rows) || payload.rows < 0) {
    errors.push("rows");
  }
  if (!isNonNegativeInteger(payload.total_cents)) {
    errors.push("total_cents");
  }
  if (!Array.isArray(payload.products)) {
    errors.push("products");
    return errors;
  }
  payload.products.forEach((entry, index) => {
    if (!Number.isInteger(entry.rows) || entry.rows < 0) {
      errors.push(`products[${index}].rows`);
    }
    if (!isNonNegativeInteger(entry.total_cents)) {
      errors.push(`products[${index}].total_cents`);
    }
    if (typeof entry.product !== "string" || entry.product === "") {
      errors.push(`products[${index}].product`);
    }
  });
  return errors;
}

export function checkGroupPayload(payload) {
  const errors = [];
  if (typeof payload.group_by !== "string" || payload.group_by === "") {
    errors.push("group_by");
  }
  if (!isNonNegativeInteger(payload.grand_total_cents)) {
    errors.push("grand_total_cents");
  }
  if (!Array.isArray(payload.groups)) {
    errors.push("groups");
    return errors;
  }
  payload.groups.forEach((group, index) => {
    const keys = Object.keys(group).sort();
    if (keys.join(",") !== GROUP_KEYS.join(",")) {
      errors.push(describeMismatch(group, GROUP_KEYS));
    }
    if (typeof group.key !== "string") errors.push(`groups[${index}].key`);
    if (!Number.isInteger(group.rows) || group.rows < 1) {
      errors.push(`groups[${index}].rows`);
    }
    if (!isNonNegativeInteger(group.total_cents)) {
      errors.push(`groups[${index}].total_cents`);
    }
  });
  return errors;
}

export function checkExport(payload) {
  return payload && payload.group_by
    ? checkGroupPayload(payload)
    : checkProductPayload(payload);
}
