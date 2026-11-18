import { createServer } from "node:http";

import { route } from "./routes.js";

const port = Number(process.env.PORT ?? 4317);

const server = createServer((request, response) => {
  try {
    const result = route(request.method, request.url);
    response.writeHead(result.status, result.headers);
    response.end(result.body);
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "internal error" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(`listening on http://127.0.0.1:${address.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
