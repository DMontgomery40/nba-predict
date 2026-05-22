import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

import {
  defaultApiPort,
  defaultWebPort,
} from "../../packages/shared/src/ports";

const apiTarget =
  process.env.SIGNAL_CONSOLE_API_TARGET ?? `http://127.0.0.1:${defaultApiPort}`;
const clientApiBaseUrl =
  process.env.VITE_API_BASE_URL ?? process.env.SIGNAL_CONSOLE_API_TARGET;

if (clientApiBaseUrl) {
  process.env.VITE_API_BASE_URL = clientApiBaseUrl;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@signal-console/domain": fileURLToPath(
        new URL("../../packages/domain/src/index.ts", import.meta.url)
      ),
      "@signal-console/ui": fileURLToPath(
        new URL("../../packages/ui/src/index.ts", import.meta.url)
      ),
    },
  },
  server: {
    port: defaultWebPort,
    proxy: {
      "/api": apiTarget,
      "/health": apiTarget,
    },
  },
});
