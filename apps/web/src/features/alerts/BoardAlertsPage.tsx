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
} from "../../data/api";

function localIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateToUtcDates(localDate: string): string[] {
  const [yy, mm, dd] = localDate.split("-").map((part) => Number(part));
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
  const end = new Date(yy, mm - 1, dd, 23, 59, 59, 999);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  if (startDate === endDate) return [startDate];
  return [startDate, endDate];
}

function tradeMetricsFromAlert(alert: BoardAnomalyAlertDto): {
  share: number | null;
  notional: number | null;
  price: number | null;
  size: number | null;
  label: string;
} {
  const evidence = alert.evidence[0];
  const labelFromEvidence =
    evidence?.displayLabel ?? alert.reason.split(" (")[0] ?? "";
  const reasonMatch = alert.reason;
  const sharePctMatch = reasonMatch.match(/([\d.]+)%\s+volume share/);
  const tradeMatch = reasonMatch.match(/trade\s+([\d.]+)/);
  const sizeMatch = reasonMatch.match(/size\s+([\d.]+)/);
  const notionalMatch = reasonMatch.match(/notional\s+\$([\d.]+)/);
  return {
    share: sharePctMatch ? Number(sharePctMatch[1]) / 100 : null,
    notional: notionalMatch ? Number(notionalMatch[1]) : null,
    price: tradeMatch ? Number(tradeMatch[1]) : null,
    size: sizeMatch ? Number(sizeMatch[1]) : null,
    label: labelFromEvidence,
  };
}

type Mode = "live" | "historic";

type IncidentRow = {
  alert: BoardAnomalyAlertDto;
  pbp: BoardIncidentDto["playByPlay"] | null;
};

function FanoutCard({ alert }: { alert: BoardAnomalyAlertDto }) {
  const evidence = alert.evidence.slice(0, 6);
  return (
    <article className="board-shock-fanout" aria-label={alert.gameLabel}>
      <header className="board-shock-fanout-head">
        <div>
          <div className="eyebrow">
            {alert.gameLabel} · Attribution-shaped board shock
          </div>
          <h2>
            {alert.primaryEntityKey
              ? alert.primaryEntityKey
                  .split(/[\s-]/)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")
              : "Multi-market fanout"}
          </h2>
        </div>
        <div className="board-shock-fanout-when">
          {new Date(alert.firstPopAt).toLocaleString("en-US", {
            day: "numeric",
            hour: "numeric",
            hour12: true,
            minute: "2-digit",
            month: "short",
            second: "2-digit",
            timeZoneName: "short",
          })}
        </div>
      </header>
      <p className="board-shock-fanout-prose">{alert.reason}</p>
      <ul className="board-shock-fanout-evidence">
        {evidence.map((row) => (
          <li key={row.observationId}>
            <span className="board-shock-fanout-label">{row.displayLabel}</span>
            <span className="board-shock-fanout-reason">{row.reason}</span>
          </li>
        ))}
      </ul>
      {alert.missingDataNotes.length > 0 ? (
        <p className="board-shock-fanout-missing">
          {alert.missingDataNotes
            .map((note) => `${note.source}: ${note.reason}`)
            .join(" · ")}
        </p>
      ) : null}
      <footer className="board-shock-fanout-foot">
        <Link
          to={`/board-alerts/${encodeURIComponent(alert.gameId)}?at=${encodeURIComponent(alert.firstPopAt)}&label=${encodeURIComponent(alert.gameLabel)}`}
        >
          Inspect →
        </Link>
      </footer>
    </article>
  );
}

function VigCalloutCard({ rows }: { rows: IncidentRow[] }) {
  const withVig = rows.find(
    (row) =>
      (
        row as IncidentRow & {
          alert: BoardAnomalyAlertDto & {
            vigAdjusted?: BoardIncidentDto["vigAdjusted"];
          };
        }
      ).alert.vigAdjusted &&
      ((
        row as IncidentRow & {
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
      className="board-shock-vig-callout"
      aria-label="Vig-adjusted disagreement"
    >
      <header>
        <span className="eyebrow">{incident.gameLabel}</span>
        <h2>{incident.reason.split(":")[0]}</h2>
      </header>
      <div className="board-shock-vig-grid">
        <div>
          <span className="metric-label">Raw ask-vs-ask</span>
          <span className="board-shock-vig-raw">{raw}pp</span>
        </div>
        <div>
          <span className="metric-label">Vig-adjusted (real)</span>
          <span className="board-shock-vig-fair">{fair}pp</span>
        </div>
      </div>
      <p className="board-shock-vig-read">{incident.vigAdjusted.honestRead}</p>
      <Link
        className="board-shock-vig-inspect"
        to={`/board-alerts/${encodeURIComponent(incident.gameId)}?at=${encodeURIComponent(incident.firstPopAt)}&label=${encodeURIComponent(incident.gameLabel)}`}
      >
        Inspect →
      </Link>
    </section>
  );
}

export function BoardAlertsPage() {
  const [mode, setMode] = useState<Mode>("live");
  const [date, setDate] = useState<string>(localIsoDate());

  const liveQuery = useQuery({
    enabled: mode === "live",
    queryFn: () => getBoardAlerts({ limit: 20 }),
    queryKey: ["board-alerts", "live"],
    refetchInterval: 10_000,
  });

  const utcDates = useMemo(() => localDateToUtcDates(date), [date]);
  const incidentsQuery0 = useQuery({
    enabled: mode === "historic" && utcDates.length >= 1,
    queryFn: () => getBoardIncidents({ date: utcDates[0], limit: 20 }),
    queryKey: ["board-alerts", "incidents", utcDates[0]],
  });
  const incidentsQuery1 = useQuery({
    enabled: mode === "historic" && utcDates.length === 2,
    queryFn: () => getBoardIncidents({ date: utcDates[1]!, limit: 20 }),
    queryKey: ["board-alerts", "incidents", utcDates[1] ?? ""],
  });

  const allRows: IncidentRow[] = useMemo(() => {
    if (mode === "live") {
      const items = liveQuery.data?.data ?? [];
      return items.map((alert) => ({ alert, pbp: null }));
    }
    const a = incidentsQuery0.data?.data ?? [];
    const b = incidentsQuery1.data?.data ?? [];
    const merged = [...a, ...b];
    const seen = new Set<string>();
    return merged
      .filter((incident) => {
        if (seen.has(incident.id)) return false;
        seen.add(incident.id);
        return true;
      })
      .map((incident) => ({ alert: incident, pbp: incident.playByPlay }));
  }, [mode, liveQuery.data, incidentsQuery0.data, incidentsQuery1.data]);

  const isLoading =
    mode === "live"
      ? liveQuery.isLoading
      : incidentsQuery0.isLoading || incidentsQuery1.isLoading;
  const isError =
    mode === "live"
      ? liveQuery.isError
      : incidentsQuery0.isError || incidentsQuery1.isError;

  const grouped = useMemo(() => {
    const map = new Map<string, IncidentRow[]>();
    for (const row of allRows) {
      const list = map.get(row.alert.gameLabel) ?? [];
      list.push(row);
      map.set(row.alert.gameLabel, list);
    }
    for (const list of map.values()) {
      list.sort((aRow, bRow) => {
        const aT = tradeMetricsFromAlert(aRow.alert);
        const bT = tradeMetricsFromAlert(bRow.alert);
        if ((bT.notional ?? 0) !== (aT.notional ?? 0))
          return (bT.notional ?? 0) - (aT.notional ?? 0);
        return (bT.share ?? 0) - (aT.share ?? 0);
      });
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aTop = tradeMetricsFromAlert(a[1][0].alert).notional ?? 0;
      const bTop = tradeMetricsFromAlert(b[1][0].alert).notional ?? 0;
      return bTop - aTop;
    });
  }, [allRows]);

  return (
    <PageFrame>
      <Panel className="board-shock-shell" aria-label="Board shocks desk">
        <header className="board-shock-page-header">
          <div>
            <div className="eyebrow">Board anomaly desk</div>
            <h1>NBA board shocks</h1>
          </div>
          <div className="board-shock-controls">
            <div className="board-shock-mode" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "live"}
                className={
                  mode === "live"
                    ? "board-shock-mode-button board-shock-mode-on"
                    : "board-shock-mode-button"
                }
                onClick={() => setMode("live")}
              >
                Live
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "historic"}
                className={
                  mode === "historic"
                    ? "board-shock-mode-button board-shock-mode-on"
                    : "board-shock-mode-button"
                }
                onClick={() => setMode("historic")}
              >
                Historic
              </button>
            </div>
            {mode === "historic" ? (
              <label className="board-shock-date">
                <span className="metric-label">Local date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        </header>
        {isLoading ? (
          <div className="board-shock-empty">Loading desk…</div>
        ) : isError ? (
          <div className="board-shock-empty board-shock-empty-error">
            Could not load desk.
          </div>
        ) : grouped.length === 0 ? (
          <div className="board-shock-empty">
            {mode === "live"
              ? "No active board shocks."
              : `No persisted shocks for ${date}.`}
          </div>
        ) : (
          <>
            <VigCalloutCard rows={allRows} />
            {(() => {
              const oneCardPerGame = new Map<string, IncidentRow>();
              for (const row of allRows) {
                const existing = oneCardPerGame.get(row.alert.gameLabel);
                if (!existing) {
                  oneCardPerGame.set(row.alert.gameLabel, row);
                  continue;
                }
                const preferAttribution =
                  row.alert.shockKind === "attribution-shaped" &&
                  existing.alert.shockKind !== "attribution-shaped";
                const higherScore = row.alert.score > existing.alert.score;
                if (
                  preferAttribution ||
                  (existing.alert.shockKind === row.alert.shockKind &&
                    higherScore)
                ) {
                  oneCardPerGame.set(row.alert.gameLabel, row);
                }
              }
              const ordered = Array.from(oneCardPerGame.values()).sort(
                (a, b) => b.alert.score - a.alert.score
              );
              return ordered
                .slice(0, mode === "live" ? 5 : 8)
                .map((row) => (
                  <FanoutCard key={row.alert.id} alert={row.alert} />
                ));
            })()}
          </>
        )}
      </Panel>
    </PageFrame>
  );
}
