import type { InstrumentTimelinePayload } from "../data/api";

export type DivergenceTracePoint = {
  bet365?: number | null;
  capturedAt: string;
  external?: number | null;
  gap?: number | null;
  hasComparison: boolean;
};

export type DivergenceTraceSummary = {
  aboveThresholdDurationMs: number;
  firstAboveThresholdAt?: string | null;
  currentGap?: number | null;
  latestAt?: string | null;
  maxGap?: number | null;
  maxGapAt?: string | null;
  minGap?: number | null;
  points: DivergenceTracePoint[];
  threshold: number;
};

export type LatestComparisonRow = {
  capturedAt: string;
  impliedProbability: number;
  line?: number | null;
  source: string;
};

export type LatestComparison = {
  capturedAt: string;
  externalAverage: number;
  gap: number;
  rows: LatestComparisonRow[];
};

const traceSources = ["bet365", "kalshi", "polymarket"] as const;
const defaultSameTimeWindowMs = 10 * 60_000;
const defaultContinuityWindowMs = 60_000;

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inferContinuityWindowMs(
  points: Array<{ capturedAt: string }>,
  maxWindowMs: number
) {
  const timestamps = points
    .map((point) => Date.parse(point.capturedAt))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const deltas = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index])
    .filter((delta) => delta > 0 && delta <= maxWindowMs)
    .sort((left, right) => left - right);

  if (deltas.length === 0) {
    return Math.min(defaultContinuityWindowMs, maxWindowMs);
  }

  const median = deltas[Math.floor(deltas.length / 2)];
  return Math.min(Math.max(defaultContinuityWindowMs, median * 2), maxWindowMs);
}

export function buildDivergenceTraceSummary(
  timeline: InstrumentTimelinePayload["data"] | null | undefined,
  threshold = 0.15,
  sameTimeWindowMs = defaultSameTimeWindowMs
): DivergenceTraceSummary | null {
  if (!timeline) {
    return null;
  }

  const events = traceSources
    .flatMap((source) =>
      (timeline.quoteSeriesBySource[source] ?? [])
        .filter((point) => typeof point.impliedProbability === "number")
        .map((point) => ({
          capturedAt: point.capturedAt,
          impliedProbability: point.impliedProbability as number,
          source,
        }))
    )
    .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));

  if (events.length === 0) {
    return null;
  }

  const latest = new Map<string, { capturedAtMs: number; value: number }>();
  const points: DivergenceTracePoint[] = [];

  for (const event of events) {
    const eventTime = Date.parse(event.capturedAt);
    if (!Number.isFinite(eventTime)) {
      continue;
    }

    latest.set(event.source, {
      capturedAtMs: eventTime,
      value: event.impliedProbability,
    });
    const bet365Entry = latest.get("bet365") ?? null;
    const bet365 = bet365Entry?.value ?? null;
    const external = average(
      ["kalshi", "polymarket"]
        .map((source) => latest.get(source))
        .filter(
          (
            entry
          ): entry is {
            capturedAtMs: number;
            value: number;
          } =>
            Boolean(
              entry &&
              bet365Entry &&
              Math.abs(entry.capturedAtMs - bet365Entry.capturedAtMs) <=
                sameTimeWindowMs
            )
        )
        .map((entry) => entry.value)
    );
    const gap =
      typeof bet365 === "number" && typeof external === "number"
        ? Math.abs(bet365 - external)
        : null;

    const hasComparison = gap != null;

    points.push({
      bet365: hasComparison ? bet365 : null,
      capturedAt: event.capturedAt,
      external: hasComparison ? external : null,
      gap,
      hasComparison,
    });
  }

  const gapPoints = points.filter(
    (point): point is DivergenceTracePoint & { gap: number } =>
      typeof point.gap === "number"
  );
  const continuityWindowMs = inferContinuityWindowMs(points, sameTimeWindowMs);
  const aboveThresholdDurationMs = points.reduce((total, point, index) => {
    if (typeof point.gap !== "number") {
      return total;
    }
    if (point.gap < threshold) {
      return total;
    }

    const next = points[index + 1];
    const start = Date.parse(point.capturedAt);
    const end = next ? Date.parse(next.capturedAt) : start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return total;
    }
    return total + Math.min(end - start, continuityWindowMs);
  }, 0);
  const latestGapPoint = gapPoints.at(-1) ?? null;
  const maxGapPoint = gapPoints.reduce<
    (DivergenceTracePoint & { gap: number }) | null
  >((max, point) => (max == null || point.gap > max.gap ? point : max), null);

  return {
    aboveThresholdDurationMs,
    currentGap: latestGapPoint?.gap ?? null,
    firstAboveThresholdAt:
      gapPoints.find((point) => point.gap >= threshold)?.capturedAt ?? null,
    latestAt: latestGapPoint?.capturedAt ?? null,
    maxGap: maxGapPoint?.gap ?? null,
    maxGapAt: maxGapPoint?.capturedAt ?? null,
    minGap:
      gapPoints.length > 0
        ? Math.min(...gapPoints.map((point) => point.gap))
        : null,
    points,
    threshold,
  };
}

export function buildLatestComparison(
  timeline: InstrumentTimelinePayload["data"] | null | undefined,
  sameTimeWindowMs = defaultSameTimeWindowMs
): LatestComparison | null {
  if (!timeline) {
    return null;
  }

  const bet365 = (timeline.quoteSeriesBySource.bet365 ?? [])
    .filter((point) => typeof point.impliedProbability === "number")
    .map((point) => ({
      capturedAtMs: Date.parse(point.capturedAt),
      point,
    }))
    .filter((entry) => Number.isFinite(entry.capturedAtMs));
  const externals = (["kalshi", "polymarket"] as const).flatMap((source) =>
    (timeline.quoteSeriesBySource[source] ?? [])
      .filter((point) => typeof point.impliedProbability === "number")
      .map((point) => ({
        capturedAtMs: Date.parse(point.capturedAt),
        point,
        source,
      }))
      .filter((entry) => Number.isFinite(entry.capturedAtMs))
  );

  let latest: LatestComparison | null = null;

  for (const book of bet365) {
    const candidates = externals
      .filter(
        (external) =>
          Math.abs(external.capturedAtMs - book.capturedAtMs) <=
          sameTimeWindowMs
      )
      .sort(
        (left, right) =>
          Math.abs(left.capturedAtMs - book.capturedAtMs) -
          Math.abs(right.capturedAtMs - book.capturedAtMs)
      );
    if (candidates.length === 0) {
      continue;
    }

    const bestBySource = new Map<string, (typeof candidates)[number]>();
    for (const candidate of candidates) {
      if (!bestBySource.has(candidate.source)) {
        bestBySource.set(candidate.source, candidate);
      }
    }

    const externalRows = Array.from(bestBySource.values()).sort((left, right) =>
      left.source.localeCompare(right.source)
    );
    const externalAverage =
      externalRows.reduce(
        (sum, entry) => sum + (entry.point.impliedProbability as number),
        0
      ) / externalRows.length;
    const gap = Math.abs(
      (book.point.impliedProbability as number) - externalAverage
    );
    const capturedAtMs = Math.max(
      book.capturedAtMs,
      ...externalRows.map((entry) => entry.capturedAtMs)
    );
    const comparison = {
      capturedAt: new Date(capturedAtMs).toISOString(),
      externalAverage,
      gap,
      rows: [
        {
          capturedAt: book.point.capturedAt,
          impliedProbability: book.point.impliedProbability as number,
          line: book.point.line ?? null,
          source: "bet365",
        },
        ...externalRows.map((entry) => ({
          capturedAt: entry.point.capturedAt,
          impliedProbability: entry.point.impliedProbability as number,
          line: entry.point.line ?? null,
          source: entry.source,
        })),
      ],
    } satisfies LatestComparison;

    if (!latest || capturedAtMs > Date.parse(latest.capturedAt)) {
      latest = comparison;
    }
  }

  return latest;
}
