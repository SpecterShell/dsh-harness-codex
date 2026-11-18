import { createCache } from "./cache.mjs";

export function createCatalog({ now = Date.now } = {}) {
  const cache = createCache({ now, ttlMs: 30_000 });
  const products = new Map();

  return {
    add(product) {
      products.set(product.id, product);
      cache.invalidate("catalog:");
      return product;
    },
    read(id) {
      const hit = cache.get(`catalog:${id}`);
      if (hit !== undefined) return hit;
      const product = products.get(id);
      if (product) cache.set(`catalog:${id}`, product);
      return product;
    },
    cache,
  };
}
