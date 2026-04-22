import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkDatabaseHealth,
  recordAdapterRun,
  resetDatabase,
  upsertWatchlist,
} from "../db";

let tempDir = "";

describe("shared db", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-db-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("persists watchlist and adapter-run rows in sqlite", () => {
    upsertWatchlist({
      eventId: "bos-vs-nyk",
      note: "Research queue",
      priority: 91,
      status: "queued",
    });
    recordAdapterRun({
      finishedAt: "2026-04-22T06:00:05.000Z",
      recordsSeen: 4,
      recordsWritten: 4,
      source: "nba",
      startedAt: "2026-04-22T06:00:00.000Z",
      status: "ok",
    });

    const health = checkDatabaseHealth();

    expect(health).toMatchObject({
      counts: {
        watchlistCount: 1,
      },
      schemaVersion: 3,
      status: "ok",
    });
  });

  it("reopens the sqlite handle when the database path changes", () => {
    upsertWatchlist({
      eventId: "bos-vs-nyk",
      status: "queued",
    });

    const firstHealth = checkDatabaseHealth();
    expect(firstHealth.counts.watchlistCount).toBe(1);

    const secondDir = mkdtempSync(join(tmpdir(), "signal-console-db-alt-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(
      secondDir,
      "signal-console.sqlite"
    );

    const secondHealth = checkDatabaseHealth();

    expect(secondHealth.counts.watchlistCount).toBe(0);
    expect(secondHealth.counts.gameCount).toBe(0);

    rmSync(secondDir, { recursive: true, force: true });
  });
});
