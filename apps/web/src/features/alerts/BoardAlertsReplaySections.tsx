import { Link } from "react-router-dom";

import {
  BOARD_ALERT_KIND_LABELS,
  INCIDENT_BURST_WINDOW_SECONDS,
  describePredictionSourceSummary,
  describePredictionMarketContextRow,
  describePredictionMarketContextSummary,
  alertFamilies,
  describeReviewTargetReason,
  describeBoardAlertGameClock,
  displayBoardAlertEntity,
  familyLabel,
  formatLeadLabel,
  formatNumber,
  formatOffset,
  formatPbpGameClock,
  formatPercent,
  formatPrice,
  formatTimestampToSecond,
  type BoardAlertPbpRow,
  type BoardAlertPbpRowLike,
  type BoardAlertPredictionSourceSummary,
  type BoardAlertReviewTarget,
} from "./boardAlertReview";

import type { BoardAnomalyAlertDto } from "../../data/api";

export function TraderReadSection({
  anchorAlert,
  anchorAt,
  nearestPbp,
  pbpMissing,
  traderRead,
}: {
  anchorAlert: BoardAnomalyAlertDto;
  anchorAt: string;
  nearestPbp: BoardAlertPbpRowLike | null;
  pbpMissing: boolean;
  traderRead: string | null;
}) {
  return (
    <section
      aria-label="Trader read"
      className="board-alert-card board-alert-card-primary board-alert-card-critical"
    >
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">Trader read</div>
          <div className="board-alert-kind">
            {BOARD_ALERT_KIND_LABELS[anchorAlert.shockKind]}
          </div>
        </div>
        <div className="board-alert-time">
          <div className="metric-label">Confidence / score</div>
          <div>
            {(anchorAlert.confidence * 100).toFixed(0)}% · {anchorAlert.score}
          </div>
        </div>
      </header>
      <p className="board-alert-reason">{traderRead ?? anchorAlert.reason}</p>
      <div className="board-alert-summary-grid">
        <div>
          <span className="metric-label">Wall clock</span>
          <strong>{formatTimestampToSecond(anchorAt)}</strong>
        </div>
        <div>
          <span className="metric-label">Game clock</span>
          <strong>
            {describeBoardAlertGameClock({
              alert: anchorAlert,
              anchorAt,
              nearestPbp,
              pbpMissing,
            })}
          </strong>
        </div>
        <div>
          <span className="metric-label">Primary handle</span>
          <strong>
            {anchorAlert.primaryEntityKey
              ? displayBoardAlertEntity(anchorAlert.primaryEntityKey)
              : "Broad tripwire"}
          </strong>
        </div>
        <div>
          <span className="metric-label">Likely families</span>
          <strong>{alertFamilies(anchorAlert)}</strong>
        </div>
      </div>
      {nearestPbp ? (
        <p className="board-alert-callout">
          Nearest NBA feed row:{" "}
          <strong>{formatTimestampToSecond(nearestPbp.timeActual)}</strong>
          {" · "}
          {formatPbpGameClock(nearestPbp) ?? "clock n/a"}
          {" · "}
          {nearestPbp.description ?? "no description"}
          {nearestPbp.teamTricode ? ` · ${nearestPbp.teamTricode}` : ""}
        </p>
      ) : (
        <p className="board-alert-callout board-alert-callout-muted">
          {pbpMissing
            ? "Persisted NBA play-by-play is missing for this game snapshot, so the exact event still needs NBA-side verification."
            : "No persisted NBA feed row is close enough to this incident to confirm the exact in-game event from the feed alone."}
        </p>
      )}
    </section>
  );
}

export function ReviewTargetsSection({
  reviewTargets,
}: {
  reviewTargets: BoardAlertReviewTarget[];
}) {
  return (
    <section
      aria-label="Review targets"
      className="board-alert-card board-alert-card-warm"
    >
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">Review / suspend first</div>
          <div className="board-alert-kind">
            {reviewTargets.length} implicated markets from the selected incident
            read
          </div>
        </div>
      </header>
      {reviewTargets.length === 0 ? (
        <p className="board-alert-reason">
          No concrete market targets are persisted for this incident yet.
        </p>
      ) : (
        <div className="board-alert-targets">
          <div className="board-alert-targets-head">
            <span>Source</span>
            <span>Family</span>
            <span>Market</span>
            <span>Why flagged</span>
          </div>
          <ol className="board-alert-targets-body">
            {reviewTargets.map((row) => (
              <li key={`${row.sourceAlertId}:${row.observationId}`}>
                <span className="board-alert-target-source">{row.source}</span>
                <span className="board-alert-target-family">
                  {familyLabel(row.family)}
                </span>
                <span className="board-alert-target-market">
                  {row.displayLabel}
                </span>
                <span className="board-alert-target-why">
                  {describeReviewTargetReason(row)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export function SameBurstFollowUpSection({
  anchorAt,
  dateParam,
  nearbyIncidentRows,
}: {
  anchorAt: string;
  dateParam: string | null;
  nearbyIncidentRows: BoardAnomalyAlertDto[];
}) {
  return (
    <section aria-label="Nearby incidents" className="board-alert-card">
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">Same-burst follow-up</div>
          <div className="board-alert-kind">
            {dateParam
              ? `Only alerts within ${INCIDENT_BURST_WINDOW_SECONDS}s of the selected incident`
              : `Only alerts within ${INCIDENT_BURST_WINDOW_SECONDS}s of the selected live alert`}
          </div>
        </div>
      </header>
      {nearbyIncidentRows.length === 0 ? (
        <p className="board-alert-reason">
          No other persisted alerts were found within{" "}
          {INCIDENT_BURST_WINDOW_SECONDS}s of this incident.
        </p>
      ) : (
        <ol className="board-alerts-timeline">
          {nearbyIncidentRows.map((alert) => (
            <li key={alert.id}>
              <span className="board-alerts-timeline-time">
                {formatTimestampToSecond(alert.firstPopAt)}
              </span>
              <span className="board-alerts-timeline-kind">
                {alert.primaryEntityKey
                  ? displayBoardAlertEntity(alert.primaryEntityKey)
                  : BOARD_ALERT_KIND_LABELS[alert.shockKind]}
              </span>
              <span className="board-alerts-timeline-reason">
                {alert.reason}
              </span>
              <span className="board-alerts-timeline-score">
                {formatLeadLabel(anchorAt, alert.firstPopAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PredictionSourcesSection({
  predictionSources,
}: {
  predictionSources: BoardAlertPredictionSourceSummary[];
}) {
  return (
    <section
      aria-label="Prediction-market source context"
      className="board-alert-card"
    >
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">
            Prediction-market context by source
          </div>
          <div className="board-alert-kind">
            Canonical quote + trade observations near the selected incident
          </div>
        </div>
      </header>
      {predictionSources.length === 0 ? (
        <p className="board-alert-reason">
          No persisted prediction-market observations in this window.
        </p>
      ) : (
        <ol className="board-alerts-timeline">
          {predictionSources.map((summary) => (
            <li key={summary.source}>
              <span className="board-alerts-timeline-time">
                {summary.source}
              </span>
              <span className="board-alerts-timeline-kind">
                {describePredictionSourceSummary(summary)}
              </span>
              <span className="board-alerts-timeline-reason">
                {summary.topRows
                  .slice(0, 2)
                  .map((row) => row.displayLabel)
                  .join(" · ") || "no highlighted markets"}
              </span>
              <span className="board-alerts-timeline-score">
                {summary.nearestOffsetSeconds == null
                  ? "no nearest row"
                  : formatOffset(summary.nearestOffsetSeconds)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PredictionMarketEvidenceSection({
  predictionSources,
}: {
  predictionSources: BoardAlertPredictionSourceSummary[];
}) {
  const rows = predictionSources.flatMap((summary) =>
    summary.topRows.slice(0, 4).map((row) => ({
      ...row,
      source: summary.source,
    }))
  );

  return (
    <section
      aria-label="Prediction-market evidence near selected incident"
      className="board-alert-card board-alert-card-hot"
    >
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">Prediction-market evidence</div>
          <div className="board-alert-kind">
            {describePredictionMarketContextSummary(predictionSources)}
          </div>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="board-alert-reason">
          No persisted prediction-market observations in this window.
        </p>
      ) : (
        <div className="board-alert-targets">
          <div className="board-alert-targets-head">
            <span>Source</span>
            <span>Kind</span>
            <span>Market</span>
            <span>Why it matters</span>
          </div>
          <ol className="board-alert-targets-body">
            {rows.slice(0, 8).map((row) => (
              <li key={row.observationId}>
                <span className="board-alert-target-source">{row.source}</span>
                <span className="board-alert-target-family">{row.kind}</span>
                <span className="board-alert-target-market">
                  {row.displayLabel}
                  <br />
                  <small>
                    {formatTimestampToSecond(row.eventTimestamp)} ·{" "}
                    {formatOffset(row.offsetSeconds)}
                    {row.kind === "trade"
                      ? ` · ${formatPercent(row.volumeShare)}`
                      : ""}
                  </small>
                </span>
                <span className="board-alert-target-why">
                  {describePredictionMarketContextRow(row)}
                  {row.kind === "trade" ? (
                    <>
                      <br />
                      <small>
                        ${formatPrice(row.tradePrice ?? row.impliedProbability)}
                        {" × "}
                        {formatNumber(row.tradeSize)} = $
                        {formatNumber(row.notional)}
                      </small>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export function NbaFeedSection({
  nearestPbp,
  pbp,
  pbpMissing,
}: {
  nearestPbp: BoardAlertPbpRowLike | null;
  pbp: BoardAlertPbpRow[];
  pbpMissing: boolean;
}) {
  return (
    <section
      aria-label="NBA feed around selected incident"
      className="board-alert-card"
    >
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">
            NBA feed around selected incident
          </div>
          <div className="board-alert-kind">
            {pbp.length} actions in ±30m{" "}
            {pbp.length === 0 ? "(persisted window empty)" : "(NBA stat feed)"}
          </div>
        </div>
      </header>
      {pbp.length === 0 ? (
        <p className="board-alert-reason">
          {nearestPbp
            ? "No NBA action row is persisted inside this exact ±30m window. The nearest persisted NBA feed row is shown above for broader game context."
            : pbpMissing
              ? "Persisted NBA play-by-play is missing for this game snapshot, so game-clock confirmation still needs NBA-side verification."
              : "No NBA action row is persisted inside this exact ±30m window."}
        </p>
      ) : (
        <ol className="board-alerts-timeline">
          {pbp.slice(0, 40).map((row) => (
            <li key={row.actionNumber}>
              <span className="board-alerts-timeline-time">
                {formatTimestampToSecond(row.timeActual)}
              </span>
              <span className="board-alerts-timeline-kind">
                {formatPbpGameClock(row) ?? row.clock ?? "clock n/a"}
              </span>
              <span className="board-alerts-timeline-reason">
                {row.description ?? "(no description)"}{" "}
                {row.teamTricode ? `· ${row.teamTricode}` : ""}
              </span>
              <span className="board-alerts-timeline-score">
                {row.offsetSeconds != null
                  ? formatOffset(row.offsetSeconds)
                  : "—"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ReplayFooter({ backToDeskPath }: { backToDeskPath: string }) {
  return (
    <footer className="board-alert-card-footer">
      <div className="board-alert-actions">
        <Link
          className="board-alert-action board-alert-action-secondary"
          to={backToDeskPath}
        >
          Back to desk
        </Link>
      </div>
    </footer>
  );
}
