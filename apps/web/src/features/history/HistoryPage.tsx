import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import {
  Badge,
  MetricTile,
  Panel,
  SectionTitle,
} from "../../components/Primitives";
import {
  getAdminCaptureRuns,
  getAdminStorageCoverage,
  getResearchCoverage,
  getSignalMismatches,
} from "../../data/api";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").replace("Z", "");
}

function formatPercent(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function HistoryPage() {
  const captureRuns = useQuery({
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const researchCoverage = useQuery({
    queryKey: ["research-coverage"],
    queryFn: getResearchCoverage,
  });
  const signalMismatches = useQuery({
    queryKey: ["research-signal-mismatches"],
    queryFn: getSignalMismatches,
  });

  if (
    captureRuns.isLoading ||
    storageCoverage.isLoading ||
    researchCoverage.isLoading ||
    signalMismatches.isLoading ||
    (!captureRuns.data && !captureRuns.isError) ||
    (!storageCoverage.data && !storageCoverage.isError) ||
    (!researchCoverage.data && !researchCoverage.isError) ||
    (!signalMismatches.data && !signalMismatches.isError)
  ) {
    return <LoadingState message="Loading persisted research history…" />;
  }

  if (
    captureRuns.isError ||
    storageCoverage.isError ||
    researchCoverage.isError ||
    signalMismatches.isError ||
    !captureRuns.data ||
    !storageCoverage.data ||
    !researchCoverage.data ||
    !signalMismatches.data
  ) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Fallback" title="History unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The persisted history surfaces could not be loaded."
          error={
            captureRuns.error ??
            storageCoverage.error ??
            researchCoverage.error ??
            signalMismatches.error
          }
          onAction={() => {
            void captureRuns.refetch();
            void storageCoverage.refetch();
            void researchCoverage.refetch();
            void signalMismatches.refetch();
          }}
          title="History failed to load"
        />
      </PageFrame>
    );
  }

  const quoteTicksPersisted = storageCoverage.data.data.reduce(
    (sum, row) => sum + row.quoteTickCount,
    0
  );

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Archive"
            title={`${captureRuns.data.data.length} capture runs visible`}
            body="This page stays useful even when the live slate is empty by focusing on what has already been persisted."
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">History</div>
          <h1>Persisted market and ingest history</h1>
          <p>
            Review capture runs, storage coverage, research gaps, and historical
            disagreement without depending on a live games list being present.
          </p>
        </div>
      </section>

      <div className="grid-metrics">
        <MetricTile
          label="Capture Runs"
          value={String(captureRuns.data.data.length)}
          tone="positive"
        />
        <MetricTile
          label="Quote Ticks"
          value={String(quoteTicksPersisted)}
          tone={quoteTicksPersisted > 0 ? "positive" : "warning"}
        />
        <MetricTile
          label="Coverage Rows"
          value={String(researchCoverage.data.data.length)}
          tone={researchCoverage.data.data.length > 0 ? "positive" : "warning"}
        />
        <MetricTile
          label="Mismatch Rows"
          value={String(signalMismatches.data.data.length)}
          tone={signalMismatches.data.data.length > 0 ? "warning" : "positive"}
        />
      </div>

      <Panel>
        <SectionTitle
          eyebrow="Capture Runs"
          title="Recent adapter activity"
          body="These rows come from persisted adapter run logging, not the current browser session."
        />
        <div className="stack">
          {captureRuns.data.data.length === 0 ? (
            <p className="muted">No capture runs have been written yet.</p>
          ) : (
            captureRuns.data.data.slice(0, 10).map((run) => (
              <div className="action-row" key={run.id}>
                <div>
                  <strong>{run.source}</strong>
                  <p>
                    {run.recordsSeen} seen · {run.recordsWritten} written ·
                    started {formatTimestamp(run.startedAt)}
                  </p>
                </div>
                <Badge tone={run.status === "ok" ? "positive" : "critical"}>
                  {run.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Panel>

      <div className="dual-grid">
        <Panel>
          <SectionTitle
            eyebrow="Storage"
            title="Persisted source coverage"
            body="This shows which sources and market families have durable payloads behind them."
          />
          <div className="stack">
            {storageCoverage.data.data.length === 0 ? (
              <p className="muted">No persisted source coverage rows yet.</p>
            ) : (
              storageCoverage.data.data.slice(0, 8).map((row) => (
                <div
                  className="storage-coverage-row"
                  key={`${row.gameId}-${row.source}-${row.family ?? "all"}`}
                >
                  <div>
                    <strong>{row.gameId}</strong>
                    <p>
                      {row.source} · {row.family ?? "all families"}
                    </p>
                  </div>
                  <div className="storage-coverage-metrics">
                    <span>{row.sourceMarketCount} source markets</span>
                    <span>{row.quoteTickCount} quote ticks</span>
                    <span>{row.rawPayloadCount} raw payloads</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Coverage"
            title="Research gaps and unmapped rows"
            body="This keeps missing and unmapped source visibility alive when there is nothing new on the current slate."
          />
          <div className="stack">
            {researchCoverage.data.data.length === 0 ? (
              <p className="muted">
                No research coverage rows are available yet.
              </p>
            ) : (
              researchCoverage.data.data.slice(0, 8).map((row) => (
                <div
                  className="storage-coverage-row"
                  key={`${row.gameId}-${row.instrumentId ?? "game"}-${row.family ?? "all"}`}
                >
                  <div>
                    <strong>{row.gameId}</strong>
                    <p>
                      {row.instrumentId ?? "game aggregate"} ·{" "}
                      {row.family ?? "all families"}
                    </p>
                  </div>
                  <div className="storage-coverage-metrics">
                    <span>
                      market feeds{" "}
                      {formatMarketSourceList(row.availableSources)}
                    </span>
                    <span>
                      NBA state{" "}
                      {hasNbaStateSource(row.availableSources)
                        ? "available"
                        : "missing"}
                    </span>
                    <span>
                      missing market feeds{" "}
                      {row.missingSources.join(", ") || "none"}
                    </span>
                    <span>
                      unmapped {row.unmappedSources.join(", ") || "none"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle
          eyebrow="Mismatch Archive"
          title="Historical disagreement snapshot"
          body="This is the persisted signal-mismatch surface, which is often the fastest way to find interesting older research states."
        />
        <div className="stack">
          {signalMismatches.data.data.length === 0 ? (
            <p className="muted">No signal mismatch rows are available yet.</p>
          ) : (
            signalMismatches.data.data.slice(0, 10).map((row) => (
              <div
                className="note-card compact"
                key={`${row.gameId}-${row.instrumentId}`}
              >
                <h3>{row.displayLabel}</h3>
                <p>
                  {row.family} · gap {formatPercent(row.impliedProbabilityGap)}{" "}
                  · bet365 {formatPercent(row.bet365ImpliedProbability)} ·
                  kalshi {formatPercent(row.kalshiImpliedProbability)} ·
                  polymarket {formatPercent(row.polymarketImpliedProbability)}
                </p>
                <div className="tag-row">
                  <Badge
                    tone={row.directionalDisagreement ? "warning" : "neutral"}
                  >
                    {row.directionalDisagreement
                      ? "directional disagreement"
                      : "same direction"}
                  </Badge>
                  <Badge tone={row.lineMismatch ? "warning" : "positive"}>
                    {row.lineMismatch ? "line mismatch" : "line aligned"}
                  </Badge>
                  <Badge tone="neutral">{row.mappingStatus}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </PageFrame>
  );
}
