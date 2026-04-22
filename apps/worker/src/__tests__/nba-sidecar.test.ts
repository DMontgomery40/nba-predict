import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getResearchGame,
  listAdapterRuns,
  resetDatabase,
} from "@signal-console/shared";

import {
  buildNbaSidecarDateWindow,
  buildNbaSidecarUrl,
  fetchNbaSidecarScoreboard,
  ingestNbaSidecarScoreboard,
  syncNbaSidecarScoreboard,
  syncNbaSidecarWindow,
} from "../nba-sidecar";

let tempDir = "";

const scoreboardPayload = {
  games: [
    {
      game: {
        awayParticipant: {
          abbreviation: "NYK",
          key: "nyk",
          name: "New York Knicks",
          shortName: "Knicks",
          side: "away" as const,
        },
        homeParticipant: {
          abbreviation: "BOS",
          key: "bos",
          name: "Boston Celtics",
          shortName: "Celtics",
          side: "home" as const,
        },
        id: "nba-0022600001",
        league: "NBA",
        scheduledStart: "2026-04-22T02:00:00.000Z",
        sourceGameKeyNba: "0022600001",
        sport: "basketball",
      },
      gameState: {
        awayScore: 108,
        capturedAt: "2026-04-22T05:55:00.000Z",
        clock: "00:42",
        finalAt: null,
        homeScore: 112,
        isFinal: false,
        period: 4,
        startedAt: "2026-04-22T02:03:00.000Z",
        status: "in-play" as const,
      },
      outcome: null,
    },
  ],
  generatedAt: "2026-04-22T05:55:00.000Z",
  requestedDate: "2026-04-22",
};

describe("nba sidecar worker integration", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-worker-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    delete process.env.NBA_SIDECAR_BASE_URL;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("builds a stable sidecar URL with query params", () => {
    expect(
      buildNbaSidecarUrl("http://127.0.0.1:9393/", "/api/v1/scoreboard", {
        date: "2026-04-22",
      })
    ).toBe("http://127.0.0.1:9393/api/v1/scoreboard?date=2026-04-22");
  });

  it("builds a sidecar date window that covers lookback and lookahead days", () => {
    expect(
      buildNbaSidecarDateWindow({
        lookaheadDays: 2,
        lookbackDays: 1,
        now: () => new Date("2026-04-22T06:00:00.000Z"),
      })
    ).toEqual(["2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"]);
  });

  it("fetches a normalized scoreboard payload from the sidecar", async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({
        data: scoreboardPayload,
      }),
      ok: true,
      status: 200,
    }));

    const payload = await fetchNbaSidecarScoreboard({
      baseUrl: "http://127.0.0.1:9393",
      fetchImpl: fetchImpl as never,
    });

    expect(payload.games).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:9393/api/v1/scoreboard"
    );
  });

  it("ingests sidecar scoreboard games into the live research store", () => {
    const result = ingestNbaSidecarScoreboard(scoreboardPayload);

    expect(result).toEqual({
      gamesSeen: 1,
      outcomesWritten: 0,
      statesWritten: 1,
    });
    expect(getResearchGame("nba-0022600001")).toMatchObject({
      game: expect.objectContaining({
        id: "nba-0022600001",
      }),
      gameState: expect.objectContaining({
        status: "in-play",
      }),
    });
  });

  it("records adapter runs for successful sidecar syncs", async () => {
    await syncNbaSidecarScoreboard({
      baseUrl: "http://127.0.0.1:9393",
      fetchImpl: (async () => ({
        json: async () => ({
          data: scoreboardPayload,
        }),
        ok: true,
        status: 200,
      })) as never,
      now: () => new Date("2026-04-22T06:00:00.000Z"),
    });

    expect(listAdapterRuns(5)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordsSeen: 1,
          source: "nba",
          status: "ok",
        }),
      ])
    );
  });

  it("syncs a scoreboard window across recent and upcoming dates", async () => {
    await syncNbaSidecarWindow({
      baseUrl: "http://127.0.0.1:9393",
      fetchImpl: (async (url: string) => ({
        json: async () => ({
          data: {
            ...scoreboardPayload,
            requestedDate: new URL(url).searchParams.get("date"),
          },
        }),
        ok: true,
        status: 200,
      })) as never,
      lookaheadDays: 1,
      lookbackDays: 1,
      now: () => new Date("2026-04-22T06:00:00.000Z"),
    });

    expect(listAdapterRuns(5)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordsSeen: 3,
          source: "nba",
          status: "ok",
        }),
      ])
    );
  });
});
