import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getClosedGames,
  getSignalQualityReport,
  type ClosedGameSummary,
} from "../../data/api";

type Cutoff = "live-final" | "pregame";

const FIXED_SOURCES = ["bet365", "kalshi", "polymarket"] as const;

function formatProbability(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function sourceClosing(
  game: ClosedGameSummary,
  participantKey: string,
  source: string
) {
  const instrument = game.moneylineByParticipant.find(
    (item) => item.participantKey === participantKey
  );
  return instrument?.sources.find((s) => s.source === source);
}

function winnerCorrectBySource(
  game: ClosedGameSummary,
  source: string
): "yes" | "no" | "none" {
  const winnerKey = game.winnerKey;
  if (!winnerKey) return "none";
  const winnerInstrument = game.moneylineByParticipant.find(
    (item) => item.participantKey === winnerKey
  );
  const winnerProb = winnerInstrument?.sources.find(
    (s) => s.source === source
  )?.impliedProbability;
  if (winnerProb == null) return "none";
  return winnerProb >= 0.5 ? "yes" : "no";
}

function brierContribution(
  game: ClosedGameSummary,
  source: string
): number | null {
  const winnerKey = game.winnerKey;
  if (!winnerKey) return null;
  let total = 0;
  let n = 0;
  for (const instrument of game.moneylineByParticipant) {
    const sourceEntry = instrument.sources.find((s) => s.source === source);
    const p = sourceEntry?.impliedProbability;
    if (p == null) continue;
    const actual = instrument.participantKey === winnerKey ? 1 : 0;
    total += (p - actual) ** 2;
    n += 1;
  }
  return n > 0 ? total / n : null;
}

export function ResearchPage() {
  const [cutoff, setCutoff] = useState<Cutoff>("pregame");

  const signalQuality = useQuery({
    queryKey: ["research", "signal-quality", cutoff],
    queryFn: () => getSignalQualityReport({ closingCutoff: cutoff }),
  });

  const closedGames = useQuery({
    queryKey: ["research", "closed-games", cutoff],
    queryFn: () => getClosedGames({ closingCutoff: cutoff, limit: 500 }),
  });

  const sortedGames = useMemo(() => {
    const list = closedGames.data?.data ?? [];
    return [...list].sort((a, b) =>
      b.scheduledStart.localeCompare(a.scheduledStart)
    );
  }, [closedGames.data]);

  const perSourceReport = useMemo(() => {
    const map = new Map<
      string,
      {
        brier: number | null;
        logLoss: number | null;
        closingWinnerAccuracy: number | null;
        sampleCount: number;
      }
    >();
    for (const entry of signalQuality.data?.data.perSource ?? []) {
      map.set(entry.source, entry);
    }
    return map;
  }, [signalQuality.data]);

  return (
    <div className="research-surface">
      <div className="research-header">
        <div className="research-header-left">
          <div className="eyebrow">Signal Research</div>
          <h1>How much signal is in prediction markets vs the book?</h1>
          <span className="muted">
            Moneyline implied-probability comparison across sources, graded
            against actual outcomes.
          </span>
        </div>
        <div className="cutoff-toggle">
          <span className="eyebrow">Closing cutoff</span>
          <div className="cutoff-buttons">
            <button
              className={cutoff === "pregame" ? "active" : ""}
              onClick={() => setCutoff("pregame")}
              type="button"
            >
              pregame
            </button>
            <button
              className={cutoff === "live-final" ? "active" : ""}
              onClick={() => setCutoff("live-final")}
              type="button"
            >
              live-final
            </button>
          </div>
        </div>
      </div>

      <section className="research-metrics">
        <div className="metrics-head">
          <span className="eyebrow">Per-source signal quality</span>
          <span className="muted">
            {signalQuality.data?.data.sampleCount ?? 0} predictions graded
          </span>
        </div>
        {signalQuality.isLoading ? (
          <div className="muted">Loading…</div>
        ) : signalQuality.isError ? (
          <div className="critical">Failed to load signal quality.</div>
        ) : (
          <div className="metrics-grid">
            <div className="metrics-row metrics-row-head">
              <span>Source</span>
              <span className="num">n</span>
              <span className="num">Brier</span>
              <span className="num">Log loss</span>
              <span className="num">Winner acc.</span>
            </div>
            {FIXED_SOURCES.map((source) => {
              const entry = perSourceReport.get(source);
              return (
                <div className="metrics-row" key={source}>
                  <span className="source-pill">{source}</span>
                  <span className="num">{entry?.sampleCount ?? 0}</span>
                  <span className="num">
                    {formatNumber(entry?.brier ?? null)}
                  </span>
                  <span className="num">
                    {formatNumber(entry?.logLoss ?? null)}
                  </span>
                  <span className="num">
                    {formatPercent(entry?.closingWinnerAccuracy ?? null)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="research-table-wrap">
        <div className="metrics-head">
          <span className="eyebrow">
            Closed games — {cutoff} prices vs outcome
          </span>
          <span className="muted">
            {sortedGames.length} game{sortedGames.length === 1 ? "" : "s"}
          </span>
        </div>
        {closedGames.isLoading ? (
          <div className="muted">Loading…</div>
        ) : sortedGames.length === 0 ? (
          <div className="muted">
            No closed games with moneyline coverage. Run{" "}
            <code>pnpm backfill nba</code> and the Kalshi/Polymarket historical
            backfills to populate.
          </div>
        ) : (
          <div className="closed-games-table">
            <div className="cgt-row cgt-head">
              <span>Date</span>
              <span>Matchup</span>
              <span>Final</span>
              {FIXED_SOURCES.flatMap((source) => [
                <span className="num" key={`${source}-away`}>
                  {source} away
                </span>,
                <span className="num" key={`${source}-home`}>
                  {source} home
                </span>,
              ])}
              {FIXED_SOURCES.map((source) => (
                <span className="num" key={`${source}-br`}>
                  {source} Brier
                </span>
              ))}
            </div>
            {sortedGames.map((game) => {
              const home =
                game.moneylineByParticipant.find(
                  (i) =>
                    i.participantKey != null &&
                    i.participantKey === game.winnerKey
                )?.participantKey ?? null;
              const awayKey = game.moneylineByParticipant.find(
                (i) => i.participantKey != null && i.participantKey !== home
              )?.participantKey;
              const homeKey = game.moneylineByParticipant.find(
                (i) => i.participantKey !== awayKey
              )?.participantKey;
              return (
                <div className="cgt-row" key={game.gameId}>
                  <span className="mono">
                    {game.scheduledStart.slice(0, 10)}
                  </span>
                  <span className="matchup">
                    <Link className="matchup-link" to={`/games/${game.gameId}`}>
                      {game.matchup}
                    </Link>
                    {game.winnerKey ? (
                      <span className="winner-tag">
                        won by {game.winnerKey}
                      </span>
                    ) : null}
                  </span>
                  <span className="mono">
                    {game.finalAwayScore ?? "-"}–{game.finalHomeScore ?? "-"}
                  </span>
                  {FIXED_SOURCES.flatMap((source) => [
                    <span
                      className="num"
                      key={`${game.gameId}-${source}-${awayKey}`}
                    >
                      {formatProbability(
                        awayKey
                          ? sourceClosing(game, awayKey, source)
                              ?.impliedProbability
                          : null
                      )}
                    </span>,
                    <span
                      className="num"
                      key={`${game.gameId}-${source}-${homeKey}`}
                    >
                      {formatProbability(
                        homeKey
                          ? sourceClosing(game, homeKey, source)
                              ?.impliedProbability
                          : null
                      )}
                    </span>,
                  ])}
                  {FIXED_SOURCES.map((source) => {
                    const status = winnerCorrectBySource(game, source);
                    const brier = brierContribution(game, source);
                    return (
                      <span
                        className={`num brier-cell brier-cell-${status}`}
                        key={`${game.gameId}-br-${source}`}
                      >
                        {formatNumber(brier, 3)}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
