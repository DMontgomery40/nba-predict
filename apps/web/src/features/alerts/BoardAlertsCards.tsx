import { Link } from "react-router-dom";

import {
  BOARD_ALERT_KIND_LABELS,
  boardAlertTitle,
  buildBoardAlertInspectPath,
  formatBoardAlertCardTime,
  type BoardAlertIncidentRow,
} from "./boardAlertReview";

import type { BoardAnomalyAlertDto, BoardIncidentDto } from "../../data/api";

export function BoardAlertCard({
  alert,
  dateParam,
}: {
  alert: BoardAnomalyAlertDto;
  dateParam?: string | null;
}) {
  const evidence = alert.evidence.slice(0, 6);
  return (
    <article className="trader-incident-card" aria-label={alert.gameLabel}>
      <header className="trader-incident-card-head">
        <div>
          <div className="eyebrow">
            {alert.gameLabel} · {BOARD_ALERT_KIND_LABELS[alert.shockKind]}
          </div>
          <h2>{boardAlertTitle(alert)}</h2>
        </div>
        <div className="trader-incident-card-when">
          {formatBoardAlertCardTime(alert)}
        </div>
      </header>
      <p className="trader-incident-card-prose">{alert.reason}</p>
      <ul className="trader-incident-card-evidence">
        {evidence.map((row) => (
          <li key={row.observationId}>
            <span className="trader-incident-card-label">
              {row.displayLabel}
            </span>
            <span className="trader-incident-card-reason">{row.reason}</span>
          </li>
        ))}
      </ul>
      {alert.missingDataNotes.length > 0 ? (
        <p className="trader-incident-card-missing">
          {alert.missingDataNotes
            .map((note) => `${note.source}: ${note.reason}`)
            .join(" · ")}
        </p>
      ) : null}
      <footer className="trader-incident-card-foot">
        <Link to={buildBoardAlertInspectPath(alert, dateParam)}>Inspect →</Link>
      </footer>
    </article>
  );
}

export function VigCalloutCard({
  rows,
  dateParam,
}: {
  rows: BoardAlertIncidentRow[];
  dateParam?: string | null;
}) {
  const withVig = rows.find(
    (row) =>
      (
        row as BoardAlertIncidentRow & {
          alert: BoardAnomalyAlertDto & {
            vigAdjusted?: BoardIncidentDto["vigAdjusted"];
          };
        }
      ).alert.vigAdjusted &&
      ((
        row as BoardAlertIncidentRow & {
          alert: BoardAnomalyAlertDto & {
            vigAdjusted?: BoardIncidentDto["vigAdjusted"];
          };
        }
      ).alert.vigAdjusted?.fairGap ?? 0) > 0
  );
  if (!withVig) return null;
  const incident = withVig.alert as BoardAnomalyAlertDto & {
    vigAdjusted: NonNullable<BoardIncidentDto["vigAdjusted"]>;
  };
  const raw = (incident.vigAdjusted.rawGap * 100).toFixed(1);
  const fair = (incident.vigAdjusted.fairGap! * 100).toFixed(1);
  return (
    <section
      className="trader-incident-vig-callout"
      aria-label="Vig-adjusted disagreement"
    >
      <header>
        <span className="eyebrow">{incident.gameLabel}</span>
        <h2>{incident.reason.split(":")[0]}</h2>
      </header>
      <div className="trader-incident-vig-grid">
        <div>
          <span className="metric-label">Raw ask-vs-ask</span>
          <span className="trader-incident-vig-raw">{raw}pp</span>
        </div>
        <div>
          <span className="metric-label">Vig-adjusted (real)</span>
          <span className="trader-incident-vig-fair">{fair}pp</span>
        </div>
      </div>
      <p className="trader-incident-vig-read">
        {incident.vigAdjusted.honestRead}
      </p>
      <Link
        className="trader-incident-vig-inspect"
        to={buildBoardAlertInspectPath(incident, dateParam)}
      >
        Inspect →
      </Link>
    </section>
  );
}
