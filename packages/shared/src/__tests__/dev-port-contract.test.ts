import { describe, expect, it } from "vitest";

import { defaultApiPort, defaultE2eApiPort, defaultWebPort } from "../ports";

describe("dev port contract", () => {
  it("keeps the live dev API port separate from the e2e fixture API port", () => {
    expect(defaultApiPort).toBe(8788);
    expect(defaultE2eApiPort).toBe(8787);
    expect(defaultApiPort).not.toBe(defaultE2eApiPort);
    expect(defaultWebPort).toBe(4120);
  });
});
