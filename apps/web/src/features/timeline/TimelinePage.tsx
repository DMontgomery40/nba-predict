import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppStore } from "../../app/store";
import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Panel, SectionTitle } from "../../components/Primitives";
import { getEvent, getOverview } from "../../data/api";

export function TimelinePage() {
  const { eventId } = useParams();
  const mode = useAppStore((state) => state.mode);
  const overview = useQuery({
    queryKey: ["overview", mode],
    queryFn: () => getOverview(mode),
  });
  const resolvedEventId =
    eventId ?? overview.data?.data.cards[0]?.eventId ?? "";
  const event = useQuery({
    queryKey: ["event", mode, resolvedEventId],
    queryFn: () => getEvent(mode, resolvedEventId),
    enabled: Boolean(resolvedEventId),
  });

  const timeline = useMemo(
    () =>
      event.data?.data.timeline.map((point) => ({
        label: point.capturedAt.slice(11, 16),
        bet365: Number((point.bet365 * 100).toFixed(1)),
        kalshi: Number((point.kalshi * 100).toFixed(1)),
        polymarket: Number((point.polymarket * 100).toFixed(1)),
        divergenceScore: point.divergenceScore,
      })) ?? [],
    [event.data]
  );

  if (!resolvedEventId && overview.isError) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Route Guard"
              title="Missing event selection"
            />
          </Panel>
        }
      >
        <ErrorState
          description="Timeline mode needs a valid event selection or a working overview payload."
          error={overview.error}
          onAction={() => void overview.refetch()}
          title="Timeline could not resolve an event"
        />
      </PageFrame>
    );
  }

  if (!resolvedEventId) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Route Guard"
              title="Missing event selection"
            />
          </Panel>
        }
      >
        <ErrorState
          description="Timeline mode needs an event id in the route or an overview card to select one."
          title="Timeline has no event to render"
        />
      </PageFrame>
    );
  }

  if (event.isLoading || (!event.data && !event.isError)) {
    return <LoadingState message="Loading timeline…" />;
  }

  if (event.isError || !event.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Fallback" title="Timeline unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The timeline query failed."
          error={event.error}
          onAction={() => void event.refetch()}
          title="Timeline data failed to load"
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Replay Notes"
            title={event.data.data.storyline.name}
            body={event.data.data.storyline.summary}
          />
          <div className="stack">
            {event.data.data.timeline.flatMap((point) =>
              point.annotations.map((annotation) => (
                <article
                  className="audit-item"
                  key={`${annotation.capturedAt}-${annotation.label}`}
                >
                  <span>{annotation.capturedAt.slice(11, 16)}</span>
                  <strong>{annotation.label}</strong>
                  <p>{annotation.message}</p>
                </article>
              ))
            )}
          </div>
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Signal Timeline</div>
          <h1>{event.data.data.signal.eventLabel}</h1>
          <p>Replay how divergence built and which source led the move.</p>
        </div>
        <Link className="ghost-button" to={`/events/${resolvedEventId}`}>
          Back to event workspace
        </Link>
      </section>

      <Panel>
        <SectionTitle
          eyebrow="Probability Overlay"
          title="Source-by-source movement"
        />
        <div className="chart-wrap large">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={timeline}>
              <CartesianGrid stroke="#20272f" vertical={false} />
              <XAxis dataKey="label" stroke="#67717c" />
              <YAxis stroke="#67717c" domain={["dataMin - 3", "dataMax + 3"]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="bet365"
                stroke="#e6edf7"
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Severity Curve"
          title="Why the market moved up the queue"
        />
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline}>
              <CartesianGrid stroke="#20272f" vertical={false} />
              <XAxis dataKey="label" stroke="#67717c" />
              <YAxis stroke="#67717c" />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="divergenceScore"
                stroke="#f7c66b"
                fill="#f7c66b33"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </PageFrame>
  );
}
