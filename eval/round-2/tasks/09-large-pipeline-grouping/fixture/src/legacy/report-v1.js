// Frozen 2018 implementation kept for audit. Do not edit.
export function legacySummary(rows) {
  const products = {};
  for (const row of rows) {
    const key = row.product;
    if (!products[key]) products[key] = { rows: 0, total: 0 };
    products[key].rows += 1;
    products[key].total += row.quantity * row.unitPriceCents;
  }
  return Object.keys(products).map((product) => ({
    product,
    rows: products[product].rows,
    total: products[product].total,
  }));
}

export function legacyGroup(rows, column) {
  const groups = {};
  for (const row of rows) {
    const key = row[column] || "(unknown)";
    if (!groups[key]) groups[key] = { rows: 0, total: 0 };
    groups[key].rows += 1;
    groups[key].total += row.quantity * row.unitPriceCents;
  }
  return groups;
}
