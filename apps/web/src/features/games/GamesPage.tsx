import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Panel, SectionTitle } from "../../components/Primitives";
import { getGames } from "../../data/api";
import {
  formatGameScoreClock,
  getGameOperationalState,
} from "../../lib/game-state";
import {
  buildGameTriage,
  getMarketSources,
  type GameRow,
} from "../../lib/game-triage";
import { formatGapPoints } from "../../lib/market-format";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";
import { formatOperatorDateTime } from "../../lib/time-format";

function scoreLine(entry: GameRow) {
  return formatGameScoreClock(entry);
}

function formatGameName(entry: GameRow) {
  return `${entry.game.awayParticipant.shortName} at ${entry.game.homeParticipant.shortName}`;
}

export function GamesPage() {
  const games = useQuery({
    queryKey: ["games"],
    queryFn: () => getGames(),
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

  const triage = buildGameTriage(games.data.data);
  const visibleRows = triage.actionableRows.slice(0, 80);
  const stateAttentionRows = games.data.data
    .map((entry) => ({
      entry,
      state: getGameOperationalState(entry),
    }))
    .filter(
      ({ state }) => state.tone === "critical" || state.tone === "warning"
    )
    .slice(0, 6);

  return (
    <PageFrame>
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Tracked Games</div>
          <h1>NBA market work slate</h1>
          <p>
            Market-work boards first. Scoreboard-only and placeholder backfill
            rows are counted below, not repeated forever.
          </p>
        </div>
      </section>

      <div className="slate-triage-grid">
        <div className="triage-tile triage-live">
          <span>Market work boards</span>
          <strong>{triage.actionableRows.length.toLocaleString()}</strong>
          <em>market feed, instrument, divergence, or unmapped work</em>
        </div>
        <div className="triage-tile">
          <span>Scoreboard only</span>
          <strong>{triage.nbaStateOnlyRows.length.toLocaleString()}</strong>
          <em>truth context exists, no market board yet</em>
        </div>
        <div className="triage-tile">
          <span>Placeholder names</span>
          <strong>{triage.placeholderRows.length.toLocaleString()}</strong>
          <em>suppressed from trader navigation</em>
        </div>
        <div className="triage-tile">
          <span>Showing</span>
          <strong>{visibleRows.length.toLocaleString()}</strong>
          <em>ranked by divergence, source coverage, instruments</em>
        </div>
      </div>

      {stateAttentionRows.length > 0 ? (
        <section className="state-attention-strip">
          <header>
            <span>NBA state watch</span>
            <strong>
              {stateAttentionRows.length} game
              {stateAttentionRows.length === 1 ? "" : "s"} need attention
            </strong>
          </header>
          <div>
            {stateAttentionRows.map(({ entry, state }) => (
              <Link
                className={`state-attention-row state-attention-${state.tone}`}
                key={entry.game.id}
                to={`/games/${entry.game.id}`}
              >
                <strong>{formatGameName(entry)}</strong>
                <span>{state.label}</span>
                <em>{state.detail}</em>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Panel className="slate-workbench">
        <SectionTitle
          eyebrow="Market Work Slate"
          title="Boards with market work"
          body="No empty Away/Home cards. Rows below have market feeds, instruments, ranked divergence, or unresolved mapping work."
        />
        {games.data.data.length === 0 ? (
          <Panel>
            <SectionTitle
              eyebrow="No Current Slate"
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
        ) : visibleRows.length === 0 ? (
          <div className="empty-row">
            No market-work boards yet. The database currently contains
            scoreboard-only or placeholder game rows; use History, Research, or
            Settings while capture/backfill mapping catches up.
          </div>
        ) : (
          <div className="table-shell slate-table-shell">
            <table className="desk-table slate-table">
              <thead>
                <tr>
                  <th>Board</th>
                  <th>State</th>
                  <th>Market feeds</th>
                  <th>NBA state</th>
                  <th>Instruments</th>
                  <th>Top signal</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((entry) => {
                  const topInstrument = entry.topDivergences[0];
                  const marketSources = getMarketSources(entry);
                  const hasNbaState = hasNbaStateSource(
                    entry.coverage.availableSources
                  );
                  const stateReadout = getGameOperationalState(entry);
                  return (
                    <tr key={entry.game.id}>
                      <td>
                        <strong>{formatGameName(entry)}</strong>
                        <span>
                          {entry.game.league} -{" "}
                          {formatOperatorDateTime(entry.game.scheduledStart)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`state-label state-label-${stateReadout.tone}`}
                        >
                          {stateReadout.label}
                        </span>
                        <span>{scoreLine(entry)}</span>
                      </td>
                      <td>
                        <span className="slate-feed-line">
                          {marketSources.length > 0
                            ? formatMarketSourceList(marketSources)
                            : "mapping work only"}
                        </span>
                      </td>
                      <td>
                        <span className="slate-feed-line">
                          {hasNbaState ? "available" : "missing"}
                        </span>
                      </td>
                      <td className="desk-number">
                        {entry.activeInstrumentCount}
                      </td>
                      <td>
                        {topInstrument ? (
                          <>
                            <strong>{topInstrument.displayLabel}</strong>
                            <span>
                              {formatGapPoints(
                                topInstrument.impliedProbabilityGap
                              )}{" "}
                              divergence - {topInstrument.severity}
                            </span>
                          </>
                        ) : entry.hasUnmappedMarkets ? (
                          <span className="status-text status-warm">
                            unmapped markets
                          </span>
                        ) : (
                          <span className="muted">coverage only</span>
                        )}
                      </td>
                      <td>
                        {topInstrument ? (
                          <Link
                            className="desk-link"
                            to={`/games/${entry.game.id}/markets/${topInstrument.instrumentId}`}
                          >
                            Review
                          </Link>
                        ) : (
                          <Link
                            className="desk-link"
                            to={`/games/${entry.game.id}`}
                          >
                            Game
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageFrame>
  );
}
