import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { useAppStore } from "../../app/store";
import {
  ErrorState,
  InlineAlert,
  LoadingState,
} from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import { getWatchlist, removeWatchlist } from "../../data/api";

export function WatchlistPage() {
  const mode = useAppStore((state) => state.mode);
  const queryClient = useQueryClient();
  const watchlist = useQuery({
    queryKey: ["watchlist", mode],
    queryFn: () => getWatchlist(mode),
  });
  const removeMutation = useMutation({
    mutationFn: (eventId: string) => removeWatchlist(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  if (watchlist.isLoading || (!watchlist.data && !watchlist.isError)) {
    return <LoadingState message="Loading watchlist…" />;
  }

  if (watchlist.isError || !watchlist.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Fallback" title="Watchlist unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The watchlist query failed."
          error={watchlist.error}
          onAction={() => void watchlist.refetch()}
          title="Watchlist failed to load"
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Queue Summary"
            title={`${watchlist.data.data.length} tracked markets`}
            body="Use this surface as the desk shortlist rather than a dump of every disagreement."
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Watchlist / Alerts</div>
          <h1>Desk shortlist</h1>
          <p>
            Priority-ranked markets that merit an active trader review loop.
          </p>
        </div>
      </section>

      <Panel>
        <div className="stack">
          {removeMutation.isError ? (
            <InlineAlert
              message={
                removeMutation.error instanceof Error
                  ? removeMutation.error.message
                  : "Watchlist removal failed."
              }
            />
          ) : null}
          {watchlist.data.data.length === 0 ? (
            <div className="empty-row">
              Nothing queued yet. Use event workspace actions to add a market.
            </div>
          ) : (
            watchlist.data.data.map((item) => (
              <article className="watch-card" key={item.eventId}>
                <div>
                  <div className="watch-head">
                    <Link to={`/events/${item.eventId}`}>
                      {item.eventLabel}
                    </Link>
                    <Badge
                      tone={
                        item.severityBand === "high" ? "warning" : "positive"
                      }
                    >
                      {item.severityBand}
                    </Badge>
                  </div>
                  <p>{item.narrative}</p>
                  <div className="tag-row">
                    {item.reasonCodes.map((code) => (
                      <Badge key={code} tone="positive">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="watch-meta">
                  <strong>{item.watchlistPriority}</strong>
                  <span>{item.tipoffLabel}</span>
                  <button
                    className="ghost-button"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(item.eventId)}
                  >
                    {removeMutation.isPending ? "Removing…" : "Remove"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>
    </PageFrame>
  );
}
