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

import { RawSourceDrawer } from "./RawSourceDrawer";
import {
  formatTimelineChartData,
  formatTimelineTimestamp,
} from "./timeline-chart";
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
  sourceSeriesColors,
} from "../../lib/chart-theme";

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
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRawPrice(
  raw: {
    odds?: string | null;
    price?: number | null;
  },
  source: string
) {
  if (raw.odds) {
    return `odds ${raw.odds}`;
  }

  if (typeof raw.price === "number") {
    return source === "polymarket"
      ? `price ${raw.price.toFixed(3)}`
      : `price ${raw.price.toFixed(2)}`;
  }

  return "price n/a";
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
  const scheduledLabel = new Date(game.scheduledStart).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

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

  return instrument.selection;
}

export function EventWorkspacePage() {
  const { gameId = "", instrumentId = "" } = useParams();
  const [rawDrawerOpen, setRawDrawerOpen] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
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

  const chartData = useMemo(
    () =>
      formatTimelineChartData(timeline.data?.data.quoteSeriesBySource ?? {}),
    [timeline.data?.data.quoteSeriesBySource]
  );
  const timelinePointCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(timeline.data?.data.quoteSeriesBySource ?? {}).map(
          ([sourceId, points]) => [
            sourceId,
            points.filter((point) => point.impliedProbability != null).length,
          ]
        )
      ),
    [timeline.data?.data.quoteSeriesBySource]
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
  const diagnosticsData = sourceDiagnostics.data?.data ?? [];
  const exportUrl = getInstrumentTimelineExportUrl(gameId, instrumentId);
  const hasSourceQuotes = instrumentData.latestQuotesBySource.length > 0;
  const hasSourceDiagnostics = diagnosticsData.length > 0;
  const pricedQuotes = instrumentData.latestQuotesBySource.filter(
    (
      quote
    ): quote is (typeof instrumentData.latestQuotesBySource)[number] & {
      impliedProbability: number;
    } => quote.impliedProbability != null
  );
  const highestQuote = [...pricedQuotes].sort(
    (left, right) => right.impliedProbability - left.impliedProbability
  )[0];
  const lowestQuote = [...pricedQuotes].sort(
    (left, right) => left.impliedProbability - right.impliedProbability
  )[0];
  const observedGap =
    highestQuote && lowestQuote
      ? highestQuote.impliedProbability - lowestQuote.impliedProbability
      : null;
  const gameStateSummary = formatGameStateSummary(
    gameData.game,
    gameData.gameState
  );
  const marketQuestion = describeInstrumentQuestion(
    gameData.game,
    instrumentData.instrument
  );
  const missingMarketSources = marketResearchSources.filter(
    (source) => !pricedQuotes.some((quote) => quote.source === source)
  );
  const signalSummary =
    pricedQuotes.length < 2
      ? `No comparative signal yet. Only ${pricedQuotes[0]?.source ?? "zero sources"} has a current quote on this exact market.${missingMarketSources.length > 0 ? ` Missing ${missingMarketSources.join(", ")}.` : ""}`
      : `${highestQuote?.source ?? "A source"} is ${formatProbability(
          highestQuote?.impliedProbability
        )} and ${lowestQuote?.source ?? "another source"} is ${formatProbability(
          lowestQuote?.impliedProbability
        )}, a ${formatProbability(
          observedGap
        )} spread on ${marketQuestion.toLowerCase()}.`;
  const signalBadge =
    pricedQuotes.length < 2
      ? {
          label: "single source",
          tone: "warning" as const,
        }
      : instrumentData.derivedComparison.lineMismatch
        ? {
            label: "line mismatch",
            tone: "warning" as const,
          }
        : {
            label: "signal live",
            tone: "positive" as const,
          };

  function openRawSource(sourceId?: string | null) {
    setSelectedSourceId(sourceId ?? null);
    setRawDrawerOpen(true);
  }

  return (
    <>
      <PageFrame
        aside={
          <>
            <Panel>
              <SectionTitle
                eyebrow="Research Comparison"
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
            <div className="eyebrow">Instrument Workspace</div>
            <h1>{instrumentData.instrument.displayLabel}</h1>
            <p>
              See the market question, who is pricing it right now, and whether
              there is a real multi-source signal.
            </p>
          </div>
          <div className="hero-actions">
            <a className="primary-button" href={exportUrl}>
              Export timeline CSV
            </a>
            <button
              className="ghost-button"
              disabled={!hasSourceQuotes}
              onClick={() => setRawDrawerOpen(true)}
              type="button"
            >
              Inspect raw source payloads
            </button>
          </div>
        </section>

        <Panel>
          <SectionTitle
            eyebrow="Current Market Read"
            title={marketQuestion}
            body={`${instrumentData.instrument.displayLabel} · ${gameStateSummary}`}
          />
          {hasSourceQuotes ? (
            <div className="stack">
              <div
                className={`inline-alert ${
                  pricedQuotes.length >= 2
                    ? "inline-alert-positive"
                    : "inline-alert-warning"
                }`}
              >
                <strong>
                  {pricedQuotes.length >= 2
                    ? "Comparative signal is live on this market."
                    : "No comparative signal yet on this exact market."}
                </strong>
                <span>{signalSummary}</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Probability</th>
                    <th>Odds / Price</th>
                    <th>Freshness</th>
                    <th>Captured</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {instrumentData.latestQuotesBySource.map((quote) => (
                    <tr key={quote.source}>
                      <td>
                        <strong>{quote.source}</strong>
                        <div className="table-subtle">
                          <Badge
                            tone={toneForMappingStatus(quote.mappingStatus)}
                          >
                            {quote.mappingStatus}
                          </Badge>
                        </div>
                      </td>
                      <td className="table-metric">
                        {formatProbability(quote.impliedProbability)}
                      </td>
                      <td>
                        <div>{formatRawPrice(quote.raw, quote.source)}</div>
                        <div className="muted">
                          line {formatLine(quote.raw.line)}
                        </div>
                      </td>
                      <td>{formatMinutes(quote.freshnessMs)}</td>
                      <td>{formatCapturedAt(quote.capturedAt)}</td>
                      <td>
                        <button
                          className="ghost-button"
                          onClick={() => openRawSource(quote.source)}
                          type="button"
                        >
                          Open raw
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            title="How that market moved over time"
            body="Only priced sources on this exact instrument are plotted. Single observations stay visible as dots."
          />
          <div className="chart-shell">
            <ResponsiveContainer height={320} width="100%">
              <LineChart data={chartData}>
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
                <YAxis stroke={chartAxisColor} />
                <Tooltip
                  labelFormatter={formatTimelineTimestamp}
                  {...chartTooltipStyle}
                />
                <Legend wrapperStyle={chartLegendStyle} />
                {instrumentData.latestQuotesBySource.map((quote) => (
                  <Line
                    dataKey={quote.source}
                    key={quote.source}
                    name={quote.source}
                    dot={
                      (timelinePointCounts[quote.source] ?? 0) <= 1
                        ? {
                            fill: sourceSeriesColors[quote.source] ?? "#69d7a5",
                            r: 4,
                            stroke:
                              sourceSeriesColors[quote.source] ?? "#69d7a5",
                            strokeWidth: 0,
                          }
                        : false
                    }
                    activeDot={{
                      fill: sourceSeriesColors[quote.source] ?? "#69d7a5",
                      r: 5,
                      stroke: "#f3f7fb",
                      strokeWidth: 1,
                    }}
                    stroke={sourceSeriesColors[quote.source] ?? "#69d7a5"}
                    strokeWidth={2}
                    type="monotone"
                  />
                ))}
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
            eyebrow="Diagnostics"
            title="Research plumbing"
            body="Hidden by default so the instrument page stays focused on the actual comparison signal."
          />
          <div className="stack">
            <div className="tag-row">
              <button
                className="ghost-button"
                onClick={() => setShowDiagnostics((current) => !current)}
                type="button"
              >
                {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
              </button>
            </div>
            {showDiagnostics && sourceDiagnostics.isLoading ? (
              <p className="muted">Loading diagnostics…</p>
            ) : null}
            {showDiagnostics && sourceDiagnostics.isError ? (
              <p className="muted">
                Diagnostics failed to load. The primary comparison data above is
                still available.
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
                        source market {entry.sourceMarket.sourceMarketKey}
                      </span>
                      <span>
                        raw label {entry.sourceMarket.rawLabel ?? "n/a"} ·
                        family {entry.sourceMarket.rawFamily ?? "n/a"}
                      </span>
                      <span>
                        freshness {formatMinutes(entry.freshnessMs)} · lag{" "}
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
                        latest raw payload{" "}
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
        sourceIds={instrumentData.latestQuotesBySource.map(
          (quote) => quote.source
        )}
      />
    </>
  );
}
