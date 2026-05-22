import { describe, expect, it } from "vitest";

import playwrightConfig from "../../../../apps/web/playwright.config";
import { defaultApiPort, defaultE2eApiPort, defaultWebPort } from "../ports";

describe("dev port contract", () => {
  it("keeps the live dev API port separate from the e2e fixture API port", () => {
    expect(defaultApiPort).toBe(8788);
    expect(defaultE2eApiPort).toBe(8787);
    expect(defaultApiPort).not.toBe(defaultE2eApiPort);
    expect(defaultWebPort).toBe(4120);
  });

  it("points the Playwright web runner at the e2e fixture API target", () => {
    const configuredServers = Array.isArray(playwrightConfig.webServer)
      ? playwrightConfig.webServer
      : [playwrightConfig.webServer];
    const webServer = configuredServers.find((entry) => entry?.name === "web");

    expect(webServer?.env?.SIGNAL_CONSOLE_API_TARGET).toBe(
      `http://127.0.0.1:${defaultE2eApiPort}`
    );
    expect(webServer?.env?.VITE_API_BASE_URL).toBe(
      `http://127.0.0.1:${defaultE2eApiPort}`
    );
  });
});
