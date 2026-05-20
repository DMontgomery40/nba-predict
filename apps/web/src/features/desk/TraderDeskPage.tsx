import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { BoardAlertsBanner } from "./BoardAlertsBanner";
import { DivergenceMiniChart } from "../../components/DivergenceMiniChart";
import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import {
  getAdminCaptureRuns,
  getAdminSources,
  getAdminStorageCoverage,
  getClosedGames,
  getBoardVolatility,
  getDivergence,
  getGames,
  getInstrumentLeadLag,
  getInstrumentTimeline,
  getMarketAnomalies,
  getReadyHealth,
  getSignalQualityReport,
  getSignalMismatches,
  isApiRequestError,
  type AdminCaptureRunsPayload,
  type AdminSourcesPayload,
  type AdminStorageCoveragePayload,
  type ClosedGamesPayload,
  type DivergencePayload,
  type GamesPayload,
} from "../../data/api";
import { buildDivergenceTraceSummary } from "../../lib/divergence-history";
import {
  formatGamePeriodClock,
  formatGameScoreClock,
  getGameOperationalState,
} from "../../lib/game-state";
import { buildGameTriage, getMarketSources } from "../../lib/game-triage";
import {
  formatGapPoints,
  formatMarketMatchLabel,
} from "../../lib/market-format";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";
import { formatOperatorDateTime } from "../../lib/time-format";

type DivergenceRow = DivergencePayload["data"][number];
type GameRow = GamesPayload["data"][number];
type SourceHealthRow = AdminSourcesPayload["data"][number];
type CaptureRunRow = AdminCaptureRunsPayload["data"][number];
type StorageCoverageRow = AdminStorageCoveragePayload["data"][number];
type ClosedGameSummary = ClosedGamesPayload["data"][number];

const ACTIONABLE_BET365_RECENCY_MS = 15 * 60_000;

function isTransientDeskError(error: Error) {
  return isApiRequestError(error)
    ? error.status >= 500 || error.status === 0
    : true;
}

function retryTransientDeskQuery(failureCount: number, error: Error) {
  return isTransientDeskError(error) && failureCount < 2;
}

function deskRetryDelay(attemptIndex: number) {
  return Math.min(100 * 2 ** attemptIndex, 500);
}

function formatDeskQueryError(error: unknown) {
  if (isApiRequestError(error)) {
    return `${error.message}${error.requestId ? ` (${error.requestId})` : ""}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function formatProbability(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatDecimal(value?: number | null, digits = 4) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return value.toFixed(digits);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(value?: string | null) {
  return formatOperatorDateTime(value);
}

function formatAge(value?: number | null) {
  if (value == null) {
    return "no quote";
  }

  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }

  if (value < 60 * 60_000) {
    return `${(value / 60_000).toFixed(1)}m`;
  }

  return `${(value / (60 * 60_000)).toFixed(1)}h`;
}

function formatDuration(value?: number | null) {
  if (value == null || value <= 0) {
    return "0s";
  }
  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }
  if (value < 60 * 60_000) {
    return `${Math.round(value / 60_000)}m`;
  }
  return `${(value / (60 * 60_000)).toFixed(1)}h`;
}

function rowTone(row: DivergenceRow) {
  if (row.severity === "critical") {
    return "danger";
  }
  if (row.severity === "high" || row.lineMismatch) {
    return "hot";
  }
  if (row.severity === "medium") {
    return "warm";
  }
  return "cool";
}

function alertTone(row: { severity: string }) {
  if (row.severity === "critical") {
    return "danger";
  }
  if (row.severity === "high") {
    return "hot";
  }
  if (row.severity === "medium") {
    return "warm";
  }
  return "cool";
}

function volatilityTone(band?: string) {
  if (band === "critical" || band === "alert") return "danger";
  if (band === "elevated") return "hot";
  if (band === "normal") return "cool";
  return "warm";
}

function formatVolatilityBand(band?: string) {
  if (!band) return "No data";
  return band.replace(/-/g, " ");
}

function boardVolatilityAnchorAt(alertId?: string | null, measuredAt?: string) {
  if (typeof alertId === "string") {
    const prefix = "board-alert:";
    if (alertId.startsWith(prefix)) {
      const parts = alertId.split(":");
      if (parts.length >= 5) {
        return parts.slice(4).join(":");
      }
    }
  }
  return measuredAt;
}

function freshnessTone(row: DivergenceRow) {
  const recency = row.captureRecencyMs;
  if (recency == null) {
    return "danger";
  }
  if (recency <= 60_000) {
    return "cool";
  }
  if (recency <= 5 * 60_000) {
    return "warm";
  }
  return "hot";
}

function sourceStatusTone(status?: string) {
  if (status === "ok" || status === "ready" || status === "public") {
    return "cool";
  }
  if (status === "configured") {
    return "warm";
  }
  return "danger";
}

function hasBet365Comparison(row: DivergenceRow) {
  const sources = row.sources ?? [];
  return (
    sources.includes("bet365") &&
    (sources.includes("kalshi") || sources.includes("polymarket")) &&
    (row.comparisonSummary?.comparisonCount ?? 0) > 0
  );
}

function isLiveBet365Comparison(row: DivergenceRow) {
  return (
    hasBet365Comparison(row) &&
    row.gameStatus === "in-play" &&
    row.captureRecencyMs != null &&
    row.captureRecencyMs <= ACTIONABLE_BET365_RECENCY_MS
  );
}

function sourceSplitForRow(row: DivergenceRow) {
  return row.gameStatus === "final"
    ? row.comparisonSummary?.maxGapSourceProbabilities
    : (row.comparisonSummary?.latestSourceProbabilities ??
        row.comparisonSummary?.maxGapSourceProbabilities);
}

function buildSourceMap(rows: SourceHealthRow[]) {
  return new Map(rows.map((row) => [row.source, row]));
}

function latestRunBySource(rows: CaptureRunRow[]) {
  const latest = new Map<string, CaptureRunRow>();
  for (const row of rows) {
    const existing = latest.get(row.source);
    if (!existing || row.startedAt > existing.startedAt) {
      latest.set(row.source, row);
    }
  }
  return latest;
}

function buildStorageSummary(
  rows: StorageCoverageRow[],
  runs: CaptureRunRow[]
) {
  const latestRuns = latestRunBySource(runs);
  const bySource = new Map<
    string,
    {
      gameIds: Set<string>;
      quoteTicks: number;
      rawPayloads: number;
      source: string;
      sourceMarkets: number;
    }
  >();

  for (const row of rows) {
    const existing =
      bySource.get(row.source) ??
      ({
        gameIds: new Set<string>(),
        quoteTicks: 0,
        rawPayloads: 0,
        source: row.source,
        sourceMarkets: 0,
      } satisfies {
        gameIds: Set<string>;
        quoteTicks: number;
        rawPayloads: number;
        source: string;
        sourceMarkets: number;
      });
    existing.gameIds.add(row.gameId);
    existing.quoteTicks += row.quoteTickCount;
    existing.rawPayloads += row.rawPayloadCount;
    existing.sourceMarkets += row.sourceMarketCount;
    bySource.set(row.source, existing);
  }

  return [...bySource.values()]
    .map((row) => ({
      ...row,
      gameCount: row.gameIds.size,
      latestRun: latestRuns.get(row.source),
    }))
    .sort((left, right) => right.quoteTicks - left.quoteTicks);
}

function findWinnerInstrument(game: ClosedGameSummary) {
  return (
    game.moneylineByParticipant.find(
      (instrument) => instrument.outcome.winnerProbability === 1
    ) ?? game.moneylineByParticipant[0]
  );
}

function callTone(
  probability?: number | null,
  winnerProbability?: 0 | 1 | null
) {
  if (probability == null || winnerProbability == null) {
    return "none";
  }

  return winnerProbability === 1
    ? probability >= 0.5
      ? "cool"
      : "danger"
    : probability < 0.5
      ? "cool"
      : "danger";
}

function formatSourceLabel(source: string) {
  if (source === "bet365") {
    return "b365";
  }

  return source;
}

function formatGameLabel(game: GameRow) {
  return `${game.game.awayParticipant.shortName} at ${game.game.homeParticipant.shortName}`;
}

function marketTimingLabel(row: DivergenceRow) {
  if (row.gameStatus === "final") {
    return "finished game";
  }
  if (row.gameStatus === "in-play") {
    return "game in progress";
  }
  if (row.gameStatus === "scheduled") {
    return "scheduled game";
  }
  return formatMarketMatchLabel(row.comparableState);
}

function InstrumentTrace({
  fallbackSummary,
  gameId,
  instrumentId,
}: {
  fallbackSummary?: DivergenceRow["comparisonSummary"] | null;
  gameId: string;
  instrumentId: string;
}) {
  const timeline = useQuery({
    queryKey: ["instrument-timeline-mini", gameId, instrumentId],
    queryFn: () => getInstrumentTimeline(gameId, instrumentId),
    refetchInterval: 5000,
  });
  const summary = buildDivergenceTraceSummary(timeline.data?.data);

  if (summary) {
    return <DivergenceMiniChart summary={summary} />;
  }

  if (fallbackSummary) {
    return (
      <div className="mini-divergence mini-divergence-summary">
        <div className="mini-divergence-meta">
          <span>latest {formatGapPoints(fallbackSummary.latestGap)}</span>
          <span>
            range {formatGapPoints(fallbackSummary.minGap)}-
            {formatGapPoints(fallbackSummary.maxGap)}
          </span>
          <span>
            {formatDuration(fallbackSummary.aboveThresholdDurationMs)} above
          </span>
        </div>
      </div>
    );
  }

  return <DivergenceMiniChart summary={summary} />;
}

export function TraderDeskPage() {
  const [dismissedAnomalyAlertId, setDismissedAnomalyAlertId] = useState<
    string | null
  >(null);
  const games = useQuery({
    queryKey: ["games", { limit: 25 }],
    queryFn: () => getGames({ limit: 25 }),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    retry: retryTransientDeskQuery,
    retryDelay: deskRetryDelay,
    staleTime: 5_000,
  });
  const divergence = useQuery({
    queryKey: ["divergence", { limit: 25, sort: "signalPriority" }],
    queryFn: () => getDivergence({ limit: 25, sort: "signalPriority" }),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    retry: retryTransientDeskQuery,
    retryDelay: deskRetryDelay,
    staleTime: 5_000,
  });
  const primarySurfacesReady = Boolean(games.data && divergence.data);
  const boardVolatility = useQuery({
    queryKey: ["research-board-volatility", "live", 5],
    queryFn: () => getBoardVolatility({ contextWindowMinutes: 30, limit: 5 }),
    enabled: primarySurfacesReady,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) =>
      isTransientDeskError(error) && failureCount < 1,
    retryDelay: deskRetryDelay,
    staleTime: 4_000,
  });
  const marketAnomalies = useQuery({
    queryKey: ["research-market-anomalies", "live"],
    queryFn: () =>
      getMarketAnomalies({
        includeUnmapped: true,
        limit: 12,
        minConfidence: 0.45,
        minScore: 45,
      }),
    enabled: primarySurfacesReady,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) =>
      isTransientDeskError(error) && failureCount < 1,
    retryDelay: deskRetryDelay,
    staleTime: 10_000,
  });
  const supportingQueriesEnabled = primarySurfacesReady;
  const deskReviewAnalyticsEnabled = true;
  const topCandidate = divergence.data?.data[0];
  const pregameSignalQuality = useQuery({
    enabled: supportingQueriesEnabled && deskReviewAnalyticsEnabled,
    queryKey: ["research", "signal-quality", "pregame"],
    queryFn: () => getSignalQualityReport({ closingCutoff: "pregame" }),
  });
  const liveFinalSignalQuality = useQuery({
    enabled: supportingQueriesEnabled && deskReviewAnalyticsEnabled,
    queryKey: ["research", "signal-quality", "live-final"],
    queryFn: () => getSignalQualityReport({ closingCutoff: "live-final" }),
  });
  const closedGames = useQuery({
    enabled: supportingQueriesEnabled && deskReviewAnalyticsEnabled,
    queryKey: ["research", "closed-games", "pregame", 6],
    queryFn: () => getClosedGames({ closingCutoff: "pregame", limit: 6 }),
  });
  const topLeadLag = useQuery({
    enabled: Boolean(topCandidate),
    queryKey: [
      "desk-top-lead-lag",
      topCandidate?.gameId,
      topCandidate?.instrumentId,
    ],
    queryFn: () => {
      if (!topCandidate) {
        throw new Error("Top instrument is not available.");
      }
      return getInstrumentLeadLag(
        topCandidate.gameId,
        topCandidate.instrumentId,
        {
          bucketSeconds: 60,
          maxLagBuckets: 30,
        }
      );
    },
  });
  const signalMismatches = useQuery({
    enabled: supportingQueriesEnabled,
    queryKey: ["research-signal-mismatches"],
    queryFn: () => getSignalMismatches(),
  });
  const sourceHealth = useQuery({
    enabled: supportingQueriesEnabled,
    queryKey: ["admin-sources"],
    queryFn: getAdminSources,
  });
  const captureRuns = useQuery({
    enabled: supportingQueriesEnabled,
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    enabled: supportingQueriesEnabled,
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const readiness = useQuery({
    enabled: supportingQueriesEnabled,
    queryKey: ["health-ready"],
    queryFn: getReadyHealth,
  });

  const primaryLoadError =
    games.isError && !games.data
      ? games.error
      : divergence.isError && !divergence.data
        ? divergence.error
        : null;

  if (primaryLoadError) {
    return (
      <PageFrame>
        <ErrorState
          description="The trader desk needs the persisted game list and ranked divergence queue before it can be trusted."
          error={primaryLoadError}
          onAction={() => {
            void games.refetch();
            void divergence.refetch();
          }}
          title="Trader desk failed to load"
        />
      </PageFrame>
    );
  }

  if (
    games.isLoading ||
    divergence.isLoading ||
    !games.data ||
    !divergence.data
  ) {
    return <LoadingState message="Building trader desk..." />;
  }

  const rows = divergence.data?.data ?? [];
  const gameRows = games.data?.data ?? [];
  const gameTriage = buildGameTriage(gameRows);
  const pressureRows = gameTriage.actionableRows
    .filter((row) => row.topDivergences.length > 0 || row.hasUnmappedMarkets)
    .slice(0, 10);
  const stateAttentionRows = gameRows
    .map((game) => ({
      game,
      state: getGameOperationalState(game),
    }))
    .filter(
      ({ state }) => state.tone === "critical" || state.tone === "warning"
    )
    .slice(0, 5);
  const sourceMap = buildSourceMap(sourceHealth.data?.data ?? []);
  const storageRows = buildStorageSummary(
    storageCoverage.data?.data ?? [],
    captureRuns.data?.data ?? []
  );
  const pregameQualityRows = pregameSignalQuality.data?.data.perSource ?? [];
  const liveFinalQualityRows =
    liveFinalSignalQuality.data?.data.perSource ?? [];
  const liveFinalBySource = new Map(
    liveFinalQualityRows.map((row) => [row.source, row])
  );
  const topLeadLagPair = topLeadLag.data?.data.pairs[0];
  const trustedLeadLagPair =
    topLeadLagPair && topLeadLagPair.bestCorrelation >= 0.2
      ? topLeadLagPair
      : null;
  const anomalyRows = marketAnomalies.data?.data ?? [];
  const topAnomaly = anomalyRows[0] ?? null;
  const volatilityRows = boardVolatility.data?.data ?? [];
  const topVolatility = volatilityRows[0] ?? null;
  const gameById = new Map(gameRows.map((game) => [game.game.id, game]));
  const topVolatilityGame = topVolatility
    ? gameById.get(topVolatility.gameId)
    : null;
  const topVolatilityScoreClock = topVolatilityGame
    ? formatGameScoreClock(topVolatilityGame)
    : null;
  const topVolatilityPeriodClock = formatGamePeriodClock(
    topVolatilityGame?.gameState
  );
  const topVolatilityAnchorAt = boardVolatilityAnchorAt(
    topVolatility?.alertId,
    topVolatility?.measuredAt
  );
  const volatilityEvidence = topVolatility?.evidence.slice(0, 4) ?? [];
  const showAnomalyPopup =
    topAnomaly != null && topAnomaly.id !== dismissedAnomalyAlertId;
  const liveTrackedRows = gameRows.filter(
    (row) => getGameOperationalState(row).tone === "live"
  ).length;
  const lineMismatchRows = rows.filter((row) => row.lineMismatch).length;
  const unmappedCoverageRows = gameRows.filter(
    (row) =>
      row.hasUnmappedMarkets || row.coverage.unmappedSourceMarketCount > 0
  ).length;
  const bet365BackedRows = rows.filter(hasBet365Comparison);
  const liveBet365Rows = bet365BackedRows.filter(isLiveBet365Comparison);
  const reviewBet365Rows = bet365BackedRows.filter(
    (row) => !isLiveBet365Comparison(row)
  );
  const externalOnlyRows = rows.filter(
    (row) => !hasBet365Comparison(row) && row.impliedProbabilityGap != null
  );
  const topRow = liveBet365Rows[0] ?? null;
  const diagnosticRow =
    topRow ?? reviewBet365Rows[0] ?? externalOnlyRows[0] ?? null;
  const topSplit = diagnosticRow ? sourceSplitForRow(diagnosticRow) : undefined;
  const rankedRows = [
    ...liveBet365Rows,
    ...reviewBet365Rows,
    ...externalOnlyRows,
  ].slice(0, 15);
  const closedRows = closedGames.data?.data ?? [];
  const totalSourceMarkets = storageRows.reduce(
    (sum, row) => sum + row.sourceMarkets,
    0
  );
  const maxSourceTicks = Math.max(
    1,
    ...storageRows.map((row) => row.quoteTicks)
  );
  const readinessLabel = readiness.isLoading
    ? "loading"
    : readiness.isError
      ? "error"
      : (readiness.data?.status ?? "unknown");
  const primaryRefreshErrors = [
    {
      error: games.error,
      hasData: games.data != null,
      label: "Persisted game list",
    },
    {
      error: divergence.error,
      hasData: divergence.data != null,
      label: "Ranked divergence queue",
    },
  ].filter((entry) => entry.error && entry.hasData);
  const supportingErrorCount = [
    boardVolatility,
    marketAnomalies,
    pregameSignalQuality,
    liveFinalSignalQuality,
    closedGames,
    topLeadLag,
    signalMismatches,
    sourceHealth,
    captureRuns,
    storageCoverage,
    readiness,
  ].filter((query) => query.isError).length;

  return (
    <PageFrame>
      <div className="ops-console" aria-label="Trading research desk">
        <header className="ops-topline">
          <div className="ops-brand">
            <strong>bet365</strong>
            <span>desk</span>
            <em>signal ops</em>
          </div>
          <div className="ops-live-chip">
            <span>Backend online</span>
          </div>
          <div className="ops-session">
            <span>Generated</span>
            <strong>
              {formatTimestamp(
                divergence.data?.meta.generatedAt ??
                  marketAnomalies.data?.meta.generatedAt
              )}
            </strong>
          </div>
          <nav className="ops-tabs" aria-label="Desk sections">
            <a className="ops-tab" href="#market-weirdness">
              Volatility
            </a>
            <a className="ops-tab" href="#market-review">
              Review
            </a>
            <a className="ops-tab" href="#pressure-ranking">
              Ranking
            </a>
            <a className="ops-tab" href="#calibration">
              Calibration
            </a>
            <a className="ops-tab" href="#feed-health">
              Feeds
            </a>
            <a className="ops-tab" href="#closed-games">
              History
            </a>
          </nav>
        </header>

        <BoardAlertsBanner />
        <section
          className={`ops-thesis ops-volatility-${volatilityTone(
            topVolatility?.band
          )}`}
          aria-labelledby="desk-thesis-title"
        >
          <div className="ops-thesis-copy">
            <span>Game state</span>
            <div>
              <h1 id="desk-thesis-title">Volatility now</h1>
              <p>
                {topVolatility
                  ? `${topVolatility.gameLabel} · ${
                      topVolatilityScoreClock
                        ? `${topVolatilityScoreClock} · `
                        : ""
                    }${formatVolatilityBand(
                      topVolatility.band
                    )} · ${topVolatility.score}/100`
                  : boardVolatility.isLoading
                    ? "Measuring live prediction-market game state..."
                    : "No live prediction-market game-state sample."}
              </p>
            </div>
          </div>
          <div className="ops-thesis-metrics">
            <div>
              <span>{topVolatilityPeriodClock ? "Clock" : "Current"}</span>
              <strong
                className={`ops-volatility-number ops-${volatilityTone(
                  topVolatility?.band
                )}`}
              >
                {topVolatilityPeriodClock ??
                  (topVolatility ? topVolatility.score : "n/a")}
              </strong>
            </div>
            {topVolatilityPeriodClock ? (
              <div>
                <span>Vol</span>
                <strong
                  className={`ops-volatility-number ops-${volatilityTone(
                    topVolatility?.band
                  )}`}
                >
                  {topVolatility ? topVolatility.score : "n/a"}
                </strong>
              </div>
            ) : null}
            <div>
              <span>Normal</span>
              <strong>
                &lt;{topVolatility?.thresholds.elevatedMinScore ?? 40}
              </strong>
            </div>
            <div>
              <span>Elevated</span>
              <strong>
                {topVolatility?.thresholds.elevatedMinScore ?? 40}+
              </strong>
            </div>
            <div>
              <span>Alert</span>
              <strong>{topVolatility?.thresholds.alertMinScore ?? 55}+</strong>
            </div>
          </div>
        </section>

        {supportingErrorCount > 0 ? (
          <Panel className="desk-panel desk-warning ops-warning">
            {supportingErrorCount} supporting desk feed
            {supportingErrorCount === 1 ? "" : "s"} failed. The ranked queue is
            visible, but source health, history, or readiness may be incomplete.
          </Panel>
        ) : null}

        {primaryRefreshErrors.length > 0 ? (
          <Panel className="desk-panel desk-warning ops-warning">
            <strong>Showing last trusted persisted data.</strong>{" "}
            {primaryRefreshErrors
              .map(
                (entry) =>
                  `${entry.label}: ${formatDeskQueryError(entry.error)}`
              )
              .join(" · ")}
          </Panel>
        ) : null}

        {stateAttentionRows.length > 0 ? (
          <section className="ops-state-alert" aria-label="NBA state watch">
            <div>
              <span>NBA state watch</span>
              <strong>
                {stateAttentionRows.length} NBA state row
                {stateAttentionRows.length === 1 ? "" : "s"} need review
              </strong>
            </div>
            <div>
              {stateAttentionRows.map(({ game, state }) => (
                <Link
                  className={`ops-state-row ops-state-${state.tone}`}
                  key={game.game.id}
                  to={`/games/${game.game.id}`}
                >
                  <strong>{formatGameLabel(game)}</strong>
                  <span>{state.label}</span>
                  <em>{state.detail}</em>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {showAnomalyPopup && topAnomaly ? (
          <div
            aria-labelledby="prop-alert-popup-title"
            aria-modal="false"
            className={`prop-alert-popup prop-alert-${alertTone(topAnomaly)}`}
            role="alertdialog"
          >
            <div className="prop-alert-popup-icon">
              <AlertTriangle aria-hidden="true" size={20} />
            </div>
            <div>
              <span>Market anomaly</span>
              <h2 id="prop-alert-popup-title">{topAnomaly.displayLabel}</h2>
              <p>
                {topAnomaly.source} · score {topAnomaly.score} ·{" "}
                {topAnomaly.labels.slice(0, 2).join(", ")}
              </p>
              <div className="prop-alert-popup-actions">
                <Link
                  className="desk-link"
                  to={
                    topAnomaly.instrumentId
                      ? `/games/${topAnomaly.gameId}/markets/${topAnomaly.instrumentId}`
                      : "/market-anomalies"
                  }
                >
                  Review now
                </Link>
                <button
                  aria-label="Dismiss market anomaly"
                  className="icon-button"
                  onClick={() => setDismissedAnomalyAlertId(topAnomaly.id)}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="ops-grid">
          <Panel className="ops-panel ops-prop-risk" id="market-weirdness">
            <header className="ops-panel-head">
              <span className="ops-panel-index">0</span>
              <div>
                <span>Prediction-market weirdness</span>
                <h2>
                  {topVolatility
                    ? `${formatVolatilityBand(topVolatility.band)} · ${topVolatility.score}/100`
                    : "No live score"}
                </h2>
              </div>
              <p>
                Whole-game volatility plus the specific prop and market noise
                underneath it.
              </p>
            </header>
            {boardVolatility.isLoading ? (
              <p className="desk-note">Measuring game-state volatility...</p>
            ) : boardVolatility.isError ? (
              <p className="desk-note">Game-state volatility failed to load.</p>
            ) : !topVolatility ? (
              <div className="prop-risk-empty">
                <strong>No live prediction-market sample.</strong>
              </div>
            ) : (
              <div className="ops-volatility-body">
                <div
                  className={`ops-volatility-score ops-volatility-${volatilityTone(
                    topVolatility.band
                  )}`}
                >
                  <span>
                    {topVolatility.gameLabel}
                    {topVolatilityScoreClock
                      ? ` · ${topVolatilityScoreClock}`
                      : ""}
                  </span>
                  <strong>{topVolatility.score}</strong>
                  <em>{formatVolatilityBand(topVolatility.band)}</em>
                </div>
                <div className="ops-volatility-thresholds">
                  <span>
                    normal &lt;{topVolatility.thresholds.elevatedMinScore}
                  </span>
                  <span>
                    elevated {topVolatility.thresholds.elevatedMinScore}+
                  </span>
                  <span>alert {topVolatility.thresholds.alertMinScore}+</span>
                  <span>
                    {topVolatility.sample.sourceMarketCount} markets ·{" "}
                    {topVolatility.sample.families.join(", ") || "no families"}
                  </span>
                </div>
                {volatilityEvidence.length > 0 ? (
                  <div className="ops-volatility-evidence">
                    {volatilityEvidence.map((row) => (
                      <span key={row.observationId}>
                        {row.displayLabel} · {row.reason}
                      </span>
                    ))}
                  </div>
                ) : null}
                {topVolatility.alertId ? (
                  <Link
                    className="desk-link ops-wide-link"
                    to={`/board-alerts/${encodeURIComponent(
                      topVolatility.gameId
                    )}?at=${encodeURIComponent(
                      topVolatilityAnchorAt ?? topVolatility.measuredAt
                    )}&label=${encodeURIComponent(topVolatility.gameLabel)}&alertId=${encodeURIComponent(topVolatility.alertId)}`}
                  >
                    Inspect board
                  </Link>
                ) : null}
              </div>
            )}
            {marketAnomalies.isLoading ? (
              <p className="desk-note">Listening for market anomalies...</p>
            ) : marketAnomalies.isError ? (
              <p className="desk-note">
                Prediction-market anomaly feed failed to load.
              </p>
            ) : anomalyRows.length === 0 ? (
              <div className="prop-risk-empty">
                <strong>No current market weirdness above threshold.</strong>
                <span>
                  The desk stays quiet until persisted market data crosses the
                  active anomaly score.
                </span>
              </div>
            ) : (
              <div className="prop-risk-list">
                {anomalyRows.slice(0, 5).map((alert) => (
                  <Link
                    className={`prop-risk-row prop-risk-${alertTone(alert)}`}
                    key={alert.id}
                    to={
                      alert.instrumentId
                        ? `/games/${alert.gameId}/markets/${alert.instrumentId}`
                        : "/market-anomalies"
                    }
                  >
                    <div>
                      <strong>{alert.displayLabel}</strong>
                      <span>
                        {alert.gameLabel} · {alert.source} · {alert.apiSurface}
                      </span>
                    </div>
                    <div className="prop-risk-prices">
                      <em>price {formatProbability(alert.metrics.price)}</em>
                      <em>
                        trade {formatProbability(alert.metrics.tradePrice)}
                      </em>
                      <strong>score {alert.score}</strong>
                    </div>
                    <div className="prop-risk-meta">
                      <span>{alert.labels.slice(0, 2).join(", ")}</span>
                      <span>conf {(alert.confidence * 100).toFixed(0)}%</span>
                      <span>{formatTimestamp(alert.eventTimestamp)}</span>
                    </div>
                    {alert.instrumentId ? (
                      <InstrumentTrace
                        gameId={alert.gameId}
                        instrumentId={alert.instrumentId}
                      />
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="ops-panel ops-read-first" id="market-review">
            <header className="ops-panel-head">
              <span className="ops-panel-index">1</span>
              <div>
                <span>Prop support</span>
                <h2>
                  {topRow?.displayLabel ??
                    (diagnosticRow
                      ? `${reviewBet365Rows[0] ? "Past comparison" : "Review"}: ${
                          diagnosticRow.displayLabel
                        }`
                      : "No ranked signal yet")}
                </h2>
              </div>
            </header>
            {diagnosticRow ? (
              <>
                <div
                  className={`ops-alert-card ops-alert-${
                    topRow ? rowTone(topRow) : "warm"
                  }`}
                >
                  <span>
                    {topRow
                      ? `${topRow.severity} pressure`
                      : reviewBet365Rows[0]
                        ? "past Bet365-vs-exchange comparison"
                        : "not Bet365-vs-exchange"}
                  </span>
                  <strong>
                    {formatGapPoints(diagnosticRow.impliedProbabilityGap)}
                  </strong>
                  <p>
                    {diagnosticRow.family} ·{" "}
                    {formatMarketMatchLabel(diagnosticRow.comparableState)} ·
                    priority {diagnosticRow.signalPriority}
                  </p>
                </div>
                <div className="ops-source-split">
                  <span>Source split</span>
                  {topSplit ? (
                    <div>
                      <em>b365 {formatProbability(topSplit.bet365)}</em>
                      <em>kalshi {formatProbability(topSplit.kalshi)}</em>
                      <em>
                        polymarket {formatProbability(topSplit.polymarket)}
                      </em>
                    </div>
                  ) : (
                    <p>
                      No same-time Bet365-vs-exchange split is persisted for
                      this instrument.
                    </p>
                  )}
                </div>
                <InstrumentTrace
                  fallbackSummary={diagnosticRow.comparisonSummary}
                  gameId={diagnosticRow.gameId}
                  instrumentId={diagnosticRow.instrumentId}
                />
                <Link
                  className="desk-link ops-wide-link"
                  to={`/games/${diagnosticRow.gameId}/markets/${diagnosticRow.instrumentId}`}
                >
                  Open market
                </Link>
              </>
            ) : (
              <p className="desk-note">
                Capture has not produced enough comparable market data for a
                ranked queue.
              </p>
            )}
          </Panel>

          <Panel className="ops-panel ops-ranking" id="pressure-ranking">
            <header className="ops-panel-head">
              <span className="ops-panel-index">2</span>
              <div>
                <span>Pressure ranking</span>
                <h2>Bet365 vs exchange props</h2>
              </div>
            </header>
            <div className="table-shell ops-table-shell">
              <table className="desk-table ops-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Instrument</th>
                    <th>Market</th>
                    <th>State</th>
                    <th>Divergence</th>
                    <th>Quote age</th>
                    <th>Split</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>No ranked divergence rows yet.</td>
                    </tr>
                  ) : (
                    rankedRows.map((row, index) => {
                      const split = sourceSplitForRow(row);
                      return (
                        <tr
                          className={`desk-signal-row signal-${rowTone(row)}`}
                          key={`${row.gameId}:${row.instrumentId}`}
                        >
                          <td className="ops-rank-cell">
                            <strong>{index + 1}</strong>
                            <span>{row.signalPriority}</span>
                          </td>
                          <td>
                            <strong>{row.displayLabel}</strong>
                            <span>{row.gameId}</span>
                          </td>
                          <td>{row.family}</td>
                          <td>
                            <span
                              className={`status-text status-${rowTone(row)}`}
                            >
                              {marketTimingLabel(row)}
                            </span>
                          </td>
                          <td className="desk-number">
                            {formatGapPoints(row.impliedProbabilityGap)}
                          </td>
                          <td>
                            <span
                              className={`status-text status-${freshnessTone(
                                row
                              )}`}
                            >
                              {formatAge(row.captureRecencyMs)}
                            </span>
                          </td>
                          <td className="desk-split-cell ops-split-cell">
                            {split ? (
                              <>
                                <span>
                                  b365 {formatProbability(split.bet365)}
                                </span>
                                <span>
                                  kal {formatProbability(split.kalshi)}
                                </span>
                                <span>
                                  poly {formatProbability(split.polymarket)}
                                </span>
                              </>
                            ) : (
                              <span>no same-time split</span>
                            )}
                          </td>
                          <td>
                            <Link
                              className="desk-link"
                              to={`/games/${row.gameId}/markets/${row.instrumentId}`}
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel className="ops-panel ops-calibration" id="calibration">
            <header className="ops-panel-head">
              <span className="ops-panel-index">3</span>
              <div>
                <span>Calibration leaderboard</span>
                <h2>Closed-game source error</h2>
              </div>
            </header>
            <div className="table-shell ops-table-shell ops-table-short">
              <table className="desk-table compact ops-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Brier</th>
                    <th>Log loss</th>
                    <th>Win acc</th>
                    <th>Through final</th>
                    <th>N</th>
                  </tr>
                </thead>
                <tbody>
                  {!deskReviewAnalyticsEnabled ? (
                    <tr>
                      <td colSpan={6}>
                        Open Research for closed-game calibration.
                      </td>
                    </tr>
                  ) : pregameSignalQuality.isLoading ? (
                    <tr>
                      <td colSpan={6}>Loading closed-game quality rows...</td>
                    </tr>
                  ) : pregameQualityRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No closed-game quality rows yet.</td>
                    </tr>
                  ) : (
                    pregameQualityRows.map((row) => {
                      const liveFinal = liveFinalBySource.get(row.source);
                      return (
                        <tr key={row.source}>
                          <td>
                            <strong>{row.source}</strong>
                          </td>
                          <td className="desk-number">
                            {formatDecimal(row.brier, 4)}
                          </td>
                          <td>{formatDecimal(row.logLoss, 4)}</td>
                          <td>
                            {formatProbability(row.closingWinnerAccuracy)}
                          </td>
                          <td>{formatDecimal(liveFinal?.brier, 4)}</td>
                          <td>{formatCount(row.sampleCount)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {topCandidate && (topLeadLag.isLoading || trustedLeadLagPair) ? (
            <Panel className="ops-panel ops-leadlag">
              <header className="ops-panel-head">
                <span className="ops-panel-index">4</span>
                <div>
                  <span>Source timing</span>
                  <h2>Lead / lag only if dependable</h2>
                </div>
              </header>
              <div className="ops-leadlag-body">
                <div className="ops-instrument-line">
                  <span>Market</span>
                  <strong>{topCandidate.displayLabel}</strong>
                </div>
                {topLeadLag.isLoading ? (
                  <p className="desk-note">
                    Loading one-minute source timing...
                  </p>
                ) : trustedLeadLagPair ? (
                  <div className="ops-leadlag-metrics">
                    <div>
                      <span>Lead source</span>
                      <strong className="ops-yellow">
                        {trustedLeadLagPair.leadSource}
                      </strong>
                    </div>
                    <div>
                      <span>Lag source</span>
                      <strong className="ops-red">
                        {trustedLeadLagPair.lagSource}
                      </strong>
                    </div>
                    <div>
                      <span>Delay</span>
                      <strong>
                        {formatDuration(
                          trustedLeadLagPair.bestLagBuckets *
                            (topLeadLag.data?.data.bucketSeconds ?? 60) *
                            1000
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>Correlation</span>
                      <strong>
                        {formatDecimal(trustedLeadLagPair.bestCorrelation, 3)}
                      </strong>
                    </div>
                    <div>
                      <span>Sample depth</span>
                      <strong>
                        {formatCount(trustedLeadLagPair.sampleCount)}
                      </strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel className="ops-panel ops-feed" id="feed-health">
            <header className="ops-panel-head">
              <span className="ops-panel-index">5</span>
              <div>
                <span>Feed health / history</span>
                <h2>Persisted source depth</h2>
              </div>
            </header>
            <div className="ops-source-bars" aria-label="Persisted quote ticks">
              {storageCoverage.fetchStatus === "idle" &&
              storageCoverage.data == null ? (
                <p className="desk-note">Source history scan deferred.</p>
              ) : storageCoverage.isLoading ? (
                <p className="desk-note">Loading persisted source history...</p>
              ) : storageCoverage.isError ? (
                <p className="desk-note">
                  Persisted source history failed to load.
                </p>
              ) : storageRows.length === 0 ? (
                <p className="desk-note">No persisted source history yet.</p>
              ) : (
                storageRows.slice(0, 5).map((row) => {
                  const health = sourceMap.get(row.source);
                  const latestRun = row.latestRun;
                  const status = latestRun?.status ?? health?.status;
                  return (
                    <div className="ops-source-row" key={row.source}>
                      <div>
                        <strong>{row.source}</strong>
                        <span>
                          {formatCount(row.quoteTicks)} ticks ·{" "}
                          {formatCount(row.sourceMarkets)} markets ·{" "}
                          {formatCount(row.gameCount)} games
                        </span>
                      </div>
                      <div className="ops-bar-track">
                        <span
                          style={{
                            width: `${Math.max(
                              5,
                              (row.quoteTicks / maxSourceTicks) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <em
                        className={`status-text status-${sourceStatusTone(
                          status
                        )}`}
                      >
                        {status ?? "unknown"}
                      </em>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel className="ops-panel ops-closed" id="closed-games">
            <header className="ops-panel-head">
              <span className="ops-panel-index">6</span>
              <div>
                <span>Finished games</span>
                <h2>Most recent moneyline calls by source</h2>
              </div>
            </header>
            <div className="ops-closed-grid">
              {closedRows.slice(0, 6).map((game) => {
                const instrument = findWinnerInstrument(game);
                return (
                  <Link
                    className="ops-closed-card"
                    key={game.gameId}
                    to={
                      instrument
                        ? `/games/${game.gameId}/markets/${instrument.instrumentId}`
                        : `/games/${game.gameId}`
                    }
                  >
                    <span>{game.matchup}</span>
                    <strong>
                      {game.finalAwayScore ?? "-"}-{game.finalHomeScore ?? "-"}
                    </strong>
                    <div className="closed-call-tags">
                      {instrument?.sources.map((source) => (
                        <em
                          className={`source-call-pill source-call-${callTone(
                            source.impliedProbability,
                            instrument.outcome.winnerProbability
                          )}`}
                          key={`${game.gameId}:${source.source}`}
                        >
                          {formatSourceLabel(source.source)}{" "}
                          {formatProbability(source.impliedProbability)}
                        </em>
                      ))}
                    </div>
                  </Link>
                );
              })}
              {!deskReviewAnalyticsEnabled ? (
                <p className="desk-note">
                  Open History for finished-game review.
                </p>
              ) : closedGames.isLoading ? (
                <p className="desk-note">Loading closed-game grading...</p>
              ) : null}
              {deskReviewAnalyticsEnabled &&
              !closedGames.isLoading &&
              closedRows.length === 0 ? (
                <p className="desk-note">
                  No closed moneyline outcomes graded yet.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel className="ops-panel ops-map">
            <header className="ops-panel-head">
              <span className="ops-panel-index">7</span>
              <div>
                <span>Game pressure map</span>
                <h2>Games with signal</h2>
              </div>
            </header>
            <div className="table-shell ops-table-shell ops-table-short">
              <table className="desk-table compact ops-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>State</th>
                    <th>Coverage</th>
                    <th>Top pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {pressureRows.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No signal game boards.</td>
                    </tr>
                  ) : (
                    pressureRows.map((game) => {
                      const top = game.topDivergences[0];
                      const marketSources = getMarketSources(game);
                      const hasNba = hasNbaStateSource(
                        game.coverage.availableSources
                      );
                      const stateReadout = getGameOperationalState(game);
                      return (
                        <tr key={game.game.id}>
                          <td>
                            <strong>{formatGameLabel(game)}</strong>
                            <span>{game.game.id}</span>
                          </td>
                          <td>
                            <span
                              className={`state-label state-label-${stateReadout.tone}`}
                            >
                              {stateReadout.label}
                            </span>
                            <span>{formatGameScoreClock(game)}</span>
                          </td>
                          <td>
                            <span>
                              market feeds{" "}
                              {marketSources.length > 0
                                ? formatMarketSourceList(marketSources)
                                : "mapping work only"}
                            </span>
                            <span>
                              NBA state {hasNba ? "available" : "missing"}
                            </span>
                          </td>
                          <td>
                            {top ? (
                              <Link
                                className="desk-link"
                                to={`/games/${game.game.id}/markets/${top.instrumentId}`}
                              >
                                {top.displayLabel}
                              </Link>
                            ) : (
                              "no ranked market"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <footer className="ops-footer">
          <span>Market: NBA</span>
          <span>Total games: {formatCount(gameRows.length)}</span>
          <span>NBA live games: {formatCount(liveTrackedRows)}</span>
          <span>
            Market work: {formatCount(gameTriage.actionableRows.length)}
          </span>
          <span>Signal boards: {formatCount(pressureRows.length)}</span>
          <span>Suppressed rows: {formatCount(gameTriage.suppressedRows)}</span>
          <span>Unmapped games: {formatCount(unmappedCoverageRows)}</span>
          <span>Line mismatches: {formatCount(lineMismatchRows)}</span>
          <span>Source markets: {formatCount(totalSourceMarkets)}</span>
          <span>Readiness: {readinessLabel}</span>
        </footer>
      </div>
    </PageFrame>
  );
}
