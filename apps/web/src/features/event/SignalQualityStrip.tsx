import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  getInstrumentDeltaSeries,
  getInstrumentLeadLag,
  type InstrumentDivergenceSummary,
} from "../../data/api";
import { formatGapPoints } from "../../lib/market-format";
import { formatOperatorDateTime } from "../../lib/time-format";

function formatNumber(value: number | null | undefined, digits = 3) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function SignalQualityStrip({
  comparisonSummary,
  gameId,
  instrumentId,
}: {
  comparisonSummary?: InstrumentDivergenceSummary | null;
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
    if (comparisonSummary) {
      return {
        bucketsWithDelta: comparisonSummary.comparisonCount,
        overlap: comparisonSummary.comparisonCount,
        peak: {
          absoluteDelta: comparisonSummary.maxGap ?? null,
          bucketAt: comparisonSummary.maxGapAt ?? null,
        },
      };
    }

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
  }, [comparisonSummary, delta.data]);

  const topPair = leadLag.data?.data.pairs?.[0];
  const insufficient = leadLag.data?.data.insufficientData ?? false;
  const summaryLoading = !comparisonSummary && delta.isLoading;
  const hasFirstMove =
    topPair != null &&
    topPair.bestLagBuckets !== 0 &&
    Math.abs(topPair.bestCorrelation) >= 0.3 &&
    topPair.sampleCount >= 10;

  return (
    <div className="sq-strip">
      <div className="sq-cell">
        <span className="sq-label">same-time samples</span>
        <span className="sq-value mono">
          {summaryLoading ? "…" : deltaSummary.overlap.toLocaleString()}
        </span>
      </div>
      <div className="sq-cell">
        <span className="sq-label">peak divergence</span>
        <span className="sq-value mono">
          {summaryLoading
            ? "…"
            : formatGapPoints(deltaSummary.peak?.absoluteDelta ?? null)}
        </span>
        <span className="sq-sub mono muted">
          {formatOperatorDateTime(deltaSummary.peak?.bucketAt)}
        </span>
      </div>
      <div className="sq-cell">
        <span className="sq-label">first move</span>
        {leadLag.isLoading ? (
          <span className="sq-value mono">…</span>
        ) : insufficient || !topPair ? (
          <span className="sq-value mono muted">n/a</span>
        ) : topPair.bestLagBuckets === 0 ? (
          <>
            <span className="sq-value mono">same minute</span>
            <span className="sq-sub mono muted">
              {topPair.sampleCount} samples
            </span>
          </>
        ) : !hasFirstMove ? (
          <>
            <span className="sq-value mono muted">n/a</span>
            <span className="sq-sub mono muted">
              {topPair.sampleCount} samples
            </span>
          </>
        ) : (
          <>
            <span className="sq-value mono">
              {topPair.leadSource} → {topPair.lagSource}
            </span>
            <span className="sq-sub mono muted">
              match {formatNumber(topPair.bestCorrelation)} ·{" "}
              {topPair.bestLagBuckets}m · {topPair.sampleCount} samples
            </span>
          </>
        )}
      </div>
    </div>
  );
}
