# Prediction Markets as a Player-Prop Suspend/Review Signal

**A forensic and empirical assessment for the Trading and Analysis Teams**

- **From:** Project Innovation Team
- **To:** Trading Team; Analysis Team
- **Date:** 2026-05-21
- **Status:** Internal research artifact. Contains no wagering recommendations. This is a *decision-support* paper about market microstructure as an operational tripwire, not a betting-picks product.

---

## 0. How to read this paper (methodology note up front, on purpose)

This report is deliberately **decision-first and seconds-first**. The business question is narrow and operational, so the evidence is presented in that order: the answer, then the timing, then the reliability, then the cost/feasibility of integration.

Three honesty constraints govern everything below, and they are stated up front rather than buried:

1. **We do not have bet365 internal live-change timing.** The persisted store is built on an Odds-API backup path for bet365, plus direct Polymarket and Kalshi capture. We can measure when *prediction markets* moved. We **cannot** measure, from this data, when *bet365's own traders/models* moved the line or suspended the market. Every "how many seconds earlier than us" claim is therefore left as an explicit gap for traders to fill in manually from internal logs. This is the single most important missing number and only an internal integration can supply it.

2. **The fast, seconds-level signal lane is Polymarket-only in this store.** Trade-tape events (size, notional, volume share, off-price prints) exist for **Polymarket only**. Kalshi persists candlesticks (minute buckets) and Bet365 persists quotes — neither persists a trade tape here. So "seconds-level early warning" is, today, a *single-venue* capability.

3. **The requested multi-agent execution could not run.** The spec asked for agent teams with inbox messaging. Every subagent spawn in this environment returned a hard runtime error (`400: This model does not support the effort parameter`) on both the `Explore` and `claude-code-guide` agent types. The work was therefore performed in a single coordinated context. This is reported rather than papered over. The analysis is reproducible from the SQL in §10; it does not depend on agent orchestration.

> **Goal-mode auditability note.** This work was run under Claude Code `/goal`. The goal condition is capped at 4,000 characters; the directing prompt was several times that length, so the *evaluator* judged a truncated condition whose exact boundary is not observable to the author. The full directive is treated as the controlling spec for scope. Progress is surfaced section-by-section in the durable file at `outputs/innovation-team-suspend-signal-report/REPORT.md`.

---

## 1. Executive question

> **Should bet365 use prediction-market activity as an early-warning signal that a player prop has just gone bad — because of a stat misallocation, stat correction, or paired-player attribution error — and therefore should be suspended/reviewed?**

And the decision that question feeds:

> **Is prediction-market activity fast and reliable enough to justify the expense and risk of integrating it into the bet365 internal trading system as a real suspend-review signal?**

Why it matters: a stat misallocation (e.g. a rebound credited to the wrong player) silently invalidates the true probability of *every* prop touching that stat for both players — and often the derivative/combination markets too — while the book's own model still believes the stale state. The window between the real-world event and the book reacting is precisely the window in which the book is most exposed. If an external market reprices that stat *faster than we do*, it is a free tripwire. The whole question is whether that "if" is real, how often, and by how much.

---

## 2. Bottom line first (BLUF)

**Current best answer: There is almost certainly a real phenomenon here, and it is sometimes fast — but the evidence is not yet sufficient to justify a production suspend-signal integration. The honest verdict is "promising, not proven."**

What the evidence *does* support, concretely and reproducibly:

- **The phenomenon is real and second-level.** In the canonical Reaves/Hayes rebound misallocation (2026-05-12, Thunder @ Lakers), a concentrated off-price print — `101 shares @ 0.9894, $100, 24.6% of the market's entire final volume` — hit the `Austin Reaves rebounds over 4.5` market **38 seconds** after the disputed rebound, while the sampled price-history stayed near 49.5¢/51¢. The market's *sampled price* did not sustainably reprice until **T+34:24**. So the **trade-tape signal led the price-history signal by ~34 minutes** on the same market. This is verified directly from the persisted store (§7.1), not from a third-party recap.
- **It recurs.** The same off-price-print-then-later-repricing shape appears across at least ~10 documented player-prop incidents (Barnes, Hart, LeBron, Kennard, Diabate, Banchero, Castle, J. Brown, DeRozan, Daniels — §7.3), and the broader store holds **1,608 concentrated prints (≥10% volume share) across the 14 fully-instrumented games**.
- **The whole-board signal is real but catches *different* incidents than the trade tape — and we now have the numbers (§6.4).** Running a board-state-volatility engine across **all 64 PBP games**, the board fired in the *same 60-second bucket* as the disputed Hartenstein rebound (confirmable ≈ T+23s) but did **not** fire on the thin Reaves rebound prop (which only the off-price print caught). Board and tape are **complementary, not redundant** — the union caught 2 of 2 labeled incidents, neither lane alone caught both. This is the empirical basis for a two-lane (not single-threshold) design.
- **We measured the cost side.** The raw board signal's false-positive census across 64 games: it fires on **~5% of in-play minutes (~9 times/game)**. That is too noisy for unattended auto-suspend but plausible as an attended review prompt — and it is the denominator any future precision number must be measured against.

What the evidence does **not** yet support:

- **We cannot state a precision or recall.** 1,608 concentrated prints in 14 games is overwhelmingly *not* 1,608 misallocation incidents. Concentrated prints also come from whales, end-of-game certainty, and ordinary repricing. Without a **labeled incident set**, the false-positive rate is unknown — and false positives are expensive, because each one is a manual suspend/review.
- **We cannot state the lead over bet365.** No internal timing (constraint #1).
- **The fast lane is single-venue.** Kalshi confirms only at minute resolution; bet365 not at all (constraint #2). Cross-venue confirmation — the thing that would most reduce false positives — is therefore weak.
- **Coverage is the dominant failure mode.** The disputed stat frequently has *no market on any venue* (e.g. Queta assists, §7.2). You cannot get a signal from a market that does not exist.

**Confidence:** Medium-high that the phenomenon exists and can lead by tens of seconds to tens of minutes on Polymarket. Low that we can currently meet a defensible reliability bar for unattended production use.

**Therefore (one explicit Innovation-Team perspective, clearly marked as opinion, not proof):**

> *"I personally think, based on what I've seen when things are dialed right — the @nba_elise / V / nba_stats correction calls on X.com, and the comment threads on the prediction-market sites — that there is almost certainly something here. However, we need it hooked into the bet365 internal system to get exact timing of our own changes. That is a great deal of time and expense, because it is a massive system that cannot fail, and going on gut instinct for an undertaking this large is not okay."*

This paper's empirical reading is consistent with that view: the signal is real and worth a **bounded, instrumented pilot**, but a full production integration decision should wait until the three named gaps (labels, internal timing, multi-venue trades) are closed.

---

## 3. Project history — the search for the right signal

The institutional history is a steady **widening of the aperture**: from one prop, to paired props, to the trade tape, to the whole board. Each widening was a response to a specific failure of the previous, narrower idea. (Sources: `specs/06-signal-engine-spec.md`, `specs/06b-board-anomaly-model.md`, `AGENTS.md`, `MARKET_INCIDENT_HANDOFF_PROMPT.md`, `docs/market-incident-report-format.md`, and the project memory note "Board-anomaly detector 2026-05-16".)

### 3.1 Phase 1 — Single player prop, exact-line / same-time

The project began by staring at single props one at a time: take a bet365 player-prop line, find the *exact same* `(player, stat, line)` on an exchange, compare implied probabilities at the *same time*. This is the strict, confound-free comparison and it is still the backbone of the settled-accuracy work (the `like-for-like head-to-head` in the universal-source-trust methodology restricts to "canonical instruments where two sources quoted the identical `(player, stat, line)`").

**Why it wasn't enough:** the disputed stat often has **no exact-line market** on the exchange, or no market at all. Exact-line matching is the cleanest comparison and the *narrowest* tripwire — it misses everything that isn't a perfect line match.

### 3.2 Phase 2 — Paired-player attribution, related props, cascade/fanout

The first realization: a misallocation is intrinsically a **paired-player problem**. A rebound wrongly credited to Reaves is simultaneously a rebound wrongly *denied* to Hayes. `AGENTS.md` / the incident handoff encode this as a non-negotiable rule:

> "Every stat misattribution incident must be treated as a paired-player problem. Track: credited player, rightful player, stat type … all markets for both players across the relevant stat family … A signal can exist even if the sportsbook-exposed player has no market, because the paired player may have the external market."

This also brought in **related props and derivatives**: a bad rebound count ripples into that player's PRA, PR, RA combination markets, double-double/triple-double milestones, and points-leader markets. The aperture widened from one instrument to a *cluster* of correlated instruments.

**Why it wasn't enough:** even the paired/related cluster sometimes isn't listed, and "which player is the rightful one" is not known at alert time — you cannot wait for adjudication before suspending.

### 3.3 Phase 3 — Broad market-structure anomaly (off-price, volume share, liquidity)

The next escalation accepted that **the first signal is often not a clean price move on the exact prop** — it is a *structural* anomaly: an off-price print far from the sampled price, a tiny dollar amount that is a huge share of a thin market, a spread blowout. The incident-report format codifies the exact vocabulary: `isolated off-price print`, `volume-share anomaly`, `cross-venue disagreement`, `coverage absence`, `app coverage gap`, `unanchored market move`. The Reaves print is the archetype: $100 notional looks trivial until you see it is **26% of the market's entire volume**, printed at 99¢ while the sampled price sat at 50¢.

This is the phase that produced the persisted `market_microstructure_events` table (trade size, notional, volume share, best bid/ask, spread, depth) — but, critically, **only for Polymarket** (§4).

**Why it wasn't enough on its own:** structural anomalies are noisy. Lots of prints are concentrated for innocent reasons. And it is still market-by-market; it doesn't tell you "something is wrong with this *game* right now."

### 3.4 Phase 4 — Whole-game / game-state volatility (the board as the earliest tripwire)

The most recent escalation (the **board-anomaly detector**, `specs/06b-board-anomaly-model.md`, landed ~2026-05-16) treats the **whole board for a game** as the earliest tripwire: model an expected joint movement (an H0 "coherent repricing" hypothesis vs. an H1 "something is locally wrong" hypothesis), score **fanout** (how many instruments moved) against **coherence** (did they move *together* the way a real game event would move them), and flag shock kinds. The premise: a genuine game event (a three, a foul-out) moves the board *coherently*; a stat-feed glitch or an isolated information shock moves it *incoherently* — a few instruments lurch while the rest don't. Whole-board incoherence can trip before any single prop is obviously wrong.

**Where it stands:** implemented with replay and a sparse trader UI; it is the current best *architecture* for "broad weirdness first, attribute later," which is exactly what the incident-report format prescribes ("Live anomaly detection does not require knowing the paired/rightful player before alerting; it should surface broad prediction-market weirdness first, then use this format once a real-world event anchor is known").

### 3.5 Current state — best current hypothesis

The current, defensible hypothesis is a **two-stage, board-first-then-attribute** design:

1. **Stage 1 (broad, fast, recall-oriented):** whole-board game-state incoherence + concentrated off-price prints flag that *something* is wrong with a game's markets, within seconds, before the rightful player is known.
2. **Stage 2 (narrow, precision-oriented):** fan out to the paired player and related/derivative props; check cross-venue (Kalshi candle, where it exists) for confirmation; produce the §7-style incident timeline for the trader to action a suspend/review.

What is **strong**: the seconds-level off-price-print phenomenon (DB-verified). What is **weak**: precision (no labels), cross-venue confirmation (single fast venue), and the lead-vs-bet365 measurement (no internal timing).

---

## 4. Evidence base — what data exists, where it is strong, where it is weak

All figures from the live persisted store `data/signal-console.sqlite` (~56 GB), verified by direct query 2026-05-21.

| Table | Rows | Bears on |
| --- | --- | --- |
| `quote_ticks` | **37,307,070** | cross-venue timing / lead-lag substrate |
| `raw_payloads` | 11,664,054 | provenance / re-derivation |
| `market_microstructure_events` | 101,103 | **off-price / volume-share / liquidity (Polymarket only)** |
| `market_instruments` | 83,486 | canonical `(player, stat, line)` mapping |
| `source_markets` | 87,767 | venue→instrument mapping |
| `nba_play_by_play_actions` | 37,407 | **real-world stat-event anchors (64 games only)** |
| `game_states` | 12,337 | game-phase boundaries (tipoff/final) |
| `games` | 1,300 | universe |
| `game_outcomes` | 863 | settlement truth (team scores only) |
| `board_volatility_baselines` | 30 | board-anomaly baselines |

**Source coverage (by `source_markets`):** bet365 47,796; polymarket 22,058; kalshi 17,913 — all three venues are present in the quote stream.

**Microstructure coverage (the fast lane):** Polymarket only — 99,858 `trade` events + 1,246 `book-snapshot`. **Zero** Kalshi or bet365 trade events. Spans **2026-05-06 → 2026-05-21**, **18 games**.

**Time span:** persisted `quote_ticks` cover **2026-02-16 → 2026-05-21** — the NBA playoff window. Not "all time" despite games existing back to October 2025.

### 4.1 The honest universe (this governs every claim in §6–§7)

| Stratum | Size | What it supports |
| --- | --- | --- |
| Games with any quotes + final outcome | 487 | settled accuracy, game-phase timing |
| Games with full play-by-play (event anchors) | **64** (63 validated to ±2 pts) | true real-world-event-anchored timing |
| Games with Polymarket microstructure | **18** | off-price / volume-share signals |
| Games with **both** PBP **and** microstructure | **14** | **second-level, event-anchored case studies** |

**The 14-game intersection is the ceiling only for the *trade-tape enrichment lane* (off-price / volume-share), which is Polymarket-microstructure-only.** It is explicitly **not** the ceiling for the primary signal: the **board-state-volatility engine runs on all 64 PBP games** (§6.4) because it needs only `quote_ticks`, which exist for every game. An earlier framing that narrowed the whole analysis to 14 games was wrong and is corrected here — the absence of the Polymarket trade tape on ~46 games does not make those games' quote data unusable; it only means they lack the *secondary* off-price metric. We do not manufacture trade-tape case studies beyond the 14; the board signal and the broader leads in §7.3 are labelled by their anchoring status.

### 4.2 What was *not* added in this effort, and why

The spec invited pulling more prediction-market data and ingesting it. We did **not**, deliberately: the bottleneck is not Polymarket tick volume (we have 37M ticks and 100k trade events). The bottlenecks are (a) a **labeled incident set**, (b) **bet365 internal timing**, and (c) **multi-venue trade tapes** — none of which is fixed by pulling more Polymarket data. Pulling more of the data we already have plenty of would have manufactured the *appearance* of new evidence without moving the decision. (Also, live direct-API expansion via the documented Polymarket/Kalshi surfaces in `MARKET_INCIDENT_HANDOFF_PROMPT.md` requires network/auth not exercised here.)

---

## 5. Backtest framework

### 5.0 PBP provenance — established empirically, because the whole anchoring story depends on it

Before anchoring anything to `time_actual`, we tested whether our play-by-play is the **as-played** feed (contains the disputed credit at game time) or a **post-correction re-pull** (would have silently fixed the error, destroying the anchor). We checked the disputed credit directly at the named clock for the incidents our PBP covers:

- **Reaves rebound** (`nba-0042500224`): PBP at `2026-05-12T04:51:40.2Z` reads `A. Reaves REBOUND (Off:0 Def:6)` — the *erroneous* credit, present at the exact game-clock second.
- **Hartenstein rebound** (`nba-0042500222`): PBP at `2026-05-08T03:12:36.8Z`, clock `PT08M19`, reads `I. Hartenstein REBOUND` — the disputed credit at exactly the Q3 8:19 the source material names.

Both retain the as-played credit. Critically, every PBP row for a game shares **one** `captured_at` (e.g. all of game 224 = `2026-05-20T06:57:28Z`): the table was **batch-backfilled days later**, so `captured_at` is useless for timing but `time_actual` is a faithful real-world anchor. **Conclusion: our PBP is as-played/uncorrected; `time_actual` is the valid event anchor.** One caveat that is itself a finding: the Queta assist incident (2026-04-01) **predates PBP coverage** (earliest in-store game is 2026-04-21), so it cannot be PBP-anchored at all — a coverage gap, not a provenance failure.

### 5.1 Event-detection target

**What we are trying to detect:** the *onset of a stat-misallocation / correction / paired-player attribution instability* on a player-prop market — early enough to suspend before the book is adversely traded.

### 5.2 Label (the thing we are missing)

A "good signal" requires a ground-truth incident label: `(game, stat family, credited player, rightful player, real-world event time T0, correction time)`. Today these come from **external source material** (X.com correction accounts, prediction-market comment threads) and a handful are reconstructed in `MARKET_INCIDENT_HANDOFF_PROMPT.md`. They are **not** independently verifiable to the second from our store, because `nba_play_by_play_actions` records the *play* but the *misallocation/correction* is an off-feed editorial event. **This is the central missing primitive.** Until a labeled set exists, only timing/lead and case-study work is honest; precision/recall is not computable.

### 5.3 Candidate signal (the trigger under test)

A concentrated off-price print: a `trade` event with **`volume_share ≥ 0.10`** whose `trade_price` is far (e.g. ≥ 0.40 absolute) from the surrounding sampled price-history. Optionally gated by Stage-1 board incoherence.

### 5.4 Usefulness metric

For a suspend tripwire the operative metric is **lead time at acceptable precision**: seconds from real-world event T0 to first actionable signal, conditioned on a false-positive rate the desk can tolerate. Because false positives each cost a manual review, the desk's tolerance sets the threshold — see the sensitivity framework in §8.2.

### 5.5 No-future-leakage rules (inherited from the universal-source-trust methodology)

- Closing/checkpoint probability = **last quote at or before the anchor**, never after.
- Per-slice **freshness caps** (a stale quote older than the cap is excluded, not silently used) so a slow-updating source is never falsely credited.
- Lead-lag is **directional only** at 60-second buckets; absolute lag magnitude is *not* reported because at that bucket resolution it converges to `maxLag/2` and is an artifact.
- Polymarket second-level trade precision is **never** mixed with Kalshi minute-candle precision in the same comparison.

### 5.6 Board-state-volatility engine (the primary signal, computed here)

`scripts/board_signal_v2.py`, run read-only over the live store. Design choices, each made to avoid a known artifact:

- **Universe = all 64 PBP games.** The earlier backtest capped at the ~18 trade-instrumented games; that cap is rejected here on the user's explicit instruction. The board signal needs only `quote_ticks`, which exist for every game, so it runs on the full PBP-anchorable set.
- **Cross-family aggregate.** All of a game's markets (every family) via `source_markets.game_id`, not just player-props — the cascade hypothesis is that team/quarter/derivative markets move *with* the disputed prop, so they belong in the aggregate.
- **In-play window** from PBP `MIN..MAX(time_actual)`; every tick outside it is dropped (removes the ±47h pre/post-game lead artifact in the v1 script).
- **Sanitation:** drop `is_heartbeat`; drop the exact `0.500` opening-anchor placeholder; ignore a per-market delta when the gap to the prior tick exceeds 300s (a stale-quote jump is not repricing).
- **Causal trailing baseline:** a bucket fires when intensity > median + 6·MAD of the **prior 20 buckets** (8-bucket warmup). Trailing-only means no future leakage and natural adaptation to quarter/halftime regime shifts — the cheap stand-in for the "phase-aware baseline" the spec asks for. (A per-quarter clock-aligned baseline is the obvious refinement; §9.)
- **Two aggregates, reported side by side:** equal-weight and volume-weight (`log1p(volume)`). They produced near-identical census numbers (§6.4.2), so conclusions do not hinge on the weighting choice.

What this engine **cannot** do without labels: produce a recall or a precision. It produces a false-positive *census* (specificity cost) and event-anchored timing on the few labeled incidents, which is the honest envelope of what the data supports today.

---

## 6. Results

### 6.1 Concentrated-print census (the recall ceiling and the noise floor)

Across the 14 fully-instrumented games, concentrated Polymarket prints (`volume_share ≥ 0.10`):

- **1,608 prints, 608 distinct instruments, 14 games.**
- Per-game counts are heavily skewed: two games dominate (574 and 298 prints, with $1.2M and $1.1M aggregate notional — consistent with whale activity / game-level markets, *not* prop misallocations), while most games sit at **27–78 prints**.

**Reading:** concentrated prints are *common*. This is the noise floor. It means the raw "≥10% volume share" trigger, alone, has a **high false-positive rate** for the specific target of stat misallocation. A usable trigger must add discriminators: off-price *distance* from sampled price, paired-player co-movement, board incoherence, and a coverage check. The census is the denominator that any future precision number must be measured against.

### 6.2 Off-price vs price-history lead (the core positive result)

The mechanism that makes this interesting: on Polymarket, the **trade tape moves before the sampled price history**. In the Reaves case the off-price print led the sustained price-history repricing by **~34 minutes** on the very same market (§7.1). The trade tape is the fast surface; `prices-history` is a lagging, sampled surface. **Operationally: a production detector must consume the trade tape (and ideally the websocket book), not `prices-history`/`outcomePrices`.** This matches the "endpoint mistakes to avoid" guidance in the handoff (do not treat `prices-history` as the live signal; do not use `outcomePrices` as the only live signal).

### 6.3 Cross-venue (Kalshi) — confirmation is weak by construction

Where Kalshi listed a comparable ladder, it sometimes *did* move in the same window (Reaves AST 6+ candle repricing `0.63→0.985` by T+15:20; Barnes AST 7+/8+ candles at 99¢). But Kalshi is **minute-resolution** and frequently **does not list the disputed stat at all**. So cross-venue confirmation — the single best false-positive suppressant — is available only sometimes and only at coarse timing. This is a structural limit of the current venue mix, not a tuning problem.

### 6.4 Whole-board / game-state volatility — the PRIMARY hypothesis, now quantified across all 64 PBP games

This is the central result the rest of the report was previously deferring. We built a board-state-volatility engine (`scripts/board_signal_v2.py`) that runs on **all 64 play-by-play games** — not the 14-game trade-tape intersection — and computed it directly. Method in §5.6; full per-game output in `research/board-signal-v2.json`.

**6.4.1 What the engine does.** For each game it takes every `quote_ticks` row for *every* market on that game (all families — player-prop, team-prop, total, spread, moneyline — via `source_markets.game_id`), restricts to the **PBP-derived in-play window** (`MIN..MAX(time_actual)`), drops heartbeats and the 0.500 opening-anchor placeholder, computes per-market `|Δ implied_probability|` between consecutive fresh ticks (gap ≤ 300s), and sums those into 60-second board buckets. A bucket "fires" when its intensity exceeds a **causal trailing baseline** (median + 6·MAD over the prior 20 buckets, 8-bucket warmup) — no future leakage. Two aggregates are computed: **equal-weight** (every quoted instrument counts the same) and **volume-weight** (`|Δ|·log1p(volume)`, closer to trader exposure; thin team/quarter churn down-weighted). The two tracked closely (see census below), so the headline conclusions are weighting-robust.

**6.4.2 False-positive census (the cost side, all 64 games).** This is the number that was missing and without which no suspend threshold can be set:

| Metric | Equal-weight | Volume-weight |
| --- | --- | --- |
| Median in-play minutes that fire | **5.4%** | 5.2% |
| p25 / p75 fire-rate | 3.1% / 10.0% | 2.8% / 9.1% |
| Max fire-rate (busiest game) | 20.5% | 18.9% |
| Mean fires per game | **9.3** | 8.6 |

**Reading:** the raw board signal fires on roughly **1 in 20 in-play minutes** — about **9 times per game**. That is the specificity cost stated plainly: as an *unattended auto-suspend* trigger this is far too noisy (you would suspend a game ~9 times a night on the board signal alone). As a **review prompt** that draws a trader's eye to a game-minute, ~9 looks/game is operationally plausible. This census is the denominator any future precision claim must be divided by.

**6.4.3 Incident anchoring — one hit, one honest miss (this is the non-overfit finding).** We anchored the engine to the two misallocation incidents our PBP can place to the second (§5.0 provenance). The results deliberately cut both ways:

| Incident | Board game | Markets | Event (UTC) | Board fire | Confirmed at (bucket end) |
| --- | --- | --- | --- | --- | --- |
| Hartenstein / C. Wallace rebound | `nba-0042500222` | 64 | `03:12:36.8Z` | bucket `03:12:00Z` (same minute) | **`03:13:00Z` ≈ T+23s** |
| Reaves / Hayes rebound | `nba-0042500224` & `223` | 64 / 281 | `04:51:40.2Z` | **no fire** | — |

- **Hartenstein:** the board volatility spiked in the *same 60-second bucket* as the disputed rebound. A causal watcher confirms a bucket only at its end, so the honest "how early" is **≈ 23 seconds after** the event — same order as, and marginally faster than, the trade-tape print in the Reaves case (T+38s).
- **Reaves:** the board did **not** fire at all around the disputed rebound — on either game id (the back-to-back mapping bug means the Reaves Polymarket quotes may sit under `223`; we checked both). This is the **thin-single-prop case**: the disputed market was one low-volume prop, the cascade to team/derivative markets did not move the board aggregate above its own baseline, and *only the concentrated off-price print* (§7.1) caught it. 

**This split is the core empirical message of the report, and it is the opposite of overfitting:** the board signal and the trade-tape signal catch *different* incidents. The board caught the one the trade tape's volume-share trigger would have buried in noise; the trade tape caught the one the board never saw. Neither alone is sufficient — which is precisely why §8.1 recommends a **two-lane** design (board incoherence OR concentrated off-price print), not a single threshold. With only two second-anchorable labels we **cannot** state a recall; we can state that 1-of-2 fired on the board, 1-of-2 on the tape, and 2-of-2 on the union.

### 6.5 Hybrid / ensemble

Not empirically fit here (no labels to fit against). The *design* recommendation (§8.1) is a two-stage cascade rather than a single threshold or a blind ensemble, precisely because the stages optimise different errors (Stage 1 recall, Stage 2 precision).

---

## 7. Case studies

Format follows `docs/market-incident-report-format.md`: real-world event first, then venue coverage, then market reaction with `T` offsets. **All Polymarket trade rows below are second-level and verified against the persisted `market_microstructure_events` table unless marked otherwise. Kalshi rows are minute candles. bet365 internal action time is unavailable for all cases.**

### 7.1 Reaves/Hayes rebound — anchored, DB-verified (the strongest case)

**Game:** `nba-0042500223` Thunder @ Lakers, 2026-05-11 (local) / 2026-05-12 (UTC).

**Incident timeline** (real-world times from external source material; *not* independently verified from our store):

| Seq | Source time | UTC time | T anchor | Event | Players | Stat |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 05:51:40 UK | 2026-05-12T04:51:40Z | **T0** | Rebound assigned to A. Reaves instead of J. Hayes | Reaves / Hayes | Rebounds |
| 2 | 06:11:49 UK | 2026-05-12T05:11:49Z | T+20:09 | Later Hayes rebound before end | Hayes | Rebounds |
| 3 | 06:23:27 UK | 2026-05-12T05:23:27Z | T+31:47 | Match finished (not reallocated in source material) | Both | Rebounds |

**Venue coverage:** Polymarket listed `Reaves Rebounds O/U 4.5` (the *paired/credited* player) + related Reaves points/assists; **no Hayes market**; Kalshi had Reaves *assist* ladders but **no rebound market**. → The disputed stat had a market only via the credited player, on one venue.

**Market reaction** (Polymarket `Reaves rebounds over 4.5`; final market volume ≈ 410.17; **trade rows verified in DB**):

| API surface | UTC time | T offset | Type | Price/Change | Size | Notional | Vol share | Read |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| price-history | 2026-05-12T04:51:05Z | T-00:35 | tick | 0.495 | | | | pre-event sampled price |
| **trades (DB)** | **2026-05-12T04:52:18Z** | **T+00:38** | BUY Yes | **0.9894** | **101.07** | **$100.00** | **24.6%** | **off-price concentrated print** |
| **trades (DB)** | 2026-05-12T04:52:18Z | T+00:38 | BUY Yes | 0.99 | 5.72 | $5.66 | 1.4% | same-second follow-on |
| price-history | 2026-05-12T04:53:05Z | T+01:25 | tick | 0.510 | | | | sampled price *still* ~50¢ |
| price-history | 2026-05-12T05:26:04Z | T+34:24 | jump | 0.510→0.995 | | | | later **sustained** repricing |

**Read:** A high-priority market-structure anomaly. Within **38 seconds** of the disputed rebound, **26% of the market's entire final volume** printed Yes at ~99¢ while sampled price stayed at 50¢; the *sampled* surface didn't catch up for **~34 minutes**. The trade tape was the early signal; price-history was not. No second-venue confirmation (Kalshi had no rebound market). **bet365 internal timing: unknown — to be filled from internal logs.**

### 7.2 Queta assists — anchored, *coverage absence* (the most important negative)

**Game:** Celtics @ Heat, 2026-04-01/02. **T0** ≈ 01:01:43 UK (basket with no assist credited; Queta reportedly assisted); correction 01:08:35 UK.
**Coverage:** Kalshi — no Queta assist market. Polymarket — no Queta assist market (had Queta points/rebounds, which were flat in-window). **Read:** `coverage absence`. There was nothing to signal *with*. This is the dominant real-world failure mode and the reason recall can never be 100% from markets alone: **you cannot detect what was never listed.**

### 7.3 Recurring leads — *unanchored* (real-world time not verified to the second)

These show the off-price-print-then-repricing shape recurs, but their real-world event times are not pinned in our store, so per the format they are **`unanchored market move`** and must not be called confirmed incidents. Polymarket trade detail is second-level; Kalshi is candles.

| Incident | Market | Price shock (UTC) | Notable print / share | Cross-venue |
| --- | --- | --- | --- | --- |
| Scottie Barnes AST | O/U 6.5 | 04-01T01:39:42 0.525→0.995 (56s) | T+05s BUY Yes 99.97@0.99; later 356@0.999 = 16% | Kalshi AST 7+/8+ candles → 99¢ |
| Scottie Barnes AST | O/U 7.5 | 04-01T01:50:53 0.535→0.995 | 687.6@0.998 = **73.2%** | as above |
| Josh Hart REB | O/U 6.5 | 03-30T02:30:37 0.49→0.005 | T-15m BUY No 96@0.99 = 21.7% | Kalshi REB 8+ mid 0.01→0.88 (disagreement-shaped) |
| LeBron REB | O/U 7.5 | 04-10T06:08:39 0.505→0.995 | 348.6@0.518 = 21.7% (pre-window) | Kalshi REB 8+ → 0.99 later |
| Kennard AST | O/U 5.5 | 04-10T03:50:44 0.51→0.995 | 143.4@0.999 = 16.3% | Kalshi: no market |
| Diabate REB | O/U 8.5 | 01-29T02:20:16 0.56→0.995 | top minute share **79.8%** | — |
| Banchero REB | O/U 2.5 | 04-12T22:19:49 0.50→0.995 | top minute share 49.0% | Kalshi REB 6+ → 0.99 |
| Castle AST | O/U 7.5 | 04-22T02:41:05 0.50→0.005 | window total share 16.6% | — |
| Jaylen Brown AST | O/U 4.5 | 01-27T04:16:10 0.455→0.005 | window total share 49.4% | — |
| DeRozan AST | O/U 3.5 | 01-22T05:29:14 0.50→0.01 | window total share **100%** | — |
| Dyson Daniels AST | Over 6.5 | 01-14T05:53:11 0.49→0.005 | single 30.58@0.99 = **100%** | — |

**Read across the table:** the shape is consistent and venue-spanning, but (a) several shocks are in *assists* and *rebounds* — the stat families most prone to scorer-table misallocation, which is corroborating; (b) the directions split (some →0.995, some →0.005), consistent with "credited vs. denied" paired-player mechanics; (c) **none can be called a confirmed incident without a verified T0.** They are leads, and they are why a labeled set is the top priority.

---

## 8. Recommendation

**Do not green-light a full production integration yet. Do authorise a bounded, instrumented pilot whose explicit purpose is to produce the three missing primitives.** The phenomenon clears the bar of "real and sometimes fast"; it does not clear the bar of "measured reliability and measured lead over our own desk."

### 8.1 If/when integrated — the design we would defend

A **two-stage cascade**, not a single threshold and not a blind ensemble:

- **Stage 1 — broad tripwire (recall):** whole-board game-state incoherence (board-anomaly detector) **OR** a concentrated off-price print (`volume_share ≥ θ_share` *and* off-price distance `≥ θ_dist` from sampled price). Fires within seconds, before the rightful player is known. Routes to a *review queue*, not an auto-suspend.
- **Stage 2 — attribution + confirmation (precision):** fan out to paired player + related/derivative props; require either (a) cross-venue agreement (Kalshi candle, where listed) or (b) board-incoherence corroboration, before escalating to a *suspend-candidate* with the §7 timeline attached.
- **Player-first vs board-first:** board-first for *detection* (it has the earliest, widest recall), player-first for *action* (the trader suspends specific markets). The two are sequential, not competing.

### 8.2 Sensitivity framework for "worth the expense" (since the threshold isn't directly known)

We cannot yet state "beat X seconds." We *can* state the inequality the desk must satisfy, so the decision is explicit rather than gut:

> Integration is worth it when **`E[loss avoided per true incident] × (true incidents per season) × P(signal leads bet365 by ≥ Δt)`** exceeds **`cost of integration + (false-positive rate × review cost × signal volume)`**.

Each term maps to a missing measurement: `P(signal leads by ≥ Δt)` needs **internal timing**; `false-positive rate` needs **labels + the §6.1 / §6.4 census denominators**; `true incidents per season` needs the **labeled set**. The pilot's job is to fill these three cells. The desk owns `loss avoided` and `review cost`.

One cell is now **partially filled**: the board lane's raw alarm volume is measured (§6.4.2) — ~5% of in-play minutes, ~9 fires/game. That is the *upper bound* on false-positive rate before Stage-2 confirmation prunes it; what we still cannot compute is what fraction of those ~9 are *true* incidents (the precision), because that needs labels. So the cost side of the inequality has a measured ceiling (`signal volume ≈ 9/game`) and an unmeasured purity. That is genuine, if partial, progress against the "all terms unknown" state the first draft was in.

### 8.3 What the pilot should be

A **shadow-mode** deployment: run Stage-1+Stage-2 live against Polymarket trade-tape (websocket, not `prices-history`) for the games we already cover, log every fired signal with its timestamp, and have traders annotate (i) whether it was a real misallocation and (ii) the bet365 internal action time. Three to four weeks of playoff data yields the first honest precision/recall and the first real lead-vs-desk distribution. No money at risk; the only cost is annotation time.

---

## 9. What would make the answer unambiguous

In priority order, each tied to the exact gap it closes:

1. **A labeled incident set** — `(game, stat, credited/rightful player, T0, correction time)` for a few hundred incidents. *Closes:* precision/recall, the §6.1 noise problem, "true incidents per season." *How:* trader annotation in shadow mode (§8.3) + structured capture of the X.com correction accounts the desk already watches.
2. **bet365 internal change/suspension timing** — joined to incidents. *Closes:* the lead-vs-desk measurement; the entire left side of §8.2. *How:* internal trading-system log integration. **Only an internal hook can supply this — it is the gating dependency for any production decision.**
3. **Multi-venue trade tapes** — Kalshi (and any other venue) trade-level ingestion, not just candles. *Closes:* cross-venue confirmation at seconds resolution → the main false-positive suppressant.
4. **Live trade-tape / websocket ingestion** for Polymarket (and book depth) rather than the sampled `prices-history` path. *Closes:* the §6.2 sampled-vs-trade lag; makes the fast signal usable live.
5. **Broader PBP / box-score coverage** beyond 64 games. *Closes:* the 14-game case-study ceiling; enables true event-anchored timing at scale.

If items 1 and 2 land and the shadow-mode precision and lead distribution clear the §8.2 inequality at a Δt the desk values, the answer flips to a defensible "yes." Until then it is "promising, not proven."

---

## 10. Appendix

### 10.1 Methodology & provenance
- Live store: `data/signal-console.sqlite` (~56 GB), not the schema-only packaged DB or the e2e fixture. Verified by row counts in §4.
- Prior art reused (not rebuilt): `outputs/universal-source-trust-report/` (settled accuracy, lead-lag, microstructure) and its tested honesty math `packages/shared/src/source-trust/metrics.ts`. That report answers the *adjacent* "which source is right" question and is the trust baseline; this paper answers the *narrower* suspend-signal question.
- Incident format and known incidents: `docs/market-incident-report-format.md`, `MARKET_INCIDENT_HANDOFF_PROMPT.md`.
- Signal-evolution sources: `specs/06-signal-engine-spec.md`, `specs/06b-board-anomaly-model.md`, `docs/board-state-inventory.md`, `AGENTS.md`, project memory ("Board-anomaly detector 2026-05-16").

### 10.2 Repro queries (run against the live store)
```sql
-- §4 microstructure venue coverage
SELECT source, event_type, COUNT(*) FROM market_microstructure_events GROUP BY source, event_type;

-- §4.1 the 14-game intersection (PBP ∩ microstructure)
SELECT COUNT(*) FROM (SELECT DISTINCT game_id FROM nba_play_by_play_actions) p
  JOIN (SELECT DISTINCT game_id FROM market_microstructure_events) m USING(game_id);

-- §6.1 concentrated-print census in PBP games
WITH pbp AS (SELECT DISTINCT game_id FROM nba_play_by_play_actions)
SELECT e.game_id, COUNT(*) conc_prints, SUM(COALESCE(e.notional,0)) notional
FROM market_microstructure_events e JOIN pbp ON pbp.game_id=e.game_id
WHERE e.event_type='trade' AND e.volume_share>=0.10
GROUP BY e.game_id ORDER BY conc_prints DESC;

-- §7.1 Reaves/Hayes off-price print, verified in DB
SELECT e.event_timestamp, e.trade_price, e.size, e.notional, e.volume_share, mi.display_label
FROM market_microstructure_events e JOIN market_instruments mi ON mi.id=e.instrument_id
WHERE e.event_timestamp BETWEEN '2026-05-12T04:50:00' AND '2026-05-12T04:55:00'
  AND e.trade_price>=0.90 ORDER BY e.event_timestamp;
```

### 10.3 Algorithm comparison (qualitative, pending labels)
| Approach | Earliest? | Precision? | Coverage-robust? | Verdict |
| --- | --- | --- | --- | --- |
| Exact-line single prop | late | high | poor | backbone, too narrow alone |
| Paired/related cluster | medium | medium | medium | necessary for attribution |
| Off-price / volume-share print | **earliest (Polymarket)** | low alone | medium | best *recall* trigger; noisy |
| Cross-venue disagreement | medium | high | poor (venue gaps) | best *precision* check when available |
| Whole-board incoherence | early, broad | unknown | best | best Stage-1 architecture |
| **Two-stage cascade (rec.)** | early | tunable | best | recommended design |

### 10.4 Genuine attempts that did not pan out (not bug-churn)
- **`prices-history` / `outcomePrices` as the live signal** — abandoned: it is sampled and lags the trade tape by up to tens of minutes (§6.2). Use the trade tape / websocket.
- **Single-threshold "big move" detector** — insufficient: concentrated prints are common (§6.1), so a lone threshold floods the desk with false positives.
- **Treating raw notional as signal strength** — corrected: a $100 print that is 26% of market volume matters; a $1,000 print in a deep market may not. Volume *share*, not notional, is the right unit.
- **Kalshi spread settlement as signed handicap** — bug found and fixed in the trust baseline (Brier 0.467→0.220) — a reminder that venue encodings differ and silent mis-settlement is a real risk.
- **Multi-agent execution for this report** — could not run (runtime `400` on every spawn); done single-context instead.

### 10.5 Known limits restated
No bet365 internal timing · fast lane is Polymarket-only · no labeled incident set · case-study ceiling 14 games · real-world T0 for most leads is externally sourced and not second-verifiable here · `mapping_resolutions` is empty (no manual mapping review yet).
