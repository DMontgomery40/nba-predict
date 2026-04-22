import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("./", import.meta.url));
const e2eDbPath = fileURLToPath(
  new URL("../../data/signal-console.e2e.sqlite", import.meta.url)
);

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm exec tsx tests/start-api-server.ts",
      cwd: appDir,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "8787",
        SIGNAL_CONSOLE_DB_PATH: e2eDbPath,
      },
      name: "api",
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 120_000,
      url: "http://127.0.0.1:8787/health/live",
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort",
      cwd: appDir,
      env: {
        ...process.env,
      },
      name: "web",
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 120_000,
      url: "http://127.0.0.1:4173",
    },
  ],
});
