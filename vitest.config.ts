import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
      "@signal-console/domain": fileURLToPath(
        new URL("./packages/domain/src/index.ts", import.meta.url)
      ),
      "@signal-console/shared": fileURLToPath(
        new URL("./packages/shared/src/index.ts", import.meta.url)
      ),
      "@signal-console/adapters": fileURLToPath(
        new URL("./packages/adapters/src/index.ts", import.meta.url)
      ),
      "@signal-console/ui": fileURLToPath(
        new URL("./packages/ui/src/index.ts", import.meta.url)
      ),
    },
  },
  test: {
    coverage: {
      exclude: [
        "**/dist/**",
        "**/node_modules/**",
        "**/tests/**",
        "**/*.config.*",
        "**/src/main.tsx",
      ],
      provider: "v8",
      reporter: ["text", "lcov"],
    },
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    setupFiles: [fileURLToPath(new URL("./vitest.setup.ts", import.meta.url))],
  },
});
