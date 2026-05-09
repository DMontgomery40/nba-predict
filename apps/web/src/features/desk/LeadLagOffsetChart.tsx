import type { LeadLagSeriesPayload } from "../../data/api";

type SeriesRow = LeadLagSeriesPayload["data"]["offsetSeries"][number];

const LINE_W = 560;
const LINE_H = 120;
const LINE_PAD = { top: 10, right: 10, bottom: 22, left: 36 };

const HIST_W = 240;
const HIST_H = 120;
const HIST_PAD = { top: 10, right: 6, bottom: 22, left: 26 };

function tickTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function LeadLagOffsetChart({
  series,
  bucketSeconds,
  histogram,
}: {
  series: SeriesRow[];
  bucketSeconds: number;
  histogram: Array<{ lagBuckets: number; count: number }>;
}) {
  const validSeries = series.filter((s) => s.lagBuckets != null);
  const lags = validSeries.map((s) => s.lagBuckets as number);

  if (lags.length === 0) {
    return (
      <p className="desk-note">
        Rolling-window lead/lag produced no stable estimates on this instrument
        yet.
      </p>
    );
  }

  const lagMinData = Math.min(...lags);
  const lagMaxData = Math.max(...lags);
  const lagPadding = Math.max(1, Math.ceil((lagMaxData - lagMinData) * 0.2));
  const lagMin = Math.min(lagMinData - lagPadding, -1);
  const lagMax = Math.max(lagMaxData + lagPadding, 1);
  const lagRange = lagMax - lagMin;

  const n = series.length;
  const xStep = (LINE_W - LINE_PAD.left - LINE_PAD.right) / Math.max(1, n - 1);

  const lineY = (lag: number) =>
    LINE_H -
    LINE_PAD.bottom -
    ((lag - lagMin) / lagRange) * (LINE_H - LINE_PAD.top - LINE_PAD.bottom);
  const lineX = (idx: number) => LINE_PAD.left + idx * xStep;

  const pathD = (() => {
    let d = "";
    let pen = "M";
    series.forEach((pt, idx) => {
      if (pt.lagBuckets == null) {
        pen = "M";
        return;
      }
      d += `${pen}${lineX(idx).toFixed(2)},${lineY(pt.lagBuckets).toFixed(2)} `;
      pen = "L";
    });
    return d.trim();
  })();

  const zeroY = lineY(0);

  const firstLabel = series[0]?.bucketAt;
  const lastLabel = series[n - 1]?.bucketAt;

  // Histogram range
  const histMaxCount =
    histogram.length > 0 ? Math.max(...histogram.map((h) => h.count)) : 1;
  const histLagMin = Math.min(lagMin, ...histogram.map((h) => h.lagBuckets));
  const histLagMax = Math.max(lagMax, ...histogram.map((h) => h.lagBuckets));
  const histSpan = Math.max(1, histLagMax - histLagMin);
  const histBarWidth = (HIST_W - HIST_PAD.left - HIST_PAD.right) / histSpan;

  return (
    <div className="leadlag-charts">
      <div className="leadlag-line">
        <div className="leadlag-axis">
          <span>offset (buckets × {bucketSeconds}s) over time</span>
          <em>
            + lag = {series[0]?.lagBuckets != null ? "book trails" : "—"} · 0 =
            synced
          </em>
        </div>
        <svg
          aria-label="Lead/lag offset over time"
          height={LINE_H}
          viewBox={`0 0 ${LINE_W} ${LINE_H}`}
          width={LINE_W}
        >
          <line
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="2 3"
            x1={LINE_PAD.left}
            x2={LINE_W - LINE_PAD.right}
            y1={zeroY}
            y2={zeroY}
          />
          <text
            className="leadlag-tick"
            textAnchor="end"
            x={LINE_PAD.left - 4}
            y={zeroY + 3}
          >
            0
          </text>
          <text
            className="leadlag-tick"
            textAnchor="end"
            x={LINE_PAD.left - 4}
            y={lineY(lagMax) + 3}
          >
            {lagMax}
          </text>
          <text
            className="leadlag-tick"
            textAnchor="end"
            x={LINE_PAD.left - 4}
            y={lineY(lagMin) + 3}
          >
            {lagMin}
          </text>
          <path
            d={pathD}
            fill="none"
            stroke="#f4c96f"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.3}
          />
          <text className="leadlag-tick" x={LINE_PAD.left} y={LINE_H - 4}>
            {firstLabel ? tickTime(firstLabel) : "—"}
          </text>
          <text
            className="leadlag-tick"
            textAnchor="end"
            x={LINE_W - LINE_PAD.right}
            y={LINE_H - 4}
          >
            {lastLabel ? tickTime(lastLabel) : "—"}
          </text>
        </svg>
      </div>

      <div className="leadlag-hist">
        <div className="leadlag-axis">
          <span>offset distribution</span>
          <em>buckets</em>
        </div>
        <svg
          aria-label="Lead/lag offset distribution"
          height={HIST_H}
          viewBox={`0 0 ${HIST_W} ${HIST_H}`}
          width={HIST_W}
        >
          <line
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="2 3"
            x1={
              HIST_PAD.left +
              ((0 - histLagMin) / histSpan) *
                (HIST_W - HIST_PAD.left - HIST_PAD.right)
            }
            x2={
              HIST_PAD.left +
              ((0 - histLagMin) / histSpan) *
                (HIST_W - HIST_PAD.left - HIST_PAD.right)
            }
            y1={HIST_PAD.top}
            y2={HIST_H - HIST_PAD.bottom}
          />
          {histogram.map((bin) => {
            const x =
              HIST_PAD.left +
              ((bin.lagBuckets - histLagMin) / histSpan) *
                (HIST_W - HIST_PAD.left - HIST_PAD.right);
            const h =
              (bin.count / histMaxCount) *
              (HIST_H - HIST_PAD.top - HIST_PAD.bottom);
            return (
              <rect
                fill="#f4c96f"
                height={h}
                key={bin.lagBuckets}
                opacity={0.85}
                width={Math.max(2, histBarWidth * 0.7)}
                x={x - histBarWidth * 0.35}
                y={HIST_H - HIST_PAD.bottom - h}
              />
            );
          })}
          <text className="leadlag-tick" x={HIST_PAD.left} y={HIST_H - 4}>
            {histLagMin}
          </text>
          <text
            className="leadlag-tick"
            textAnchor="end"
            x={HIST_W - HIST_PAD.right}
            y={HIST_H - 4}
          >
            {histLagMax}
          </text>
        </svg>
      </div>
    </div>
  );
}
