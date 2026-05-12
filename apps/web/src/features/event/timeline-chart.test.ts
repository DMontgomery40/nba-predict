import { describe, expect, it } from "vitest";

import {
  formatDivergenceChartData,
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

    expect(rows).toContainEqual({
      bet365: 61,
      capturedAt: "2026-04-22T05:55:00.000Z",
    });
    expect(rows).toContainEqual({
      kalshi: 67,
      capturedAt: "2026-04-22T05:55:05.000Z",
    });
    expect(rows).toContainEqual({
      bet365: 62,
      capturedAt: "2026-04-22T05:55:30.000Z",
    });
    expect(rows).toContainEqual({
      bet365: 63,
      capturedAt: "2026-04-23T05:55:00.000Z",
    });
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

  it("breaks a source line across long quote gaps instead of drawing a continuous price", () => {
    const rows = formatTimelineChartData({
      kalshi: [
        {
          capturedAt: "2026-05-11T01:20:31.000Z",
          impliedProbability: 0.99,
        },
        {
          capturedAt: "2026-05-12T07:20:01.000Z",
          impliedProbability: 0.03,
        },
      ],
    });

    expect(rows).toEqual([
      { capturedAt: "2026-05-11T01:20:31.000Z", kalshi: 99 },
      { capturedAt: "2026-05-11T01:20:31.001Z", kalshi: null },
      { capturedAt: "2026-05-12T07:20:00.999Z", kalshi: null },
      { capturedAt: "2026-05-12T07:20:01.000Z", kalshi: 3 },
    ]);
  });

  it("plots only measured divergence and breaks across unmeasured windows", () => {
    const rows = formatDivergenceChartData([
      {
        capturedAt: "2026-05-10T23:09:15.000Z",
        gap: 0.024,
      },
      {
        capturedAt: "2026-05-10T23:09:16.000Z",
        gap: null,
      },
      {
        capturedAt: "2026-05-12T07:30:24.000Z",
        gap: 0.684,
      },
    ]);

    expect(rows).toEqual([
      { capturedAt: "2026-05-10T23:09:15.000Z", divergence: 2.4 },
      { capturedAt: "2026-05-10T23:09:16.000Z", divergence: null },
      { capturedAt: "2026-05-10T23:09:16.001Z", divergence: null },
      { capturedAt: "2026-05-12T07:30:23.999Z", divergence: null },
      { capturedAt: "2026-05-12T07:30:24.000Z", divergence: 68.4 },
    ]);
  });

  it("formats timestamps with enough context to distinguish days", () => {
    const label = formatTimelineTimestamp("2026-04-23T05:55:30.000Z");
    expect(label).toMatch(/\w{3} \d{1,2}, \d{1,2}:\d{2} (AM|PM) \w{2,5}/);
    expect(label).not.toBe("04-23 05:55:30");
    expect(formatTimelineTimestamp(null)).toBe("n/a");
  });
});
