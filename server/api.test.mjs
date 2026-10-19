import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
test("SQLite API persists records after restart and enforces request boundaries", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gj-api-"));
  let child;
  const port = String(19000 + Math.floor(Math.random() * 10000));
  const base = `http://127.0.0.1:${port}`;
  async function start() {
    child = spawn(process.execPath, ["server/index.mjs"], {
      env: { ...process.env, PORT: port, DATA_DIR: directory },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("API failed to start");
      }),
    ]);
  }
  async function stop() {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    child = null;
  }
  try {
    await start();
    assert.equal((await (await fetch(base + "/api/health")).json()).ok, true);
    const saved = await fetch(base + "/api/state/gj-hosts", {
      method: "PUT",
      body: JSON.stringify({
        value: [{ name: "Host de prueba", venue: "Sede de prueba" }],
      }),
    });
    assert.equal(saved.status, 200);
    const invalid = await fetch(base + "/api/state/unknown", {
      method: "PUT",
      body: "{}",
    });
    assert.equal(invalid.status, 404);
    const origin = await fetch(base + "/api/state/gj-hosts", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(origin.status, 403);
    const subscription = await fetch(base + "/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        subscription: {
          endpoint: "https://127.0.0.1/internal",
          keys: { p256dh: "x", auth: "x" },
        },
      }),
    });
    assert.equal(subscription.status, 400);
    const key = (await (await fetch(base + "/api/push/key")).json()).publicKey;
    assert.ok(key.length > 80);
    await stop();
    await start();
    const record = await (await fetch(base + "/api/state/gj-hosts")).json();
    assert.equal(record.value[0].name, "Host de prueba");
    assert.equal(
      (await (await fetch(base + "/api/push/key")).json()).publicKey,
      key,
    );
  } finally {
    if (child) await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("production workspace requires authentication for API and assets", async () => {
  const directory = mkdtempSync(join(tmpdir(), "gj-auth-"));
  const port = String(30000 + Math.floor(Math.random() * 5000));
  const password = (await import("node:crypto"))
    .randomBytes(24)
    .toString("hex");
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      PORT: port,
      DATA_DIR: directory,
      NODE_ENV: "production",
      APP_PASSWORD: password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("Authenticated API failed to start");
      }),
    ]);
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal((await fetch(base + "/api/state/gj-hosts")).status, 401);
    assert.equal((await fetch(base + "/")).status, 401);
    const response = await fetch(base + "/api/state/gj-hosts", {
      headers: {
        Authorization:
          "Basic " + Buffer.from("jam:" + password).toString("base64"),
      },
    });
    assert.equal(response.status, 200);
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    rmSync(directory, { recursive: true, force: true });
  }
});
