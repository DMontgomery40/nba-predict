import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import {
  getBoardAlerts,
  getBoardIncidents,
  type BoardAnomalyAlertDto,
  type BoardIncidentDto,
  type BoardIncidentPbpAnchor,
} from "../../data/api";

const SHOCK_KIND_LABEL: Record<BoardAnomalyAlertDto["shockKind"], string> = {
  "pregame-availability": "Pregame availability shock",
  "near-tip-availability": "Near-tip availability shock",
  "attribution-shaped": "Attribution-shaped board shock",
  "market-structure": "Market-structure shock",
  "cross-surface-disagreement": "Cross-surface disagreement",
  "coverage-gap": "Coverage / mapping / timing gap",
};

function todayIsoDate(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestampToTheSecond(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso ?? "—";
  const dateStr = date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZoneName: "short",
    year: "numeric",
  });
  return dateStr;
}

function formatOffsetSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const abs = Math.abs(seconds);
  const sign = seconds >= 0 ? "+" : "-";
  if (abs < 60) return `T${sign}${abs}s`;
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  if (abs < 3600) return `T${sign}${mins}m${String(secs).padStart(2, "0")}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `T${sign}${hours}h${String(remMins).padStart(2, "0")}m${String(secs).padStart(2, "0")}s`;
}

type PbpLineProps = {
  context: BoardIncidentDto["playByPlay"] | null;
};

function PlayByPlayLine({ context }: PbpLineProps) {
  if (!context) {
    return (
      <div className="board-alert-pbp">
        <span className="metric-label">PBP context</span> not loaded
      </div>
    );
  }
  if (!context.available) {
    return (
      <div className="board-alert-pbp board-alert-pbp-missing">
        <span className="metric-label">PBP context</span> no play-by-play
        captured for this game — pregame or coverage gap; no in-game anchor
        available
      </div>
    );
  }
  const before = context.nearestBefore;
  const after = context.nearestAfter;
  const render = (anchor: BoardIncidentPbpAnchor | null, label: string) => {
    if (!anchor) return null;
    const offset = formatOffsetSeconds(anchor.offsetSeconds);
    const periodClock =
      anchor.period && anchor.clock
        ? `${anchor.clock} ${anchor.period}Q`
        : (anchor.clock ?? "");
    const team = anchor.teamTricode ? ` · ${anchor.teamTricode}` : "";
    return (
      <div
        className="board-alert-pbp-line"
        key={`${label}-${anchor.actionNumber}`}
      >
        <span className="metric-label">{label}</span>
        <span className="board-alert-pbp-time">
          {offset} {periodClock}
        </span>
        <span className="board-alert-pbp-desc">
          {anchor.description ?? anchor.actionType ?? "(no description)"}
          {team}
        </span>
      </div>
    );
  };
  return (
    <div className="board-alert-pbp">
      {render(before, "Nearest play before")}
      {render(after, "Nearest play after")}
      {before == null && after == null ? (
        <span>
          PBP captured ({context.totalActions} actions) but no time-anchored row
          matched.
        </span>
      ) : null}
    </div>
  );
}

type CardProps = {
  alert: BoardAnomalyAlertDto;
  pbp: BoardIncidentDto["playByPlay"] | null;
  vig: BoardIncidentDto["vigAdjusted"] | null;
  isPrimary: boolean;
};

function VigAdjustedSection({
  vig,
}: {
  vig: BoardIncidentDto["vigAdjusted"] | null;
}) {
  if (!vig) {
    return (
      <div className="board-alert-vig board-alert-vig-missing">
        <span className="metric-label">Vig-adjusted</span> not computed
        (single-sided market or insufficient quotes to pair). Raw ask-vs-ask gap
        may overstate the real disagreement by ~4–8pp on bookmaker rows.
      </div>
    );
  }
  const rawPp = (vig.rawGap * 100).toFixed(1);
  const fairPp = vig.fairGap == null ? null : (vig.fairGap * 100).toFixed(1);
  return (
    <div className="board-alert-vig">
      <div className="board-alert-vig-row">
        <span className="metric-label">Raw (ask-vs-ask)</span>
        <span className="board-alert-vig-value">{rawPp}pp</span>
      </div>
      <div className="board-alert-vig-row">
        <span className="metric-label">Vig-adjusted</span>
        <span className="board-alert-vig-value">
          {fairPp == null ? "—" : `${fairPp}pp`}
        </span>
      </div>
      <p className="board-alert-vig-read">{vig.honestRead}</p>
      <ul className="board-alert-vig-sides">
        {vig.sides.map((side) => (
          <li key={side.source}>
            <span className="board-alert-vig-source">{side.source}</span>
            <span className="board-alert-vig-side-note">{side.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardAlertProseCard({ alert, pbp, vig, isPrimary }: CardProps) {
  return (
    <article
      aria-label={`${alert.gameLabel} ${SHOCK_KIND_LABEL[alert.shockKind]}`}
      className={`board-alert-card board-alert-card-${alert.severity}${
        isPrimary ? " board-alert-card-primary" : ""
      }`}
    >
      <header className="board-alert-card-header">
        <div>
          <div className="board-alert-game">{alert.gameLabel}</div>
          <div className="board-alert-kind">
            {SHOCK_KIND_LABEL[alert.shockKind]}
          </div>
        </div>
        <div className="board-alert-time" aria-label="first pop time">
          <div className="metric-label">First pop (to the second)</div>
          <div>{formatTimestampToTheSecond(alert.firstPopAt)}</div>
        </div>
      </header>
      <p className="board-alert-reason">{alert.reason}</p>
      <VigAdjustedSection vig={vig} />
      <PlayByPlayLine context={pbp} />
      <div className="board-alert-evidence-grid">
        <div>
          <div className="metric-label">Score</div>
          <div className="metric-value">{alert.score}</div>
        </div>
        <div>
          <div className="metric-label">Confidence</div>
          <div className="metric-value">
            {(alert.confidence * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="metric-label">Residual after H0</div>
          <div className="metric-value">
            {(alert.components.residual * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="metric-label">Coherence</div>
          <div className="metric-value">
            {(alert.components.coherence * 100).toFixed(0)}%
          </div>
        </div>
      </div>
      {alert.evidence.length > 0 ? (
        <section className="board-alert-evidence">
          <div className="metric-label">
            Top evidence ({alert.evidence.length} rows)
          </div>
          <ul className="board-alert-evidence-list">
            {alert.evidence.slice(0, 5).map((row) => (
              <li key={row.observationId}>
                <span className="board-alert-evidence-label">
                  {row.displayLabel}
                </span>
                <span className="board-alert-evidence-source">
                  {row.source}
                  {row.evidenceUnmapped ? " · unmapped" : ""}
                </span>
                <span className="board-alert-evidence-reason">
                  {row.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {alert.missingDataNotes.length > 0 ? (
        <div className="board-alert-missing">
          <span className="metric-label">Missing data</span>{" "}
          {alert.missingDataNotes
            .map((note) => `${note.source}: ${note.reason}`)
            .join(" · ")}
        </div>
      ) : null}
      {alert.h0Adjustments.drivers.length > 0 ? (
        <div className="board-alert-h0">
          <span className="metric-label">H0 notes</span>{" "}
          {alert.h0Adjustments.drivers.join(" · ")}
        </div>
      ) : null}
      <footer className="board-alert-card-footer">
        <div className="board-alert-actions">
          <Link
            className="board-alert-action board-alert-action-primary"
            to={`/board-alerts/${encodeURIComponent(alert.gameId)}?at=${encodeURIComponent(alert.firstPopAt)}&label=${encodeURIComponent(alert.gameLabel)}`}
          >
            Inspect game timeline
          </Link>
        </div>
      </footer>
    </article>
  );
}

type Mode = "live" | "historic";

export function BoardAlertsPage() {
  const [mode, setMode] = useState<Mode>("historic");
  const [date, setDate] = useState<string>(todayIsoDate());

  const liveQuery = useQuery({
    enabled: mode === "live",
    queryFn: () => getBoardAlerts({ limit: 8 }),
    queryKey: ["board-alerts", "live"],
    refetchInterval: 10_000,
  });

  const incidentsQuery = useQuery({
    enabled: mode === "historic",
    queryFn: () => getBoardIncidents({ date, limit: 10 }),
    queryKey: ["board-alerts", "incidents", date],
  });

  const cards = useMemo(() => {
    if (mode === "live") {
      const items = liveQuery.data?.data ?? [];
      return items.map((alert) => ({ alert, pbp: null, vig: null }));
    }
    const items = incidentsQuery.data?.data ?? [];
    return items.map((incident) => ({
      alert: incident,
      pbp: incident.playByPlay,
      vig: incident.vigAdjusted,
    }));
  }, [mode, liveQuery.data, incidentsQuery.data]);

  const isLoading =
    mode === "live" ? liveQuery.isLoading : incidentsQuery.isLoading;
  const isError = mode === "live" ? liveQuery.isError : incidentsQuery.isError;

  const primary = cards[0] ?? null;
  const secondary = cards.slice(1, 5);

  return (
    <PageFrame>
      <Panel className="board-alerts-shell" aria-label="Board alerts">
        <header className="board-alerts-header">
          <div className="eyebrow">Board anomaly desk</div>
          <h1>NBA board shocks</h1>
          <p>
            One alert at a time. When, what, vs what, fanout, PBP context. H0
            normal market dynamics suppressed before scoring.
          </p>
        </header>
        <div className="board-alerts-controls">
          <div className="board-alerts-mode" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "live"}
              className={`board-alert-action ${mode === "live" ? "board-alert-action-primary" : "board-alert-action-secondary"}`}
              onClick={() => setMode("live")}
            >
              Live (now)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "historic"}
              className={`board-alert-action ${mode === "historic" ? "board-alert-action-primary" : "board-alert-action-secondary"}`}
              onClick={() => setMode("historic")}
            >
              Historic incident (date)
            </button>
          </div>
          {mode === "historic" ? (
            <label className="board-alerts-date">
              <span className="metric-label">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        {isLoading ? (
          <div className="board-alerts-empty">Loading board state…</div>
        ) : isError ? (
          <div className="board-alerts-empty board-alerts-empty-error">
            Could not load board alerts.
          </div>
        ) : !primary ? (
          <div className="board-alerts-empty">
            {mode === "live"
              ? "No board shock above threshold right now."
              : `No persisted board incidents found for ${date} above the 15pp gap floor.`}
          </div>
        ) : (
          <div className="board-alerts-deck">
            <BoardAlertProseCard
              alert={primary.alert}
              pbp={primary.pbp}
              vig={primary.vig}
              isPrimary
            />
            {secondary.length > 0 ? (
              <section
                aria-label="Other board incidents"
                className="board-alerts-secondary"
              >
                <div className="eyebrow">
                  Other persisted incidents on this date
                </div>
                {secondary.map((card) => (
                  <BoardAlertProseCard
                    key={card.alert.id}
                    alert={card.alert}
                    pbp={card.pbp}
                    vig={card.vig}
                    isPrimary={false}
                  />
                ))}
              </section>
            ) : null}
          </div>
        )}
      </Panel>
    </PageFrame>
  );
}
