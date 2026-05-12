import { useQuery } from "@tanstack/react-query";
import { Bell, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { DivergenceMiniChart } from "../../components/DivergenceMiniChart";
import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import {
  getDivergence,
  getInstrumentTimeline,
  getPlayerPropAlertPlayback,
  getPlayerPropAlerts,
  type DivergencePayload,
  type PlayerPropAlertPlaybackPayload,
  type PlayerPropAlertsPayload,
} from "../../data/api";
import { buildDivergenceTraceSummary } from "../../lib/divergence-history";
import { formatOperatorDateTime } from "../../lib/time-format";

type DivergenceRow = DivergencePayload["data"][number];
type PlayerPropAlertRow = PlayerPropAlertsPayload["data"][number];
type PlaybackFrame = PlayerPropAlertPlaybackPayload["data"][number];

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isDateInputValue(value: string | null) {
  return value != null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatTimestamp(value?: string | null) {
  return formatOperatorDateTime(value);
}

function formatProbability(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatLine(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "line n/a";
  }

  return `line ${value > 0 ? `+${value}` : value}`;
}

function formatDeltaPoints(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

function formatThreshold(value: number) {
  return `${(value * 100).toFixed(0)} pp`;
}

function formatAge(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }

  if (value < 60 * 60_000) {
    return `${(value / 60_000).toFixed(1)}m`;
  }

  return `${(value / (60 * 60_000)).toFixed(1)}h`;
}

function rowPeakGap(row: DivergenceRow) {
  return row.comparisonSummary?.maxGap ?? row.impliedProbabilityGap ?? null;
}

function matchLabel(state: string) {
  switch (state) {
    case "comparable":
      return "matched";
    case "line-mismatch":
      return "line mismatch";
    case "selection-mismatch":
      return "selection mismatch";
    case "unmapped":
      return "unmapped";
    default:
      return state;
  }
}

function alertTone(alert: PlayerPropAlertRow) {
  if (alert.severity === "critical") {
    return "critical";
  }
  if (alert.severity === "high") {
    return "hot";
  }
  return "warm";
}

function InstrumentTrace({
  gameId,
  instrumentId,
}: {
  gameId: string;
  instrumentId: string;
}) {
  const timeline = useQuery({
    queryKey: ["instrument-timeline-mini", gameId, instrumentId],
    queryFn: () => getInstrumentTimeline(gameId, instrumentId),
    refetchInterval: 5000,
  });

  return (
    <DivergenceMiniChart
      summary={buildDivergenceTraceSummary(timeline.data?.data)}
    />
  );
}

function AlertCard({
  alert,
  compact,
}: {
  alert: PlayerPropAlertRow;
  compact?: boolean;
}) {
  return (
    <article
      className={`prop-alert-card prop-alert-card-${alertTone(alert)} ${
        compact ? "prop-alert-card-compact" : ""
      }`}
    >
      <div className="prop-alert-card-main">
        <div>
          <div className="eyebrow">{alert.gameLabel}</div>
          <h3>{alert.displayLabel}</h3>
        </div>
        <Link
          className="desk-link"
          to={`/games/${alert.gameId}/markets/${alert.instrumentId}`}
        >
          Open
        </Link>
      </div>
      <div className="prop-alert-card-grid">
        <div>
          <span>Bet365</span>
          <strong>{formatProbability(alert.bet365.impliedProbability)}</strong>
          <em>
            {formatLine(alert.bet365.lineRaw)} ·{" "}
            {formatTimestamp(alert.bet365.capturedAt)}
          </em>
        </div>
        <div>
          <span>{alert.predictionMarket.source}</span>
          <strong>
            {formatProbability(alert.predictionMarket.impliedProbability)}
          </strong>
          <em>
            {formatLine(alert.predictionMarket.lineRaw)} ·{" "}
            {formatTimestamp(alert.predictionMarket.capturedAt)}
          </em>
        </div>
        <div>
          <span>Divergence</span>
          <strong>{formatDeltaPoints(alert.signedDelta)}</strong>
          <em>{alert.direction.replaceAll("-", " ")}</em>
        </div>
        <div>
          <span>Quote timing</span>
          <strong>{formatAge(alert.freshness.bet365AgeMs)}</strong>
          <em>time apart {formatAge(alert.freshness.quoteTimeGapMs)}</em>
        </div>
      </div>
      {compact ? null : (
        <InstrumentTrace
          gameId={alert.gameId}
          instrumentId={alert.instrumentId}
        />
      )}
    </article>
  );
}

function PlaybackFrameCard({ frame }: { frame: PlaybackFrame }) {
  return (
    <article className="playback-frame">
      <div className="playback-frame-head">
        <div>
          <span>{formatTimestamp(frame.capturedAt)}</span>
          <strong>
            {frame.alertCount} alert{frame.alertCount === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="playback-frame-meta">
          <span>{frame.notifiedAlertIds.length} notified</span>
          <span>{(frame.poll.minDelta * 100).toFixed(0)} pp min</span>
        </div>
      </div>
      {frame.error ? (
        <div className="alert-monitor-error">{frame.error.message}</div>
      ) : null}
      {!frame.error ? (
        <div className="playback-alert-list">
          {frame.alerts.length > 0 ? (
            frame.alerts.map((alert) => (
              <AlertCard
                alert={alert}
                compact
                key={`${frame.capturedAt}:${alert.id}`}
              />
            ))
          ) : (
            <div className="playback-empty-frame">No active prop alert.</div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function TrackedPlayerPropList({ rows }: { rows: DivergenceRow[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="tracked-prop-preview" aria-label="Tracked player props">
      {rows.slice(0, 5).map((row) => (
        <Link
          className="tracked-prop-row"
          key={`${row.gameId}:${row.instrumentId}`}
          to={`/games/${row.gameId}/markets/${row.instrumentId}`}
        >
          <span>{row.displayLabel}</span>
          <strong>{formatThreshold(rowPeakGap(row) ?? 0)}</strong>
          <em>{matchLabel(row.comparableState)}</em>
          <InstrumentTrace
            gameId={row.gameId}
            instrumentId={row.instrumentId}
          />
        </Link>
      ))}
    </div>
  );
}

export function PlayerPropAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const playbackDate = isDateInputValue(searchParams.get("date"))
    ? searchParams.get("date")!
    : localDateInputValue();
  const [notificationThresholdPct, setNotificationThresholdPct] = useState(15);
  const notificationThreshold = notificationThresholdPct / 100;

  function setPlaybackDate(nextDate: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (isDateInputValue(nextDate)) {
      nextParams.set("date", nextDate);
    } else {
      nextParams.delete("date");
    }
    setSearchParams(nextParams, { replace: true });
  }

  const liveAlerts = useQuery({
    queryKey: ["research-player-prop-alerts", "monitor", notificationThreshold],
    queryFn: () =>
      getPlayerPropAlerts({
        limit: 25,
        maxQuoteAgeMinutes: 10,
        maxQuoteTimeGapMinutes: 10,
        minDelta: notificationThreshold,
      }),
    refetchInterval: 5000,
  });
  const playback = useQuery({
    queryKey: ["research-player-prop-alert-playback", playbackDate],
    queryFn: () =>
      getPlayerPropAlertPlayback({
        date: playbackDate,
        limit: 300,
      }),
    refetchInterval: 10_000,
  });
  const trackedPlayerProps = useQuery({
    queryKey: ["research-player-props-tracked", playbackDate],
    queryFn: () =>
      getDivergence({
        date: playbackDate,
        family: "player-prop",
        limit: 500,
        sort: "signalPriority",
      }),
  });

  const currentAlerts = liveAlerts.data?.data ?? [];
  const frames = playback.data?.data ?? [];
  const latestFrame = frames.at(-1);
  const alertFrames = frames.filter(
    (frame) => frame.alerts.length > 0 || frame.error
  );
  const zeroAlertFrameCount = frames.filter(
    (frame) => frame.alerts.length === 0 && !frame.error
  ).length;
  const notifiedCount = frames.reduce(
    (sum, frame) => sum + frame.notifiedAlertIds.length,
    0
  );
  const playbackThreshold = latestFrame?.poll.minDelta ?? notificationThreshold;
  const trackedRows = trackedPlayerProps.data?.data ?? [];
  const trackedRowsAtPlaybackThreshold = trackedRows.filter(
    (row) => (rowPeakGap(row) ?? 0) >= playbackThreshold
  );
  const playbackAlerts = frames.flatMap((frame) => frame.alerts);
  const playbackAlertsAtThreshold = playbackAlerts.filter(
    (alert) => alert.absoluteDelta >= playbackThreshold
  );
  const playbackAlertDivergences = playbackAlertsAtThreshold
    .map((alert) => alert.absoluteDelta)
    .filter(Number.isFinite);
  const playbackAlertRange =
    playbackAlertDivergences.length > 0
      ? {
          max: Math.max(...playbackAlertDivergences),
          min: Math.min(...playbackAlertDivergences),
        }
      : null;
  const historyLink = `/history?date=${encodeURIComponent(
    playbackDate
  )}&family=player-prop`;

  return (
    <PageFrame>
      <div className="alert-monitor" aria-label="Player prop alert monitor">
        <section className="alert-monitor-hero">
          <div>
            <div className="eyebrow">Player prop attribution risk</div>
            <h1>Player prop alert monitor</h1>
            <p>
              {liveAlerts.isError
                ? "Current alert feed failed; player-prop risk is unverified."
                : currentAlerts.length > 0
                  ? `${currentAlerts.length} current disagreement${
                      currentAlerts.length === 1 ? "" : "s"
                    } need review.`
                  : "Watcher is armed; no current prop disagreement is active."}
            </p>
          </div>
          <div className="alert-monitor-actions">
            <label>
              <span>Date</span>
              <input
                onChange={(event) => setPlaybackDate(event.target.value)}
                type="date"
                value={playbackDate}
              />
            </label>
            <label>
              <span>Alert threshold</span>
              <input
                aria-label="Notification threshold in percentage points"
                max={100}
                min={0}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (Number.isFinite(nextValue)) {
                    setNotificationThresholdPct(nextValue);
                  }
                }}
                step={1}
                type="number"
                value={notificationThresholdPct}
              />
            </label>
            <button
              aria-label="Refresh alert history"
              className="icon-button"
              onClick={() => {
                void liveAlerts.refetch();
                void playback.refetch();
              }}
              title="Refresh alert history"
              type="button"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </section>

        <section className="alert-monitor-stats" aria-label="Alert summary">
          <div>
            <Bell size={17} />
            <span>Current queue</span>
            <strong>{currentAlerts.length}</strong>
          </div>
          <div>
            <Play size={17} />
            <span>Tracked props</span>
            <strong>
              {trackedPlayerProps.isLoading ? "..." : trackedRows.length}
            </strong>
          </div>
          <div>
            <Bell size={17} />
            <span>Watcher polls</span>
            <strong>{frames.length}</strong>
          </div>
          <div>
            <Play size={17} />
            <span>Last poll</span>
            <strong>
              {latestFrame ? formatTimestamp(latestFrame.capturedAt) : "none"}
            </strong>
          </div>
        </section>

        <Panel className="alert-monitor-panel">
          <div className="alert-monitor-section-head">
            <div>
              <div className="eyebrow">Right now</div>
              <h2>Current review queue</h2>
            </div>
            <span>{liveAlerts.isFetching ? "refreshing" : "steady"}</span>
          </div>
          <div className="alert-monitor-list">
            {liveAlerts.isError ? (
              <div className="alert-monitor-error">
                Player prop alert feed failed to load. Current queue is not
                verified.
              </div>
            ) : currentAlerts.length > 0 ? (
              currentAlerts.map((alert) => (
                <AlertCard alert={alert} key={alert.id} />
              ))
            ) : (
              <div className="alert-monitor-empty">
                No current player-prop disagreement alert.
              </div>
            )}
          </div>
        </Panel>

        <Panel className="alert-monitor-panel">
          <div className="alert-monitor-section-head">
            <div>
              <div className="eyebrow">Past checks</div>
              <h2>Saved alert checks</h2>
            </div>
            <span>{playback.isFetching ? "refreshing" : playbackDate}</span>
          </div>
          <div className="playback-frame-list">
            {playback.isError ? (
              <div className="alert-monitor-error">
                Player prop alert history failed to load. Saved checks are not
                verified.
              </div>
            ) : frames.length > 0 ? (
              <>
                <div className="playback-summary-card">
                  <div>
                    <strong>
                      {trackedPlayerProps.isLoading
                        ? "Loading tracked player props..."
                        : `${trackedRows.length} tracked player props`}
                    </strong>
                    <p>
                      {zeroAlertFrameCount} watcher check
                      {zeroAlertFrameCount === 1 ? "" : "s"} had no current
                      alert.
                      {trackedPlayerProps.isLoading
                        ? " Waiting for persisted comparison rows before judging the threshold."
                        : trackedPlayerProps.isError
                          ? " Persisted comparison rows failed to load, so the threshold summary is not verified."
                          : playbackAlertsAtThreshold.length > 0
                            ? ` ${playbackAlertsAtThreshold.length} saved alert${
                                playbackAlertsAtThreshold.length === 1
                                  ? ""
                                  : "s"
                              } reached ${formatThreshold(
                                playbackThreshold
                              )}; saved alert divergence ranged from ${formatThreshold(
                                playbackAlertRange?.min ?? playbackThreshold
                              )} to ${formatThreshold(
                                playbackAlertRange?.max ?? playbackThreshold
                              )}.`
                            : trackedRowsAtPlaybackThreshold.length > 0
                              ? ` ${trackedRowsAtPlaybackThreshold.length} persisted comparison${
                                  trackedRowsAtPlaybackThreshold.length === 1
                                    ? ""
                                    : "s"
                                } reached ${formatThreshold(
                                  playbackThreshold
                                )} on this date; alert notifications also require quote age and same-time quote rules at each check.`
                              : notifiedCount === 0
                                ? ` No persisted comparison is at the ${formatThreshold(
                                    playbackThreshold
                                  )} threshold on this date.`
                                : ` ${notifiedCount} notification${
                                    notifiedCount === 1 ? "" : "s"
                                  } fired at the saved ${formatThreshold(
                                    playbackThreshold
                                  )} threshold.`}
                    </p>
                  </div>
                  <div className="playback-summary-actions">
                    <Link className="desk-link" to={historyLink}>
                      See tracked props in History
                    </Link>
                  </div>
                </div>
                <TrackedPlayerPropList rows={trackedRows} />
                {alertFrames.length > 0 ? (
                  alertFrames.map((frame) => (
                    <PlaybackFrameCard
                      frame={frame}
                      key={`${frame.capturedAt}:${frame.alertCount}`}
                    />
                  ))
                ) : (
                  <div className="alert-monitor-empty">
                    No alert-triggering polls for this date.
                  </div>
                )}
              </>
            ) : (
              <div className="alert-monitor-empty">
                No alert checks have been written for this date.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
