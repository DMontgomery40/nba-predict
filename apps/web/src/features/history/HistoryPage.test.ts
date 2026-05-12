import { describe, expect, it } from "vitest";

import { buildHistoricalGapSummary } from "./HistoryPage";

function quote(source: string, capturedAt: string, impliedProbability: number) {
  return {
    capturedAt,
    impliedProbability,
    isHeartbeat: false,
    source,
  };
}

describe("history divergence summaries", () => {
  it("does not carry a stale Bet365 quote into a later exchange price", () => {
    const summary = buildHistoricalGapSummary({
      annotations: [],
      gameStateSeries: [],
      lineMismatchWindows: [],
      quoteSeriesBySource: {
        bet365: [quote("bet365", "2026-05-10T23:09:15.934Z", 0.714)],
        kalshi: [
          quote("kalshi", "2026-05-10T23:09:26.021Z", 0.73),
          quote("kalshi", "2026-05-12T07:30:23.373Z", 0.03),
        ],
        polymarket: [],
      },
    });

    expect(summary?.peakGap).toBeCloseTo(0.016);
    expect(summary?.peakKalshi).toBeCloseTo(0.73);
    expect(summary?.peakCapturedAt).toBe("2026-05-10T23:09:26.021Z");
  });
});
