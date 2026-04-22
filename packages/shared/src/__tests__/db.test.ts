import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { storylines } from "@signal-console/domain";

import {
  checkDatabaseHealth,
  getReplaySelection,
  getStoryline,
  getWatchlist,
  resetDatabase,
  seedStorylines,
  setReplaySelection,
  upsertWatchlist,
} from "../db";

let tempDir = "";

describe("shared db", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-db-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
    resetDatabase();
    seedStorylines(storylines);
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("hydrates storylines and retrieves them from sqlite", () => {
    const storyline = getStoryline("boston-steam");

    expect(storyline?.frames).toHaveLength(storylines[0]?.frames.length ?? 0);
    expect(storyline?.name).toBe("Boston Steam Into Tip");
  });

  it("persists replay selection and watchlist rows", () => {
    setReplaySelection("thunder-late-flip", 2);
    upsertWatchlist({
      eventId: "mavs-thunder",
      priority: 91,
      status: "queued",
      note: "Desk wants this pinned.",
    });

    expect(getReplaySelection()).toEqual({
      storylineId: "thunder-late-flip",
      frameIndex: 2,
    });
    expect(getWatchlist()[0]?.eventId).toBe("mavs-thunder");
  });

  it("reports schema and integrity details for the active sqlite database", () => {
    const health = checkDatabaseHealth();

    expect(health).toMatchObject({
      counts: {
        storylineCount: storylines.length,
      },
      schemaVersion: 1,
      status: "ok",
    });
  });

  it("reopens the sqlite handle when the database path changes", () => {
    upsertWatchlist({
      eventId: "knicks-celtics",
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

    expect(secondHealth.counts.storylineCount).toBe(0);
    expect(secondHealth.counts.watchlistCount).toBe(0);

    rmSync(secondDir, { recursive: true, force: true });
  });
});
