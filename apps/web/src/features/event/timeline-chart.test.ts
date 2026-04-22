import { describe, expect, it } from "vitest";

import {
  formatTimelineChartData,
  formatTimelineTimestamp,
} from "./timeline-chart";

describe("timeline chart helpers", () => {
  it("preserves separate points captured within the same minute and across days", () => {
    const rows = formatTimelineChartData({
      bet365: [
        {
          capturedAt: "2026-04-22T05:55:00.000Z",
          impliedProbability: 0.61,
        },
        {
          capturedAt: "2026-04-22T05:55:30.000Z",
          impliedProbability: 0.62,
        },
        {
          capturedAt: "2026-04-23T05:55:00.000Z",
          impliedProbability: 0.63,
        },
      ],
      kalshi: [
        {
          capturedAt: "2026-04-22T05:55:05.000Z",
          impliedProbability: 0.67,
        },
      ],
    });

    expect(rows).toEqual([
      { bet365: 61, capturedAt: "2026-04-22T05:55:00.000Z" },
      { kalshi: 67, capturedAt: "2026-04-22T05:55:05.000Z" },
      { bet365: 62, capturedAt: "2026-04-22T05:55:30.000Z" },
      { bet365: 63, capturedAt: "2026-04-23T05:55:00.000Z" },
    ]);
  });

  it("keeps missing implied probabilities as chart gaps instead of zeros", () => {
    const rows = formatTimelineChartData({
      bet365: [
        {
          capturedAt: "2026-04-22T05:55:00.000Z",
          impliedProbability: null,
        },
      ],
    });

    expect(rows).toEqual([
      { bet365: null, capturedAt: "2026-04-22T05:55:00.000Z" },
    ]);
  });

  it("formats timestamps with enough context to distinguish days", () => {
    expect(formatTimelineTimestamp("2026-04-23T05:55:30.000Z")).toBe(
      "04-23 05:55:30"
    );
    expect(formatTimelineTimestamp(null)).toBe("n/a");
  });
});
