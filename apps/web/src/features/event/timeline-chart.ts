export type TimelineSeriesBySource = Record<
  string,
  Array<{
    capturedAt: string;
    impliedProbability?: number | null;
  }>
>;

export type TimelineChartRow = {
  capturedAt: string;
} & Record<string, number | null | string>;

export type DivergenceChartPoint = {
  capturedAt: string;
  gap?: number | null;
};

const defaultLineBreakMs = 10 * 60_000;

function setSourceValue(
  byTimestamp: Map<string, TimelineChartRow>,
  capturedAt: string,
  sourceId: string,
  value: number | null
) {
  const existing = byTimestamp.get(capturedAt) ?? { capturedAt };
  existing[sourceId] = value;
  byTimestamp.set(capturedAt, existing);
}

export function formatTimelineChartData(
  series: TimelineSeriesBySource,
  maxLineGapMs = defaultLineBreakMs
): TimelineChartRow[] {
  const byTimestamp = new Map<string, TimelineChartRow>();
  const lineBreakMs = Math.max(0, maxLineGapMs);

  for (const [sourceId, points] of Object.entries(series)) {
    const orderedPoints = points
      .map((point) => ({
        capturedAtMs: Date.parse(point.capturedAt),
        point,
      }))
      .filter((entry) => Number.isFinite(entry.capturedAtMs))
      .sort((left, right) => left.capturedAtMs - right.capturedAtMs);

    for (const [index, entry] of orderedPoints.entries()) {
      setSourceValue(
        byTimestamp,
        entry.point.capturedAt,
        sourceId,
        entry.point.impliedProbability == null
          ? null
          : Number((entry.point.impliedProbability * 100).toFixed(1))
      );

      const next = orderedPoints[index + 1];
      if (!next || next.capturedAtMs - entry.capturedAtMs <= lineBreakMs) {
        continue;
      }

      setSourceValue(
        byTimestamp,
        new Date(entry.capturedAtMs + 1).toISOString(),
        sourceId,
        null
      );
      setSourceValue(
        byTimestamp,
        new Date(next.capturedAtMs - 1).toISOString(),
        sourceId,
        null
      );
    }
  }

  return [...byTimestamp.values()].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt)
  );
}

export function formatDivergenceChartData(
  points: DivergenceChartPoint[],
  maxLineGapMs = defaultLineBreakMs
): TimelineChartRow[] {
  const byTimestamp = new Map<string, TimelineChartRow>();
  const lineBreakMs = Math.max(0, maxLineGapMs);
  const orderedPoints = points
    .map((point) => ({
      capturedAtMs: Date.parse(point.capturedAt),
      point,
    }))
    .filter((entry) => Number.isFinite(entry.capturedAtMs))
    .sort((left, right) => left.capturedAtMs - right.capturedAtMs);

  for (const [index, entry] of orderedPoints.entries()) {
    setSourceValue(
      byTimestamp,
      entry.point.capturedAt,
      "divergence",
      entry.point.gap == null
        ? null
        : Number((entry.point.gap * 100).toFixed(1))
    );

    const next = orderedPoints[index + 1];
    if (!next || next.capturedAtMs - entry.capturedAtMs <= lineBreakMs) {
      continue;
    }

    setSourceValue(
      byTimestamp,
      new Date(entry.capturedAtMs + 1).toISOString(),
      "divergence",
      null
    );
    setSourceValue(
      byTimestamp,
      new Date(next.capturedAtMs - 1).toISOString(),
      "divergence",
      null
    );
  }

  return [...byTimestamp.values()].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt)
  );
}

export function formatTimelineTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
  });
}
