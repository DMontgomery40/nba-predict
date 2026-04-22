import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAppStore } from "../../app/store";
import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import { getDivergence } from "../../data/api";

export function DivergenceExplorerPage() {
  const mode = useAppStore((state) => state.mode);
  const [search, setSearch] = useState("");
  const divergence = useQuery({
    queryKey: ["divergence", mode, search],
    queryFn: () => getDivergence(mode, search),
  });

  const topRow = useMemo(() => divergence.data?.data[0], [divergence.data]);

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

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Explorer Focus"
            title={topRow?.label ?? "No visible rows"}
            body={
              topRow
                ? `Leading source ${topRow.leadingSource} with ${topRow.reasonCodes.join(" • ")}.`
                : "Adjust filters to expose a divergence cluster."
            }
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Divergence Explorer</div>
          <h1>Cross-event disagreement</h1>
          <p>
            Sortable scan surface for confidence, freshness, and trader
            priority.
          </p>
        </div>
      </section>

      <Panel>
        <SectionTitle eyebrow="Filters" title="Search by team or matchup" />
        <input
          className="search-input"
          placeholder="Search team or matchup"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Panel>

      <Panel>
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matchup</th>
                <th>bet365</th>
                <th>Consensus</th>
                <th>Divergence</th>
                <th>Confidence</th>
                <th>Priority</th>
                <th>Lead</th>
                <th>Tipoff</th>
              </tr>
            </thead>
            <tbody>
              {divergence.data.data.map((row) => (
                <tr key={row.eventId}>
                  <td>
                    <Link to={`/events/${row.eventId}`}>{row.label}</Link>
                    <div className="table-subtle">
                      {row.reasonCodes.slice(0, 2).map((code) => (
                        <Badge key={code} tone="positive">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>{(row.bet365 * 100).toFixed(1)}%</td>
                  <td>{(row.consensus * 100).toFixed(1)}%</td>
                  <td>{row.divergenceScore}</td>
                  <td>{row.confidenceScore}</td>
                  <td>{row.watchlistPriority}</td>
                  <td>{row.leadingSource}</td>
                  <td>{row.tipoffLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageFrame>
  );
}
