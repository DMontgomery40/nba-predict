import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppStore } from "../../app/store";
import {
  ErrorState,
  InlineAlert,
  LoadingState,
} from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import {
  Badge,
  Panel,
  ProbabilityPill,
  SectionTitle,
} from "../../components/Primitives";
import { SourceHealthPanel } from "../../components/SourceHealth";
import { getEvent, queueWatchlist, type EventPayload } from "../../data/api";

function formatTimeline(timeline: EventPayload["data"]["timeline"]) {
  return timeline.map((point) => ({
    label: point.capturedAt.slice(11, 16),
    bet365: Number((point.bet365 * 100).toFixed(1)),
    kalshi: Number((point.kalshi * 100).toFixed(1)),
    polymarket: Number((point.polymarket * 100).toFixed(1)),
    consensus: Number((point.consensus * 100).toFixed(1)),
  }));
}

export function EventWorkspacePage() {
  const { eventId = "" } = useParams();
  const mode = useAppStore((state) => state.mode);
  const queryClient = useQueryClient();
  const event = useQuery({
    queryKey: ["event", mode, eventId],
    queryFn: () => getEvent(mode, eventId),
    enabled: Boolean(eventId),
  });
  const queueMutation = useMutation({
    mutationFn: () => queueWatchlist(eventId, "Queued from event workspace"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  if (!eventId) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Route Guard" title="Missing event id" />
          </Panel>
        }
      >
        <ErrorState
          actionLabel="Back to overview"
          description="Event workspace needs a valid event id in the route."
          onAction={() => {
            window.location.assign("/");
          }}
          title="No event selected"
        />
      </PageFrame>
    );
  }

  if (event.isLoading || (!event.data && !event.isError)) {
    return <LoadingState message="Loading event workspace…" />;
  }

  if (event.isError || !event.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Failure State"
              title="Event workspace unavailable"
              body="The shell stayed up, but this event payload could not be resolved."
            />
          </Panel>
        }
      >
        <ErrorState
          description="The event workspace query failed."
          error={event.error}
          onAction={() => void event.refetch()}
          title="Event detail failed to load"
        />
      </PageFrame>
    );
  }

  const data = event.data.data;
  const timeline = formatTimeline(data.timeline);

  return (
    <PageFrame
      aside={
        <>
          <Panel>
            <SectionTitle
              eyebrow="Recommended Action"
              title={data.signal.narrativeTitle}
            />
            <div className="stack">
              {data.signal.suggestedActions.map((action) => (
                <div className="action-row" key={action.label}>
                  <div>
                    <strong>{action.label}</strong>
                    <p>{action.detail}</p>
                  </div>
                  <Badge
                    tone={
                      action.priority === "act-now" ? "critical" : "warning"
                    }
                  >
                    {action.priority}
                  </Badge>
                </div>
              ))}
            </div>
            <button
              className="primary-button"
              disabled={queueMutation.isPending}
              onClick={() => queueMutation.mutate()}
            >
              {queueMutation.isPending ? "Queueing…" : "Queue on watchlist"}
            </button>
            {queueMutation.isError ? (
              <InlineAlert
                message={
                  queueMutation.error instanceof Error
                    ? queueMutation.error.message
                    : "Watchlist action failed."
                }
              />
            ) : null}
            {queueMutation.isSuccess ? (
              <InlineAlert message="Queued on watchlist." tone="positive" />
            ) : null}
          </Panel>

          <Panel>
            <SectionTitle
              eyebrow="Source Trust"
              title="Why the confidence lands here"
            />
            <div className="stack">
              {data.signal.sourceTrust.map((item) => (
                <div className="trust-row" key={item.sourceId}>
                  <div className="trust-head">
                    <span>{item.sourceId}</span>
                    <strong>{item.score}</strong>
                  </div>
                  <div className="trust-bar">
                    <span style={{ width: `${item.score}%` }} />
                  </div>
                  <p className="muted">{item.note}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle
              eyebrow="Audit Trail"
              title="What changed, in order"
            />
            <div className="stack">
              {data.signal.audit.map((item) => (
                <article className="audit-item" key={item.id}>
                  <span>{item.capturedAt.slice(11, 16)}</span>
                  <strong>{item.label}</strong>
                  <p>{item.message}</p>
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
          <div className="eyebrow">Event Workspace</div>
          <h1>{data.signal.eventLabel}</h1>
          <p>{data.storyline.summary}</p>
        </div>
        <div className="hero-actions">
          <Badge
            tone={
              data.signal.severityBand === "critical" ? "critical" : "warning"
            }
          >
            {data.signal.severityBand}
          </Badge>
          <Link className="ghost-button" to={`/timeline/${eventId}`}>
            Open full timeline
          </Link>
        </div>
      </section>

      <Panel>
        <SectionTitle
          eyebrow="Consensus Strip"
          title="Current home win probability"
        />
        <div className="probability-grid">
          <ProbabilityPill
            label="bet365"
            value={data.signal.quotes.bet365.probability}
          />
          <ProbabilityPill
            label="Kalshi"
            value={data.signal.quotes.kalshi.probability}
            highlight
          />
          <ProbabilityPill
            label="Polymarket"
            value={data.signal.quotes.polymarket.probability}
            highlight
          />
          <ProbabilityPill
            label="Model"
            value={data.signal.quotes.model.probability}
          />
          <ProbabilityPill
            label="Consensus"
            value={data.signal.consensusProbability}
            highlight
          />
        </div>
      </Panel>

      <div className="grid-metrics">
        <div className="metric-tile">
          <div className="eyebrow">Priority</div>
          <div className="metric-value">{data.signal.watchlistPriority}</div>
        </div>
        <div className="metric-tile">
          <div className="eyebrow">Divergence</div>
          <div className="metric-value">{data.signal.divergenceScore}</div>
        </div>
        <div className="metric-tile metric-positive">
          <div className="eyebrow">Confidence</div>
          <div className="metric-value">{data.signal.confidenceScore}</div>
        </div>
        <div className="metric-tile">
          <div className="eyebrow">Tipoff</div>
          <div className="metric-value">{data.signal.tipoffLabel}</div>
        </div>
      </div>

      <Panel>
        <SectionTitle
          eyebrow="Divergence Timeline"
          title="How the external stack moved"
          body={data.signal.narrative}
        />
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timeline}>
              <XAxis dataKey="label" stroke="#67717c" />
              <YAxis stroke="#67717c" domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="bet365"
                stroke="#d9dde3"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="kalshi"
                stroke="#64d2a7"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="polymarket"
                stroke="#7ac7ff"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="consensus"
                stroke="#f7c66b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="dual-grid">
        <Panel>
          <SectionTitle eyebrow="Evidence" title="Why this matters right now" />
          <div className="stack">
            {data.signal.evidence.map((item) => (
              <article className="note-card" key={item}>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Reason Codes"
            title="Deterministic explanations"
          />
          <div className="tag-row">
            {data.signal.reasonCodes.map((code) => (
              <Badge key={code} tone="positive">
                {code}
              </Badge>
            ))}
          </div>
          <div className="context-meta">
            <div>
              <span>Exposure</span>
              <strong>{data.signal.context.exposureScore}</strong>
            </div>
            <div>
              <span>Volatility</span>
              <strong>{data.signal.context.volatilityScore}</strong>
            </div>
            <div>
              <span>Liquidity Risk</span>
              <strong>{data.signal.context.liquidityRisk}</strong>
            </div>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
