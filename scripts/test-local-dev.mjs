import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "gj-browser-"));
const env = {
  ...process.env,
  PORT: "3016",
  GAMEJAM_API_PORT: "3016",
  DATA_DIR: directory,
  APP_PASSWORD: "",
  NODE_ENV: "development",
};
const children = [
  spawn(process.execPath, ["server/index.mjs"], { env, stdio: "inherit" }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5182",
      "--strictPort",
    ],
    { env, stdio: "inherit" },
  ),
];
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.all(
    children.map(
      (p) =>
        new Promise((resolve) => {
          if (p.exitCode !== null) return resolve();
          p.once("exit", resolve);
          p.kill("SIGTERM");
        }),
    ),
  );
  rmSync(directory, { recursive: true, force: true });
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
children.forEach((p) => p.on("exit", () => void stop()));
