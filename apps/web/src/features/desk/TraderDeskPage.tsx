import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Panel, SectionTitle } from "../../components/Primitives";
import {
  getAdminCaptureRuns,
  getAdminSources,
  getAdminStorageCoverage,
  getClosedGames,
  getDivergence,
  getGames,
  getInstrumentLeadLag,
  getReadyHealth,
  getSignalQualityReport,
  getSignalMismatches,
  type AdminCaptureRunsPayload,
  type AdminSourcesPayload,
  type AdminStorageCoveragePayload,
  type ClosedGamesPayload,
  type DivergencePayload,
  type GamesPayload,
  type SignalMismatchesPayload,
} from "../../data/api";
import { buildGameTriage, getMarketSources } from "../../lib/game-triage";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";

type DivergenceRow = DivergencePayload["data"][number];
type GameRow = GamesPayload["data"][number];
type SignalMismatchRow = SignalMismatchesPayload["data"][number];
type SourceHealthRow = AdminSourcesPayload["data"][number];
type CaptureRunRow = AdminCaptureRunsPayload["data"][number];
type StorageCoverageRow = AdminStorageCoveragePayload["data"][number];
type ClosedGameSummary = ClosedGamesPayload["data"][number];

const ACTIONABLE_BET365_RECENCY_MS = 15 * 60_000;

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
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").replace("Z", "");
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

function scoreLine(game: GameRow) {
  if (!game.gameState) {
    return "no NBA state";
  }

  const period = game.gameState.period ? ` P${game.gameState.period}` : "";
  const clock = game.gameState.clock ? ` ${game.gameState.clock}` : "";
  return `${game.gameState.awayScore ?? "-"}-${game.gameState.homeScore ?? "-"} ${game.gameState.status}${period}${clock}`;
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

function mismatchKey(row: { gameId: string; instrumentId: string }) {
  return `${row.gameId}:${row.instrumentId}`;
}

function buildMismatchIndex(rows: SignalMismatchRow[]) {
  return new Map(rows.map((row) => [mismatchKey(row), row]));
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

export function TraderDeskPage() {
  const games = useQuery({
    queryKey: ["games"],
    queryFn: getGames,
  });
  const divergence = useQuery({
    queryKey: ["divergence", { sort: "signalPriority" }],
    queryFn: () => getDivergence({ sort: "signalPriority" }),
  });
  const topCandidate = divergence.data?.data[0];
  const pregameSignalQuality = useQuery({
    queryKey: ["research", "signal-quality", "pregame"],
    queryFn: () => getSignalQualityReport({ closingCutoff: "pregame" }),
  });
  const liveFinalSignalQuality = useQuery({
    queryKey: ["research", "signal-quality", "live-final"],
    queryFn: () => getSignalQualityReport({ closingCutoff: "live-final" }),
  });
  const closedGames = useQuery({
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
    queryKey: ["research-signal-mismatches"],
    queryFn: getSignalMismatches,
  });
  const sourceHealth = useQuery({
    queryKey: ["admin-sources"],
    queryFn: getAdminSources,
  });
  const captureRuns = useQuery({
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const readiness = useQuery({
    queryKey: ["health-ready"],
    queryFn: getReadyHealth,
  });

  if (
    games.isLoading ||
    divergence.isLoading ||
    (!games.data && !games.isError) ||
    (!divergence.data && !divergence.isError)
  ) {
    return <LoadingState message="Building trader desk..." />;
  }

  if (games.isError || divergence.isError || !games.data || !divergence.data) {
    return (
      <PageFrame
        aside={
          <Panel className="desk-panel">
            <SectionTitle
              eyebrow="Desk unavailable"
              title="Primary work queue failed"
            />
          </Panel>
        }
      >
        <ErrorState
          description="The trader desk needs the persisted game list and ranked divergence queue before it can be trusted."
          error={games.error ?? divergence.error}
          onAction={() => {
            void games.refetch();
            void divergence.refetch();
          }}
          title="Trader desk failed to load"
        />
      </PageFrame>
    );
  }

  const rows = divergence.data.data;
  const gameRows = games.data.data;
  const gameTriage = buildGameTriage(gameRows);
  const pressureRows = gameTriage.actionableRows.slice(0, 10);
  const mismatchRows = signalMismatches.data?.data ?? [];
  const mismatchIndex = buildMismatchIndex(mismatchRows);
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
  const liveTrackedRows = gameRows.filter((row) => {
    const status = row.gameState?.status.toLowerCase() ?? "";
    return status.includes("in-play") || status === "live";
  }).length;
  const quoteTicksPersisted =
    storageCoverage.data?.data.reduce(
      (sum, row) => sum + row.quoteTickCount,
      0
    ) ?? 0;
  const lineMismatchRows = rows.filter((row) => row.lineMismatch).length;
  const unmappedCoverageRows = gameRows.filter(
    (row) =>
      row.hasUnmappedMarkets || row.coverage.unmappedSourceMarketCount > 0
  ).length;
  const bet365BackedRows = rows.filter(
    (row) =>
      mismatchIndex.get(mismatchKey(row))?.bet365ImpliedProbability != null
  );
  const freshBet365Rows = bet365BackedRows.filter(
    (row) =>
      row.captureRecencyMs != null &&
      row.captureRecencyMs <= ACTIONABLE_BET365_RECENCY_MS
  );
  const staleBet365Rows = bet365BackedRows.filter(
    (row) =>
      row.captureRecencyMs == null ||
      row.captureRecencyMs > ACTIONABLE_BET365_RECENCY_MS
  );
  const externalOnlyRows = rows.filter(
    (row) =>
      mismatchIndex.get(mismatchKey(row))?.bet365ImpliedProbability == null
  );
  const topRow = freshBet365Rows[0] ?? null;
  const diagnosticRow =
    topRow ?? staleBet365Rows[0] ?? externalOnlyRows[0] ?? rows[0] ?? null;
  const topMismatch = diagnosticRow
    ? mismatchIndex.get(mismatchKey(diagnosticRow))
    : undefined;
  const rankedRows = [
    ...freshBet365Rows,
    ...staleBet365Rows,
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
  const supportingErrorCount = [
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
            <span>Live</span>
          </div>
          <div className="ops-session">
            <span>Generated</span>
            <strong>{formatTimestamp(divergence.data.meta.generatedAt)}</strong>
          </div>
          <nav className="ops-tabs" aria-label="Desk sections">
            <a className="ops-tab ops-tab-active" href="#pressure-ranking">
              Dashboard
            </a>
            <a className="ops-tab" href="#pressure-ranking">
              Markets
            </a>
            <a className="ops-tab" href="#calibration">
              Calibration
            </a>
            <a className="ops-tab" href="#feed-health">
              Feeds
            </a>
            <a className="ops-tab" href="#closed-tape">
              History
            </a>
          </nav>
        </header>

        <section className="ops-thesis" aria-labelledby="desk-thesis-title">
          <div className="ops-thesis-copy">
            <span>Today&apos;s thesis:</span>
            <div>
              <h1 id="desk-thesis-title">What the markets actually knew.</h1>
              <p>
                {topRow
                  ? `${topRow.displayLabel} is the Bet365-backed read-first instrument: ${formatProbability(
                      topRow.impliedProbabilityGap
                    )} cross-source gap, priority ${topRow.signalPriority}, ${formatAge(
                      topRow.captureRecencyMs
                    )} quote age.`
                  : staleBet365Rows[0]
                    ? `No fresh Bet365-backed trading signal is populated. Closest stale Bet365 diagnostic is ${staleBet365Rows[0].displayLabel}: ${formatProbability(
                        staleBet365Rows[0].impliedProbabilityGap
                      )} gap, priority ${staleBet365Rows[0].signalPriority}, ${formatAge(
                        staleBet365Rows[0].captureRecencyMs
                      )} quote age.`
                    : diagnosticRow
                      ? `No Bet365-backed trading signal is populated. Highest external-only diagnostic is ${diagnosticRow.displayLabel}: ${formatProbability(
                          diagnosticRow.impliedProbabilityGap
                        )} gap, priority ${diagnosticRow.signalPriority}, ${formatAge(
                          diagnosticRow.captureRecencyMs
                        )} quote age.`
                      : "No ranked market pressure is persisted yet; the desk stays quiet instead of inventing a slate."}
              </p>
            </div>
          </div>
          <div className="ops-thesis-metrics">
            <div>
              <span>Ranked queue</span>
              <strong>{formatCount(rows.length)}</strong>
            </div>
            <div>
              <span>Fresh B365</span>
              <strong
                className={freshBet365Rows.length > 0 ? "ops-green" : "ops-red"}
              >
                {formatCount(freshBet365Rows.length)}
              </strong>
            </div>
            <div>
              <span>Stale B365</span>
              <strong className="ops-yellow">
                {formatCount(staleBet365Rows.length)}
              </strong>
            </div>
            <div>
              <span>Ticks</span>
              <strong>{formatCount(quoteTicksPersisted)}</strong>
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

        <div className="ops-grid">
          <Panel className="ops-panel ops-read-first">
            <header className="ops-panel-head">
              <span className="ops-panel-index">1</span>
              <div>
                <span>Read first</span>
                <h2>
                  {topRow?.displayLabel ??
                    (diagnosticRow
                      ? `${staleBet365Rows[0] ? "Stale diagnostics" : "Diagnostics only"}: ${
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
                      : staleBet365Rows[0]
                        ? "stale Bet365 signal"
                        : "not Bet365-backed"}
                  </span>
                  <strong>
                    {formatProbability(diagnosticRow.impliedProbabilityGap)}
                  </strong>
                  <p>
                    {diagnosticRow.family} · {diagnosticRow.comparableState} ·
                    priority {diagnosticRow.signalPriority}
                  </p>
                </div>
                <div className="ops-source-split">
                  <span>Source split</span>
                  {topMismatch ? (
                    <div>
                      <em>
                        b365{" "}
                        {formatProbability(
                          topMismatch.bet365ImpliedProbability
                        )}
                      </em>
                      <em>
                        kalshi{" "}
                        {formatProbability(
                          topMismatch.kalshiImpliedProbability
                        )}
                      </em>
                      <em>
                        polymarket{" "}
                        {formatProbability(
                          topMismatch.polymarketImpliedProbability
                        )}
                      </em>
                    </div>
                  ) : (
                    <p>No persisted split row for this instrument.</p>
                  )}
                </div>
                <Link
                  className="desk-link ops-wide-link"
                  to={`/games/${diagnosticRow.gameId}/markets/${diagnosticRow.instrumentId}`}
                >
                  {topRow
                    ? "Open instrument workspace"
                    : "Open diagnostic instrument"}
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
                <span>Pressure ranking (live & pregame)</span>
                <h2>Highest ranked disagreement right now.</h2>
              </div>
              <p>
                Sorted by persisted divergence priority. Gap is probability
                spread, not a manufactured bps score.
              </p>
            </header>
            <div className="table-shell ops-table-shell">
              <table className="desk-table ops-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Instrument</th>
                    <th>Market</th>
                    <th>State</th>
                    <th>Gap</th>
                    <th>Fresh</th>
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
                      const mismatch = mismatchIndex.get(mismatchKey(row));
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
                              {row.inPlay ? "live" : row.comparableState}
                            </span>
                          </td>
                          <td className="desk-number">
                            {formatProbability(row.impliedProbabilityGap)}
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
                            {mismatch ? (
                              <>
                                <span>
                                  b365{" "}
                                  {formatProbability(
                                    mismatch.bet365ImpliedProbability
                                  )}
                                </span>
                                <span>
                                  kal{" "}
                                  {formatProbability(
                                    mismatch.kalshiImpliedProbability
                                  )}
                                </span>
                                <span>
                                  poly{" "}
                                  {formatProbability(
                                    mismatch.polymarketImpliedProbability
                                  )}
                                </span>
                              </>
                            ) : (
                              <span>no split row</span>
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
                <h2>How predictive each source was at close.</h2>
              </div>
            </header>
            <p className="ops-panel-note">
              Brier and log-loss use persisted closed-game moneyline outcomes.
              Pregame uses the last tick before tip.
            </p>
            <div className="table-shell ops-table-shell ops-table-short">
              <table className="desk-table compact ops-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Brier</th>
                    <th>Log loss</th>
                    <th>Win acc</th>
                    <th>Live-final</th>
                    <th>N</th>
                  </tr>
                </thead>
                <tbody>
                  {pregameSignalQuality.isLoading ? (
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

          <Panel className="ops-panel ops-leadlag">
            <header className="ops-panel-head">
              <span className="ops-panel-index">4</span>
              <div>
                <span>Lead / lag readout</span>
                <h2>
                  Which venue is moving first on the top-ranked instrument.
                </h2>
              </div>
            </header>
            {topRow ? (
              <div className="ops-leadlag-body">
                <div className="ops-instrument-line">
                  <span>Instrument</span>
                  <strong>{topRow.displayLabel}</strong>
                </div>
                {topLeadLag.isLoading ? (
                  <p className="desk-note">
                    Loading one-minute lead/lag trace...
                  </p>
                ) : topLeadLagPair ? (
                  <div className="ops-leadlag-metrics">
                    <div>
                      <span>Lead source</span>
                      <strong className="ops-yellow">
                        {topLeadLagPair.leadSource}
                      </strong>
                    </div>
                    <div>
                      <span>Lag source</span>
                      <strong className="ops-red">
                        {topLeadLagPair.lagSource}
                      </strong>
                    </div>
                    <div>
                      <span>Lag buckets</span>
                      <strong>{topLeadLagPair.bestLagBuckets}</strong>
                    </div>
                    <div>
                      <span>Correlation</span>
                      <strong>
                        {formatDecimal(topLeadLagPair.bestCorrelation, 3)}
                      </strong>
                    </div>
                    <div>
                      <span>Sample depth</span>
                      <strong>{formatCount(topLeadLagPair.sampleCount)}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="desk-note">
                    Insufficient overlapping quote buckets for a trusted
                    lead/lag readout.
                  </p>
                )}
              </div>
            ) : (
              <p className="desk-note">No ranked instrument selected yet.</p>
            )}
          </Panel>

          <Panel className="ops-panel ops-feed" id="feed-health">
            <header className="ops-panel-head">
              <span className="ops-panel-index">5</span>
              <div>
                <span>Feed health / history</span>
                <h2>Persisted source depth</h2>
              </div>
            </header>
            <div className="ops-source-bars" aria-label="Persisted quote ticks">
              {storageCoverage.isLoading ? (
                <p className="desk-note">Loading persisted source tape...</p>
              ) : storageCoverage.isError ? (
                <p className="desk-note">
                  Persisted source tape failed to load.
                </p>
              ) : storageRows.length === 0 ? (
                <p className="desk-note">No persisted source tape yet.</p>
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

          <Panel className="ops-panel ops-closed" id="closed-tape">
            <header className="ops-panel-head">
              <span className="ops-panel-index">6</span>
              <div>
                <span>Closed game tape</span>
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
              {closedGames.isLoading ? (
                <p className="desk-note">Loading closed-game grading...</p>
              ) : null}
              {!closedGames.isLoading && closedRows.length === 0 ? (
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
                <span>Live game pressure map</span>
                <h2>Actionable boards only</h2>
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
                      <td colSpan={4}>
                        No actionable game boards visible. State-only backfill
                        rows are collapsed instead of repeated.
                      </td>
                    </tr>
                  ) : (
                    pressureRows.map((game) => {
                      const top = game.topDivergences[0];
                      const marketSources = getMarketSources(game);
                      const hasNba = hasNbaStateSource(
                        game.coverage.availableSources
                      );
                      return (
                        <tr key={game.game.id}>
                          <td>
                            <strong>{formatGameLabel(game)}</strong>
                            <span>{game.game.id}</span>
                          </td>
                          <td>{scoreLine(game)}</td>
                          <td>
                            {marketSources.length > 0
                              ? formatMarketSourceList(marketSources)
                              : "mapping work only"}
                            {hasNba ? " + NBA" : ""}
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

          <Panel className="ops-panel ops-attention">
            <header className="ops-panel-head">
              <span className="ops-panel-index">8</span>
              <div>
                <span>Attention pressure index</span>
                <h2>Pending user telemetry</h2>
              </div>
            </header>
            <div className="ops-pending-box">
              <strong>Pending data contract</strong>
              <p>
                Reserved for per-market user-event aggregates. This panel stays
                intentionally empty until clickstream/watchlist/bet-intent feeds
                are persisted.
              </p>
              <code>
                action_rate_z + focus_entropy_drop + edit_loop_z - price_move_z
              </code>
            </div>
          </Panel>
        </div>

        <footer className="ops-footer">
          <span>Market: NBA</span>
          <span>Total games: {formatCount(gameRows.length)}</span>
          <span>Live games: {formatCount(liveTrackedRows)}</span>
          <span>
            Actionable: {formatCount(gameTriage.actionableRows.length)}
          </span>
          <span>
            Suppressed placeholder/state/no-market:{" "}
            {formatCount(gameTriage.suppressedRows)}
          </span>
          <span>Unmapped games: {formatCount(unmappedCoverageRows)}</span>
          <span>Line mismatches: {formatCount(lineMismatchRows)}</span>
          <span>Source markets: {formatCount(totalSourceMarkets)}</span>
          <span>Readiness: {readinessLabel}</span>
        </footer>
      </div>
    </PageFrame>
  );
}
