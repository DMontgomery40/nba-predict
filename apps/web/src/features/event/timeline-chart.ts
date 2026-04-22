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

export function formatTimelineChartData(
  series: TimelineSeriesBySource
): TimelineChartRow[] {
  const byTimestamp = new Map<string, TimelineChartRow>();

  for (const [sourceId, points] of Object.entries(series)) {
    for (const point of points) {
      const existing = byTimestamp.get(point.capturedAt) ?? {
        capturedAt: point.capturedAt,
      };
      existing[sourceId] =
        point.impliedProbability == null
          ? null
          : Number((point.impliedProbability * 100).toFixed(1));
      byTimestamp.set(point.capturedAt, existing);
    }
  }

  return [...byTimestamp.values()].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt)
  );
}

export function formatTimelineTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").replace("Z", "").slice(5, 19);
}
