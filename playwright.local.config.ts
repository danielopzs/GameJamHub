import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests",
  testMatch: "local.spec.ts",
  outputDir: "test-results/local",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5182",
    serviceWorkers: "block",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {},
  },
  webServer: {
    command: "node scripts/test-local-dev.mjs",
    url: "http://127.0.0.1:5182",
    reuseExistingServer: false,
  },
});
