import { describe, expect, it } from "vitest";

import {
  buildGameTriage,
  hasNavigableMarketBoard,
  type GameRow,
} from "./game-triage";

function gameRow(
  id: string,
  options: {
    activeInstrumentCount?: number;
    availableSources?: string[];
    gap: number;
    hasUnmappedMarkets?: boolean;
    scheduledStart: string;
    status: string;
    topDivergences?: GameRow["topDivergences"];
  }
): GameRow {
  return {
    activeInstrumentCount: options.activeInstrumentCount ?? 1,
    coverage: {
      activeSourceCount: 2,
      availableSources: options.availableSources ?? ["bet365", "kalshi", "nba"],
      missingSources: ["polymarket"],
      unmappedSourceMarketCount: 0,
    },
    game: {
      awayParticipant: {
        key: `${id}-away`,
        name: "Road Team",
        shortName: "Road",
      },
      homeParticipant: {
        key: `${id}-home`,
        name: "Home Team",
        shortName: "Home Club",
      },
      id,
      league: "NBA",
      scheduledStart: options.scheduledStart,
      sport: "basketball",
    },
    gameState: {
      awayScore: options.status === "in-play" ? 88 : null,
      capturedAt: new Date().toISOString(),
      clock: options.status === "in-play" ? "PT07M45.00S" : null,
      homeScore: options.status === "in-play" ? 92 : null,
      period: options.status === "in-play" ? 4 : null,
      status: options.status,
    },
    hasUnmappedMarkets: options.hasUnmappedMarkets ?? false,
    topDivergences: options.topDivergences ?? [
      {
        displayLabel: `${id} signal`,
        family: "player-prop",
        impliedProbabilityGap: options.gap,
        instrumentId: `${id}-instrument`,
        lineMismatch: false,
        severity: "critical",
      },
    ],
  };
}

describe("game triage", () => {
  it("keeps live NBA boards above older high-divergence rows", () => {
    const triage = buildGameTriage([
      gameRow("old-high-gap", {
        gap: 0.8,
        scheduledStart: "2026-05-01T02:30:00.000Z",
        status: "scheduled",
      }),
      gameRow("live-lower-gap", {
        gap: 0.55,
        scheduledStart: new Date().toISOString(),
        status: "in-play",
      }),
    ]);

    expect(triage.actionableRows[0]?.game.id).toBe("live-lower-gap");
  });

  it("does not promote provider coverage alone as a navigable market board", () => {
    const coverageOnly = gameRow("coverage-only", {
      activeInstrumentCount: 0,
      availableSources: ["bet365", "kalshi", "nba"],
      gap: 0,
      scheduledStart: "2026-05-12T02:30:00.000Z",
      status: "scheduled",
      topDivergences: [],
    });
    const scoreboardOnly = gameRow("scoreboard-only", {
      activeInstrumentCount: 0,
      availableSources: ["nba"],
      gap: 0,
      scheduledStart: "2026-05-12T02:30:00.000Z",
      status: "scheduled",
      topDivergences: [],
    });

    expect(hasNavigableMarketBoard(coverageOnly)).toBe(false);
    expect(hasNavigableMarketBoard(scoreboardOnly)).toBe(false);
  });
});
