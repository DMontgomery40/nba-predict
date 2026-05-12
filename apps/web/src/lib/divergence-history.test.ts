import { describe, expect, it } from "vitest";

import {
  buildDivergenceTraceSummary,
  buildLatestComparison,
} from "./divergence-history";

const emptyTimeline = {
  annotations: [],
  gameStateSeries: [],
  lineMismatchWindows: [],
};

function quote(source: string, capturedAt: string, impliedProbability: number) {
  return {
    capturedAt,
    impliedProbability,
    isHeartbeat: false,
    source,
  };
}

describe("divergence history", () => {
  it("does not build a latest comparison from source quotes captured outside the same-time window", () => {
    expect(
      buildLatestComparison({
        ...emptyTimeline,
        quoteSeriesBySource: {
          bet365: [quote("bet365", "2026-05-10T23:09:15.934Z", 0.714)],
          kalshi: [quote("kalshi", "2026-05-12T07:30:23.373Z", 0.03)],
        },
      })
    ).toBeNull();
  });

  it("does not carry a single stale source line through an unmeasured span", () => {
    const summary = buildDivergenceTraceSummary({
      ...emptyTimeline,
      quoteSeriesBySource: {
        bet365: [quote("bet365", "2026-05-10T23:09:15.934Z", 0.714)],
        kalshi: [quote("kalshi", "2026-05-12T07:30:23.373Z", 0.03)],
      },
    });

    expect(summary?.points.every((point) => point.gap == null)).toBe(true);
    expect(summary?.points.every((point) => point.bet365 == null)).toBe(true);
    expect(summary?.points.every((point) => point.external == null)).toBe(true);
  });

  it("caps isolated above-threshold time instead of carrying it across an overnight gap", () => {
    const summary = buildDivergenceTraceSummary({
      ...emptyTimeline,
      quoteSeriesBySource: {
        bet365: [
          quote("bet365", "2026-05-10T23:09:15.000Z", 0.714),
          quote("bet365", "2026-05-12T07:30:23.000Z", 0.72),
        ],
        kalshi: [
          quote("kalshi", "2026-05-10T23:09:16.000Z", 0.03),
          quote("kalshi", "2026-05-12T07:30:24.000Z", 0.04),
        ],
      },
    });

    expect(summary?.maxGap).toBeCloseTo(0.684);
    expect(summary?.aboveThresholdDurationMs).toBeLessThanOrEqual(60_000);
  });
});
