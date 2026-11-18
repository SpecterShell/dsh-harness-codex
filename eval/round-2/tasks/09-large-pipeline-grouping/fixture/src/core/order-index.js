export function indexById(rows) {
  const index = new Map();
  for (const row of rows) {
    if (index.has(row.orderId)) {
      throw new Error(`duplicate order id: ${row.orderId}`);
    }
    index.set(row.orderId, row);
  }
  return index;
}

export function indexByProduct(rows) {
  const index = new Map();
  for (const row of rows) {
    const bucket = index.get(row.product) ?? [];
    bucket.push(row);
    index.set(row.product, bucket);
  }
  return index;
}

export function uniq(values) {
  return [...new Set(values)];
}

export function groupedProducts(rows) {
  return [...indexByProduct(rows).keys()].sort();
}

export function lookup(index, id) {
  return index.get(String(id)) ?? null;
}
