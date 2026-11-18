export function byProduct(rows, product) {
  return rows.filter((row) => row.product === product);
}

export function byRegion(rows, region) {
  return rows.filter((row) => row.region === region);
}

export function minQuantity(rows, quantity) {
  return rows.filter((row) => row.quantity >= quantity);
}

export function maxUnitPrice(rows, cents) {
  return rows.filter((row) => row.unitPriceCents <= cents);
}

export function applyFilters(rows, filters = {}) {
  let result = rows;
  if (filters.product) result = byProduct(result, filters.product);
  if (filters.region) result = byRegion(result, filters.region);
  if (filters.minQuantity !== undefined) {
    result = minQuantity(result, filters.minQuantity);
  }
  if (filters.maxUnitPrice !== undefined) {
    result = maxUnitPrice(result, filters.maxUnitPrice);
  }
  return result;
}
