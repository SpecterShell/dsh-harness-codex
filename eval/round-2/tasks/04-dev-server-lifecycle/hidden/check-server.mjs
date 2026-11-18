// Hidden server check for task 04. Copied one level below the repo root.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

assert.equal(await portInUse(48173), false, "something is still listening on port 48173");

const child = spawn(process.execPath, ["server/index.js"], {
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.setDataEncoding?.("utf8");
child.stderr.on("data", (chunk) => { stderr += chunk; });

const port = await new Promise((resolve, reject) => {
  let output = "";
  const timer = setTimeout(() => reject(new Error(`server did not start: ${stderr}`)), 5000);
  child.stdout.on("data", (chunk) => {
    output += chunk;
    const match = output.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) {
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  });
  child.once("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`server exited early with ${code}: ${stderr}`));
  });
});

async function call(path, options) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const type = response.headers.get("content-type") ?? "";
  assert.match(type, /application\/json/, `${path}: content type ${type}`);
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}

try {
  let result = await call("/health");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok" });

  result = await call("/api/items");
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 5);
  assert.deepEqual(result.body.items.map((item) => item.id), [1, 2, 3, 4, 5]);

  result = await call("/api/items?limit=2");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.items.map((item) => item.id), [1, 2]);

  result = await call("/api/items?limit=2&offset=3");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.items.map((item) => item.id), [4, 5]);

  result = await call("/api/items?limit=abc");
  assert.equal(result.status, 400, `limit=abc was ${result.status}`);
  assert.equal(typeof result.body.error, "string");

  result = await call("/api/items?limit=0");
  assert.equal(result.status, 400, `limit=0 was ${result.status}`);

  result = await call("/api/items?limit=101");
  assert.equal(result.status, 400, `limit=101 was ${result.status}`);

  result = await call("/api/items?offset=-1");
  assert.equal(result.status, 400, `offset=-1 was ${result.status}`);

  result = await call("/api/items/3");
  assert.equal(result.status, 200);
  assert.equal(result.body.name, "stapler");

  result = await call("/api/items/999");
  assert.equal(result.status, 404, `missing item was ${result.status}`);
  assert.equal(typeof result.body.error, "string");

  result = await call("/nope");
  assert.equal(result.status, 404, `unknown route was ${result.status}`);
  assert.equal(typeof result.body.error, "string");

  result = await call("/api/items", { method: "POST" });
  assert.equal(result.status, 405, `POST was ${result.status}`);
  assert.match(result.headers.get("allow") ?? "", /GET/);
  assert.equal(typeof result.body.error, "string");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

assert.equal(await portInUse(port), false, "the check's own server did not stop");
console.log("hidden server checks ok");
