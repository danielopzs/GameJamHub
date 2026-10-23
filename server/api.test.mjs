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
    assert.equal((await fetch(base + "/api/state/gj-hosts")).status, 401);
    const registered = await fetch(base + "/api/local/register", {
      method: "POST",
      body: JSON.stringify({
        jamName: "Prueba persistente",
        name: "Host de prueba",
        username: "host",
        email: "host@example.com",
        password: "prueba-segura",
      }),
    });
    assert.equal(registered.status, 201);
    const cookie = registered.headers.get("set-cookie").split(";")[0];
    const { jam } = await registered.json();
    const headers = { Cookie: cookie };
    const answers = {
      mode: "Virtual",
      framework: false,
      platform: "Discord",
      joinUrl: "https://discord.gg/gamejam-test",
      participants: 100,
      infrastructure: true,
      partner: false,
      civil: false,
      teamSize: 10,
    };
    assert.equal(
      (
        await fetch(base + `/api/local/jams/${jam.id}/onboarding`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ answers, revision: 0, complete: true }),
        })
      ).status,
      200,
    );
    const saved = await fetch(
      base + `/api/local/jams/${jam.id}/state/gj-hosts`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          value: [{ name: "Host de prueba", venue: "Sede de prueba" }],
          revision: 1,
        }),
      },
    );
    assert.equal(saved.status, 200);
    const conflict = await fetch(
      base + `/api/local/jams/${jam.id}/state/gj-hosts`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ value: [], revision: 1 }),
      },
    );
    assert.equal(conflict.status, 409);
    const invalid = await fetch(
      base + `/api/local/jams/${jam.id}/state/unknown`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ value: [], revision: 0 }),
      },
    );
    assert.equal(invalid.status, 404);
    const origin = await fetch(base + "/api/state/gj-hosts", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(origin.status, 403);
    const subscription = await fetch(base + "/api/push/subscribe", {
      method: "POST",
      headers,
      body: JSON.stringify({
        subscription: {
          endpoint: "https://127.0.0.1/internal",
          keys: { p256dh: "x", auth: "x" },
        },
      }),
    });
    assert.equal(subscription.status, 400);
    const key = (
      await (await fetch(base + "/api/push/key", { headers })).json()
    ).publicKey;
    assert.ok(key.length > 80);
    await stop();
    await start();
    const record = await (
      await fetch(base + `/api/local/jams/${jam.id}`, { headers })
    ).json();
    assert.equal(
      record.state.find((r) => r.key === "gj-hosts").value[0].name,
      "Host de prueba",
    );
    assert.equal(
      (await (await fetch(base + "/api/push/key", { headers })).json())
        .publicKey,
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
    assert.equal(response.status, 401);
    assert.equal(
      (await response.json()).error,
      "Inicia sesión para acceder a los datos del evento.",
    );
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    rmSync(directory, { recursive: true, force: true });
  }
});
