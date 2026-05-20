import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  isDateInputValue,
  pickPrimaryLiveIncidentRows,
  utcIsoDate,
  type BoardAlertIncidentRow,
} from "./boardAlertReview";
import { BoardAlertCard, VigCalloutCard } from "./BoardAlertsCards";
import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import { getBoardAlerts, getBoardIncidents } from "../../data/api";

type Mode = "live" | "historic";

export function BoardAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    isDateInputValue(searchParams.get("date")) ? "historic" : "live"
  );
  const [dateInput, setDateInput] = useState<string>(() => {
    const paramDate = searchParams.get("date");
    return isDateInputValue(paramDate) ? paramDate : utcIsoDate();
  });

  useEffect(() => {
    const paramDate = searchParams.get("date");
    if (!isDateInputValue(paramDate)) return;
    setMode("historic");
    setDateInput((current) => (current === paramDate ? current : paramDate));
  }, [searchParams]);

  function setHistoricDateParam(nextDate: string | null) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextDate && isDateInputValue(nextDate)) {
      nextParams.set("date", nextDate);
    } else {
      nextParams.delete("date");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function showLiveMode() {
    setMode("live");
    setHistoricDateParam(null);
  }

  function showHistoricMode() {
    setMode("historic");
    if (isDateInputValue(dateInput)) {
      setHistoricDateParam(dateInput);
      return;
    }
    const fallbackDate = utcIsoDate();
    setDateInput(fallbackDate);
    setHistoricDateParam(fallbackDate);
  }

  function updateHistoricDate(nextDate: string) {
    setDateInput(nextDate);
    setHistoricDateParam(nextDate);
  }

  const liveQuery = useQuery({
    enabled: mode === "live",
    queryFn: () => getBoardAlerts({ limit: 20 }),
    queryKey: ["board-alerts", "live"],
    refetchInterval: 10_000,
  });

  const selectedHistoricDate = isDateInputValue(dateInput) ? dateInput : null;
  const incidentsQuery = useQuery({
    enabled: mode === "historic" && selectedHistoricDate != null,
    queryFn: () =>
      getBoardIncidents({ date: selectedHistoricDate!, limit: 50 }),
    queryKey: ["board-alerts", "incidents", selectedHistoricDate ?? ""],
  });

  const allRows: BoardAlertIncidentRow[] = useMemo(() => {
    if (mode === "live") {
      const items = liveQuery.data?.data ?? [];
      return items.map((alert) => ({ alert, pbp: null }));
    }
    return (incidentsQuery.data?.data ?? []).map((incident) => ({
      alert: incident,
      pbp: incident.playByPlay,
    }));
  }, [mode, liveQuery.data, incidentsQuery.data]);

  const isLoading =
    mode === "live" ? liveQuery.isLoading : incidentsQuery.isLoading;
  const isError = mode === "live" ? liveQuery.isError : incidentsQuery.isError;

  const livePrimaryRows = useMemo(
    () => pickPrimaryLiveIncidentRows(allRows).slice(0, 5),
    [allRows]
  );
  const historicRows = useMemo(
    () =>
      allRows
        .slice()
        .sort((a, b) => {
          const timeDelta =
            Date.parse(a.alert.firstPopAt) - Date.parse(b.alert.firstPopAt);
          if (timeDelta !== 0) {
            return timeDelta;
          }
          return b.alert.score - a.alert.score;
        })
        .slice(0, 50),
    [allRows]
  );

  return (
    <PageFrame>
      <Panel
        className="trader-incident-shell"
        aria-label="Trader incidents desk"
      >
        <header className="trader-incident-page-header">
          <div>
            <div className="eyebrow">Trader incident desk</div>
            <h1>NBA trader incidents</h1>
          </div>
          <div className="trader-incident-controls">
            <div className="trader-incident-mode" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "live"}
                className={
                  mode === "live"
                    ? "trader-incident-mode-button trader-incident-mode-on"
                    : "trader-incident-mode-button"
                }
                onClick={showLiveMode}
              >
                Live
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "historic"}
                className={
                  mode === "historic"
                    ? "trader-incident-mode-button trader-incident-mode-on"
                    : "trader-incident-mode-button"
                }
                onClick={showHistoricMode}
              >
                Historic
              </button>
            </div>
            {mode === "historic" ? (
              <label className="trader-incident-date">
                <span className="metric-label">Research date (UTC)</span>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(event) => updateHistoricDate(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        </header>
        {isLoading ? (
          <div className="trader-incident-empty">Loading desk…</div>
        ) : isError ? (
          <div className="trader-incident-empty trader-incident-empty-error">
            Could not load desk.
          </div>
        ) : allRows.length === 0 ? (
          <div className="trader-incident-empty">
            {mode === "live"
              ? "No active trader incidents."
              : selectedHistoricDate == null
                ? "Choose a valid research date."
                : `No persisted incidents for ${selectedHistoricDate}.`}
          </div>
        ) : (
          <>
            <VigCalloutCard
              rows={allRows}
              dateParam={mode === "historic" ? selectedHistoricDate : null}
            />
            {(mode === "live" ? livePrimaryRows : historicRows).map((row) => (
              <BoardAlertCard
                key={row.alert.id}
                alert={row.alert}
                dateParam={mode === "historic" ? selectedHistoricDate : null}
              />
            ))}
          </>
        )}
      </Panel>
    </PageFrame>
  );
}
