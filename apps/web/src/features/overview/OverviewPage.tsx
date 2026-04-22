import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useAppStore } from "../../app/store";
import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import {
  Badge,
  MetricTile,
  Panel,
  SectionTitle,
} from "../../components/Primitives";
import { SourceHealthPanel } from "../../components/SourceHealth";
import { getOverview } from "../../data/api";

export function OverviewPage() {
  const mode = useAppStore((state) => state.mode);
  const overview = useQuery({
    queryKey: ["overview", mode],
    queryFn: () => getOverview(mode),
  });

  if (overview.isLoading || (!overview.data && !overview.isError)) {
    return <LoadingState message="Loading overview…" />;
  }

  if (overview.isError || !overview.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Fallback"
              title="Overview unavailable"
              body="The shell is still up, but the ranked slate payload did not load."
            />
          </Panel>
        }
      >
        <ErrorState
          description="The overview query failed."
          error={overview.error}
          onAction={() => void overview.refetch()}
          title="Overview failed to load"
        />
      </PageFrame>
    );
  }

  const data = overview.data.data;

  return (
    <PageFrame
      aside={
        <>
          <Panel>
            <SectionTitle
              eyebrow="Interesting Now"
              title={data.storyline.name}
              body={data.storyline.description}
            />
            <div className="stack">
              {data.interestingNow.map((item) => (
                <article className="note-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </Panel>
          <SourceHealthPanel sources={data.sourceHealth} />
        </>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Overview Dashboard</div>
          <h1>Signal Console</h1>
          <p>
            Immediate ranked view of the NBA slate with divergence, confidence,
            and trader-ready urgency.
          </p>
        </div>
        <div className="hero-chip">
          <span>{mode}</span>
          <strong>{data.storyline.fixturePack}</strong>
        </div>
      </section>

      <div className="grid-metrics">
        {data.quickStats.map((stat) => (
          <MetricTile
            key={stat.label}
            label={stat.label}
            value={stat.value}
            tone={stat.tone}
          />
        ))}
      </div>

      <Panel>
        <SectionTitle
          eyebrow="Top Divergence Cards"
          title="What deserves trader attention first"
        />
        <div className="card-grid">
          {data.cards.map((card) => (
            <Link
              className="signal-card"
              key={card.eventId}
              to={`/events/${card.eventId}`}
            >
              <div className="signal-card-head">
                <div>
                  <h3>{card.label}</h3>
                  <p>{card.interestingNow}</p>
                </div>
                <Badge
                  tone={
                    card.severityBand === "critical"
                      ? "critical"
                      : card.severityBand === "high"
                        ? "warning"
                        : "positive"
                  }
                >
                  {card.severityBand}
                </Badge>
              </div>
              <div className="signal-card-metrics">
                <div>
                  <span>Priority</span>
                  <strong>{card.watchlistPriority}</strong>
                </div>
                <div>
                  <span>Divergence</span>
                  <strong>{card.divergenceScore}</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{card.confidenceScore}</strong>
                </div>
                <div>
                  <span>Tipoff</span>
                  <strong>{card.tipoffLabel}</strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="Watchlist" title="Queued or monitored markets" />
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matchup</th>
                <th>Severity</th>
                <th>Priority</th>
                <th>Tipoff</th>
                <th>Reason Codes</th>
              </tr>
            </thead>
            <tbody>
              {data.watchlist.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-row">No queued markets yet.</div>
                  </td>
                </tr>
              ) : (
                data.watchlist.map((row) => (
                  <tr key={row.eventId}>
                    <td>
                      <Link to={`/events/${row.eventId}`}>
                        {row.eventLabel}
                      </Link>
                    </td>
                    <td>{row.severityBand}</td>
                    <td>{row.watchlistPriority}</td>
                    <td>{row.tipoffLabel}</td>
                    <td>{row.reasonCodes.join(" • ")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageFrame>
  );
}
