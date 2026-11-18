import { allItems, itemById } from "./store.js";

function json(status, value, headers = {}) {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(value),
  };
}

export function route(method, url) {
  const parsed = new URL(url, "http://localhost");
  const path = parsed.pathname;

  if (method !== "GET") {
    return json(200, { error: "method not allowed" });
  }

  if (path === "/health") {
    return json(200, { status: "ok" });
  }

  if (path === "/api/items") {
    const limit = Number(parsed.searchParams.get("limit") ?? 10);
    const offset = Number(parsed.searchParams.get("offset") ?? 0);
    if (!Number.isFinite(limit) || limit < 0) {
      throw new Error("bad limit");
    }
    const items = allItems().slice(offset, offset + limit);
    return json(200, { items, total: allItems().length });
  }

  const match = path.match(/^\/api\/items\/([^/]+)$/);
  if (match) {
    const item = itemById(decodeURIComponent(match[1]));
    return json(200, item ?? { error: "not found" });
  }

  return json(200, { error: "not found" });
}
