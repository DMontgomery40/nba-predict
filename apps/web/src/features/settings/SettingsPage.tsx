import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import {
  getAdminCaptureRuns,
  getAdminRuntimeConfig,
  getAdminStorageCoverage,
  getAdminSources,
  getAdminUnmappedMarkets,
  getLiveHealth,
  getMarketAnomalyScoreConfig,
  getReadyHealth,
  getResearchCoverage,
  getSignalMismatches,
  putMarketAnomalyScoreConfig,
  postBackfillGames,
  postBackfillMarkets,
  postCaptureRestart,
  postResolveMapping,
  postTimelineMaterializationRebuild,
  type MarketAnomalyScoreConfig,
  type QueuedAdminActionPayload,
} from "../../data/api";
import {
  formatGapPoints,
  formatProbabilityPercent,
} from "../../lib/market-format";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";
import { formatOperatorDateTime } from "../../lib/time-format";

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatTimestamp(value?: string | null) {
  return formatOperatorDateTime(value);
}

function formatMinutes(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value / 60_000).toFixed(1)} min`;
}

function statusClass(status: string) {
  if (status === "ok" || status === "configured" || status === "ready") {
    return "status-cool";
  }
  if (
    status === "manual" ||
    status === "queued" ||
    status === "checking" ||
    status === "pending"
  ) {
    return "status-warm";
  }
  return "status-danger";
}

function cloneScoreConfig(config?: MarketAnomalyScoreConfig) {
  if (!config) {
    return null;
  }
  return {
    ...config,
    thresholds: { ...config.thresholds },
    toggles: { ...config.toggles },
    weights: { ...config.weights },
  };
}

type QueuedActionNotice = {
  detail: string;
  id: number;
  title: string;
};

function buildQueuedActionNotice(
  payload: QueuedAdminActionPayload["data"],
  title: string
) {
  return {
    detail: `${payload.actionType} queued at ${formatTimestamp(payload.requestedAt)}; status ${payload.status}`,
    id: payload.id,
    title,
  } satisfies QueuedActionNotice;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [queuedActions, setQueuedActions] = useState<QueuedActionNotice[]>([]);
  const [restartSource, setRestartSource] = useState("");
  const [gameBackfillForm, setGameBackfillForm] = useState({
    dateFrom: todayDateValue(),
    dateTo: todayDateValue(),
    league: "NBA",
    sport: "basketball",
  });
  const [marketBackfillForm, setMarketBackfillForm] = useState({
    dateFrom: "",
    dateTo: "",
    gameId: "",
    source: "",
  });
  const [mappingDrafts, setMappingDrafts] = useState<
    Record<
      string,
      {
        instrumentId: string;
        reason: string;
      }
    >
  >({});
  const [scoreConfigDraft, setScoreConfigDraft] =
    useState<MarketAnomalyScoreConfig | null>(null);

  const sources = useQuery({
    queryKey: ["admin-sources"],
    queryFn: getAdminSources,
  });
  const runtimeConfig = useQuery({
    queryKey: ["admin-runtime-config"],
    queryFn: getAdminRuntimeConfig,
  });
  const marketAnomalyScoreConfig = useQuery({
    queryKey: ["market-anomaly-score-config", "settings"],
    queryFn: getMarketAnomalyScoreConfig,
  });
  const captureRuns = useQuery({
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const unmappedMarkets = useQuery({
    queryKey: ["admin-unmapped-markets"],
    queryFn: getAdminUnmappedMarkets,
  });
  const coverage = useQuery({
    queryKey: ["research-coverage"],
    queryFn: getResearchCoverage,
  });
  const signalMismatches = useQuery({
    queryKey: ["research-signal-mismatches"],
    queryFn: () => getSignalMismatches(),
  });
  const liveHealth = useQuery({
    queryKey: ["health-live"],
    queryFn: getLiveHealth,
  });
  const readyHealth = useQuery({
    queryKey: ["health-ready"],
    queryFn: getReadyHealth,
  });

  const restartCapture = useMutation({
    mutationFn: postCaptureRestart,
    onSuccess: (payload, variables) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(
          payload.data,
          variables.source
            ? `Restart queued for ${variables.source}`
            : "Restart queued for all sources"
        ),
        ...current,
      ]);
    },
  });
  const backfillGames = useMutation({
    mutationFn: postBackfillGames,
    onSuccess: (payload) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(payload.data, "Game backfill queued"),
        ...current,
      ]);
    },
  });
  const backfillMarkets = useMutation({
    mutationFn: postBackfillMarkets,
    onSuccess: (payload) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(payload.data, "Market backfill queued"),
        ...current,
      ]);
    },
  });
  const rebuildTimelines = useMutation({
    mutationFn: postTimelineMaterializationRebuild,
    onSuccess: (payload) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(
          payload.data,
          "Timeline materialization rebuild queued"
        ),
        ...current,
      ]);
    },
  });
  const saveMarketAnomalyScoreConfig = useMutation({
    mutationFn: (config: MarketAnomalyScoreConfig) =>
      putMarketAnomalyScoreConfig(config),
    onSuccess: (payload) => {
      setScoreConfigDraft(cloneScoreConfig(payload.data));
      queryClient.invalidateQueries({
        queryKey: ["market-anomaly-score-config"],
      });
      queryClient.invalidateQueries({ queryKey: ["market-anomalies"] });
    },
  });
  const resolveMapping = useMutation({
    mutationFn: postResolveMapping,
    onSuccess: (_payload, variables) => {
      setMappingDrafts((current) => ({
        ...current,
        [variables.sourceMarketId]: {
          instrumentId: "",
          reason: current[variables.sourceMarketId]?.reason ?? "manual review",
        },
      }));
      void queryClient.invalidateQueries({
        queryKey: ["admin-unmapped-markets"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["research-coverage"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["games"],
      });
    },
  });

  if (
    sources.isLoading ||
    runtimeConfig.isLoading ||
    marketAnomalyScoreConfig.isLoading ||
    captureRuns.isLoading ||
    storageCoverage.isLoading ||
    unmappedMarkets.isLoading ||
    coverage.isLoading ||
    signalMismatches.isLoading ||
    (!sources.data && !sources.isError) ||
    (!runtimeConfig.data && !runtimeConfig.isError) ||
    (!marketAnomalyScoreConfig.data && !marketAnomalyScoreConfig.isError) ||
    (!captureRuns.data && !captureRuns.isError) ||
    (!storageCoverage.data && !storageCoverage.isError) ||
    (!unmappedMarkets.data && !unmappedMarkets.isError) ||
    (!coverage.data && !coverage.isError) ||
    (!signalMismatches.data && !signalMismatches.isError)
  ) {
    return <LoadingState message="Loading operational status..." />;
  }

  if (
    sources.isError ||
    runtimeConfig.isError ||
    marketAnomalyScoreConfig.isError ||
    captureRuns.isError ||
    storageCoverage.isError ||
    unmappedMarkets.isError ||
    coverage.isError ||
    signalMismatches.isError ||
    !sources.data ||
    !runtimeConfig.data ||
    !marketAnomalyScoreConfig.data ||
    !captureRuns.data ||
    !storageCoverage.data ||
    !unmappedMarkets.data ||
    !coverage.data ||
    !signalMismatches.data
  ) {
    return (
      <PageFrame>
        <ErrorState
          description="Health, runtime config, source, or coverage data could not be loaded."
          error={
            sources.error ??
            runtimeConfig.error ??
            marketAnomalyScoreConfig.error ??
            captureRuns.error ??
            storageCoverage.error ??
            unmappedMarkets.error ??
            coverage.error ??
            signalMismatches.error
          }
          onAction={() => {
            void sources.refetch();
            void runtimeConfig.refetch();
            void marketAnomalyScoreConfig.refetch();
            void captureRuns.refetch();
            void storageCoverage.refetch();
            void unmappedMarkets.refetch();
            void coverage.refetch();
            void signalMismatches.refetch();
            void liveHealth.refetch();
            void readyHealth.refetch();
          }}
          title="Settings failed to load"
        />
      </PageFrame>
    );
  }

  const mutationError =
    restartCapture.error ??
    backfillGames.error ??
    backfillMarkets.error ??
    rebuildTimelines.error ??
    saveMarketAnomalyScoreConfig.error ??
    resolveMapping.error;

  const configGroups = runtimeConfig.data.data.reduce<
    Record<string, typeof runtimeConfig.data.data>
  >((groups, item) => {
    groups[item.category] ??= [];
    groups[item.category].push(item);
    return groups;
  }, {});

  const configuredCount = runtimeConfig.data.data.filter(
    (item) => item.configured
  ).length;
  const scoreConfig =
    scoreConfigDraft ?? cloneScoreConfig(marketAnomalyScoreConfig.data.data);
  const liveStatus =
    liveHealth.data?.status ?? (liveHealth.isError ? "error" : "checking");
  const readyStatus =
    readyHealth.data?.status ?? (readyHealth.isError ? "error" : "checking");

  return (
    <PageFrame>
      <section className="hero-strip settings-hero">
        <div>
          <div className="eyebrow">Operations</div>
          <h1>Source and readiness status</h1>
          <p>
            {configuredCount} of {runtimeConfig.data.data.length} runtime
            environment knobs are set. Admin controls below queue backend work
            through the live API.
          </p>
        </div>
      </section>

      <div
        className={`settings-alert ${
          readyStatus === "ok"
            ? "settings-alert-positive"
            : readyStatus === "checking"
              ? "settings-alert-warning"
              : "settings-alert-critical"
        }`}
      >
        <strong>{readyStatus}</strong>
        <span>
          {readyStatus === "ok"
            ? "Readiness is passing and the runtime checks are green."
            : readyStatus === "checking"
              ? "Readiness is still checking; controls and settable runtime config are visible while it runs."
              : "Readiness is currently failing. Inspect the checks below before trusting operator traffic."}
        </span>
      </div>
      {mutationError ? (
        <div className="settings-alert settings-alert-critical">
          <strong>error</strong>
          <span>
            {mutationError instanceof Error
              ? mutationError.message
              : "An admin action request failed."}
          </span>
        </div>
      ) : null}

      <div className="settings-console">
        <section className="settings-section" id="admin-controls">
          <header className="settings-section-head">
            <span>Controls</span>
            <h2>Admin action queue</h2>
          </header>
          <div className="settings-control-grid">
            <label className="filter-field">
              <span>Restart source</span>
              <select
                className="filter-select"
                onChange={(event) => setRestartSource(event.target.value)}
                value={restartSource}
              >
                <option value="">all sources</option>
                {sources.data.data.map((source) => (
                  <option key={source.source} value={source.source}>
                    {source.source}
                  </option>
                ))}
              </select>
            </label>
            <div className="settings-control-action">
              <button
                className="primary-button"
                disabled={restartCapture.isPending}
                onClick={() =>
                  restartCapture.mutate(
                    restartSource ? { source: restartSource } : {}
                  )
                }
                type="button"
              >
                {restartSource
                  ? `Restart ${restartSource}`
                  : "Restart all capture"}
              </button>
            </div>

            <label className="filter-field">
              <span>Game date from</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setGameBackfillForm((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
                type="date"
                value={gameBackfillForm.dateFrom}
              />
            </label>
            <label className="filter-field">
              <span>Game date to</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setGameBackfillForm((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
                type="date"
                value={gameBackfillForm.dateTo}
              />
            </label>
            <label className="filter-field">
              <span>League</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setGameBackfillForm((current) => ({
                    ...current,
                    league: event.target.value,
                  }))
                }
                value={gameBackfillForm.league}
              />
            </label>
            <label className="filter-field">
              <span>Sport</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setGameBackfillForm((current) => ({
                    ...current,
                    sport: event.target.value,
                  }))
                }
                value={gameBackfillForm.sport}
              />
            </label>
            <div className="settings-control-action">
              <button
                className="primary-button"
                disabled={backfillGames.isPending}
                onClick={() => backfillGames.mutate(gameBackfillForm)}
                type="button"
              >
                Queue game backfill
              </button>
            </div>

            <label className="filter-field">
              <span>Market source</span>
              <select
                className="filter-select"
                onChange={(event) =>
                  setMarketBackfillForm((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
                value={marketBackfillForm.source}
              >
                <option value="">all market sources</option>
                <option value="bet365">bet365</option>
                <option value="kalshi">kalshi</option>
                <option value="polymarket">polymarket</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Game id</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setMarketBackfillForm((current) => ({
                    ...current,
                    gameId: event.target.value,
                  }))
                }
                placeholder="nba-0042500173"
                value={marketBackfillForm.gameId}
              />
            </label>
            <label className="filter-field">
              <span>Market date from</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setMarketBackfillForm((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
                type="date"
                value={marketBackfillForm.dateFrom}
              />
            </label>
            <label className="filter-field">
              <span>Market date to</span>
              <input
                className="search-input"
                onChange={(event) =>
                  setMarketBackfillForm((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
                type="date"
                value={marketBackfillForm.dateTo}
              />
            </label>
            <div className="settings-control-action settings-two-actions">
              <button
                className="primary-button"
                disabled={backfillMarkets.isPending}
                onClick={() =>
                  backfillMarkets.mutate({
                    dateFrom: marketBackfillForm.dateFrom || undefined,
                    dateTo: marketBackfillForm.dateTo || undefined,
                    gameId: marketBackfillForm.gameId || undefined,
                    source: marketBackfillForm.source || undefined,
                  })
                }
                type="button"
              >
                Queue market backfill
              </button>
              <button
                className="ghost-button"
                disabled={rebuildTimelines.isPending}
                onClick={() => rebuildTimelines.mutate()}
                type="button"
              >
                Queue timeline rebuild
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section" id="runtime-config">
          <header className="settings-section-head">
            <span>Runtime</span>
            <h2>Settable environment</h2>
          </header>
          {Object.entries(configGroups).map(([category, items]) => (
            <div className="settings-config-group" key={category}>
              <h3>{category}</h3>
              <div className="table-shell settings-table-shell">
                <table className="desk-table compact settings-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Current</th>
                      <th>Default</th>
                      <th>Type</th>
                      <th>Restart</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key}>
                        <td>
                          <strong>{item.key}</strong>
                          <span>{item.label}</span>
                        </td>
                        <td>
                          <span
                            className={`status-text ${
                              item.configured ? "status-cool" : "status-danger"
                            }`}
                          >
                            {item.configured ? "set" : "unset"}
                          </span>
                          <span>
                            {item.valuePreview ??
                              item.defaultValue ??
                              "no default"}
                          </span>
                        </td>
                        <td>{item.defaultValue ?? "none"}</td>
                        <td>{item.inputType}</td>
                        <td>{item.restartRequired ? "yes" : "no"}</td>
                        <td>{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>

        <section className="settings-section" id="market-anomaly-scoring">
          <header className="settings-section-head">
            <span>Signals</span>
            <h2>Prediction-market anomaly scoring</h2>
          </header>
          {scoreConfig ? (
            <div className="settings-config-group">
              <div className="settings-control-action">
                <button
                  className="ghost-button"
                  disabled={saveMarketAnomalyScoreConfig.isPending}
                  onClick={() => saveMarketAnomalyScoreConfig.mutate(scoreConfig)}
                  type="button"
                >
                  Save anomaly knobs
                </button>
              </div>
              <div className="table-shell settings-table-shell">
                <table className="desk-table compact settings-table">
                  <thead>
                    <tr>
                      <th>Knob</th>
                      <th>Value</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Minimum score</td>
                      <td>
                        <input
                          onChange={(event) =>
                            setScoreConfigDraft({
                              ...scoreConfig,
                              minScore: Number(event.target.value),
                            })
                          }
                          type="number"
                          value={scoreConfig.minScore}
                        />
                      </td>
                      <td>Rows below this score stay out of the queue.</td>
                    </tr>
                    <tr>
                      <td>Minimum confidence</td>
                      <td>
                        <input
                          onChange={(event) =>
                            setScoreConfigDraft({
                              ...scoreConfig,
                              minConfidence: Number(event.target.value),
                            })
                          }
                          step="0.05"
                          type="number"
                          value={scoreConfig.minConfidence}
                        />
                      </td>
                      <td>Candles and unmapped rows carry lower confidence.</td>
                    </tr>
                    <tr>
                      <td>Include unmapped</td>
                      <td>
                        <input
                          checked={scoreConfig.toggles.includeUnmapped}
                          onChange={(event) =>
                            setScoreConfigDraft({
                              ...scoreConfig,
                              toggles: {
                                ...scoreConfig.toggles,
                                includeUnmapped: event.target.checked,
                              },
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                      <td>Unmapped market weirdness remains visible.</td>
                    </tr>
                    <tr>
                      <td>Require Bet365</td>
                      <td>
                        <input
                          checked={scoreConfig.toggles.requireBet365}
                          onChange={(event) =>
                            setScoreConfigDraft({
                              ...scoreConfig,
                              toggles: {
                                ...scoreConfig.toggles,
                                requireBet365: event.target.checked,
                              },
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                      <td>Optional book-side context gate.</td>
                    </tr>
                    {Object.entries(scoreConfig.weights).map(([key, value]) => (
                      <tr key={`weight-${key}`}>
                        <td>{key} weight</td>
                        <td>
                          <input
                            onChange={(event) =>
                              setScoreConfigDraft({
                                ...scoreConfig,
                                weights: {
                                  ...scoreConfig.weights,
                                  [key]: Number(event.target.value),
                                },
                              })
                            }
                            step="0.05"
                            type="number"
                            value={value}
                          />
                        </td>
                        <td>Normalized score contribution.</td>
                      </tr>
                    ))}
                    {Object.entries(scoreConfig.thresholds).map(
                      ([key, value]) => (
                        <tr key={`threshold-${key}`}>
                          <td>{key}</td>
                          <td>
                            <input
                              onChange={(event) =>
                                setScoreConfigDraft({
                                  ...scoreConfig,
                                  thresholds: {
                                    ...scoreConfig.thresholds,
                                    [key]: Number(event.target.value),
                                  },
                                })
                              }
                              step="0.01"
                              type="number"
                              value={value}
                            />
                          </td>
                          <td>Component trigger threshold.</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="settings-section" id="health">
          <header className="settings-section-head">
            <span>Health</span>
            <h2>Liveness and readiness</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Liveness</td>
                  <td>
                    <span className={`status-text ${statusClass(liveStatus)}`}>
                      {liveStatus}
                    </span>
                  </td>
                  <td>
                    {liveHealth.data
                      ? `Uptime ${Math.round(liveHealth.data.uptimeMs / 1000)}s`
                      : liveHealth.isError
                        ? "Liveness request failed."
                        : "Checking liveness..."}
                  </td>
                </tr>
                <tr>
                  <td>Readiness</td>
                  <td>
                    <span className={`status-text ${statusClass(readyStatus)}`}>
                      {readyStatus}
                    </span>
                  </td>
                  <td>
                    {readyHealth.data == null
                      ? readyHealth.isError
                        ? "Readiness request failed or timed out."
                        : "Checking readiness..."
                      : readyHealth.data.status === "ok"
                        ? "All runtime checks are passing."
                        : "One or more runtime checks are failing."}
                  </td>
                </tr>
                {readyHealth.data?.checks.map((check) => (
                  <tr key={check.name}>
                    <td>{check.name}</td>
                    <td>
                      <span
                        className={`status-text ${statusClass(check.status)}`}
                      >
                        {check.status}
                      </span>
                    </td>
                    <td>
                      {check.summary}
                      {check.operatorHint ? ` ${check.operatorHint}` : ""}
                    </td>
                  </tr>
                )) ?? null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="sources">
          <header className="settings-section-head">
            <span>Sources</span>
            <h2>Configured capture dependencies</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Auth</th>
                  <th>Bootstrap</th>
                  <th>Subscription</th>
                  <th>Last success</th>
                  <th>Lag</th>
                  <th>Backoff</th>
                </tr>
              </thead>
              <tbody>
                {sources.data.data.map((source) => (
                  <tr key={source.source}>
                    <td>
                      <strong>{source.source}</strong>
                    </td>
                    <td>
                      <span
                        className={`status-text ${statusClass(source.status)}`}
                      >
                        {source.status}
                      </span>
                    </td>
                    <td>{source.authState}</td>
                    <td>{source.bootstrapState ?? "n/a"}</td>
                    <td>{source.subscriptionState ?? "n/a"}</td>
                    <td>{formatTimestamp(source.lastSuccessAt)}</td>
                    <td>{formatMinutes(source.lagMs)}</td>
                    <td>{formatMinutes(source.currentBackoffMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="mismatches">
          <header className="settings-section-head">
            <span>Mismatch Research</span>
            <h2>Directional disagreement and probability splits</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Game</th>
                  <th>Divergence</th>
                  <th>Bet365</th>
                  <th>Kalshi</th>
                  <th>Polymarket</th>
                  <th>Mapping</th>
                  <th>Line</th>
                </tr>
              </thead>
              <tbody>
                {signalMismatches.data.data.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      No signal mismatch rows are available yet.
                    </td>
                  </tr>
                ) : (
                  signalMismatches.data.data.slice(0, 8).map((row) => (
                    <tr key={row.instrumentId}>
                      <td>
                        <strong>{row.displayLabel}</strong>
                        <span>
                          {row.directionalDisagreement
                            ? "directional disagreement"
                            : "same direction"}
                        </span>
                      </td>
                      <td>{row.gameLabel}</td>
                      <td>
                        {row.impliedProbabilityGap == null
                          ? "n/a"
                          : formatGapPoints(row.impliedProbabilityGap)}
                      </td>
                      <td>
                        {formatProbabilityPercent(row.bet365ImpliedProbability)}
                      </td>
                      <td>
                        {formatProbabilityPercent(row.kalshiImpliedProbability)}
                      </td>
                      <td>
                        {formatProbabilityPercent(
                          row.polymarketImpliedProbability
                        )}
                      </td>
                      <td>{row.mappingStatus}</td>
                      <td>{row.lineMismatch ? "line mismatch" : "aligned"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="coverage">
          <header className="settings-section-head">
            <span>Coverage</span>
            <h2>Research coverage gaps</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Instrument</th>
                  <th>Family</th>
                  <th>Market feeds</th>
                  <th>NBA state</th>
                  <th>Missing</th>
                  <th>Unmapped</th>
                </tr>
              </thead>
              <tbody>
                {coverage.data.data.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      No research coverage rows are available yet.
                    </td>
                  </tr>
                ) : (
                  coverage.data.data.slice(0, 10).map((row) => {
                    const hasNbaState = hasNbaStateSource(row.availableSources);

                    return (
                      <tr
                        key={`${row.gameId}-${row.instrumentId ?? "game"}-${row.family ?? "all"}`}
                      >
                        <td>
                          <strong>{row.gameId}</strong>
                        </td>
                        <td>{row.instrumentId ?? "game aggregate"}</td>
                        <td>{row.family ?? "all families"}</td>
                        <td>
                          market feeds{" "}
                          {formatMarketSourceList(row.availableSources)}
                        </td>
                        <td>
                          NBA state {hasNbaState ? "available" : "missing"}
                        </td>
                        <td>{row.missingSources.join(", ") || "none"}</td>
                        <td>{row.unmappedSources.join(", ") || "none"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="capture-runs">
          <header className="settings-section-head">
            <span>Capture Runs</span>
            <h2>Latest adapter activity</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Seen</th>
                  <th>Written</th>
                  <th>Started</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {captureRuns.data.data.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No capture runs have been recorded yet.</td>
                  </tr>
                ) : (
                  captureRuns.data.data.slice(0, 8).map((run) => (
                    <tr key={run.id}>
                      <td>
                        <strong>{run.source}</strong>
                      </td>
                      <td>
                        <span
                          className={`status-text ${statusClass(run.status)}`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td>{run.recordsSeen}</td>
                      <td>{run.recordsWritten}</td>
                      <td>{formatTimestamp(run.startedAt)}</td>
                      <td>{run.errorMessage ?? "none"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="storage">
          <header className="settings-section-head">
            <span>Storage</span>
            <h2>Persisted source coverage</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Game</th>
                  <th>Family</th>
                  <th>Source markets</th>
                  <th>Quotes</th>
                  <th>Raw payloads</th>
                </tr>
              </thead>
              <tbody>
                {storageCoverage.data.data.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No persisted source coverage rows yet.</td>
                  </tr>
                ) : (
                  storageCoverage.data.data.slice(0, 10).map((row) => (
                    <tr
                      key={`${row.source}-${row.gameId}-${row.family ?? "unknown"}`}
                    >
                      <td>
                        <strong>{row.source}</strong>
                      </td>
                      <td>{row.gameId}</td>
                      <td>{row.family ?? "unmapped family"}</td>
                      <td>{row.sourceMarketCount}</td>
                      <td>{row.quoteTickCount}</td>
                      <td>{row.rawPayloadCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="queued-actions">
          <header className="settings-section-head">
            <span>Queue</span>
            <h2>Queued results in this session</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Detail</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {queuedActions.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No admin actions have been queued yet.</td>
                  </tr>
                ) : (
                  queuedActions.map((action) => (
                    <tr key={action.id}>
                      <td>
                        <strong>{action.title}</strong>
                      </td>
                      <td>{action.detail}</td>
                      <td>queued #{action.id}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section" id="unmapped">
          <header className="settings-section-head">
            <span>Unmapped</span>
            <h2>Markets still awaiting manual review</h2>
          </header>
          <div className="table-shell settings-table-shell">
            <table className="desk-table compact settings-table settings-map-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Context</th>
                  <th>Instrument id</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unmappedMarkets.data.data.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      No unmapped markets are currently outstanding.
                    </td>
                  </tr>
                ) : (
                  unmappedMarkets.data.data.slice(0, 10).map((row) => {
                    const draft = mappingDrafts[row.sourceMarket.id] ?? {
                      instrumentId: "",
                      reason: "manual review",
                    };
                    const gameLabel = row.game
                      ? `${row.game.awayParticipant.shortName} at ${row.game.homeParticipant.shortName}`
                      : `No canonical game linked yet (${row.sourceMarket.gameId})`;
                    const context = `${gameLabel} · ${row.sourceMarket.source}${
                      row.latestQuote?.capturedAt
                        ? ` · last quote ${formatTimestamp(row.latestQuote.capturedAt)}`
                        : ""
                    }`;

                    return (
                      <tr key={row.sourceMarket.id}>
                        <td>
                          <strong>
                            {row.sourceMarket.rawLabel ?? row.sourceMarket.id}
                          </strong>
                          <span>{row.sourceMarket.mappingStatus}</span>
                        </td>
                        <td>{context}</td>
                        <td>
                          <input
                            className="search-input"
                            onChange={(event) =>
                              setMappingDrafts((current) => ({
                                ...current,
                                [row.sourceMarket.id]: {
                                  ...draft,
                                  instrumentId: event.target.value,
                                },
                              }))
                            }
                            placeholder="bos-moneyline"
                            value={draft.instrumentId}
                          />
                        </td>
                        <td>
                          <input
                            className="search-input"
                            onChange={(event) =>
                              setMappingDrafts((current) => ({
                                ...current,
                                [row.sourceMarket.id]: {
                                  ...draft,
                                  reason: event.target.value,
                                },
                              }))
                            }
                            value={draft.reason}
                          />
                        </td>
                        <td>
                          <button
                            className="primary-button"
                            disabled={
                              resolveMapping.isPending ||
                              draft.instrumentId.length === 0
                            }
                            onClick={() =>
                              resolveMapping.mutate({
                                instrumentId: draft.instrumentId,
                                reason: draft.reason,
                                sourceMarketId: row.sourceMarket.id,
                              })
                            }
                            type="button"
                          >
                            Resolve mapping
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
