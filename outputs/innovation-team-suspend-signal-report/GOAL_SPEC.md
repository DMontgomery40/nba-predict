# Suspend-Signal Report — Full Controlling Spec (governs the /goal condition)

**The 4000-char goal condition is a condensed table-of-contents of THIS file. This file is authoritative for scope. The condition holds the hard MET/NOT-MET gates inline because the harness cannot follow a link to decide completion.**

## The question
Should bet365 use prediction-market activity (Polymarket trade tape + Kalshi candles + cross-venue board volatility) as an early **suspend/review** signal when an NBA player prop has gone bad via stat misallocation / mis-credit / paired-player attribution — and is it fast + reliable enough to justify integration into the internal bet365 system? Answer with **how many seconds early**, how reliably, and a go/no-go. "We do not know yet" is acceptable only if earned with real experimentation.

## Two phases, two agent-team rounds (agents do real work; never agents prompting agents)
- **Phase 1 — Forensic history.** Document every genuine signal approach in project order: single prop → paired-player/cascade-domino → broad market-structure (off-price/volume-share/liquidity) → whole-board/game-state volatility. Repo-cited (file:line). Exclude idiot bugs; include real pivots and WHY each widened. (`research/01-history-archaeology.md` exists — verify/extend, don't redo.)
- **Phase 2 — FIND THE SOLUTION (not report the problem).** Experiment to find the best signal/algorithm and PROVE it with numbers. Pull MORE prediction-market data via codemode into the DB and backtest it. Many backtests + many case studies. Derive the "worth-the-expense unless we beat Δt seconds" threshold + sensitivity. Everything to the second.

## Core mental model (do not lose)
A stat mistake cascades/dominoes across the whole board: the miscredited player's O/U, their triple-double/PRA, the team quarter-rebounds, AND the rightful player's markets. The exact prop is often the THINNEST/quietest market; the loudest, earliest signal is the whole board lurching vs its own baseline. This is why game-state volatility exists — it is the PRIMARY hypothesis. Real people watching live (TV/in-arena, beating broadcast delay) reprice prediction markets before the data providers; the painful case is bettor wrong + NBA API wrong → book pays against a state later overturned.

## Signal bake-off (the heart of Phase 2)
Compare ≥4 candidate detectors on computed distributions: exact-prop divergence; paired-player; whole-board game-state volatility (equal- AND volume-weighted); off-price/volume-share concentrated print; cross-venue ensemble. Metrics: lead-time distribution (median/IQR/N) of board vs exact-prop vs price-history; false-positive census on non-incident windows (specificity cost). Name a recommended best signal and prove it. Trigger form: single-threshold vs multi-stage board-first-then-fanout vs ensemble.

## Data ground truth
DB `data/signal-console.sqlite` (~52GB; PRAGMA busy_timeout). `quote_ticks` 37M (bet365+PM+kalshi); `market_microstructure_events` 101k = Polymarket-only trade tape, 18 games; `nba_play_by_play_actions` 64 games sub-second `time_actual`. Anchor real-world events to PBP `time_actual` (PROVEN as-played/uncorrected; `captured_at` is batch-backfill garbage). Join trades to games by PBP time window, NOT stored game_id (back-to-back mapping bug: Reaves PM under 223, PBP under 224). Sanitize: drop 0.500 opening anchor, volume_share>1, stale (>300s) deltas. Run board signal on ALL 64 PBP games — do NOT cap at 14.

## Labels
No official DB. Use ALL incidents in `~/.codex/sessions/**` emails (validation only — DO NOT overfit; assigners withheld a full key) + assemble more public incidents via codemode (X.com @nba_elise/@pbpstats/@PDemilord, prediction-market comment threads, NBA corrections), cited with URLs.

## Deliverable
`outputs/innovation-team-suspend-signal-report/report.html` — a rich, INTERACTIVE, self-contained HTML paper built with the frontend-design skill: SVG charts, collapsible "microscope" detail, dense color-coded tables, real typography. NOT a markdown dump, NOT consumer-card aesthetic — Bloomberg-terminal density. 10 sections: Executive question; Bottom-line (answer+confidence+unknowns); Project history; Evidence base; Backtest framework (event defs, labels, metrics, no-future-leakage); Results (per signal + lead-lag + ensemble); MANY case studies (seconds-first); Recommendation (go/no-go + Δt threshold); What would make it unambiguous; Appendix (methodology, archaeology log, external research w/ URLs, algorithm comparison, genuine dead-ends).

## Verbatim personal-view paragraph (include as ONE marked Innovation-Team perspective, not the conclusion)
> "I personally think, based on what I've seen when things are dialed right, based on @nba_elise and V and nba_stats correction calls on X.com as well as various comment threads on the prediction market sites, that there is almost certainly something here. However, we need it hooked into the bet365 internal system to get exact timing of our changes. This is obviously a great deal of time and expense potentially, because it is a massive system that cannot mess up, and going on gut instinct for such a major undertaking is not okay."

## Environment
Subagents need `model: sonnet` (else 400 effort-param error). WebSearch/WebFetch fail — reach internet ONLY via codemode (`mcp__codemode-mcp__execute_code`, Deno fetch, 30s/call). Keep heavy 52GB-sqlite reads in ONE owner (lead) to avoid lock contention; agents do codemode pulls (to a side DB), web/label research, case-study writing. Seconds-first; never fabricate bet365 internal timing.
