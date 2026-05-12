import { formatGapPoints } from "../lib/market-format";

import type { DivergenceTraceSummary } from "../lib/divergence-history";

type DivergenceMiniChartProps = {
  summary?: DivergenceTraceSummary | null;
};

function formatDuration(ms: number) {
  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < 60 * 60_000) {
    return `${Math.round(ms / 60_000)}m`;
  }
  return `${(ms / (60 * 60_000)).toFixed(1)}h`;
}

function pathForValues(
  values: Array<number | null>,
  width: number,
  height: number
) {
  if (!values.some((value) => typeof value === "number")) {
    return "";
  }

  const numericValues = values.filter(
    (value): value is number => typeof value === "number"
  );
  const min = Math.min(0, ...numericValues);
  const max = Math.max(1, ...numericValues);
  const denom = Math.max(0.001, max - min);
  const lastIndex = Math.max(1, values.length - 1);
  let segmentOpen = false;

  return values
    .map((value, index) => {
      if (typeof value !== "number") {
        segmentOpen = false;
        return "";
      }
      const x = (index / lastIndex) * width;
      const y = height - ((value - min) / denom) * height;
      const command = segmentOpen ? "L" : "M";
      segmentOpen = true;
      return `${command}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

export function DivergenceMiniChart({ summary }: DivergenceMiniChartProps) {
  if (!summary || summary.points.length === 0) {
    return (
      <span
        aria-label="No same-time divergence chart"
        className="mini-chart-empty"
      />
    );
  }

  const width = 168;
  const height = 42;
  const bet365Path = pathForValues(
    summary.points.map((point) => point.bet365 ?? null),
    width,
    height
  );
  const externalPath = pathForValues(
    summary.points.map((point) => point.external ?? null),
    width,
    height
  );
  const gapPath = pathForValues(
    summary.points.map((point) => point.gap ?? null),
    width,
    height
  );

  return (
    <div className="mini-divergence">
      <svg
        aria-label={`Latest measured divergence ${formatGapPoints(
          summary.currentGap
        )}, range ${formatGapPoints(summary.minGap)} to ${formatGapPoints(
          summary.maxGap
        )}`}
        className="mini-divergence-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          className="mini-divergence-threshold"
          x1="0"
          x2={width}
          y1={height - summary.threshold * height}
          y2={height - summary.threshold * height}
        />
        <path className="mini-divergence-bet365" d={bet365Path} />
        <path className="mini-divergence-external" d={externalPath} />
        <path className="mini-divergence-gap" d={gapPath} />
      </svg>
      <div className="mini-divergence-meta">
        <span>latest {formatGapPoints(summary.currentGap)}</span>
        <span>
          range {formatGapPoints(summary.minGap)}-
          {formatGapPoints(summary.maxGap)}
        </span>
        <span>{formatDuration(summary.aboveThresholdDurationMs)} above</span>
      </div>
    </div>
  );
}
