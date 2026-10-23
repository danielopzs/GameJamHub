import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
if (process.env.NODE_ENV === "production" && !process.env.APP_PASSWORD)
  throw new Error("Set APP_PASSWORD before starting a production workspace");
const hash = (value) => createHash("sha256").update(value).digest();
import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { resolve, extname, sep } from "node:path";
import webpush from "web-push";
import { dueReminders } from "./schedule.mjs";
import { createLocalJams } from "./local-jams.mjs";
const dataDir = resolve(process.env.DATA_DIR || ".data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, "gamejam.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS subscriptions (endpoint TEXT PRIMARY KEY, payload TEXT NOT NULL, role TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sent (id TEXT PRIMARY KEY);",
);
const keyfile = resolve(dataDir, "vapid.json");
if (!existsSync(keyfile))
  writeFileSync(keyfile, JSON.stringify(webpush.generateVAPIDKeys()), {
    mode: 0o600,
  });
const keys = JSON.parse(readFileSync(keyfile, "utf8"));
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  keys.publicKey,
  keys.privateKey,
);
const localJams = createLocalJams(db);
if (
  !db
    .prepare("PRAGMA table_info(subscriptions)")
    .all()
    .some((column) => column.name === "jam_id")
)
  db.exec("ALTER TABLE subscriptions ADD COLUMN jam_id TEXT");
const root = resolve("dist");
const port = Number(process.env.PORT || 3001);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};
function reply(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 2_000_000) throw new Error("Payload too large");
  }
  return JSON.parse(text || "{}");
}
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (process.env.APP_PASSWORD && path !== "/api/health") {
      const authorization = req.headers.authorization || "";
      const supplied = authorization.startsWith("Basic ")
        ? Buffer.from(authorization.slice(6), "base64").toString()
        : "";
      if (
        !timingSafeEqual(
          hash(supplied),
          hash("jam:" + process.env.APP_PASSWORD),
        )
      ) {
        res.writeHead(401, {
          "WWW-Authenticate": 'Basic realm="Game Jam Manager", charset="UTF-8"',
          "Cache-Control": "no-store",
        });
        res.end("Authentication required");
        return;
      }
    }
    if (path.startsWith("/api/")) {
      // Mutating browser requests must originate from this workspace.
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        return reply(res, 403, { error: "Cross-origin request refused" });
      if (path === "/api/health")
        return reply(res, 200, { ok: true, storage: "sqlite" });
      if (await localJams.handle(req, res, path, body, reply)) return;
      if (path.startsWith("/api/push/") && !localJams.session(req))
        return reply(res, 401, {
          error: "Inicia sesión para configurar recordatorios.",
        });
      if (path === "/api/push/key" && req.method === "GET")
        return reply(res, 200, { publicKey: keys.publicKey });
      if (path === "/api/push/subscribe" && req.method === "POST") {
        const { subscription, role = "Todos", jamId } = await body(req);
        const user = localJams.session(req);
        let selectedId = user.jam_id;
        if (jamId && jamId !== selectedId) {
          if (user.role !== "organizer")
            return reply(res, 403, {
              error: "No tienes acceso a esa edición.",
            });
          localJams.owner(req, jamId);
          selectedId = jamId;
        }
        if (
          user.role !== "organizer" &&
          role !==
            (user.role === "judge"
              ? "Jueces"
              : user.role === "staff"
                ? "Organizadores"
                : "Participantes")
        )
          return reply(res, 403, {
            error: "Selecciona los avisos de tu perfil.",
          });
        const endpoint = new URL(subscription?.endpoint);
        const validHost =
          endpoint.hostname === "fcm.googleapis.com" ||
          endpoint.hostname.endsWith(".push.services.mozilla.com") ||
          endpoint.hostname === "updates.push.services.mozilla.com" ||
          endpoint.hostname.endsWith(".notify.windows.com") ||
          endpoint.hostname.endsWith(".push.apple.com");
        if (
          endpoint.protocol !== "https:" ||
          !validHost ||
          !subscription?.keys?.p256dh ||
          !subscription?.keys?.auth
        )
          return reply(res, 400, {
            error: "Invalid browser push subscription",
          });
        db.prepare(
          "INSERT OR REPLACE INTO subscriptions(endpoint,payload,role,jam_id) VALUES (?,?,?,?)",
        ).run(
          subscription.endpoint,
          JSON.stringify(subscription),
          String(role),
          selectedId,
        );
        return reply(res, 200, { ok: true });
      }
      if (path === "/api/push/unsubscribe" && req.method === "POST") {
        const { endpoint, jamId } = await body(req);
        const user = localJams.session(req);
        let selectedId = user.jam_id;
        if (jamId && jamId !== selectedId) {
          if (user.role !== "organizer")
            return reply(res, 403, { error: "Sin acceso." });
          localJams.owner(req, jamId);
          selectedId = jamId;
        }
        db.prepare(
          "DELETE FROM subscriptions WHERE endpoint=? AND jam_id=?",
        ).run(String(endpoint), selectedId);
        return reply(res, 200, { ok: true });
      }
      return reply(res, 404, { error: "Not found" });
    }
    if (req.method !== "GET")
      return reply(res, 405, { error: "Method not allowed" });
    let file = resolve(root, "." + decodeURIComponent(path));
    if (file !== root && !file.startsWith(root + sep))
      return reply(res, 403, { error: "Forbidden" });
    if (!existsSync(file) || !statSync(file).isFile())
      file = resolve(root, "index.html");
    if (!existsSync(file))
      return reply(res, 404, {
        error: "Run npm run build before starting production server",
      });
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": path === "/sw.js" ? "no-cache" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(readFileSync(file));
  } catch (error) {
    console.error("Request failed:", error.message);
    if (!res.headersSent) reply(res, 400, { error: "Invalid request" });
  }
});
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const events = db
      .prepare("SELECT jam_id,value FROM local_jam_state WHERE key='gj-event'")
      .all();
    for (const row of events) {
      const event = JSON.parse(row.value);
      const custom = JSON.parse(
        db
          .prepare(
            "SELECT value FROM local_jam_state WHERE jam_id=? AND key='gj-reminders'",
          )
          .get(row.jam_id)?.value || "[]",
      );
      for (const reminder of dueReminders(event, Date.now(), custom)) {
        for (const sub of db
          .prepare("SELECT * FROM subscriptions WHERE jam_id=?")
          .all(row.jam_id)) {
          if (
            sub.role !== "Todos" &&
            reminder.audience !== "Todos" &&
            sub.role !== reminder.role &&
            sub.role !== reminder.audience
          )
            continue;
          const id = `${row.jam_id}:${event.start}:${reminder.id}:${reminder.at}:${sub.endpoint}`;
          if (db.prepare("SELECT id FROM sent WHERE id=?").get(id)) continue;
          try {
            await webpush.sendNotification(
              JSON.parse(sub.payload),
              JSON.stringify({
                title: `${event.name} · ${reminder.role}`,
                body: reminder.text,
              }),
              { TTL: 3600 },
            );
            db.prepare("INSERT OR IGNORE INTO sent VALUES (?)").run(id);
          } catch (error) {
            if ([404, 410].includes(error.statusCode))
              db.prepare("DELETE FROM subscriptions WHERE endpoint=?").run(
                sub.endpoint,
              );
            else
              console.error(
                "Push delivery failed:",
                error.statusCode || error.message,
              );
          }
        }
      }
    }
  } finally {
    running = false;
  }
}
const timer = setInterval(
  () => tick().catch((e) => console.error(e.message)),
  30000,
);
timer.unref();
server.listen(port, "0.0.0.0", () =>
  console.log(`Game Jam API and production server listening on ${port}`),
);
process.on("SIGTERM", () => {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
