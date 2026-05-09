import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getInstrumentDeltaSeries, getInstrumentLeadLag } from "../../data/api";

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined, digits = 3) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function SignalQualityStrip({
  gameId,
  instrumentId,
}: {
  gameId: string;
  instrumentId: string;
}) {
  const delta = useQuery({
    enabled: Boolean(gameId && instrumentId),
    queryFn: () =>
      getInstrumentDeltaSeries(gameId, instrumentId, { bucketSeconds: 60 }),
    queryKey: ["instrument-delta", gameId, instrumentId],
  });
  const leadLag = useQuery({
    enabled: Boolean(gameId && instrumentId),
    queryFn: () =>
      getInstrumentLeadLag(gameId, instrumentId, {
        bucketSeconds: 60,
        maxLagBuckets: 20,
      }),
    queryKey: ["instrument-lead-lag", gameId, instrumentId],
  });

  const deltaSummary = useMemo(() => {
    const points = delta.data?.data ?? [];
    const withDelta = points.filter((p) => typeof p.absoluteDelta === "number");
    if (withDelta.length === 0) {
      return { bucketsWithDelta: 0, overlap: points.length, peak: null };
    }
    const peak = withDelta.reduce((max, p) =>
      (p.absoluteDelta ?? 0) > (max.absoluteDelta ?? 0) ? p : max
    );
    const overlap = points.filter((p) => {
      const keys = Object.keys(p.perSource).filter(
        (k) => p.perSource[k] != null
      );
      return keys.length >= 2;
    }).length;
    return {
      bucketsWithDelta: withDelta.length,
      overlap,
      peak,
    };
  }, [delta.data]);

  const topPair = leadLag.data?.data.pairs?.[0];
  const insufficient = leadLag.data?.data.insufficientData ?? false;

  return (
    <div className="sq-strip">
      <div className="sq-cell">
        <span className="sq-label">overlap buckets</span>
        <span className="sq-value mono">
          {delta.isLoading ? "…" : deltaSummary.overlap.toLocaleString()}
        </span>
      </div>
      <div className="sq-cell">
        <span className="sq-label">peak |Δ| bet365↔ext</span>
        <span className="sq-value mono">
          {delta.isLoading
            ? "…"
            : formatPercent(deltaSummary.peak?.absoluteDelta ?? null)}
        </span>
        <span className="sq-sub mono muted">
          {deltaSummary.peak?.bucketAt?.slice(0, 16).replace("T", " ") ?? ""}
        </span>
      </div>
      <div className="sq-cell">
        <span className="sq-label">lead/lag</span>
        {leadLag.isLoading ? (
          <span className="sq-value mono">…</span>
        ) : insufficient || !topPair ? (
          <span className="sq-value mono muted">n/a</span>
        ) : (
          <>
            <span className="sq-value mono">
              {topPair.leadSource} → {topPair.lagSource}
              {topPair.bestLagBuckets === 0 ? " (lockstep)" : ""}
            </span>
            <span className="sq-sub mono muted">
              r={formatNumber(topPair.bestCorrelation)} · lag=
              {topPair.bestLagBuckets}m · n={topPair.sampleCount}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
