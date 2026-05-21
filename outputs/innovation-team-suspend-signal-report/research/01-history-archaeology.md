# Signal Idea Evolution: Forensic Archaeology

**File:** `outputs/innovation-team-suspend-signal-report/research/01-history-archaeology.md`  
**Date produced:** 2026-05-21  
**Method:** grep corpus search across all non-node_modules source; full read of AGENTS.md, README.md, TODO.md, MARKET_INCIDENT_HANDOFF_PROMPT.md, NEXT_AGENT_HANDOFF_PROMPT.md, specs/01-product-requirements.md, specs/05-api-spec.md, specs/06-signal-engine-spec.md, specs/06b-board-anomaly-model.md, docs/board-state-inventory.md, docs/market-incident-report-format.md, docs/source-materials/bet365_nba_signal_console_memo.md, bet365_nba_signal_console_proposal.md, PLAN.md, TODO.md; `git log --oneline -50`.

---

## Summary of term-scan hits (which files carry substantive signal-concept content)

| Term group | Primary substantive files |
|---|---|
| player-prop-alert / player_prop_alert | specs/05-api-spec.md:33-34, README.md, PLAN.md, specs/01-product-requirements.md:FR-013/FR-014 |
| signal-mismatches / signal_mismatch | specs/05-api-spec.md:32, README.md, PLAN.md, specs/06-signal-engine-spec.md |
| exact-line / same-time | AGENTS.md:151, specs/06-signal-engine-spec.md:SIG-005/SIG-007/SIG-009, specs/02-ux-spec.md:UX-025, README.md |
| paired player / paired-player | AGENTS.md:104-115, TODO.md:28-65, MARKET_INCIDENT_HANDOFF_PROMPT.md:67-82, specs/06-signal-engine-spec.md:SIG-013 |
| fanout / cascade | specs/06b-board-anomaly-model.md:§6, specs/06-signal-engine-spec.md:SIG-013-SIG-014, AGENTS.md:67, PLAN.md, packages/shared/src/board-anomaly/fanout.ts |
| market-anomalies / board-alerts / board-volatility | specs/05-api-spec.md:35-40, README.md, PLAN.md, specs/06b-board-anomaly-model.md |
| game-state-volatility / whole-board | specs/06b-board-anomaly-model.md:§3A, AGENTS.md:67, PLAN.md:67-68, README.md:26-28 |
| off-price / volume share / liquidity shock | AGENTS.md:138-151, TODO.md:91-111, MARKET_INCIDENT_HANDOFF_PROMPT.md, specs/06-signal-engine-spec.md:SIG-008/SIG-012 |
| cross-venue disagreement | specs/06-signal-engine-spec.md:SIG-008, specs/06b-board-anomaly-model.md:§2, AGENTS.md:150 |
| signal-quality / closed-games | README.md:305, PLAN.md:17, specs/06-signal-engine-spec.md:SIG-007 |
| delta-series / lead-lag | README.md:217-218, PLAN.md, specs/05-api-spec.md |
| replay | specs/06b-board-anomaly-model.md:§9, specs/01-product-requirements.md:FR-019, PLAN.md:Goal |
| market_microstructure_events | docs/board-state-inventory.md:table, README.md:297-298 |
| suspend / seconds | AGENTS.md:61/65, PLAN.md:Goal/100, specs/01-product-requirements.md:FR-019/FR-020 |
| prediction-market weirdness | AGENTS.md:110, TODO.md:37-59, docs/market-incident-report-format.md:7 |
| stat misallocation / misattribution | AGENTS.md:82, TODO.md, MARKET_INCIDENT_HANDOFF_PROMPT.md |
| event-context | specs/05-api-spec.md:38/API-015-017, README.md:301 |

---

## Chronological Narrative

### Phase 1 — Single player-prop, exact-line / same-time, strict Bet365-vs-exchange lane

**Approximate period: pre-repo to commit `b888c00` (2026-04-21) through `f696436` (2026-04-22)**

The idea begins in `bet365_nba_signal_console_proposal.md` and `docs/source-materials/bet365_nba_signal_console_memo.md`, both treated as pre-code source documents.

The proposal's Section "1. Divergence Radar" describes the original signal as a weighted z-score of `abs(bet365_prob - kalshi_prob)` and `abs(bet365_prob - polymarket_prob)`, centered on the pregame moneyline:

> "For every game and market type, compare: bet365 implied probability, Kalshi implied probability, Polymarket implied probability …" (`bet365_nba_signal_console_proposal.md`, §"Core product concept / 1) Divergence Radar"`)

The memo reinforces this: "The strongest version of the idea … build an internal trader console that continuously compares bet365 prices and exposure against Kalshi, Polymarket, and NBA context." (`docs/source-materials/bet365_nba_signal_console_memo.md`, "Executive Summary")

At this stage the product was explicitly framed as pregame, winner-market-first, and then props:

> "MVP scope: NBA winner markets first, pregame focus, Kalshi + Polymarket + bet365 + nba_api, ranking, alerting, and explanation, one-screen desktop console, backtest module for signal quality." (`bet365_nba_signal_console_proposal.md`, "MVP scope")

The first code commit (`b888c00`, 2026-04-21) produced the foundational monorepo: routes for `/divergence`, a Python nba_api sidecar scaffold, and a live-only schema. The divergence route required **same-time Bet365-vs-exchange quotes on the same canonical instrument** — the codified form of Phase 1. This requirement persists today as `SIG-005` in `specs/06-signal-engine-spec.md`:

> "A probability divergence is valid only when Bet365 and at least one non-Bet365 market source have quotes inside the configured same-time window for the same canonical instrument." (`specs/06-signal-engine-spec.md:13`)

The player-prop alert route (`/api/v1/research/player-prop-alerts`) directly descends from this phase and retains its Phase 1 semantics: it "compares fresh mapped Bet365 props against Kalshi/Polymarket, filters by configurable divergence threshold and quote-time window, **fails closed on player/outcome or line mismatch**" (`README.md:303`, emphasis added). The `exact-line` compatibility framing is explicit: "The existing prop-alerts route remains a stricter exact-line compatibility surface." (`specs/02-ux-spec.md:UX-025`)

`SIG-009` names this explicitly: "Exact-line Bet365 requirements remain scoped to the player-prop alert compatibility route." (`specs/06-signal-engine-spec.md:17`)

**Genuine pivot that ended Phase 1:** The Queta assists example (Celtics at Heat, 2026-04-01 / 04-02) revealed the fatal limitation. Neither Kalshi nor Polymarket listed a Queta assists market for that game. The exact-line, same-time, strict Bet365-vs-exchange lane produces no signal when the venue simply does not list the disputed market. `MARKET_INCIDENT_HANDOFF_PROMPT.md` documents the finding verbatim: "Kalshi did not list a Neemias Queta assist market for that game. Polymarket did not list a Neemias Queta assist market for that game." (`MARKET_INCIDENT_HANDOFF_PROMPT.md:222-224`) The correct interpretation: "Do not say the market ignored the event; the relevant market did not exist on the checked venues." (`MARKET_INCIDENT_HANDOFF_PROMPT.md:227`)

This coverage-absence problem cannot be solved by better matching logic. It required a different aperture.

---

### Phase 2 — Paired-player / related-prop / cascade / fanout

**Approximate period: commit `404a874` (2026-05-14) — market anomaly detection workflow added**

The first architectural expansion accepted that a stat misallocation is intrinsically a **paired-player problem**. `TODO.md` encodes the lesson directly from the incident review:

> "For stat-feed mistakes, there are usually at least two affected players once the incident is understood: credited player: got the stat in the live feed but may not deserve it; rightful player: should have received the stat, or should have received the shot/rebound/assist/steal/block context. The incident forensics workflow must not only search the named player in the market row. It must scan both sides of the attribution when the pair is known." (`TODO.md:28-36`)

`AGENTS.md` encodes the same rule as a non-negotiable operating constraint:

> "Every stat misattribution incident must be treated as a paired-player problem. Track: credited player, rightful player, stat type, original event time, correction time if known, later relevant play time if known, all markets for both players across the relevant stat family, alternate lines and related stat families." (`AGENTS.md:107-116`, §"Analyze Paired Players and Related Props When Known")

This phase also widened the instrument scope to **compound-stat relations** (rebounds → RA/PRA/double-double/triple-double) and **scoring relations** (assist → team total / period / race-to-X). The coherence graph in `specs/06-signal-engine-spec.md:SIG-013` codifies this:

> "Observations are grouped into coherent incident clusters using a relation graph: … stat family (points, rebounds, assists, threes, steals, blocks, RA, PRA, double-double, triple-double, team total, period, race-to-X, moneyline, spread, total), compound-stat relation …, scoring relation …, mapped/unmapped label-token similarity when no mapping exists yet." (`specs/06-signal-engine-spec.md:SIG-013`)

The Reaves/Hayes rebound incident (Thunder at Lakers, 2026-05-11/12) is the empirical anchor for Phase 2. The sportsbook exposure was on **Jaxson Hayes** rebounds, but the only external-venue signal was on **Austin Reaves** rebounds O/U 4.5 — the paired player who received the misattributed stat. `MARKET_INCIDENT_HANDOFF_PROMPT.md:239-258` documents this cross entirely:

> "A signal can exist even if the sportsbook-exposed player has no external market, because the paired player may have the external market." (`AGENTS.md:115`)

**Genuine pivot that ended Phase 2:** Phase 2 is still retrospective. It requires knowing which two players are paired, which stat family is in dispute, and which alternate lines to search. The live alert workflow cannot wait for human adjudication. `TODO.md` captures the tension:

> "The live alert workflow is different: it should not wait until the rightful player is known. It should scan broadly for prediction-market weirdness, including off-price prints, volume-share anomalies, sudden repricing, liquidity shocks, and cross-venue disagreement across mapped and unmapped markets." (`TODO.md:37`)

---

### Phase 3 — Broad market-structure weirdness (off-price, volume share, liquidity, cross-venue)

**Approximate period: commit `404a874` (2026-05-14) — market anomaly detection; concurrent with Phase 2 recognition**

The Reaves/Hayes incident provides the clearest single example that made Phase 3 necessary. The print was $105.66 notional — trivially small in absolute terms — but it was **26% of the market's entire final volume**, printed at 99¢ while the sampled CLOB price sat at 49.5¢/51¢. `TODO.md:91-111` codifies this as the "off-price concentrated print" lesson:

> "Classify incident-window trades with both absolute and relative context: absolute notional in the tight window, share of total market volume, distance between trade price and nearest pre/post price-history ticks, whether the trade produced sustained repricing … In the Reaves/Hayes case, the 99c Polymarket buys should be described as a high-priority isolated anomalous print: about 26% of final market volume traded at 99c, 38 seconds after the disputed stat event, while surrounding sampled prices stayed near 49.5c/51c." (`TODO.md:93-111`)

`AGENTS.md` encodes the microstructure vocabulary as a standing operating rule:

> "Treat Volume Share As A First-Class Signal … Concentrated off-price prints are high-priority market-structure alerts. Example: 26% of a market trading at 99c while sampled prices stay near 50c is a major anomaly even if the raw notional is small." (`AGENTS.md:138-146`, §"Treat Volume Share As A First-Class Signal")

> "Live detection should prioritize any abnormal prediction-market activity, not only exact player-prop attribution rows. Escalate off-price prints, sudden volume share, volatility shocks, liquidity/spread shocks, and cross-venue disagreement across Kalshi and Polymarket." (`AGENTS.md:149-151`, §"Live Market Weirdness Comes First")

The implementation is the `market_microstructure_events` table and the `/api/v1/research/market-anomalies` route. `specs/01-product-requirements.md:FR-015` codifies the requirement:

> "The product shall expose generalized prediction-market anomaly alerts across Kalshi and Polymarket markets, including off-price prints, volume-share anomalies, volatility shocks, liquidity shocks, and cross-venue disagreement. These alerts do not require knowing a paired/rightful player at detection time." (`specs/01-product-requirements.md:FR-015`)

`SIG-008` refines the scoring model:

> "Prediction-market anomaly alerts rank broad market weirdness across Kalshi and Polymarket before exact attribution is known. Scoring combines off-price prints, volume share, volatility, liquidity/spread/depth, and cross-venue disagreement, with lower confidence for sampled/candle-only evidence." (`specs/06-signal-engine-spec.md:SIG-008`)

The commit `404a874` (2026-05-14) materialized this phase in code: `market_microstructure_events` schema, `MarketAnomaliesPage.tsx`, `market-anomaly-watch.ts`, and the `docs/market-incident-report-format.md` were all introduced together.

**Critical limitation discovered in Phase 3:** The fast, seconds-level signal lane runs on Polymarket trade-tape events only. `docs/board-state-inventory.md` is explicit: "Kalshi persists candlesticks (minute buckets) and Bet365 persists quotes — neither persists a trade tape here. So 'seconds-level early warning' is, today, a single-venue capability." (`README.md`-derived; inventory confirmed in `docs/board-state-inventory.md:§"Source Coverage Today"`).

This single-venue limitation means cross-venue confirmation — the feature that would most reduce false positives — is currently weak for the trade-tape signal. Concentrated prints are also produced by whales, end-of-game certainty, and ordinary thin-market repricing; without a labeled incident set, the false-positive rate is unknown.

**Genuine pivot that ended Phase 3 (or rather, elevated it):** Even with market-structure anomalies per instrument, no single-instrument signal reliably tells the trader "something is wrong with this *game right now*." The correlation between off-price prints in one market and a live stat error requires finding the right instrument first. The next escalation moved to treating the whole board as the earliest tripwire.

---

### Phase 4 — Whole-game / game-state volatility, whole board as earliest tripwire

**Approximate period: commit `19e8220` (2026-05-16) — board-anomaly detector added; refined in `4a5d415`, `afd2753` (2026-05-16 to 2026-05-20)**

The board-anomaly detector, landed in commit `19e8220` (2026-05-16, "Add board-anomaly detector, vig-adjusted incidents desk, Kalshi trades adapter, PBP-anchored Inspect timeline"), is the most architecturally complete change in the repo's history. It introduces 1529 lines in `packages/shared/src/board-anomaly-repository.ts`, 303 lines in `packages/shared/src/board-anomaly/detector.ts`, 279 lines in `packages/shared/src/board-anomaly/fanout.ts`, and 289 lines in `packages/domain/src/board-anomaly.ts`.

The core premise, stated in `specs/06b-board-anomaly-model.md:§2`, is to score board movement against two hypotheses:

> "H0 — normal market dynamics: the change Delta B(t) is explainable by time-to-tip, ordinary pregame drift, period/clock/score/margin, latency and quote age, normal sportsbook line repricing, normal prediction-market bid/ask noise, ordinary close-game global repricing, and per-venue baseline volatility. H1 — abnormal incident: the change is more likely under at least one of the following incident shapes: pregame availability shock; near-tip availability shock; game-state implied-volatility shock …; attribution-shaped in-game shock …; market-structure shock …; cross-surface disagreement …; coverage/mapping/timing gap …" (`specs/06b-board-anomaly-model.md:§2`)

The `game-state-volatility` shock kind is the one where prediction markets reprice the **whole game** across moneyline/spread/total/team prop buckets simultaneously. This is the earliest board-level tripwire:

> "game-state volatility shock: prediction-market residual movement is abnormal for the current phase, is confirmed by the core game-state families (moneyline, spread, total, team-prop), and survives the shared board-stress filter; player props remain supporting evidence, not the headline entity." (`specs/06b-board-anomaly-model.md:§7`, shock-kind table)

`AGENTS.md:67` encodes the trader-first rationale:

> "Broad market or whole-board volatility is valid when it acts as the earliest tripwire, but it is not enough on its own. The operator-facing follow-up must fan out into the affected players, props, and related derivative markets." (`AGENTS.md:67`)

The PLAN.md goal statement makes the temporal logic explicit:

> "The primary job is to warn fast enough that a trader can suspend the affected player props and related derivative markets when a stat may be misattributed or otherwise unstable. Broad whole-board volatility and prediction-market weirdness are still valuable, but as the earliest tripwire, not the final answer. The product should fan out from the first tripwire into the implicated players, stat families, and suspension targets, while historical replay answers what the trader would have seen and **how many seconds earlier the warning could have arrived**." (`PLAN.md:Goal`, emphasis added)

The fanout/coherence graph (`specs/06b-board-anomaly-model.md:§6`) handles the transition from whole-board signal to player-specific follow-up:

> "A single residual is suggestive; a coherent fanout is evidence. The detector groups residuals into candidate incident clusters using a relation graph: same game (always), mapped player (when participant_key resolves), possible paired player …, stat family …, compound-stat relation …, scoring relation …" (`specs/06b-board-anomaly-model.md:§6`)

The replay spec (`specs/06b-board-anomaly-model.md:§9`, `specs/01-product-requirements.md:FR-019`) directly answers the "how many seconds earlier" question:

> "The product shall replay completed-game history through the same online detector with no future leakage, surfacing what the trader would have seen, how many seconds earlier a warning could have appeared, and which related players or markets were implicated." (`specs/01-product-requirements.md:FR-019`)

A calibrated shared runtime was added in subsequent commits (whole-board calibration layer in `packages/shared/src/board-anomaly/board-volatility-model.ts`, Kalman persistence filter, phase-aware baselines in `board_volatility_baselines`, Iter02 state gate). The `#2` board-first gate was applied live during `nba-0042500301` on 2026-05-19:

> "Live math note, 2026-05-19 20:06 MDT: during nba-0042500301 at P3 1:21 remaining (81-66 …), switched the live board detector to the stricter #2 board-first gate. When a whole-game game-state-volatility tripwire and player-specific fanout first pop inside the same shock window, the live deck keeps the whole-game card and leaves the player rows in board-alert evidence until a later follow-up separates itself." (`PLAN.md:In Progress`, lines 72-73)

The `event-context` endpoint (`/api/v1/research/board-alerts/event-context`) closes the temporal audit loop: it returns nearby NBA play-by-play rows anchored to the alert timestamp, so the trader can answer "what game event caused this, and when?" (`specs/05-api-spec.md:API-015-017`).

**Signal quality analytics** (route `/api/v1/research/signal-quality`, `SIG-007`) entered at commit `196753d` (2026-05-09) and apply calibration metrics (Brier score, log-loss, per-source delta-series, lead-lag cross-correlation) to the historical divergence question: when a signal fires, how early was each source relative to the others?

---

### Phase 5 — Current state: best current hypothesis, what is strong, what is weak, what is promising

**As of 2026-05-21 (HEAD: `74fff3b`)**

**What is strong (evidenced, implemented, reproducible):**

1. The `game-state-volatility` whole-board detector is running live and deployed. The shared model runs across live alerts, replay, inspect, and desk surfaces (`README.md:26-28`; `specs/06b-board-anomaly-model.md:§3A`). Phase-aware baselines, Iter02 state gating, and a linear Kalman persistence layer are all implemented (`PLAN.md:68`; `packages/shared/src/board-anomaly/board-volatility-model.ts`).

2. The Reaves/Hayes incident provides a **verified, second-level archetype**: two off-price Polymarket trades at 99¢, 38 seconds after the disputed rebound, representing 26% of final market volume, while sampled price-history sat at 49.5¢/51¢. This is real data from the persisted store. (`MARKET_INCIDENT_HANDOFF_PROMPT.md:263-275`; `TODO.md:111-116`)

3. The exact-line player-prop alert route is fully implemented, well-specified, and intentionally preserved as a "compatibility route" for the strict Bet365-vs-exchange case. (`README.md:303`; `SIG-009`)

4. Historical replay now runs the same online detector without future leakage. (`specs/06b-board-anomaly-model.md:§9`; `specs/01-product-requirements.md:FR-019`)

5. The signal-quality analytics (Brier, log-loss, per-source lead-lag) are implemented for the calibration / "who led price discovery" backtest. (`README.md:305`; `PLAN.md:17`)

**What is weak (implemented but uncertain or single-venue):**

1. The trade-tape signal (off-price prints, volume share, second-level timing) is **Polymarket-only** in the current store. Kalshi persists only minute-bucket candlesticks. `docs/board-state-inventory.md:§"Source Coverage Today"` is explicit. Cross-venue confirmation — the feature most likely to reduce false positives — is not yet possible at seconds resolution.

2. No **labeled incident ground truth set** exists. The persisted store holds 1,608 concentrated prints (≥10% volume share) in 14 fully-instrumented games (`outputs/innovation-team-suspend-signal-report/REPORT.md:§2`), but the false-positive rate is unknown without labeling. Every whale trade, end-of-game certainty print, and ordinary thin-market fill also produces a concentrated print.

3. Bet365 internal timing is unavailable. The current ingest path is an Odds-API backup; native bet365 trade-level timing cannot be measured from this store. "We cannot state the lead over bet365." (`outputs/innovation-team-suspend-signal-report/REPORT.md:§2`)

4. FanDuel and DraftKings are not yet ingested. The FD/DK scorecard (`docs/fanduel-draftkings-provider-scorecard.md`) documents the blocker. Their absence means cross-book sportsbook disagreement is still single-book.

**What is promising but unconfirmed:**

1. The board-first detector hypothesis: that whole-board incoherent movement can lead by seconds before any single prop is obviously wrong. The theory is sound and the architecture is in place; the evidence base (14 fully-instrumented games) is too small to establish reliable phase-specific base rates.

2. Direct Kalshi trade/orderbook capture into `market_microstructure_events` (currently partial; direct adapter is in-progress per `PLAN.md:75`). If Kalshi trade-tape were persisted at seconds resolution, cross-venue confirmation would become possible and would materially reduce the false-positive burden.

3. The paired-player attribution-shaped incident classifier (`specs/06b-board-anomaly-model.md:§7`, `attribution-shaped incident` kind): it requires fanout concentrated around one player or paired-player stat family with compound-stat children moving in the same direction. This is architecturally specified and has a test suite, but empirical calibration against real labeled incidents is still needed.

**The single most important missing number:**

Exact timing of bet365's own line moves or market suspensions relative to the Polymarket print. Without internal system timing, "how many seconds earlier" is answered only for the prediction-market-vs-prediction-market lead, not for the operational question the product exists to answer. Only an internal bet365 data integration can supply this. (`outputs/innovation-team-suspend-signal-report/REPORT.md:§2`, Constraint #1)

---

## Pivot Catalogue (genuine strategy changes only, no bug-churn)

| Pivot | Phase boundary | Trigger event | File / commit |
|---|---|---|---|
| From pregame moneyline to live player-prop exact-line | Phase 1 | Realization that pregame winner-market divergence is a different (and less time-sensitive) problem than in-game prop suspension | `bet365_nba_signal_console_proposal.md`→`specs/01-product-requirements.md:FR-013` |
| From single-player exact-line to paired-player / related stats | Phase 1→2 | Queta assists: no market existed; Reaves/Hayes: the signal was on the _other_ player | `TODO.md:28-65`; `AGENTS.md:104-115`; `404a874` (2026-05-14) |
| From price-divergence-only to trade-tape / volume-share microstructure | Phase 2→3 | Reaves/Hayes: $105 notional print at 99¢ while price series stayed at 50¢; 26% volume share was not visible in price-history alone | `TODO.md:91-111`; `AGENTS.md:138-151`; `404a874` (2026-05-14) |
| From per-instrument anomaly to whole-board incoherence as earliest tripwire | Phase 3→4 | The live alert workflow cannot wait to know the paired player; board-level joint movement can lead any single-prop signal | `PLAN.md:Goal`; `specs/06b-board-anomaly-model.md:§2`; `19e8220` (2026-05-16) |
| From raw H1 score to phase-aware calibration + Kalman filter + board-first gate | Phase 4 internal | Whole-board scores were permanently in the "90+ critical" band because player prop rows saturated the scoring; core-family-only calibration corrected this | `PLAN.md:67-68`; `specs/06b-board-anomaly-model.md:§3A`; `4a5d415` and `afd2753` (2026-05-16/20) |

---

## What is not evidenced as a real strategy change (excluded from above)

- **UI redesigns** (card → table → desk hierarchy): these are presentation changes that do not alter the signal hypothesis.
- **Worker resilience / rate-limit isolation** (commit `084cd67`): operational hardening, not signal logic.
- **Schema version changes** (v1–v14): storage evolution without signal-concept pivots.
- **Test additions**: regression coverage added after implementation.
- **Odds-API.io backup vs. direct capture**: a source-reliability issue, not a signal widening.
