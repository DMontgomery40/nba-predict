import { describe, expect, it } from "vitest";

import { formatGameScoreClock, getGameOperationalState } from "./game-state";

describe("game-state formatting", () => {
  it("shows scheduled tip time instead of a generic scheduled status", () => {
    const row = {
      game: {
        scheduledStart: "2099-05-21T00:30:00.000Z",
      },
      gameState: {
        awayScore: 0,
        clock: null,
        homeScore: 0,
        isFinal: false,
        period: 0,
        status: "scheduled",
      },
      outcome: null,
    };

    expect(getGameOperationalState(row).kind).toBe("scheduled");
    expect(formatGameScoreClock(row)).toMatch(/^Tip /);
    expect(formatGameScoreClock(row)).not.toContain("scheduled");
  });

  it("shows final score lines without falling back to live clock wording", () => {
    const row = {
      game: {
        scheduledStart: "2026-05-21T00:30:00.000Z",
      },
      gameState: {
        awayScore: 113,
        capturedAt: "2026-05-21T03:18:28.042974+00:00",
        clock: "None",
        homeScore: 122,
        isFinal: true,
        period: 4,
        status: "final",
      },
      outcome: {
        capturedAt: "2026-05-21T03:18:28.042974+00:00",
        finalAwayScore: 113,
        finalHomeScore: 122,
        winnerKey: "okc",
      },
    };

    expect(getGameOperationalState(row).kind).toBe("final");
    expect(formatGameScoreClock(row)).toBe("113-122 final");
  });
});
