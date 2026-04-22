import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import { getGames } from "../../data/api";
import {
  formatMarketSourceList,
  formatMarketSourceSummary,
  hasNbaStateSource,
} from "../../lib/source-coverage";

function scoreLine(
  gameState?: {
    awayScore?: number | null;
    homeScore?: number | null;
    status: string;
  } | null
) {
  if (!gameState) {
    return "No state yet";
  }

  return `${gameState.awayScore ?? "-"} - ${gameState.homeScore ?? "-"} · ${gameState.status}`;
}

export function GamesPage() {
  const games = useQuery({
    queryKey: ["games"],
    queryFn: getGames,
  });

  if (games.isLoading || (!games.data && !games.isError)) {
    return <LoadingState message="Loading tracked games…" />;
  }

  if (games.isError || !games.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Failure" title="Game list unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The live games query failed."
          error={games.error}
          onAction={() => void games.refetch()}
          title="Tracked games failed to load"
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Coverage"
            title={`${games.data.data.length} tracked games`}
            body="Each card is backed by persisted live game state, source coverage, and instrument-level divergence summaries."
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Tracked Games</div>
          <h1>Live NBA research slate</h1>
          <p>
            Browse active and recent games, then jump directly into the most
            meaningful instrument on each board.
          </p>
        </div>
      </section>

      <div className="stack">
        {games.data.data.length === 0 ? (
          <Panel>
            <SectionTitle
              eyebrow="No Live Slate"
              title="No canonical games are visible right now"
              body="You can still review persisted history, download exports, or inspect operator status while capture or backfill repopulates the slate."
            />
            <div className="hero-actions">
              <Link className="primary-button" to="/history">
                Open history
              </Link>
              <Link className="ghost-button" to="/exports">
                Open exports
              </Link>
              <Link className="ghost-button" to="/settings">
                Open settings
              </Link>
            </div>
          </Panel>
        ) : null}
        {games.data.data.map((entry) => {
          const topInstrument = entry.topDivergences[0];
          const hasNbaState = hasNbaStateSource(
            entry.coverage.availableSources
          );

          return (
            <Panel key={entry.game.id}>
              <SectionTitle
                eyebrow={`${entry.game.league} · ${entry.game.sport}`}
                title={`${entry.game.awayParticipant.shortName} at ${entry.game.homeParticipant.shortName}`}
                body={scoreLine(entry.gameState)}
              />
              <div className="tag-row">
                <Badge tone="neutral">
                  {entry.activeInstrumentCount} instruments
                </Badge>
                <Badge
                  tone={
                    entry.coverage.availableSources.length > 0
                      ? "positive"
                      : "warning"
                  }
                >
                  {formatMarketSourceSummary(entry.coverage.availableSources)}
                </Badge>
                {hasNbaState ? <Badge tone="neutral">NBA state</Badge> : null}
                {entry.hasUnmappedMarkets ? (
                  <Badge tone="warning">Unmapped markets present</Badge>
                ) : null}
              </div>
              <p className="muted">
                Market feeds:{" "}
                {formatMarketSourceList(entry.coverage.availableSources)}
              </p>

              {topInstrument ? (
                <div className="note-card">
                  <h3>Top divergence</h3>
                  <p>
                    {topInstrument.displayLabel} ·{" "}
                    {(topInstrument.impliedProbabilityGap * 100).toFixed(1)}%
                    gap · {topInstrument.severity}
                  </p>
                  <div className="hero-actions">
                    <Link
                      className="primary-button"
                      to={`/games/${entry.game.id}`}
                    >
                      Open game workspace
                    </Link>
                    <Link
                      className="ghost-button"
                      to={`/games/${entry.game.id}/markets/${topInstrument.instrumentId}`}
                    >
                      Jump to top instrument
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="muted">No ranked divergence yet for this game.</p>
              )}
            </Panel>
          );
        })}
      </div>
    </PageFrame>
  );
}
