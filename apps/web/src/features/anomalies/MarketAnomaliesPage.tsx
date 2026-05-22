import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import {
  getMarketAnomalies,
  getMarketAnomalyScoreConfig,
  putMarketAnomalyScoreConfig,
  type MarketAnomaliesPayload,
  type MarketAnomalyScoreConfig,
} from "../../data/api";
import {
  cloneMarketAnomalyScoreConfig,
  getLiveMarketAnomalyQueueConfig,
  marketAnomalyScoreConfigQueryKey,
} from "../../lib/market-anomaly-score-config";
import { formatOperatorDateTime } from "../../lib/time-format";

type MarketAnomaly = MarketAnomaliesPayload["data"][number];

const sourceOptions = ["all", "kalshi", "polymarket", "bet365"];
const familyOptions = [
  "all",
  "moneyline",
  "spread",
  "total",
  "player-prop",
  "team-prop",
  "other",
];

function formatNumber(value?: number | null, digits = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function formatPercent(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  return `$${value.toFixed(2)}`;
}

function anomalyTone(alert: MarketAnomaly) {
  if (alert.severity === "critical") return "critical";
  if (alert.severity === "high") return "hot";
  return "warm";
}

function anomalyHref(alert: MarketAnomaly) {
  if (alert.instrumentId) {
    return `/games/${alert.gameId}/markets/${alert.instrumentId}`;
  }
  return `/settings#unmapped`;
}

function updateNumber<T extends Record<string, number>>(
  object: T,
  key: keyof T,
  value: string
): T {
  const next = Number(value);
  return {
    ...object,
    [key]: Number.isFinite(next) ? next : object[key],
  } as T;
}

function AnomalyRow({ alert }: { alert: MarketAnomaly }) {
  return (
    <tr className={`prop-risk-${anomalyTone(alert)}`}>
      <td>
        <strong>{alert.score}</strong>
        <span>{formatPercent(alert.confidence)} conf</span>
      </td>
      <td>
        <strong>{alert.displayLabel}</strong>
        <span>{alert.gameLabel}</span>
      </td>
      <td>
        <strong>{alert.source}</strong>
        <span>{alert.apiSurface}</span>
      </td>
      <td>
        <strong>{formatOperatorDateTime(alert.eventTimestamp)}</strong>
        <span>{alert.eventType}</span>
      </td>
      <td>
        <strong>{alert.labels.slice(0, 2).join(", ")}</strong>
        <span>{alert.mappingStatus}</span>
      </td>
      <td>
        <strong>
          {formatNumber(alert.metrics.tradePrice ?? alert.metrics.price)}
        </strong>
        <span>
          ref {formatNumber(alert.metrics.referencePrice)} / dist{" "}
          {formatPercent(alert.metrics.tradeDistance)}
        </span>
      </td>
      <td>
        <strong>{formatCurrency(alert.metrics.notional)}</strong>
        <span>
          size {formatNumber(alert.metrics.size)} / share{" "}
          {formatPercent(alert.metrics.volumeShare)}
        </span>
      </td>
      <td>
        <strong>{formatPercent(alert.metrics.spread)}</strong>
        <span>depth {formatNumber(alert.metrics.depthScore, 0)}</span>
      </td>
      <td>
        <Link className="desk-link" to={anomalyHref(alert)}>
          Open
        </Link>
      </td>
    </tr>
  );
}

export function MarketAnomaliesPage() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState("all");
  const [family, setFamily] = useState("all");
  const [queueFilterOverrides, setQueueFilterOverrides] = useState<{
    includeUnmapped?: boolean;
    requireBet365?: boolean;
  }>({});
  const config = useQuery({
    queryKey: marketAnomalyScoreConfigQueryKey,
    queryFn: getMarketAnomalyScoreConfig,
  });
  const [draft, setDraft] = useState<MarketAnomalyScoreConfig | null>(null);

  const activeConfig =
    draft ?? cloneMarketAnomalyScoreConfig(config.data?.data);
  const liveQueueDefaults = getLiveMarketAnomalyQueueConfig(activeConfig);
  const includeUnmapped =
    queueFilterOverrides.includeUnmapped ?? liveQueueDefaults.includeUnmapped;
  const requireBet365 =
    queueFilterOverrides.requireBet365 ?? liveQueueDefaults.requireBet365;
  const queueConfigReady = config.data != null || config.isError;
  const anomalies = useQuery({
    queryKey: [
      "market-anomalies",
      source,
      family,
      includeUnmapped,
      requireBet365,
      activeConfig?.toggles.includeHistorical ?? false,
      activeConfig?.updatedAt ?? null,
      liveQueueDefaults.minScore,
      liveQueueDefaults.minConfidence,
    ],
    queryFn: () =>
      getMarketAnomalies({
        family: family === "all" ? undefined : family,
        includeHistorical: activeConfig?.toggles.includeHistorical,
        includeUnmapped,
        limit: 50,
        minConfidence: liveQueueDefaults.minConfidence,
        minScore: liveQueueDefaults.minScore,
        requireBet365,
        source: source === "all" ? undefined : source,
      }),
    enabled: queueConfigReady,
    refetchInterval: 5000,
  });
  const saveConfig = useMutation({
    mutationFn: (next: MarketAnomalyScoreConfig) =>
      putMarketAnomalyScoreConfig(next),
    onSuccess: (payload) => {
      setDraft(cloneMarketAnomalyScoreConfig(payload.data));
      setQueueFilterOverrides({});
      void queryClient.invalidateQueries({
        queryKey: marketAnomalyScoreConfigQueryKey,
      });
      void queryClient.invalidateQueries({ queryKey: ["market-anomalies"] });
      void queryClient.invalidateQueries({
        queryKey: ["research-market-anomalies"],
      });
    },
  });

  const rows = anomalies.data?.data ?? [];
  const criticalCount = rows.filter(
    (row) => row.severity === "critical"
  ).length;
  const topScore = rows[0]?.score ?? 0;

  return (
    <PageFrame>
      <div className="alert-monitor" aria-label="Prediction-market weirdness">
        <section className="alert-monitor-hero">
          <div>
            <span className="eyebrow">Prediction-market weirdness</span>
            <h1>Market anomaly queue</h1>
            <p>
              {rows.length > 0
                ? `${rows.length} active anomaly rows; top score ${topScore}.`
                : anomalies.isLoading
                  ? "Loading anomaly queue."
                  : "No current market anomaly rows."}
            </p>
          </div>
          <div className="alert-monitor-actions">
            <label>
              <span>Source</span>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Family</span>
              <select
                value={family}
                onChange={(event) => setFamily(event.target.value)}
              >
                {familyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Refresh anomalies"
              className="icon-button"
              onClick={() => anomalies.refetch()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
            </button>
          </div>
        </section>

        <section className="alert-monitor-stats" aria-label="Anomaly summary">
          <div>
            <span>Rows</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span>Critical</span>
            <strong>{criticalCount}</strong>
          </div>
          <div>
            <span>Top score</span>
            <strong>{topScore}</strong>
          </div>
          <div>
            <span>Generated</span>
            <strong>
              {formatOperatorDateTime(anomalies.data?.meta.generatedAt)}
            </strong>
          </div>
        </section>

        <Panel className="alert-monitor-panel">
          <div className="alert-monitor-section-head">
            <div>
              <span>Live queue</span>
              <h2>Go look now</h2>
            </div>
            <div className="alert-monitor-actions">
              <label>
                <span>Unmapped</span>
                <input
                  checked={includeUnmapped}
                  onChange={(event) =>
                    setQueueFilterOverrides((current) => ({
                      ...current,
                      includeUnmapped: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
              </label>
              <label>
                <span>Require b365</span>
                <input
                  checked={requireBet365}
                  onChange={(event) =>
                    setQueueFilterOverrides((current) => ({
                      ...current,
                      requireBet365: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
              </label>
            </div>
          </div>
          {anomalies.isError ? (
            <div className="alert-monitor-error">
              Market anomaly feed failed to load.
            </div>
          ) : rows.length === 0 ? (
            <div className="alert-monitor-empty">
              No current prediction-market weirdness above the active score.
            </div>
          ) : (
            <div className="table-shell settings-table-shell">
              <table className="desk-table compact settings-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Market</th>
                    <th>Venue</th>
                    <th>Time</th>
                    <th>Signal</th>
                    <th>Price</th>
                    <th>Volume</th>
                    <th>Book</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((alert) => (
                    <AnomalyRow alert={alert} key={alert.id} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {activeConfig ? (
          <Panel className="alert-monitor-panel">
            <div className="alert-monitor-section-head">
              <div>
                <span>Score profile</span>
                <h2>Active knobs</h2>
              </div>
              <button
                className="ghost-button"
                disabled={saveConfig.isPending}
                onClick={() => saveConfig.mutate(activeConfig)}
                type="button"
              >
                <Save aria-hidden="true" size={14} />
                Save
              </button>
            </div>
            <div className="table-shell settings-table-shell">
              <table className="desk-table compact settings-table">
                <thead>
                  <tr>
                    <th>Knob</th>
                    <th>Value</th>
                    <th>Current use</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Minimum score</td>
                    <td>
                      <input
                        onChange={(event) =>
                          setDraft({
                            ...activeConfig,
                            minScore: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={activeConfig.minScore}
                      />
                    </td>
                    <td>Queue threshold</td>
                  </tr>
                  <tr>
                    <td>Minimum confidence</td>
                    <td>
                      <input
                        onChange={(event) =>
                          setDraft({
                            ...activeConfig,
                            minConfidence: Number(event.target.value),
                          })
                        }
                        step="0.05"
                        type="number"
                        value={activeConfig.minConfidence}
                      />
                    </td>
                    <td>Surface quality threshold</td>
                  </tr>
                  {Object.entries(activeConfig.weights).map(([key, value]) => (
                    <tr key={`weight-${key}`}>
                      <td>{key} weight</td>
                      <td>
                        <input
                          onChange={(event) =>
                            setDraft({
                              ...activeConfig,
                              weights: updateNumber(
                                activeConfig.weights,
                                key as keyof MarketAnomalyScoreConfig["weights"],
                                event.target.value
                              ),
                            })
                          }
                          step="0.05"
                          type="number"
                          value={value}
                        />
                      </td>
                      <td>Score component</td>
                    </tr>
                  ))}
                  {Object.entries(activeConfig.thresholds).map(
                    ([key, value]) => (
                      <tr key={`threshold-${key}`}>
                        <td>{key}</td>
                        <td>
                          <input
                            onChange={(event) =>
                              setDraft({
                                ...activeConfig,
                                thresholds: updateNumber(
                                  activeConfig.thresholds,
                                  key as keyof MarketAnomalyScoreConfig["thresholds"],
                                  event.target.value
                                ),
                              })
                            }
                            step="0.01"
                            type="number"
                            value={value}
                          />
                        </td>
                        <td>Detection threshold</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </div>
    </PageFrame>
  );
}
