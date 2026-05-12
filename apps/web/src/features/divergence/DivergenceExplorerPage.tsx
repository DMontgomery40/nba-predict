import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import {
  getDivergence,
  type DivergencePayload,
  type DivergenceQuery,
} from "../../data/api";
import { formatGapPoints } from "../../lib/market-format";
import { formatOperatorDateTime } from "../../lib/time-format";

const severityOptions = ["", "critical", "high", "medium", "low"] as const;
const freshnessOptions = [
  { label: "All", value: "" },
  { label: "Under 1m", value: "fresh" },
  { label: "1-5m", value: "aging" },
  { label: "Over 5m", value: "stale" },
  { label: "No quote", value: "offline" },
] as const;
const familyOptions = [
  { label: "All", value: "" },
  { label: "Moneyline", value: "moneyline" },
  { label: "Spread", value: "spread" },
  { label: "Total", value: "total" },
  { label: "Player props", value: "player-prop" },
  { label: "Team props", value: "team-prop" },
  { label: "Other", value: "other" },
] as const;
const mappedStateOptions = [
  { label: "All", value: "" },
  { label: "Matched", value: "comparable" },
  { label: "Line mismatch", value: "line-mismatch" },
  { label: "Selection mismatch", value: "selection-mismatch" },
  { label: "Unmapped", value: "unmapped" },
] as const;
const sortOptions = [
  { label: "Divergence", value: "divergence" },
  { label: "Board priority", value: "signalPriority" },
  { label: "Quote age", value: "freshness" },
  { label: "Last quote time", value: "captureRecency" },
  { label: "Line Mismatch", value: "lineMismatch" },
] as const;

function buildNextSearchParams(
  searchParams: URLSearchParams,
  updates: Record<string, string>
) {
  const next = new URLSearchParams(searchParams);

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }

  return next;
}

function buildSearchParams(values: Record<string, string>) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      next.set(key, value);
    }
  }

  return next;
}

function severityClass(severity: string) {
  switch (severity) {
    case "critical":
      return "sev-critical";
    case "high":
      return "sev-high";
    case "medium":
      return "sev-medium";
    default:
      return "sev-low";
  }
}

function sourceLabel(source: string) {
  switch (source) {
    case "bet365":
      return "Bet365";
    case "kalshi":
      return "Kalshi";
    case "polymarket":
      return "Polymarket";
    default:
      return source;
  }
}

function formatDuration(value?: number | null) {
  if (value == null || value <= 0) {
    return "none";
  }
  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }
  if (value < 60 * 60_000) {
    return `${Math.round(value / 60_000)}m`;
  }
  return `${(value / (60 * 60_000)).toFixed(1)}h`;
}

function marketTimingLabel(row: {
  comparableState: string;
  gameStatus?: string;
  inPlay: boolean;
}) {
  if (row.gameStatus === "final") {
    return "finished game";
  }
  if (row.gameStatus === "in-play") {
    return "game in progress";
  }
  if (row.gameStatus === "scheduled") {
    return "scheduled game";
  }
  return matchLabel(row.comparableState);
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

function rowPeakGap(row: DivergencePayload["data"][number]) {
  return row.comparisonSummary?.maxGap ?? row.impliedProbabilityGap ?? null;
}

function rowLatestGap(row: DivergencePayload["data"][number]) {
  return row.comparisonSummary?.latestGap ?? row.impliedProbabilityGap ?? null;
}

export function DivergenceExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: DivergenceQuery = {
    date: searchParams.get("date") ?? undefined,
    family:
      (searchParams.get("family") as DivergenceQuery["family"] | null) ??
      undefined,
    freshness:
      (searchParams.get("freshness") as DivergenceQuery["freshness"] | null) ??
      undefined,
    mappedState:
      (searchParams.get("mappedState") as
        | DivergenceQuery["mappedState"]
        | null) ?? undefined,
    severity:
      (searchParams.get("severity") as DivergenceQuery["severity"] | null) ??
      undefined,
    sort:
      (searchParams.get("sort") as DivergenceQuery["sort"] | null) ??
      "divergence",
  };

  const divergence = useQuery({
    queryKey: ["divergence", filters],
    queryFn: () => getDivergence(filters),
  });

  function updateFilters(updates: Record<string, string>) {
    setSearchParams(buildNextSearchParams(searchParams, updates));
  }

  function showAllPlayerProps() {
    setSearchParams(
      buildSearchParams({
        date: filters.date ?? "",
        family: "player-prop",
        sort: "divergence",
      })
    );
  }

  function resetFilters() {
    setSearchParams(
      buildSearchParams({
        date: filters.date ?? "",
        sort: "divergence",
      })
    );
  }

  const rows = divergence.data?.data ?? [];
  const rowSummary = !divergence.data
    ? divergence.isError
      ? "Comparisons unavailable"
      : "Loading comparisons"
    : `${rows.length} comparison${rows.length === 1 ? "" : "s"}`;
  const activeFilters = [
    filters.family,
    filters.severity,
    filters.freshness,
    filters.mappedState,
  ].filter(Boolean).length;
  const canResetFilters = activeFilters > 0 || filters.sort !== "divergence";

  return (
    <div className="divergence-surface">
      <div className="slate-header divergence-header">
        <div>
          <div className="eyebrow">Divergence</div>
          <h1>Instrument-first disagreement</h1>
          <div className="divergence-summary">
            <span>{rowSummary}</span>
            <span>
              {activeFilters} active filter{activeFilters === 1 ? "" : "s"}
            </span>
            {divergence.data?.meta.generatedAt ? (
              <span className="mono">
                loaded{" "}
                {formatOperatorDateTime(divergence.data.meta.generatedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="divergence-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={showAllPlayerProps}
          >
            Player prop comparisons
          </button>
          <button
            className="ghost-button"
            disabled={!canResetFilters}
            type="button"
            onClick={resetFilters}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="filter-strip">
        <label className="filter-inline" htmlFor="divergence-date">
          <span>slate date</span>
          <input
            id="divergence-date"
            type="date"
            value={filters.date ?? ""}
            onChange={(event) => updateFilters({ date: event.target.value })}
          />
        </label>
        <label className="filter-inline" htmlFor="divergence-family">
          <span>family</span>
          <select
            id="divergence-family"
            value={filters.family ?? ""}
            onChange={(event) => updateFilters({ family: event.target.value })}
          >
            {familyOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-inline" htmlFor="divergence-severity">
          <span>severity</span>
          <select
            id="divergence-severity"
            value={filters.severity ?? ""}
            onChange={(event) =>
              updateFilters({ severity: event.target.value })
            }
          >
            {severityOptions.map((o) => (
              <option key={o || "all"} value={o}>
                {o || "all"}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-inline" htmlFor="divergence-freshness">
          <span>quote age</span>
          <select
            id="divergence-freshness"
            value={filters.freshness ?? ""}
            onChange={(event) =>
              updateFilters({ freshness: event.target.value })
            }
          >
            {freshnessOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-inline" htmlFor="divergence-mapped-state">
          <span>market match</span>
          <select
            id="divergence-mapped-state"
            value={filters.mappedState ?? ""}
            onChange={(event) =>
              updateFilters({ mappedState: event.target.value })
            }
          >
            {mappedStateOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-inline" htmlFor="divergence-sort">
          <span>sort</span>
          <select
            id="divergence-sort"
            value={filters.sort ?? "divergence"}
            onChange={(event) => updateFilters({ sort: event.target.value })}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {divergence.isLoading ? (
        <div className="loading-panel">Loading persisted comparisons…</div>
      ) : divergence.isError ? (
        <div className="empty-row divergence-error">
          <strong>Failed to load divergence.</strong>
          <span>{(divergence.error as Error)?.message}</span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => void divergence.refetch()}
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-row divergence-empty">
          <strong>No persisted comparisons match this filter set.</strong>
          <span>
            Player props are shown when Bet365 has a same-time Kalshi or
            Polymarket comparison; stricter severity, quote-age, or match
            filters can hide them.
          </span>
          <div className="divergence-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={showAllPlayerProps}
            >
              Show player prop comparisons
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
        </div>
      ) : (
        <div className="divergence-table-shell">
          <table className="divergence-table">
            <thead>
              <tr>
                <th scope="col">Instrument</th>
                <th scope="col">Sources</th>
                <th className="num" scope="col">
                  Peak
                </th>
                <th className="num" scope="col">
                  Latest
                </th>
                <th className="num" scope="col">
                  Above Alert
                </th>
                <th scope="col">Match</th>
                <th scope="col">Severity</th>
                <th className="num" scope="col">
                  Priority
                </th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.gameId}:${row.instrumentId}`}>
                  <td className="divergence-instrument-cell">
                    <Link
                      className="matchup-link"
                      to={`/games/${row.gameId}/markets/${row.instrumentId}`}
                    >
                      {row.displayLabel}
                    </Link>
                    <span className="divergence-row-meta mono">
                      {marketTimingLabel(row)} · {row.family} ·{" "}
                      {formatOperatorDateTime(row.scheduledStart)}
                    </span>
                  </td>
                  <td>
                    <div className="source-pills">
                      {(row.sources ?? []).map((source) => (
                        <span className="source-pill" key={source}>
                          {sourceLabel(source)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="num mono">
                    <strong>{formatGapPoints(rowPeakGap(row))}</strong>
                    {row.comparisonSummary?.maxGapAt ? (
                      <em>
                        {formatOperatorDateTime(row.comparisonSummary.maxGapAt)}
                      </em>
                    ) : null}
                  </td>
                  <td className="num mono">
                    <strong>{formatGapPoints(rowLatestGap(row))}</strong>
                    {row.comparisonSummary?.latestComparisonAt ? (
                      <em>
                        {formatOperatorDateTime(
                          row.comparisonSummary.latestComparisonAt
                        )}
                      </em>
                    ) : null}
                  </td>
                  <td className="num mono">
                    <strong>
                      {formatDuration(
                        row.comparisonSummary?.aboveThresholdDurationMs
                      )}
                    </strong>
                    {row.comparisonSummary ? (
                      <em>
                        &gt;= {formatGapPoints(row.comparisonSummary.threshold)}
                      </em>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={`map-pill ${row.lineMismatch ? "map-pill-critical" : ""}`}
                    >
                      {matchLabel(row.comparableState)}
                    </span>
                  </td>
                  <td>
                    <span className={`sev-chip ${severityClass(row.severity)}`}>
                      {row.severity}
                    </span>
                  </td>
                  <td className="num mono muted">{row.signalPriority}</td>
                  <td>
                    <Link
                      className="row-open"
                      to={`/games/${row.gameId}/markets/${row.instrumentId}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
