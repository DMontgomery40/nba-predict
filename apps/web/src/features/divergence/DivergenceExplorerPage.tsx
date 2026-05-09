import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { getDivergence, type DivergenceQuery } from "../../data/api";

const severityOptions = ["", "critical", "high", "medium", "low"] as const;
const freshnessOptions = ["", "fresh", "aging", "stale", "offline"] as const;
const familyOptions = [
  "",
  "moneyline",
  "spread",
  "total",
  "player-prop",
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

  const rows = divergence.data?.data ?? [];

  return (
    <div className="divergence-surface">
      <div className="slate-header">
        <div>
          <div className="eyebrow">Divergence</div>
          <h1>Instrument-first disagreement</h1>
          <span className="muted">
            {rows.length} row{rows.length === 1 ? "" : "s"} · sort, filter, and
            drill in.
          </span>
        </div>
      </div>

      <div className="filter-strip">
        <label className="filter-inline">
          <span>family</span>
          <select
            value={filters.family ?? ""}
            onChange={(event) => updateFilters({ family: event.target.value })}
          >
            {familyOptions.map((o) => (
              <option key={o || "all"} value={o}>
                {o || "all"}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-inline">
          <span>severity</span>
          <select
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
        <label className="filter-inline">
          <span>freshness</span>
          <select
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
        <label className="filter-inline">
          <span>map</span>
          <select
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
        <label className="filter-inline">
          <span>sort</span>
          <select
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
        <div className="muted">Loading…</div>
      ) : divergence.isError ? (
        <div className="critical">
          Failed to load divergence. {(divergence.error as Error)?.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="muted">No rows match this filter set.</div>
      ) : (
        <div className="divergence-grid">
          <div className="div-row div-head">
            <span>Instrument</span>
            <span>Family</span>
            <span className="num">Gap</span>
            <span>Mapping</span>
            <span>Sev</span>
            <span className="num">Prio</span>
            <span />
          </div>
          {rows.map((row) => (
            <div className="div-row" key={`${row.gameId}:${row.instrumentId}`}>
              <span className="ellipsis">
                <Link
                  className="matchup-link"
                  to={`/games/${row.gameId}/markets/${row.instrumentId}`}
                >
                  {row.displayLabel}
                </Link>
              </span>
              <span className="muted mono">{row.family}</span>
              <span className="num mono">
                {row.impliedProbabilityGap == null
                  ? "—"
                  : `${(row.impliedProbabilityGap * 100).toFixed(1)}%`}
              </span>
              <span
                className={`mono ${row.lineMismatch ? "critical" : "muted"}`}
              >
                {row.comparableState}
              </span>
              <span className={`sev-chip ${severityClass(row.severity)}`}>
                {row.severity}
              </span>
              <span className="num mono muted">{row.signalPriority}</span>
              <Link
                className="row-open"
                to={`/games/${row.gameId}/markets/${row.instrumentId}`}
              >
                ↗
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
