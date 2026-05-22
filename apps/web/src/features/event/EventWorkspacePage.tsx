import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { classifyMarketSignal } from "@signal-console/domain";

import { RawSourceDrawer } from "./RawSourceDrawer";
import { SignalQualityStrip } from "./SignalQualityStrip";
import {
  formatDivergenceChartData,
  formatTimelineTimestamp,
} from "./timeline-chart";
import { DivergenceMiniChart } from "../../components/DivergenceMiniChart";
import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import {
  getGame,
  getInstrument,
  getInstrumentSources,
  getInstrumentTimeline,
  getInstrumentTimelineExportUrl,
} from "../../data/api";
import {
  chartAxisColor,
  chartGridColor,
  chartLegendStyle,
  chartTooltipStyle,
} from "../../lib/chart-theme";
import {
  buildDivergenceTraceSummary,
  buildLatestComparison,
} from "../../lib/divergence-history";
import { getGameOperationalState } from "../../lib/game-state";
import { formatGapPoints } from "../../lib/market-format";
import { formatOperatorDateTime } from "../../lib/time-format";

const marketResearchSources = ["bet365", "kalshi", "polymarket"] as const;

function toneForMappingStatus(status: string) {
  if (status === "auto") {
    return "positive" as const;
  }
  if (status === "manual") {
    return "warning" as const;
  }
  return "critical" as const;
}

function formatMinutes(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value / 60_000).toFixed(1)} min`;
}

function formatDuration(value: number) {
  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }
  if (value < 60 * 60_000) {
    return `${Math.round(value / 60_000)}m`;
  }
  return `${(value / (60 * 60_000)).toFixed(1)}h`;
}

function formatProbability(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatLine(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function formatCapturedAt(value?: string | null) {
  return formatOperatorDateTime(value);
}

function formatGameStateSummary(
  game: {
    scheduledStart: string;
  },
  gameState?: {
    awayScore?: number | null;
    clock?: string | null;
    homeScore?: number | null;
    period?: number | null;
    status: string;
  } | null
) {
  const scheduledLabel = formatOperatorDateTime(game.scheduledStart);

  if (!gameState) {
    return `Scheduled ${scheduledLabel}`;
  }

  if (gameState.status === "scheduled") {
    return `Scheduled ${scheduledLabel}`;
  }

  const scoreline = `${gameState.awayScore ?? "-"} - ${gameState.homeScore ?? "-"}`;
  const periodLabel = gameState.period ? ` · P${gameState.period}` : "";
  const clockLabel =
    gameState.clock && gameState.clock !== "None"
      ? ` · ${gameState.clock}`
      : "";

  return `${scoreline} · ${gameState.status}${periodLabel}${clockLabel}`;
}

function describeInstrumentQuestion(
  game: {
    awayParticipant: { key: string; shortName: string };
    homeParticipant: { key: string; shortName: string };
  },
  instrument: {
    displayLabel?: string;
    family: string;
    line?: number | null;
    selection: string;
  }
) {
  const participantLabel =
    game.homeParticipant.key === instrument.selection
      ? game.homeParticipant.shortName
      : game.awayParticipant.key === instrument.selection
        ? game.awayParticipant.shortName
        : instrument.selection;

  if (instrument.family === "moneyline") {
    return `${participantLabel} to win outright`;
  }

  if (instrument.family === "spread") {
    return `${participantLabel} to cover ${formatLine(instrument.line)}`;
  }

  if (instrument.family === "total") {
    const direction =
      instrument.selection === "over"
        ? "Game total over"
        : instrument.selection === "under"
          ? "Game total under"
          : "Game total";
    return `${direction} ${instrument.line ?? "n/a"}`;
  }

  return instrument.displayLabel ?? instrument.selection;
}

export function EventWorkspacePage() {
  const { gameId = "", instrumentId = "" } = useParams();
  const [rawDrawerOpen, setRawDrawerOpen] = useState(false);
  const [selectedSourceId] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const game = useQuery({
    enabled: Boolean(gameId),
    queryKey: ["game", gameId],
    queryFn: () => getGame(gameId),
  });
  const instrument = useQuery({
    enabled: Boolean(gameId && instrumentId),
    queryKey: ["instrument", gameId, instrumentId],
    queryFn: () => getInstrument(gameId, instrumentId),
  });
  const timeline = useQuery({
    enabled: Boolean(gameId && instrumentId),
    queryKey: ["instrument-timeline", gameId, instrumentId],
    queryFn: () => getInstrumentTimeline(gameId, instrumentId),
  });
  const sourceDiagnostics = useQuery({
    enabled: Boolean(gameId && instrumentId && showDiagnostics),
    queryKey: ["instrument-sources", gameId, instrumentId],
    queryFn: () => getInstrumentSources(gameId, instrumentId),
  });

  const divergenceTrace = useMemo(
    () => buildDivergenceTraceSummary(timeline.data?.data),
    [timeline.data?.data]
  );
  const latestComparison = useMemo(
    () => buildLatestComparison(timeline.data?.data),
    [timeline.data?.data]
  );

  if (!gameId || !instrumentId) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Route Guard" title="Missing route params" />
          </Panel>
        }
      >
        <ErrorState
          actionLabel="Back to games"
          description="Instrument workspace needs both a game id and an instrument id."
          onAction={() => {
            window.location.assign("/");
          }}
          title="No instrument selected"
        />
      </PageFrame>
    );
  }

  if (
    game.isLoading ||
    instrument.isLoading ||
    timeline.isLoading ||
    (!game.data && !game.isError) ||
    (!instrument.data && !instrument.isError) ||
    (!timeline.data && !timeline.isError)
  ) {
    return <LoadingState message="Loading instrument workspace…" />;
  }

  if (
    game.isError ||
    instrument.isError ||
    timeline.isError ||
    !game.data ||
    !instrument.data ||
    !timeline.data
  ) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Failure State"
              title="Instrument workspace unavailable"
            />
          </Panel>
        }
      >
        <ErrorState
          description="The instrument workspace query failed."
          error={game.error ?? instrument.error ?? timeline.error}
          onAction={() => {
            void game.refetch();
            void instrument.refetch();
            void timeline.refetch();
          }}
          title="Instrument detail failed to load"
        />
      </PageFrame>
    );
  }

  const gameData = game.data.data;
  const instrumentData = instrument.data.data;
  const apiDivergenceSummary =
    instrumentData.derivedComparison.comparisonSummary;
  const divergenceSummary = apiDivergenceSummary
    ? {
        aboveThresholdDurationMs: apiDivergenceSummary.aboveThresholdDurationMs,
        currentGap: apiDivergenceSummary.latestGap ?? null,
        firstAboveThresholdAt:
          apiDivergenceSummary.firstAboveThresholdAt ?? null,
        latestAt: apiDivergenceSummary.latestComparisonAt ?? null,
        maxGap: apiDivergenceSummary.maxGap ?? null,
        maxGapAt: apiDivergenceSummary.maxGapAt ?? null,
        minGap: apiDivergenceSummary.minGap ?? null,
        points: divergenceTrace?.points ?? [],
        threshold: apiDivergenceSummary.threshold,
      }
    : divergenceTrace;
  const divergenceChartData = formatDivergenceChartData(
    divergenceSummary?.points ?? []
  );
  const divergencePointCount = divergenceChartData.filter(
    (row) => typeof row.divergence === "number"
  ).length;
  const diagnosticsData = sourceDiagnostics.data?.data ?? [];
  const exportUrl = getInstrumentTimelineExportUrl(gameId, instrumentId);
  const availableSourceRecordIds = [
    ...new Set([
      ...instrumentData.latestQuotesBySource.map((quote) => quote.source),
      ...instrumentData.latestRawReferences.map(
        (reference) => reference.source
      ),
    ]),
  ];
  const hasSourceQuotes = instrumentData.latestQuotesBySource.length > 0;
  const hasSourceRecords = availableSourceRecordIds.length > 0;
  const hasSourceDiagnostics = diagnosticsData.length > 0;
  const pricedQuotes = instrumentData.latestQuotesBySource.filter(
    (
      quote
    ): quote is (typeof instrumentData.latestQuotesBySource)[number] & {
      impliedProbability: number;
    } => quote.impliedProbability != null
  );
  const gameStateSummary = formatGameStateSummary(
    gameData.game,
    gameData.gameState
  );
  const gameLifecycle = getGameOperationalState(gameData);
  const marketQuestion = describeInstrumentQuestion(
    gameData.game,
    instrumentData.instrument
  );
  const missingMarketSources = marketResearchSources.filter(
    (source) => !pricedQuotes.some((quote) => quote.source === source)
  );
  const signalSummary =
    latestComparison && latestComparison.rows.length >= 2
      ? `${latestComparison.rows
          .map(
            (row) =>
              `${row.source} ${formatProbability(row.impliedProbability)}`
          )
          .join(" · ")} · divergence ${formatGapPoints(
          latestComparison.gap
        )} · ${formatCapturedAt(latestComparison.capturedAt)}`
      : pricedQuotes.length < 2
        ? `No comparison yet. Only ${pricedQuotes[0]?.source ?? "zero sources"} has a quote on this exact market.${missingMarketSources.length > 0 ? ` Missing ${missingMarketSources.join(", ")}.` : ""}`
        : "Bet365 and exchange quotes have not overlapped closely enough to measure this market.";
  const signalState = classifyMarketSignal({
    comparableState: instrumentData.derivedComparison.comparableState,
    gameLifecycle,
    latestSources: instrumentData.latestQuotesBySource,
    requireBet365PlusPredictionMarket:
      instrumentData.instrument.family === "player-prop",
    sourceCount: pricedQuotes.length,
  });
  const displaySignalState =
    signalState.state === "invalid" &&
    signalState.label === "No comparison yet" &&
    divergenceSummary?.maxGap != null
      ? {
          label:
            gameLifecycle.kind === "final"
              ? "Review comparison"
              : "Earlier comparison",
          reason:
            "Latest quotes are not from the same time. Showing the most recent Bet365-vs-exchange comparison.",
          state: signalState.state,
        }
      : signalState;
  const showSignalSummary =
    instrumentData.derivedComparison.comparableState === "comparable" &&
    latestComparison != null;
  const signalBadge = (() => {
    if (signalState.state === "historical") {
      return { label: displaySignalState.label, tone: "neutral" as const };
    }
    if (
      signalState.state === "invalid" ||
      signalState.state === "stale" ||
      instrumentData.derivedComparison.lineMismatch
    ) {
      return {
        label:
          instrumentData.derivedComparison.lineMismatch &&
          signalState.state === "actionable-now"
            ? "line mismatch"
            : displaySignalState.label,
        tone: "warning" as const,
      };
    }
    return { label: displaySignalState.label, tone: "positive" as const };
  })();
  const comparisonRows =
    latestComparison?.rows.map((row) => ({
      capturedAt: row.capturedAt,
      impliedProbability: row.impliedProbability,
      line: row.line,
      marketLabel: instrumentData.instrument.displayLabel,
      source: row.source,
    })) ?? [];
  const comparisonSummary =
    latestComparison && latestComparison.rows.length >= 2
      ? `${latestComparison.rows
          .map(
            (row) =>
              `${row.source} ${formatProbability(row.impliedProbability)}`
          )
          .join(
            " · "
          )} · divergence ${formatGapPoints(latestComparison.gap)} · ${formatCapturedAt(
          latestComparison.capturedAt
        )}`
      : displaySignalState.reason;
  const divergenceHeadline =
    divergenceSummary?.maxGap != null
      ? `${formatGapPoints(divergenceSummary.maxGap)} peak divergence`
      : displaySignalState.label;
  const divergenceDetail =
    divergenceSummary?.maxGapAt != null
      ? `Peak at ${formatCapturedAt(
          divergenceSummary.maxGapAt
        )}. Latest measured divergence ${formatGapPoints(
          divergenceSummary.currentGap
        )} at ${formatCapturedAt(divergenceSummary.latestAt)}.`
      : comparisonSummary;

  return (
    <>
      <PageFrame
        aside={
          <>
            <Panel>
              <SectionTitle
                eyebrow="Comparison"
                title={instrumentData.instrument.displayLabel}
              />
              <div className="tag-row">
                <Badge tone={signalBadge.tone}>{signalBadge.label}</Badge>
                <Badge
                  tone={
                    instrumentData.derivedComparison.lineMismatch
                      ? "warning"
                      : "neutral"
                  }
                >
                  {instrumentData.instrument.family}
                </Badge>
              </div>
            </Panel>

            <Panel>
              <SectionTitle
                eyebrow="Game State"
                title={`${gameData.game.awayParticipant.shortName} at ${gameData.game.homeParticipant.shortName}`}
              />
              <p className="muted">{gameStateSummary}</p>
            </Panel>
          </>
        }
      >
        <section className="hero-strip">
          <div>
            <div className="eyebrow">Market</div>
            <h1>{instrumentData.instrument.displayLabel}</h1>
            <p>
              Bet365 and exchange prices are shown on the same probability
              scale.
            </p>
          </div>
          <div className="hero-actions">
            <a className="primary-button" href={exportUrl}>
              Export timeline CSV
            </a>
            <button
              className="ghost-button"
              disabled={!hasSourceRecords}
              onClick={() => setRawDrawerOpen(true)}
              type="button"
            >
              Source records
            </button>
          </div>
        </section>

        <SignalQualityStrip
          comparisonSummary={apiDivergenceSummary}
          gameId={gameId}
          instrumentId={instrumentId}
        />

        <Panel>
          <SectionTitle
            eyebrow="Comparison"
            title={marketQuestion}
            body={`${instrumentData.instrument.displayLabel} · ${gameStateSummary}`}
          />
          {hasSourceQuotes ? (
            <div className="stack">
              <div
                className={`inline-alert ${
                  displaySignalState.state === "actionable-now"
                    ? "inline-alert-positive"
                    : "inline-alert-warning"
                }`}
              >
                <strong>{divergenceHeadline}</strong>
                <span>
                  {showSignalSummary ? signalSummary : divergenceDetail}
                </span>
                <DivergenceMiniChart summary={divergenceSummary} />
              </div>
              {divergenceSummary?.maxGap != null ? (
                <div className="divergence-summary-grid">
                  <div>
                    <span>Peak divergence</span>
                    <strong>{formatGapPoints(divergenceSummary.maxGap)}</strong>
                    <em>{formatCapturedAt(divergenceSummary.maxGapAt)}</em>
                  </div>
                  <div>
                    <span>Latest measured</span>
                    <strong>
                      {formatGapPoints(divergenceSummary.currentGap)}
                    </strong>
                    <em>{formatCapturedAt(divergenceSummary.latestAt)}</em>
                  </div>
                  <div>
                    <span>
                      Above {formatGapPoints(divergenceSummary.threshold)}
                    </span>
                    <strong>
                      {formatDuration(
                        divergenceSummary.aboveThresholdDurationMs
                      )}
                    </strong>
                    <em>
                      {divergenceSummary.firstAboveThresholdAt
                        ? `from ${formatCapturedAt(
                            divergenceSummary.firstAboveThresholdAt
                          )}`
                        : "not reached"}
                    </em>
                  </div>
                </div>
              ) : null}
              {comparisonRows.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Market</th>
                      <th>Probability</th>
                      <th>Line</th>
                      <th>Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={`${row.source}:${row.capturedAt ?? "missing"}`}>
                        <td>
                          <strong>{row.source}</strong>
                        </td>
                        <td>{row.marketLabel}</td>
                        <td className="table-metric">
                          {formatProbability(row.impliedProbability)}
                        </td>
                        <td>{formatLine(row.line)}</td>
                        <td>{formatCapturedAt(row.capturedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">
                  No Bet365-vs-exchange comparison was measured in the same
                  quote window.
                </p>
              )}
            </div>
          ) : (
            <p className="muted">
              No source quotes have been captured for this instrument yet.
            </p>
          )}
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Timeline"
            title="Divergence over time"
            body="Only Bet365-vs-exchange quote windows are plotted. Long unmeasured spans stay disconnected."
          />
          <div className="chart-shell">
            <ResponsiveContainer height={320} width="100%">
              <LineChart data={divergenceChartData}>
                {timeline.data.data.lineMismatchWindows.map((window, index) => (
                  <ReferenceArea
                    fill="rgba(214, 132, 86, 0.14)"
                    key={`${window.start}-${index}`}
                    x1={window.start}
                    x2={window.end ?? window.start}
                  />
                ))}
                <CartesianGrid stroke={chartGridColor} vertical={false} />
                <XAxis
                  dataKey="capturedAt"
                  stroke={chartAxisColor}
                  tickFormatter={formatTimelineTimestamp}
                />
                <YAxis
                  stroke={chartAxisColor}
                  tickFormatter={(value) => `${value} pp`}
                />
                <Tooltip
                  labelFormatter={formatTimelineTimestamp}
                  {...chartTooltipStyle}
                />
                <Legend wrapperStyle={chartLegendStyle} />
                <Line
                  activeDot={{
                    fill: "#f4c96f",
                    r: 5,
                    stroke: "#f3f7fb",
                    strokeWidth: 1,
                  }}
                  connectNulls={false}
                  dataKey="divergence"
                  dot={
                    divergencePointCount <= 1
                      ? {
                          fill: "#f4c96f",
                          r: 4,
                          stroke: "#f4c96f",
                          strokeWidth: 0,
                        }
                      : false
                  }
                  isAnimationActive={false}
                  name="divergence"
                  stroke="#f4c96f"
                  strokeWidth={2}
                  type="stepAfter"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {timeline.data.data.lineMismatchWindows.length > 0 ? (
            <div className="tag-row">
              {timeline.data.data.lineMismatchWindows.map((window, index) => (
                <Badge key={`${window.start}-${index}`} tone="warning">
                  {window.sources.join(" / ")} mismatch from{" "}
                  {formatTimelineTimestamp(window.start)}
                  {window.end
                    ? ` to ${formatTimelineTimestamp(window.end)}`
                    : ""}
                </Badge>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Details"
            title="Source records"
            body="Stored source rows and timing checks stay here so the comparison above uses one canonical probability scale."
          />
          <div className="stack">
            <div className="tag-row">
              <button
                className="ghost-button"
                onClick={() => setShowDiagnostics((current) => !current)}
                type="button"
              >
                {showDiagnostics
                  ? "Hide source records"
                  : "Show source records"}
              </button>
            </div>
            {showDiagnostics && sourceDiagnostics.isLoading ? (
              <p className="muted">Loading diagnostics…</p>
            ) : null}
            {showDiagnostics && sourceDiagnostics.isError ? (
              <p className="muted">
                Source records failed to load. The comparison above is still
                available.
              </p>
            ) : null}
            {showDiagnostics && hasSourceDiagnostics ? (
              <div className="source-compare-grid">
                {diagnosticsData.map((entry) => (
                  <div
                    className="source-compare-card"
                    key={entry.sourceMarket.id}
                  >
                    <div className="source-compare-head">
                      <strong>{entry.source}</strong>
                      <Badge
                        tone={toneForMappingStatus(
                          entry.diagnostics.mappingStatus
                        )}
                      >
                        {entry.diagnostics.mappingStatus}
                      </Badge>
                    </div>
                    <div className="source-compare-body">
                      <span>
                        market id {entry.sourceMarket.sourceMarketKey}
                      </span>
                      <span>
                        source label {entry.sourceMarket.rawLabel ?? "n/a"} ·
                        family {entry.sourceMarket.rawFamily ?? "n/a"}
                      </span>
                      <span>
                        quote age {formatMinutes(entry.freshnessMs)} · lag{" "}
                        {formatMinutes(entry.diagnostics.captureLagMs)}
                      </span>
                      <span>
                        line mismatch{" "}
                        {entry.diagnostics.lineMismatch ? "present" : "clear"}
                      </span>
                      <span>
                        latest quote{" "}
                        {formatCapturedAt(entry.latestQuote?.capturedAt)}
                      </span>
                      <span>
                        last source record{" "}
                        {entry.latestRawPayload
                          ? `#${entry.latestRawPayload.id} at ${formatCapturedAt(entry.latestRawPayload.capturedAt)}`
                          : "none"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {showDiagnostics &&
            !sourceDiagnostics.isLoading &&
            !sourceDiagnostics.isError &&
            !hasSourceDiagnostics ? (
              <p className="muted">
                No source markets are attached to this canonical instrument yet.
              </p>
            ) : null}
          </div>
        </Panel>
      </PageFrame>

      <RawSourceDrawer
        gameId={gameId}
        instrumentId={instrumentId}
        onClose={() => setRawDrawerOpen(false)}
        open={rawDrawerOpen}
        preferredSourceId={selectedSourceId}
        sourceIds={availableSourceRecordIds}
      />
    </>
  );
}
