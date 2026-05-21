# Universal Source Trust — Methodology

This report answers, across all persisted live quotes in the Signal Console
store: **which sources tend to be right earlier, which are right later, and how
that changes across game markets, broad props, and player props** — framed for a
Bet365 trader deciding what to trust more, less, earlier, or only in certain
contexts. It is an internal trader-inspection artifact, not a betting-picks
product, and contains no wagering recommendations.

## Source of truth

- Database: the live persisted store at `SIGNAL_CONSOLE_DB_PATH`
  (`data/signal-console.sqlite`), **not** the schema-only packaged DB or the e2e
  fixture. Verified by row counts: 37.2M `quote_ticks`, 1,300 `games`, 863
  `game_outcomes`, 83k `market_instruments`, 100k `market_microstructure_events`.
- Three sources: `bet365` (book), `kalshi` (regulated exchange), `polymarket`
  (crypto CLOB).
- Build is reproducible:
  - `scripts/build_universal_source_trust_report.ts` → `report-data.json` (+ saved SQL in `queries/`)
  - `scripts/render_universal_source_trust_report.ts` → `index.html`
  - honesty-critical math: `packages/shared/src/source-trust/metrics.ts`
    with unit tests in `packages/shared/src/source-trust/__tests__/metrics.test.ts`.

## Scope and the "all time" caveat

Persisted `quote_ticks` span **2026-02-16 → 2026-05-21** — the NBA playoff
window — even though games exist back to October 2025. The report therefore
covers *all persisted live quotes*, which is a ~3-month playoff sample, **not**
"all time". 487 games have both a final outcome and at least one quote and form
the settleable universe.

## Two tracks, never blended

1. **Settled accuracy** — only where deterministic truth exists. Reported as
   Brier, log-loss, side accuracy, OLS calibration (slope/intercept), sample
   count, and push count.
2. **Timing / leadership / reaction** — coverage, who reprices live, who moves
   first, microstructure depth. Never labelled as "rightness".

The two are kept in separate columns/sections and never combined into a single
"trust score".

## Settlement rules (deterministic truth)

- **Moneyline**: YES = `participant_key == winner_key` from `game_outcomes`.
- **Spread**: from final scores. Two persisted encodings are handled distinctly:
  - signed handicap (bet365/polymarket, e.g. "Spurs −1.5"): cover when
    `teamMargin + line > 0`; push at `== 0`.
  - margin threshold (kalshi, e.g. "Detroit wins by over 16.5 points?"): YES when
    `teamMargin > line` (or `< line` for the "wins by under" variant); push at
    `== line`. Treating this as a signed handicap silently inverts large lines —
    detected and corrected here (kalshi spread Brier fell 0.467 → 0.220 once
    fixed; calibration slope −0.23 → +0.82).
- **Total**: over/under vs `final_home_score + final_away_score`; push at equality.
- **Player props**: settled against player final stats reconstructed from
  play-by-play (below). over/under use strict comparison with a push at integer
  equality; yes/no (milestones, double/triple-double) use `>= threshold`.
- **Pushes** (whole-number lines landing exactly on the result) are excluded
  from Brier/log-loss and reported separately — never counted as 0.5 outcomes.
- Only **full-game** markets are settled; period/half/quarter/OT markets are
  excluded via display-label detection.

## Player-prop settlement via play-by-play

`game_outcomes` carries only team scores, so player props are not settleable from
it. Instead, per-player final stats are reconstructed from
`nba_play_by_play_actions`:

- **points / assists** from the cumulative tallies embedded in action
  descriptions (`(N PTS)`, `(N AST)` — the running total; max per player);
- **rebounds** from `(Off:x Def:y)`;
- **threes / field goals** by counting attributed made shots (excluding `MISS`);
- **steals / blocks** from cumulative `(N STL/BLK)` tallies or attributed actions;
- **combination families** (PRA, PR, PA, RA, steals+blocks) by summing;
- **double/triple-double** by counting categories ≥ 10;
- **points-leader** by comparing reconstructed points to the game max.

Player names in PBP ("N. Jokić") are matched to canonical `participant_key`
("nikola-jokic") within each game's own prop roster, using first-initial +
last-name with Unicode-aware parsing and diacritic stripping (an early
ASCII-only bug dropped accented scorers entirely).

**Validation gate:** a game's reconstruction is trusted only if reconstructed
total points reconcile to the final score within ±2. **63 of 64** PBP games
passed; the one that did not is dropped. This gate is why player-prop settled
accuracy is restricted to those games.

## Timing slices

Closing probability at a checkpoint = the **last quote at or before the anchor**
for each `(instrument, source)` (latest across that source's market keys), with
no future leakage. The `(instrument, source)` unit (not `source_market`) is used
so the numbers reconcile exactly to the repo read model.

Universal matrix anchors (available for all settleable games):

| slice | anchor |
| --- | --- |
| `pregame_close` | `games.scheduled_start` (the predictive checkpoint) |
| `tipoff` | game `started_at` from `game_states` |
| `final_settle` | `final_at` from `game_states` (in-game convergence) |
| `post_final_48h` | `final_at + 48h` (post-settlement; trivially correct) |

**Operationalization note:** the spec's `pre_event` / `post_event_5m` /
`quarter_end` slices require per-event anchors from play-by-play, which exist for
only 64 of 487 games. The universal matrix therefore substitutes the game-phase
boundaries above and says so; true event-anchored timing is listed as a gap.

**Freshness caps:** a quote older than a per-slice cap at the anchor is excluded
as stale and counted separately, so a comparison is never biased toward a
least-frequently-updating source. Caps: pregame 12h, tipoff 60m, final 4h,
post-final 50h.

## Comparison hygiene

- **Brier is confounded by line placement.** An efficient O/U line near 50/50
  yields Brier ≈ 0.25 at *any* skill; an extreme line yields a much lower Brier.
  So aggregate per-source Brier is reported *with* calibration slope/intercept
  (line-mix invariant) and *alongside* a like-for-like head-to-head.
- **Like-for-like head-to-head** restricts to canonical instruments where two
  sources quoted the identical `(player, stat, line)` before tip, scored against
  the same realized outcome. This is the only confound-free skill comparison.
- Sample counts are shown on every cell; no source is ranked without its
  coverage next to it. Mapped vs unmapped and exact-line vs mismatch are kept
  distinct (cross-source comparison uses only same-instrument quotes).

## Lead-lag

Directional cross-correlation on 60-second buckets over shared, live-quoted
player props. Only **direction and win-count** are reported: at this bucket
resolution the absolute lag magnitude converges toward `maxLag/2` and is an
artifact, so it is deliberately omitted. A pair is counted only when
co-movement correlation ≥ 0.3.

## Microstructure

Trade-level events (size, notional, volume share, off-price prints) exist only
for Polymarket in this store; Kalshi and Bet365 persist quotes but not trades.
Concentrated prints = a single trade taking ≥ 10% of a market's volume.

## Validation

Custom moneyline-pregame settlement reconciles **exactly** (Brier and sample
count to the digit) against the repo's own `getSignalQualityReport({ closingCutoff: 'pregame' })`
for all three sources (bet365 n=104, kalshi n=972, polymarket n=446). This gate
runs on every build; a mismatch is reported rather than papered over.

## What would close the remaining gaps

- Team-stat aggregation from PBP to settle the team-prop family.
- Box scores / full PBP for the other 423 settleable games to extend player-prop
  settlement and enable true event-anchored timing.
- Kalshi and Bet365 trade ingestion to make microstructure multi-venue.
- Live Bet365 prop capture (not the Odds-API backup path) so Bet365 can be
  evaluated as a live prop signal.
- Manual mapping review (`mapping_resolutions` is currently empty).
