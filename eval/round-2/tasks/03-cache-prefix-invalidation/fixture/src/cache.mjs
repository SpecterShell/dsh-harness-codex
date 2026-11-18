export function createCache({ ttlMs = 60_000, now = Date.now } = {}) {
  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      if (now() >= entry.expiresAt) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value, options = {}) {
      const ttl = options.ttlMs ?? ttlMs;
      entries.set(key, { value, expiresAt: now() + ttl });
      return value;
    },

    delete(key) {
      return entries.delete(key);
    },

    invalidate(prefix) {
      const namespace = prefix.replace(/:$/, "");
      for (const key of entries.keys()) {
        if (key.startsWith(namespace)) entries.delete(key);
      }
    },

    size() {
      return entries.size;
    },

    keys() {
      return [...entries.keys()];
    },
  };
}
