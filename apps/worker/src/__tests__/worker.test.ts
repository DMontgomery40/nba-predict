import { describe, expect, it } from "vitest";

import { createAppLogger } from "@signal-console/shared";

import {
  buildWorkerHeartbeatSummary,
  calculateBackoffDelay,
  runWorkerCycle,
} from "../index";

describe("worker runtime", () => {
  it("builds a persistence-aware heartbeat summary across demo, replay, and live snapshots", () => {
    const summary = buildWorkerHeartbeatSummary({
      now: () => new Date("2026-04-21T19:00:00.000Z"),
    });

    expect(summary.capturedAt).toBe("2026-04-21T19:00:00.000Z");
    expect(summary.demoStoryline).toBeTruthy();
    expect(summary.replayStoryline).toBeTruthy();
    expect(summary.database.status).toBe("ok");
    expect(summary.liveDegradedSources.length).toBeGreaterThan(0);
  });

  it("isolates cycle failures and applies exponential backoff instead of crashing the worker", async () => {
    const result = await runWorkerCycle({
      consecutiveFailures: 1,
      ensureLoaded: () => undefined,
      intervalMs: 1_000,
      logger: createAppLogger({ test: "worker" }),
      maxBackoffMs: 4_000,
      resolveSnapshot: (() => {
        throw new Error("boom");
      }) as never,
    });

    expect(result.ok).toBe(false);
    expect(result.nextDelayMs).toBe(4_000);
  });

  it("keeps backoff capped at the configured ceiling", () => {
    expect(calculateBackoffDelay(1_000, 0, 4_000)).toBe(1_000);
    expect(calculateBackoffDelay(1_000, 1, 4_000)).toBe(2_000);
    expect(calculateBackoffDelay(1_000, 3, 4_000)).toBe(4_000);
  });
});
