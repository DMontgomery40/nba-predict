import { useQuery } from "@tanstack/react-query";

import { getInstrumentDeltaSeries } from "../../data/api";

const SOURCE_STROKE: Record<string, string> = {
  bet365: "#ff8e78",
  kalshi: "#5fa8ff",
  polymarket: "#f4c96f",
};

const WIDTH = 96;
const HEIGHT = 22;
const PAD = 2;

type Props = {
  gameId: string;
  instrumentId: string;
};

export function DivergenceSparkline({ gameId, instrumentId }: Props) {
  const series = useQuery({
    queryKey: ["desk-sparkline", gameId, instrumentId],
    queryFn: () =>
      getInstrumentDeltaSeries(gameId, instrumentId, { bucketSeconds: 60 }),
    staleTime: 30_000,
  });

  if (series.isLoading) {
    return <span className="spark-placeholder" aria-hidden />;
  }

  const rows = series.data?.data ?? [];
  if (rows.length < 3) {
    return <span className="spark-placeholder spark-empty" aria-hidden />;
  }

  const tail = rows.slice(-20);
  const n = tail.length;

  const sources = ["bet365", "kalshi", "polymarket"] as const;

  // Gather numeric points per source.
  const perSource: Record<string, Array<{ x: number; y: number }>> = {};
  for (const src of sources) perSource[src] = [];
  tail.forEach((row, idx) => {
    for (const src of sources) {
      const p = row.perSource[src];
      if (p != null && Number.isFinite(p)) {
        perSource[src].push({ x: idx, y: p });
      }
    }
  });

  // Y domain: min/max of visible probabilities across all sources.
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const src of sources) {
    for (const pt of perSource[src]) {
      if (pt.y < yMin) yMin = pt.y;
      if (pt.y > yMax) yMax = pt.y;
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    return <span className="spark-placeholder spark-empty" aria-hidden />;
  }
  const yRange = yMax - yMin || 0.01;

  const xStep = (WIDTH - PAD * 2) / Math.max(1, n - 1);

  const toPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return "";
    return points
      .map((pt, i) => {
        const cx = PAD + pt.x * xStep;
        const cy = HEIGHT - PAD - ((pt.y - yMin) / yRange) * (HEIGHT - PAD * 2);
        return `${i === 0 ? "M" : "L"}${cx.toFixed(2)},${cy.toFixed(2)}`;
      })
      .join(" ");
  };

  return (
    <svg
      aria-hidden
      className="divergence-sparkline"
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
    >
      {sources.map((src) => {
        const path = toPath(perSource[src]);
        if (!path) return null;
        return (
          <path
            d={path}
            fill="none"
            key={src}
            stroke={SOURCE_STROKE[src]}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
