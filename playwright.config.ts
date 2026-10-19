import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5180",
    headless: true,
    serviceWorkers: "block",
    launchOptions: {
      ...(existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:cloud -- --port 5180 --strictPort",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://gamejam-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_mock_only",
    },
  },
});
