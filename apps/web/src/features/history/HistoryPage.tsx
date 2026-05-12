import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

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
  getDivergence,
  getInstrumentTimeline,
  getResearchCoverage,
  getSignalMismatches,
} from "../../data/api";
import {
  formatGapPoints,
  formatMarketMatchLabel,
  formatProbabilityPercent,
} from "../../lib/market-format";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";
import { formatOperatorDateTime } from "../../lib/time-format";

type SignalMismatchRow = Awaited<
  ReturnType<typeof getSignalMismatches>
>["data"][number];
type DivergenceRow = Awaited<ReturnType<typeof getDivergence>>["data"][number];
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

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function yesterdayDateInputValue() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateInputValue(date);
}

function formatReviewDateLabel(value: string) {
  if (!value) {
    return "all persisted dates";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimestamp(value?: string | null) {
  return formatOperatorDateTime(value);
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
    return `Scheduled ${formatOperatorDateTime(row.scheduledStart)}`;
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

export function buildHistoricalGapSummary(
  timeline: InstrumentTimelineData
): HistoricalGapSummary | null {
  const quoteTimeWindowMs = 10 * 60_000;
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

  const latestBySource = new Map<
    string,
    { capturedAtMs: number; value: number }
  >();
  let openingGap: number | null = null;
  let peakSummary: HistoricalGapSummary | null = null;

  for (const point of points) {
    const pointTime = Date.parse(point.capturedAt);
    if (!Number.isFinite(pointTime)) {
      continue;
    }

    latestBySource.set(point.source, {
      capturedAtMs: pointTime,
      value: point.impliedProbability,
    });

    const bet365 = latestBySource.get("bet365");
    const kalshi = latestBySource.get("kalshi");
    const polymarket = latestBySource.get("polymarket");
    const externalEntries = ["kalshi", "polymarket"]
      .map((source) => latestBySource.get(source))
      .filter((entry): entry is { capturedAtMs: number; value: number } =>
        Boolean(
          entry &&
          bet365 &&
          Math.abs(entry.capturedAtMs - bet365.capturedAtMs) <=
            quoteTimeWindowMs
        )
      );

    if (!bet365 || externalEntries.length === 0) {
      continue;
    }

    const externalAverage =
      externalEntries.reduce((sum, entry) => sum + entry.value, 0) /
      externalEntries.length;
    const gap = Math.abs(bet365.value - externalAverage);
    const comparisonCapturedAt = new Date(
      Math.max(
        bet365.capturedAtMs,
        ...externalEntries.map((entry) => entry.capturedAtMs)
      )
    ).toISOString();

    if (openingGap == null) {
      openingGap = gap;
    }

    if (!peakSummary || gap > peakSummary.peakGap) {
      peakSummary = {
        openingGap,
        peakBet365: bet365.value,
        peakCapturedAt: comparisonCapturedAt,
        peakGap: gap,
        peakGameState: findGameStateAt(
          timeline.gameStateSeries,
          comparisonCapturedAt
        ),
        peakKalshi:
          kalshi != null && externalEntries.includes(kalshi)
            ? kalshi.value
            : null,
        peakPolymarket:
          polymarket != null && externalEntries.includes(polymarket)
            ? polymarket.value
            : null,
      };
    }
  }

  return peakSummary;
}

function selectHighlightRows(
  rows: SignalMismatchRow[],
  reviewDateLabel: string
) {
  const finishedRows = rows.filter(
    (row) => row.gameStatus === "final" && !row.lineMismatch
  );

  if (finishedRows.length > 0) {
    return {
      body: `Finished-game mismatches persisted for ${reviewDateLabel}, ranked by divergence.`,
      rows: finishedRows.slice(0, 3),
      usesFallback: false,
    };
  }

  if (rows.length === 0) {
    return {
      body: `No signal mismatch rows are persisted for ${reviewDateLabel}.`,
      rows: [],
      usesFallback: false,
    };
  }

  return {
    body: `Current or pregame mismatches persisted for ${reviewDateLabel}.`,
    rows: rows.filter((row) => !row.lineMismatch).slice(0, 3),
    usesFallback: true,
  };
}

function marketFamilyFromParam(value: string | null) {
  return value === "player-prop" ||
    value === "moneyline" ||
    value === "spread" ||
    value === "total"
    ? value
    : "all";
}

function formatPlayerPropCount(count: number) {
  return `${count} player prop${count === 1 ? "" : "s"} tracked`;
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewDate, setReviewDate] = useState(
    () => searchParams.get("date") ?? yesterdayDateInputValue()
  );
  const [marketFamily, setMarketFamily] = useState(() =>
    marketFamilyFromParam(searchParams.get("family"))
  );
  const reviewDateLabel = useMemo(
    () => formatReviewDateLabel(reviewDate),
    [reviewDate]
  );
  const selectedFamily = marketFamily === "all" ? undefined : marketFamily;

  function updateHistoryFilters(next: { date?: string; family?: string }) {
    const nextDate = next.date ?? reviewDate;
    const nextFamily = next.family ?? marketFamily;
    setReviewDate(nextDate);
    setMarketFamily(nextFamily);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (nextDate) {
        params.set("date", nextDate);
      } else {
        params.delete("date");
      }
      if (nextFamily !== "all") {
        params.set("family", nextFamily);
      } else {
        params.delete("family");
      }
      return params;
    });
  }

  const signalMismatches = useQuery({
    queryKey: ["research-signal-mismatches", reviewDate, selectedFamily],
    queryFn: () =>
      getSignalMismatches({
        date: reviewDate || undefined,
        family: selectedFamily,
      }),
  });
  const trackedPlayerProps = useQuery({
    enabled: selectedFamily === "player-prop",
    queryKey: ["research-history-tracked-player-props", reviewDate],
    queryFn: () =>
      getDivergence({
        date: reviewDate || undefined,
        family: "player-prop",
        limit: 500,
        sort: "signalPriority",
      }),
  });
  const secondaryHistoryEnabled = Boolean(signalMismatches.data);
  const captureRuns = useQuery({
    enabled: secondaryHistoryEnabled,
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    enabled: secondaryHistoryEnabled,
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const researchCoverage = useQuery({
    enabled: secondaryHistoryEnabled,
    queryKey: ["research-coverage"],
    queryFn: getResearchCoverage,
  });

  const highlightedRows = selectHighlightRows(
    signalMismatches.data?.data ?? [],
    reviewDateLabel
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
    signalMismatches.isLoading ||
    (!signalMismatches.data && !signalMismatches.isError)
  ) {
    return <LoadingState message="Loading persisted research history…" />;
  }

  if (signalMismatches.isError || !signalMismatches.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Fallback" title="History unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The persisted signal mismatch surface could not be loaded."
          error={signalMismatches.error}
          onAction={() => {
            void signalMismatches.refetch();
          }}
          title="History failed to load"
        />
      </PageFrame>
    );
  }

  const storageCoverageRows = storageCoverage.data?.data ?? [];
  const researchCoverageRows = researchCoverage.data?.data ?? [];
  const quoteTicksPersisted = storageCoverageRows.reduce(
    (sum, row) => sum + row.quoteTickCount,
    0
  );
  const finishedSignalCount = signalMismatches.data.data.filter(
    (row) => row.gameStatus === "final"
  ).length;
  const directionalSignalCount = signalMismatches.data.data.filter(
    (row) => row.directionalDisagreement
  ).length;
  const trackedPlayerPropRows = trackedPlayerProps.data?.data ?? [];
  const firstHighlight = highlightedRows.rows[0] ?? null;

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Review Date"
            title={firstHighlight?.displayLabel ?? "No highlighted comparison"}
            body={
              firstHighlight
                ? `${reviewDateLabel} · ${formatGapPoints(
                    firstHighlight.impliedProbabilityGap
                  )} peak divergence`
                : reviewDateLabel
            }
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">History</div>
          <h1>Persisted market history</h1>
          <p>
            {reviewDateLabel}
            {selectedFamily ? ` · ${selectedFamily}` : ""} · source comparisons
            and ingest evidence.
          </p>
        </div>
        <div className="history-review-actions">
          <label>
            <span>Review date</span>
            <input
              onChange={(event) =>
                updateHistoryFilters({ date: event.target.value })
              }
              type="date"
              value={reviewDate}
            />
          </label>
          <label>
            <span>Family</span>
            <select
              onChange={(event) =>
                updateHistoryFilters({ family: event.target.value })
              }
              value={marketFamily}
            >
              <option value="all">All families</option>
              <option value="player-prop">Player props</option>
              <option value="moneyline">Moneyline</option>
              <option value="spread">Spread</option>
              <option value="total">Total</option>
            </select>
          </label>
        </div>
      </section>

      {selectedFamily === "player-prop" ? (
        <Panel>
          <SectionTitle
            eyebrow="Tracked Player Props"
            title={
              trackedPlayerProps.isLoading
                ? "Loading tracked player props"
                : formatPlayerPropCount(trackedPlayerPropRows.length)
            }
            body="Includes props below the notification threshold."
          />
          {trackedPlayerProps.isError ? (
            <ErrorState
              description="Tracked player-prop rows could not be loaded."
              error={trackedPlayerProps.error}
              onAction={() => void trackedPlayerProps.refetch()}
              title="Tracked player props failed to load"
            />
          ) : trackedPlayerProps.isLoading ? (
            <div className="loading-panel">Loading tracked player props...</div>
          ) : trackedPlayerPropRows.length === 0 ? (
            <p className="muted">
              No persisted player-prop rows are available for this date.
            </p>
          ) : (
            <div className="tracked-history-grid">
              {trackedPlayerPropRows.slice(0, 24).map((row: DivergenceRow) => (
                <Link
                  className="tracked-history-row"
                  key={`${row.gameId}:${row.instrumentId}`}
                  to={`/games/${row.gameId}/markets/${row.instrumentId}`}
                >
                  <div>
                    <strong>{row.displayLabel}</strong>
                    <span>{row.gameId}</span>
                  </div>
                  <em>{formatGapPoints(row.impliedProbabilityGap)}</em>
                  <span>{formatMarketMatchLabel(row.comparableState)}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      <Panel>
        <SectionTitle
          eyebrow="Finished Games"
          title="Largest persisted divergences"
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
                      <span>Peak divergence</span>
                      <strong>
                        {highlightSummary
                          ? formatGapPoints(highlightSummary.peakGap)
                          : formatGapPoints(row.impliedProbabilityGap)}
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
                              ? formatGapPoints(highlightSummary.openingGap)
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
                            {formatProbabilityPercent(
                              highlightSummary?.peakBet365 ??
                                row.bet365ImpliedProbability
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Exchanges</span>
                          <strong>
                            {formatProbabilityPercent(
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
                        Bet365 differed by{" "}
                        {highlightSummary
                          ? formatGapPoints(highlightSummary.peakGap)
                          : formatGapPoints(row.impliedProbabilityGap)}{" "}
                        from the exchange average after opening at{" "}
                        {highlightSummary
                          ? formatGapPoints(highlightSummary.openingGap)
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
          value={
            storageCoverage.isLoading ? "..." : String(quoteTicksPersisted)
          }
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
          {captureRuns.isLoading ? (
            <div className="loading-panel">Loading capture runs...</div>
          ) : captureRuns.isError || !captureRuns.data ? (
            <ErrorState
              description="Capture-run history could not be loaded."
              error={captureRuns.error}
              onAction={() => void captureRuns.refetch()}
              title="Capture runs failed to load"
            />
          ) : captureRuns.data.data.length === 0 ? (
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
            {storageCoverage.isLoading ? (
              <div className="loading-panel">Loading storage coverage...</div>
            ) : storageCoverage.isError || !storageCoverage.data ? (
              <ErrorState
                description="Persisted source coverage could not be loaded."
                error={storageCoverage.error}
                onAction={() => void storageCoverage.refetch()}
                title="Storage coverage failed to load"
              />
            ) : storageCoverageRows.length === 0 ? (
              <p className="muted">No persisted source coverage rows yet.</p>
            ) : (
              storageCoverageRows.slice(0, 8).map((row) => (
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
            {researchCoverage.isLoading ? (
              <div className="loading-panel">Loading research coverage...</div>
            ) : researchCoverage.isError || !researchCoverage.data ? (
              <ErrorState
                description="Research coverage rows could not be loaded."
                error={researchCoverage.error}
                onAction={() => void researchCoverage.refetch()}
                title="Research coverage failed to load"
              />
            ) : researchCoverageRows.length === 0 ? (
              <p className="muted">
                No research coverage rows are available yet.
              </p>
            ) : (
              researchCoverageRows.slice(0, 8).map((row) => (
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
          title="Past disagreement snapshot"
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
                  {row.gameLabel} · {row.family} · divergence{" "}
                  {formatGapPoints(row.impliedProbabilityGap)} · bet365{" "}
                  {formatProbabilityPercent(row.bet365ImpliedProbability)} ·
                  kalshi{" "}
                  {formatProbabilityPercent(row.kalshiImpliedProbability)} ·
                  polymarket{" "}
                  {formatProbabilityPercent(row.polymarketImpliedProbability)}
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
