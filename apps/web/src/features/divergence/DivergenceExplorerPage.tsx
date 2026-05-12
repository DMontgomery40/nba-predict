import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { getDivergence, type DivergenceQuery } from "../../data/api";

const severityOptions = ["", "critical", "high", "medium", "low"] as const;
const freshnessOptions = ["", "fresh", "aging", "stale", "offline"] as const;
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
  "",
  "comparable",
  "line-mismatch",
  "unmapped",
] as const;
const sortOptions = [
  { label: "Divergence", value: "divergence" },
  { label: "Signal Priority", value: "signalPriority" },
  { label: "Freshness", value: "freshness" },
  { label: "Capture Recency", value: "captureRecency" },
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

export function DivergenceExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: DivergenceQuery = {
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
        family: "player-prop",
        sort: "divergence",
      })
    );
  }

  function resetFilters() {
    setSearchParams(
      buildSearchParams({
        sort: "divergence",
      })
    );
  }

  const rows = divergence.data?.data ?? [];
  const rowSummary = !divergence.data
    ? divergence.isError
      ? "Rows unavailable"
      : "Loading rows"
    : `${rows.length} row${rows.length === 1 ? "" : "s"}`;
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
                API{" "}
                {new Date(
                  divergence.data.meta.generatedAt
                ).toLocaleTimeString()}
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
          <span>freshness</span>
          <select
            id="divergence-freshness"
            value={filters.freshness ?? ""}
            onChange={(event) =>
              updateFilters({ freshness: event.target.value })
            }
          >
            {freshnessOptions.map((o) => (
              <option key={o || "all"} value={o}>
                {o || "all"}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-inline" htmlFor="divergence-mapped-state">
          <span>state</span>
          <select
            id="divergence-mapped-state"
            value={filters.mappedState ?? ""}
            onChange={(event) =>
              updateFilters({ mappedState: event.target.value })
            }
          >
            {mappedStateOptions.map((o) => (
              <option key={o || "all"} value={o}>
                {o || "all"}
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
        <div className="loading-panel">Loading divergence from the API…</div>
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
          <strong>No DB rows match this filter set.</strong>
          <span>
            Player props are shown when Bet365 has at least one comparison
            provider; stricter severity, freshness, or state filters can hide
            them.
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
                <th scope="col">Family</th>
                <th scope="col">Sources</th>
                <th className="num" scope="col">
                  Gap
                </th>
                <th scope="col">Mapping</th>
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
                      {row.inPlay ? "live" : "pregame"} · {row.gameId}
                    </span>
                  </td>
                  <td className="mono muted">{row.family}</td>
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
                    {row.impliedProbabilityGap == null
                      ? "—"
                      : `${(row.impliedProbabilityGap * 100).toFixed(1)}%`}
                  </td>
                  <td>
                    <span
                      className={`map-pill ${row.lineMismatch ? "map-pill-critical" : ""}`}
                    >
                      {row.comparableState}
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
