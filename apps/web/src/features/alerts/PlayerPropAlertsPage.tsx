import { useQuery } from "@tanstack/react-query";
import { Bell, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import {
  getDivergence,
  getPlayerPropAlertPlayback,
  getPlayerPropAlerts,
  type DivergencePayload,
  type PlayerPropAlertPlaybackPayload,
  type PlayerPropAlertsPayload,
} from "../../data/api";

type DivergenceRow = DivergencePayload["data"][number];
type PlayerPropAlertRow = PlayerPropAlertsPayload["data"][number];
type PlaybackFrame = PlayerPropAlertPlaybackPayload["data"][number];

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").replace("Z", "");
}

function formatProbability(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
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

function alertTone(alert: PlayerPropAlertRow) {
  if (alert.severity === "critical") {
    return "critical";
  }
  if (alert.severity === "high") {
    return "hot";
  }
  return "warm";
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
          <span>b365</span>
          <strong>{formatProbability(alert.bet365.impliedProbability)}</strong>
          <em>{alert.bet365.rawLabel ?? alert.bet365.sourceMarketKey}</em>
        </div>
        <div>
          <span>{alert.predictionMarket.source}</span>
          <strong>
            {formatProbability(alert.predictionMarket.impliedProbability)}
          </strong>
          <em>
            {alert.predictionMarket.rawLabel ??
              alert.predictionMarket.sourceMarketKey}
          </em>
        </div>
        <div>
          <span>delta</span>
          <strong>{formatDeltaPoints(alert.signedDelta)}</strong>
          <em>{alert.direction.replaceAll("-", " ")}</em>
        </div>
        <div>
          <span>age</span>
          <strong>{formatAge(alert.freshness.bet365AgeMs)}</strong>
          <em>pair gap {formatAge(alert.freshness.pairGapMs)}</em>
        </div>
      </div>
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
          <strong>{formatThreshold(row.impliedProbabilityGap ?? 0)}</strong>
          <em>{row.comparableState.replace("-", " ")}</em>
        </Link>
      ))}
    </div>
  );
}

export function PlayerPropAlertsPage() {
  const [playbackDate, setPlaybackDate] = useState(localDateInputValue());
  const [notificationThresholdPct, setNotificationThresholdPct] = useState(15);
  const notificationThreshold = notificationThresholdPct / 100;
  const liveAlerts = useQuery({
    queryKey: ["research-player-prop-alerts", "monitor", notificationThreshold],
    queryFn: () =>
      getPlayerPropAlerts({
        limit: 25,
        maxPairGapMinutes: 10,
        maxQuoteAgeMinutes: 10,
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
                ? "Live alert feed failed; current player-prop risk is unverified."
                : currentAlerts.length > 0
                  ? `${currentAlerts.length} live disagreement${
                      currentAlerts.length === 1 ? "" : "s"
                    } need review.`
                  : "Watcher is armed; no live prop disagreement is active."}
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
              <span>Threshold pp</span>
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
              aria-label="Refresh playback"
              className="icon-button"
              onClick={() => {
                void liveAlerts.refetch();
                void playback.refetch();
              }}
              title="Refresh playback"
              type="button"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </section>

        <section className="alert-monitor-stats" aria-label="Alert summary">
          <div>
            <Bell size={17} />
            <span>Live queue</span>
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
              <h2>Live review queue</h2>
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
              <div className="eyebrow">Replay tape</div>
              <h2>What the watcher saw</h2>
            </div>
            <span>{playback.isFetching ? "refreshing" : playbackDate}</span>
          </div>
          <div className="playback-frame-list">
            {playback.isError ? (
              <div className="alert-monitor-error">
                Player prop alert playback failed to load. Replay history is not
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
                      {zeroAlertFrameCount} watcher poll
                      {zeroAlertFrameCount === 1 ? "" : "s"} had no alert. Polls
                      are threshold evaluations, not video frames.
                      {notifiedCount === 0
                        ? ` None reached the notification threshold of ${formatThreshold(
                            playbackThreshold
                          )}.`
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
                No playback frames have been written for this date.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
