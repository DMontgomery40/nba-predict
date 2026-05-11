import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAppLogger, resetDatabase } from "@signal-console/shared";

import {
  buildWorkerHeartbeatSummary,
  calculateBackoffDelay,
  runWorkerCycle,
} from "../index";

let tempDir = "";

describe("worker runtime", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-worker-runtime-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.KALSHI_LIVE_LOOKBACK_DAYS;
    delete process.env.KALSHI_LIVE_MAX_EVENTS;
    delete process.env.KALSHI_API_KEY;
    delete process.env.NBA_SIDECAR_BASE_URL;
    delete process.env.ODDS_API_IO_KEY;
    delete process.env.ODDS_API_KEY;
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("builds a persistence-aware heartbeat summary for the live worker", () => {
    const summary = buildWorkerHeartbeatSummary({
      now: () => new Date("2026-04-21T19:00:00.000Z"),
    });

    expect(summary.capturedAt).toBe("2026-04-21T19:00:00.000Z");
    expect(summary.bet365GamesMatched).toBe(0);
    expect(summary.bet365SourceMarketsObserved).toBe(0);
    expect(summary.database.status).toBe("ok");
    expect(summary.kalshiGamesMatched).toBe(0);
    expect(summary.kalshiSourceMarketsObserved).toBe(0);
    expect(summary.nbaGamesObserved).toBe(0);
    expect(summary.nbaSidecarConfigured).toBe(false);
    expect(summary.polymarketGamesMatched).toBe(0);
    expect(summary.polymarketSourceMarketsObserved).toBe(0);
    expect(summary.providerFailures).toEqual([]);
  });

  it("isolates cycle failures and applies exponential backoff instead of crashing the worker", async () => {
    process.env.NBA_SIDECAR_BASE_URL = "http://127.0.0.1:9393";

    const result = await runWorkerCycle({
      consecutiveFailures: 1,
      intervalMs: 1_000,
      logger: createAppLogger({ test: "worker" }),
      maxBackoffMs: 4_000,
      syncNbaSidecar: (() => {
        throw new Error("boom");
      }) as never,
      syncPolymarket: (async () => ({
        finishedAt: "2026-04-22T06:00:00.000Z",
        gamesMatched: 0,
        marketsSeen: 0,
        ok: true as const,
        quoteObservationsWritten: 0,
        rawPayloadsWritten: 0,
        recordsSeen: 0,
        recordsWritten: 0,
        sourceMarketsObserved: 0,
        startedAt: "2026-04-22T06:00:00.000Z",
      })) as never,
    });

    expect(result.ok).toBe(false);
    expect(result.nextDelayMs).toBe(4_000);
  });

  it("runs the NBA sidecar sync before emitting the heartbeat when configured", async () => {
    process.env.NBA_SIDECAR_BASE_URL = "http://127.0.0.1:9393";
    process.env.ODDS_API_KEY = "odds-key";
    process.env.KALSHI_API_KEY = "kalshi-key";

    const syncNbaSidecar = vi.fn(async () => ({
      dateErrors: [] as Array<{ date: string; error: string }>,
      datesSynced: ["2026-04-21", "2026-04-22", "2026-04-23"],
      finishedAt: "2026-04-22T06:00:00.000Z",
      gamesSeen: 3,
      ok: true as const,
      outcomesWritten: 1,
      startedAt: "2026-04-22T06:00:00.000Z",
      statesWritten: 3,
    }));
    const syncBet365 = vi.fn(async () => ({
      bookmaker: "Bet365" as const,
      finishedAt: "2026-04-22T06:00:00.000Z",
      gamesMatched: 2,
      marketsSeen: 3,
      ok: true as const,
      quoteObservationsWritten: 6,
      rawPayloadsWritten: 6,
      recordsSeen: 6,
      recordsWritten: 18,
      source: "bet365" as const,
      sourceMarketsObserved: 6,
      startedAt: "2026-04-22T06:00:00.000Z",
    }));
    const syncKalshi = vi.fn(async () => ({
      bookmaker: "Kalshi" as const,
      eventsFetched: 2,
      eventsSeen: 2,
      finishedAt: "2026-04-22T06:00:00.000Z",
      gamesMatched: 1,
      marketErrors: [],
      marketsSeen: 2,
      milestonesSeen: 1,
      ok: true as const,
      quoteObservationsWritten: 4,
      rawPayloadsWritten: 4,
      recordsSeen: 4,
      recordsWritten: 12,
      source: "kalshi" as const,
      sourceMarketsObserved: 4,
      startedAt: "2026-04-22T06:00:00.000Z",
      unmatchedEventTickers: [],
    }));
    const syncPolymarket = vi.fn(async () => ({
      finishedAt: "2026-04-22T06:00:00.000Z",
      gamesMatched: 2,
      marketsSeen: 6,
      ok: true as const,
      quoteObservationsWritten: 12,
      rawPayloadsWritten: 12,
      recordsSeen: 12,
      recordsWritten: 36,
      sourceMarketsObserved: 12,
      startedAt: "2026-04-22T06:00:00.000Z",
    }));

    const result = await runWorkerCycle({
      logger: createAppLogger({ test: "worker" }),
      now: () => new Date("2026-04-22T06:00:00.000Z"),
      syncBet365,
      syncKalshi,
      syncNbaSidecar,
      syncPolymarket,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.bet365GamesMatched).toBe(2);
      expect(result.summary.bet365SourceMarketsObserved).toBe(6);
      expect(result.summary.kalshiGamesMatched).toBe(1);
      expect(result.summary.kalshiSourceMarketsObserved).toBe(4);
      expect(result.summary.nbaGamesObserved).toBe(3);
      expect(result.summary.nbaSidecarConfigured).toBe(true);
      expect(result.summary.polymarketGamesMatched).toBe(2);
      expect(result.summary.polymarketSourceMarketsObserved).toBe(12);
    }
    expect(syncBet365).toHaveBeenCalledOnce();
    expect(syncKalshi).toHaveBeenCalledOnce();
    expect(syncKalshi).toHaveBeenCalledWith(
      expect.objectContaining({
        maxEvents: 200,
        minimumStartDate: "2026-04-20",
      })
    );
    expect(syncNbaSidecar).toHaveBeenCalledOnce();
    expect(syncPolymarket).toHaveBeenCalledOnce();
  });

  it("keeps later market providers running when bet365 is rate-limited", async () => {
    process.env.ODDS_API_KEY = "odds-key";
    process.env.KALSHI_API_KEY = "kalshi-key";

    const syncBet365 = vi.fn(async () => {
      throw new Error(
        "Odds-API events request for Bet365 failed with status 429."
      );
    });
    const syncKalshi = vi.fn(async () => ({
      bookmaker: "Kalshi" as const,
      eventsFetched: 2,
      eventsSeen: 2,
      finishedAt: "2026-04-22T06:00:00.000Z",
      gamesMatched: 1,
      marketErrors: [],
      marketsSeen: 2,
      milestonesSeen: 1,
      ok: true as const,
      quoteObservationsWritten: 4,
      rawPayloadsWritten: 4,
      recordsSeen: 4,
      recordsWritten: 12,
      source: "kalshi" as const,
      sourceMarketsObserved: 4,
      startedAt: "2026-04-22T06:00:00.000Z",
      unmatchedEventTickers: [],
    }));
    const syncPolymarket = vi.fn(async () => ({
      finishedAt: "2026-04-22T06:00:00.000Z",
      gamesMatched: 2,
      marketsSeen: 6,
      ok: true as const,
      quoteObservationsWritten: 12,
      rawPayloadsWritten: 12,
      recordsSeen: 12,
      recordsWritten: 36,
      sourceMarketsObserved: 12,
      startedAt: "2026-04-22T06:00:00.000Z",
    }));

    const result = await runWorkerCycle({
      logger: createAppLogger({ test: "worker" }),
      now: () => new Date("2026-04-22T06:00:00.000Z"),
      syncBet365: syncBet365 as never,
      syncKalshi,
      syncPolymarket,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.providerFailures).toHaveLength(1);
      expect(result.summary.providerFailures[0]?.source).toBe("bet365");
      expect(result.summary.kalshiSourceMarketsObserved).toBe(4);
      expect(result.summary.polymarketSourceMarketsObserved).toBe(12);
    }
    expect(syncBet365).toHaveBeenCalledOnce();
    expect(syncKalshi).toHaveBeenCalledOnce();
    expect(syncKalshi).toHaveBeenCalledWith(
      expect.objectContaining({
        maxEvents: 200,
        minimumStartDate: "2026-04-20",
      })
    );
    expect(syncPolymarket).toHaveBeenCalledOnce();
  });

  it("keeps backoff capped at the configured ceiling", () => {
    expect(calculateBackoffDelay(1_000, 0, 4_000)).toBe(1_000);
    expect(calculateBackoffDelay(1_000, 1, 4_000)).toBe(2_000);
    expect(calculateBackoffDelay(1_000, 3, 4_000)).toBe(4_000);
  });
});
