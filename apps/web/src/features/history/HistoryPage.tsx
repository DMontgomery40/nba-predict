import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

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
  getInstrumentTimeline,
  getResearchCoverage,
  getSignalMismatches,
} from "../../data/api";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";

type SignalMismatchRow = Awaited<
  ReturnType<typeof getSignalMismatches>
>["data"][number];
type InstrumentTimelineData = Awaited<
  ReturnType<typeof getInstrumentTimeline>
>["data"];
type TimelineGameState = InstrumentTimelineData["gameStateSeries"][number];

type HistoricalGapSummary = {
  openingGap?: number | null;
  peakBet365?: number | null;
  peakCapturedAt: string;
  peakGap: number;
  peakGameState?: TimelineGameState | null;
  peakKalshi?: number | null;
  peakPolymarket?: number | null;
};

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

function averageDefinedNumbers(values: Array<number | null | undefined>) {
  const defined = values.filter(
    (value): value is number => typeof value === "number"
  );

  if (defined.length === 0) {
    return null;
  }

  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
}

function formatScoreline(row: SignalMismatchRow) {
  if (row.finalAwayScore != null && row.finalHomeScore != null) {
    return `Final ${row.finalAwayScore}-${row.finalHomeScore}`;
  }

  return row.gameStatus.replace("-", " ");
}

function formatGameContext(row: SignalMismatchRow) {
  if (row.finalAwayScore != null && row.finalHomeScore != null) {
    return `Final ${row.finalAwayScore}-${row.finalHomeScore}`;
  }

  const scheduledAt = new Date(row.scheduledStart);
  if (Number.isFinite(scheduledAt.getTime())) {
    return `Scheduled ${scheduledAt.toLocaleString("en-US", {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    })}`;
  }

  return row.gameStatus.replace("-", " ");
}

function formatPeakMoment(state?: TimelineGameState | null) {
  if (!state) {
    return "Pregame";
  }

  if (
    state.status === "scheduled" ||
    state.period == null ||
    state.period <= 0 ||
    state.clock == null ||
    state.clock === "None"
  ) {
    return "Pregame";
  }

  const period =
    state.period != null ? `Q${state.period}` : state.status.replace("-", " ");
  const clock = state.clock ? ` ${state.clock}` : "";
  const score =
    state.awayScore != null && state.homeScore != null
      ? ` · ${state.awayScore}-${state.homeScore}`
      : "";

  return `${period}${clock}${score}`;
}

function findGameStateAt(
  states: InstrumentTimelineData["gameStateSeries"],
  capturedAt: string
) {
  const target = Date.parse(capturedAt);
  if (!Number.isFinite(target)) {
    return null;
  }

  let current: TimelineGameState | null = null;
  for (const state of states) {
    const stateTime = Date.parse(state.capturedAt);
    if (!Number.isFinite(stateTime)) {
      continue;
    }
    if (stateTime <= target) {
      current = state;
      continue;
    }
    return current ?? state;
  }

  return current;
}

function buildHistoricalGapSummary(
  timeline: InstrumentTimelineData
): HistoricalGapSummary | null {
  const points = (["bet365", "kalshi", "polymarket"] as const)
    .flatMap((source) =>
      timeline.quoteSeriesBySource[source]
        .filter((point) => typeof point.impliedProbability === "number")
        .map((point) => ({
          capturedAt: point.capturedAt,
          impliedProbability: point.impliedProbability as number,
          source,
        }))
    )
    .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));

  if (points.length === 0) {
    return null;
  }

  const latestBySource = new Map<string, number>();
  let openingGap: number | null = null;
  let peakSummary: HistoricalGapSummary | null = null;

  for (const point of points) {
    latestBySource.set(point.source, point.impliedProbability);

    const bet365 = latestBySource.get("bet365");
    const externalValues = ["kalshi", "polymarket"]
      .map((source) => latestBySource.get(source))
      .filter((value): value is number => typeof value === "number");

    if (typeof bet365 !== "number" || externalValues.length === 0) {
      continue;
    }

    const externalAverage =
      externalValues.reduce((sum, value) => sum + value, 0) /
      externalValues.length;
    const gap = Math.abs(bet365 - externalAverage);

    if (openingGap == null) {
      openingGap = gap;
    }

    if (!peakSummary || gap > peakSummary.peakGap) {
      peakSummary = {
        openingGap,
        peakBet365: bet365,
        peakCapturedAt: point.capturedAt,
        peakGap: gap,
        peakGameState: findGameStateAt(
          timeline.gameStateSeries,
          point.capturedAt
        ),
        peakKalshi: latestBySource.get("kalshi") ?? null,
        peakPolymarket: latestBySource.get("polymarket") ?? null,
      };
    }
  }

  return peakSummary;
}

function selectHighlightRows(rows: SignalMismatchRow[]) {
  const finishedRows = rows.filter(
    (row) => row.gameStatus === "final" && !row.lineMismatch
  );

  if (finishedRows.length > 0) {
    return {
      body: "These are the clearest finished-game mismatches we have persisted this week, ranked by gap.",
      rows: finishedRows.slice(0, 3),
      usesFallback: false,
    };
  }

  return {
    body: "No finished-game source history is persisted in the current database yet, so this falls back to the clearest live or pregame mismatches we do have.",
    rows: rows.filter((row) => !row.lineMismatch).slice(0, 3),
    usesFallback: true,
  };
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

  const highlightedRows = selectHighlightRows(
    signalMismatches.data?.data ?? []
  );
  const highlightTimelines = useQueries({
    queries: highlightedRows.rows.map((row) => ({
      queryKey: [
        "instrument-timeline",
        row.gameId,
        row.instrumentId,
        "history",
      ],
      queryFn: () => getInstrumentTimeline(row.gameId, row.instrumentId),
    })),
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
  const finishedSignalCount = signalMismatches.data.data.filter(
    (row) => row.gameStatus === "final"
  ).length;
  const directionalSignalCount = signalMismatches.data.data.filter(
    (row) => row.directionalDisagreement
  ).length;

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Start Here"
            title={
              highlightedRows.rows[0]?.displayLabel ??
              "No weekly highlights yet"
            }
            body="This page now leads with the clearest persisted source story first, then drops into the archive and operator detail below."
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">History</div>
          <h1>Persisted market and ingest history</h1>
          <p>
            Start with the clearest source gap, then drill into the supporting
            capture history, coverage, and raw persistence underneath it.
          </p>
        </div>
      </section>

      <Panel>
        <SectionTitle
          eyebrow="This Week"
          title="Signals worth opening first"
          body={highlightedRows.body}
        />
        {highlightedRows.rows.length === 0 ? (
          <p className="muted">No signal mismatch rows are available yet.</p>
        ) : (
          <div className="card-grid">
            {highlightedRows.rows.map((row, index) => {
              const timelineQuery = highlightTimelines[index];
              const highlightSummary =
                timelineQuery?.data?.data != null
                  ? buildHistoricalGapSummary(timelineQuery.data.data)
                  : null;
              const peakMomentLabel = formatPeakMoment(
                highlightSummary?.peakGameState
              );

              return (
                <article
                  className="history-highlight-card"
                  key={`${row.gameId}-${row.instrumentId}`}
                >
                  <div className="history-highlight-head">
                    <div>
                      <div className="eyebrow">
                        {highlightedRows.usesFallback
                          ? row.gameStatus.replace("-", " ")
                          : "finished game"}
                      </div>
                      <h3>{row.displayLabel}</h3>
                      <p>
                        {row.gameLabel} · {formatGameContext(row)}
                      </p>
                    </div>
                    <div className="history-highlight-gap">
                      <span>Peak gap</span>
                      <strong>
                        {highlightSummary
                          ? formatPercent(highlightSummary.peakGap)
                          : formatPercent(row.impliedProbabilityGap)}
                      </strong>
                    </div>
                  </div>

                  {timelineQuery?.isLoading ? (
                    <div className="loading-panel">
                      Loading timeline context for this signal…
                    </div>
                  ) : (
                    <>
                      <div className="history-highlight-metrics">
                        <div>
                          <span>Opened</span>
                          <strong>
                            {highlightSummary
                              ? formatPercent(highlightSummary.openingGap)
                              : "n/a"}
                          </strong>
                        </div>
                        <div>
                          <span>Peak moment</span>
                          <strong>
                            {highlightSummary ? peakMomentLabel : "Unavailable"}
                          </strong>
                        </div>
                        <div>
                          <span>bet365</span>
                          <strong>
                            {formatPercent(
                              highlightSummary?.peakBet365 ??
                                row.bet365ImpliedProbability
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Prediction books</span>
                          <strong>
                            {formatPercent(
                              averageDefinedNumbers([
                                highlightSummary?.peakKalshi ??
                                  row.kalshiImpliedProbability,
                                highlightSummary?.peakPolymarket ??
                                  row.polymarketImpliedProbability,
                              ])
                            )}
                          </strong>
                        </div>
                      </div>

                      <p className="history-highlight-summary">
                        Bet365 ran{" "}
                        {highlightSummary
                          ? formatPercent(highlightSummary.peakGap)
                          : formatPercent(row.impliedProbabilityGap)}{" "}
                        away from the prediction-market average after opening at{" "}
                        {highlightSummary
                          ? formatPercent(highlightSummary.openingGap)
                          : "n/a"}
                        {highlightSummary
                          ? peakMomentLabel === "Pregame"
                            ? ", peaking before tipoff."
                            : `, peaking at ${peakMomentLabel}.`
                          : "."}
                      </p>
                    </>
                  )}

                  <div className="tag-row">
                    <Badge
                      tone={row.directionalDisagreement ? "warning" : "neutral"}
                    >
                      {row.directionalDisagreement
                        ? "directional disagreement"
                        : "same side"}
                    </Badge>
                    <Badge tone={row.lineMismatch ? "warning" : "positive"}>
                      {row.lineMismatch ? "line mismatch" : "line aligned"}
                    </Badge>
                    <Badge tone="neutral">{row.family}</Badge>
                    <Link
                      className="ghost-button"
                      to={`/games/${row.gameId}/markets/${row.instrumentId}`}
                    >
                      Open instrument
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid-metrics">
        <MetricTile
          label="Signal Rows"
          value={String(signalMismatches.data.data.length)}
          tone={signalMismatches.data.data.length > 0 ? "warning" : "positive"}
        />
        <MetricTile
          label="Finished Signals"
          value={String(finishedSignalCount)}
          tone={finishedSignalCount > 0 ? "positive" : "warning"}
        />
        <MetricTile
          label="Directional Splits"
          value={String(directionalSignalCount)}
          tone={directionalSignalCount > 0 ? "warning" : "neutral"}
        />
        <MetricTile
          label="Quote Ticks"
          value={String(quoteTicksPersisted)}
          tone={quoteTicksPersisted > 0 ? "positive" : "warning"}
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
          body="This stays available as the denser archive view after the clearer weekly highlights above."
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
                  {row.gameLabel} · {row.family} · gap{" "}
                  {formatPercent(row.impliedProbabilityGap)} · bet365{" "}
                  {formatPercent(row.bet365ImpliedProbability)} · kalshi{" "}
                  {formatPercent(row.kalshiImpliedProbability)} · polymarket{" "}
                  {formatPercent(row.polymarketImpliedProbability)}
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
                  <Badge tone="neutral">{formatScoreline(row)}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </PageFrame>
  );
}
