import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
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

  if (divergence.isLoading || (!divergence.data && !divergence.isError)) {
    return <LoadingState message="Loading divergence explorer…" />;
  }

  if (divergence.isError || !divergence.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Fallback" title="Explorer unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The divergence explorer query failed."
          error={divergence.error}
          onAction={() => void divergence.refetch()}
          title="Divergence data failed to load"
        />
      </PageFrame>
    );
  }

  function updateFilters(updates: Record<string, string>) {
    setSearchParams(buildNextSearchParams(searchParams, updates));
  }

  const rows = divergence.data.data;

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Explorer Focus"
            title={rows[0]?.displayLabel ?? "No visible rows"}
            body={
              rows[0]
                ? `${rows[0].family} · ${rows[0].severity} · ${rows[0].comparableState}`
                : "Adjust the filters or wait for more live capture."
            }
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Divergence Explorer</div>
          <h1>Instrument-first disagreement</h1>
          <p>
            Rank live instruments by implied-probability gap, freshness, and
            line-alignment status.
          </p>
        </div>
      </section>

      <Panel>
        <SectionTitle eyebrow="Filters" title="Shareable live explorer state" />
        <div className="filter-grid">
          <label className="filter-field">
            <span>Family</span>
            <select
              className="filter-select"
              value={filters.family ?? ""}
              onChange={(event) =>
                updateFilters({ family: event.target.value })
              }
            >
              {familyOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All families"}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Severity</span>
            <select
              className="filter-select"
              value={filters.severity ?? ""}
              onChange={(event) =>
                updateFilters({ severity: event.target.value })
              }
            >
              {severityOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All severities"}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Freshness</span>
            <select
              className="filter-select"
              value={filters.freshness ?? ""}
              onChange={(event) =>
                updateFilters({ freshness: event.target.value })
              }
            >
              {freshnessOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All freshness"}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Mapping</span>
            <select
              className="filter-select"
              value={filters.mappedState ?? ""}
              onChange={(event) =>
                updateFilters({ mappedState: event.target.value })
              }
            >
              {mappedStateOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All mapping states"}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Sort</span>
            <select
              className="filter-select"
              value={filters.sort ?? "divergence"}
              onChange={(event) => updateFilters({ sort: event.target.value })}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <Panel>
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Family</th>
                <th>Gap</th>
                <th>Mapping</th>
                <th>Priority</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.gameId}:${row.instrumentId}`}>
                  <td>
                    <strong>{row.displayLabel}</strong>
                    <div className="muted">{row.severity}</div>
                  </td>
                  <td>{row.family}</td>
                  <td className="table-metric">
                    {row.impliedProbabilityGap == null
                      ? "n/a"
                      : `${(row.impliedProbabilityGap * 100).toFixed(1)}%`}
                  </td>
                  <td>
                    <div className="tag-row">
                      <Badge tone={row.lineMismatch ? "warning" : "neutral"}>
                        {row.comparableState}
                      </Badge>
                    </div>
                  </td>
                  <td className="table-metric">{row.signalPriority}</td>
                  <td>
                    <Link
                      className="ghost-button"
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
      </Panel>
    </PageFrame>
  );
}
