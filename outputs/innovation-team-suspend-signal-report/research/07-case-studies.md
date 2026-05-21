# Case Studies: Prediction-Market Suspend Signal — 6 Second-Anchorable Incidents

**Document:** 07-case-studies.md  
**Date:** 2026-05-21  
**Purpose:** Incident-level narrative for Innovation-Team→Trading report. Each case study runs the same template: (a) T0 to the second, (b) first board signal + T-offset, (c) first off-price / exact-prop signal + T-offset, (d) what a desk would have seen, (e) bet365 internal timing gap (never fabricated). All leads are positive (after the real-world play) unless noted; a negative lead means the signal preceded the disputed play — that is pre-event noise, not a catch.

Data sources: `research/06-bakeoff-findings.md` (headline lead table), `research/05-cascade-experiment.md` (cascade details), `research/02-memory-recovery.md` (Reaves/Hayes trade-tape facts), `research/labels.json` (t0 anchors, provenance notes), `research/03b-external-research-verified.md` (API structure findings).

---

## Case Study 1: Reaves/Hayes Rebound — OKC at LAL, 2026-05-12

**Archetype: thin-prop coverage gap; trade-tape-only catch.**

**(a) T0.** PBP time_actual `2026-05-12T04:51:40.2Z` (game `nba-0042500224`). A rebound was credited live to Austin Reaves; Jaxson Hayes was the rightful recipient. The play was never corrected before final whistle.

**(b) Board signal.** The board-vw detector did not fire on this incident. Polymarket listed 120 player-prop markets for this game — 12 for Reaves, zero for Hayes — and no team-rebound or quarter-rebound markets existed on the fast venue. Without cascade targets to reprice, the sampled-price surface (1-min `quote_ticks`) showed no cross-market volatility. Board lead: absent.

**(c) Off-price / trade-tape signal.** Trade-tape (`market_microstructure_events`) under game `nba-0042500223` (the Polymarket-mapped game id — a game-id mapping bug caused the initial missed detection) shows a concentrated print at `04:52:18Z`, T+38s: two BUY YES fills on Reaves rebounds o/u 4.5 totalling 101 shares at $0.989 prevailing price $0.495, representing 24.6% of that market's full-game volume. No neighbouring markets showed comparable activity at that time; their volume shares were below 1%. Off-price print lead: **+38s**. Polymarket `/prices-history` candles (minimum fidelity 10 per 1-min interval, confirmed live) would not have resolved this; the signal was only visible in raw trade tape.

**(d) What a desk would have seen.** A trade-tape alert at T+38s: anomalous off-price buy, 24.6% vol-share, price 0.989 vs. prevailing 0.495. No board signal anywhere; the Reaves rebound market's sampled price remained ~0.495–0.51 all game. The alert is unambiguous in the tape but requires the off-price-print detector to surface it; board-watching alone would miss it entirely.

**(e) bet365 internal timing.** We cannot measure bet365's own line-move or suspension timestamp from this data store — that gap is never fabricated. The 38-second figure measures only the delay from PBP event to first externally-observable Polymarket fill.

---

## Case Study 2: Hartenstein/Cason-Wallace Rebound — OKC Thunder, 2026-05-08

**Archetype: whole-board cascade; third-party movers vindicate board-over-pair design.**

**(a) T0.** PBP time_actual `2026-05-08T03:12:36.8Z` (game `nba-0042500222`). A rebound was credited to Isaiah Hartenstein; Cason Wallace was the rightful recipient (source: confirmed Twitter report, Q3 8:19, `@PDemilord`).

**(b) Board signal.** The board-state-volatility engine crossed its trailing baseline in the 60-second bucket beginning `03:12:00Z`. Bucket-end confirmation: approximately **T+23s**. The specific movers were not Hartenstein's or Wallace's own props: Marcus Smart rebounds o/u 0.5 repriced +0.265 at `03:12:04Z` (T−32s relative to T0, within the same 60s bucket); Austin Reaves points o/u 18.5 repriced +0.255 at `03:13:04Z` (T+28s); Luguentz Dort props and OKC/LAL moneyline moved 0.04–0.49 in the 03:13–03:14 window. A cluster of third-party markets repriced together; no individual prop named the rightful player. Board-vw lead: **+23s**.

**(c) Off-price / trade-tape signal.** The off-price-print detector fired at T−40.8s (pre-event; classified as noise, not a catch under the [0, +300s] point-detector window). The sampled-price board surface caught this incident; the trade tape did not add a valid positive lead.

**(d) What a desk would have seen.** A board-vw alert at T+23s: cluster of props (Smart rebounds, Reaves points, Dort) repricing simultaneously with no obvious game-state trigger. The Hartenstein rebound market itself need not appear in the alert — the signal was aggregated across the whole board. This is the concrete demonstration that a "watch the credited + rightful player" paired detector (0/6 recall, bake-off table) misses what a whole-board aggregator catches.

**(e) bet365 internal timing.** We cannot measure bet365's own line-move or suspension timestamp from this data store — that gap is never fabricated. Polymarket fills are row-level (~2s latency per live API verification); sampled-price bucket confirmation adds ~60s structural lag. The +23s figure is the bucket-end estimate.

---

## Case Study 3: Allen/Strus Rebound — Cavs at Raptors Game 7, 2026-05-04

**Archetype: board catch; coverage present and board-vw fires within the minute.**

**(a) T0.** PBP time_actual `2026-05-04T01:57:02.4Z` (game `nba-0042500137`, Cavaliers at Raptors East Round 1 Game 7). A rebound was credited to Max Strus; Jarrett Allen was the rightful recipient (source: `@nba_elise`, Q4 08:02 tweet `nba_elise/status/2048506391795536374`). Note: bakeoff id `allen_strus` maps to the T0 at `01:57:02.4Z`; the tweet cited a Q4 08:02 clock, consistent with late-game timing.

**(b) Board signal.** Board-vw (K=3) fired with a lead of **+57.6s**. Board-eq (K=3) matched that lead. The board surface had sufficient prop coverage for a Game 7 to observe cross-market repricing.

**(c) Off-price / trade-tape signal.** The off-price-print detector did not produce a valid catch for this incident (no qualifying off-price print in the detection window). Board was the sole catching lane.

**(d) What a desk would have seen.** A board-vw alert roughly one minute after the disputed play: cross-market repricing consistent with a stat anomaly. No trade-tape amplification. Jarrett Allen had 22 points and 19 rebounds in that game; misattribution of a rebound to Strus in a stat-sensitive close Game 7 is a plausible trigger for informed market activity.

**(e) bet365 internal timing.** We cannot measure bet365's own line-move or suspension timestamp from this data store — that gap is never fabricated.

---

## Case Study 4: Allen/Merrill Rebound — Cavs at Raptors Game 7, 2026-05-04

**Archetype: board catch; PBP provenance caveat — correction already applied in the stored feed.**

**(a) T0.** PBP time_actual `2026-05-04T02:03:14.3Z` (game `nba-0042500137`, same Game 7). A rebound was credited live to Sam Merrill; Jarrett Allen was the rightful recipient (source: `@nba_elise`, Q4 06:48 tweet `nba_elise/status/2048500831217934522`).

**(b) Board signal.** Board-vw (K=3) fired with a lead of **+105.7s** (~1m 46s). Board-eq matched at K=3; at K=6 the lead extends to +225.7s as the detector waits for a wider cluster.

**(c) Off-price / trade-tape signal.** No qualifying off-price print in the detection window. Board was the sole catching lane.

**(d) What a desk would have seen.** A board-vw alert roughly 105 seconds after the play: a second cluster repricing in the same Game 7, same player (Allen), same stat family (rebounds). Two board alerts in six minutes of a playoff game is itself an unusual pattern.

**(e) bet365 internal timing.** We cannot measure bet365's own line-move or suspension timestamp from this data store — that gap is never fabricated.

**Provenance note.** The stored PBP for game `nba-0042500137` shows `J. Allen REBOUND` at this clock — the correction, not the original erroneous credit to Merrill. This means the PBP feed for this play has already been patched. T0 is derived from the tweet timestamp and game-clock arithmetic, not from a PBP error row. Provenance is therefore per-incident rather than uniformly "as-played"; any downstream model consuming raw PBP should not assume the feed always shows the live-misattributed version.

---

## Case Study 5: Merrill/TEAM Rebound — Cavs vs. Pistons, 2026-05-18

**Archetype: volume-weighting win; equal-weight misses a TEAM-credited rebound.**

**(a) T0.** PBP time_actual `2026-05-18T02:00:53.4Z` (game `nba-0042500207`, Q3 04:45, Cavaliers vs. Pistons East Semis context). A rebound was credited to TEAM (offensive rebound); Sam Merrill was the rightful recipient (source: `@nba_elise`, tweet `nba_elise/status/2056196423691989496`, posted 2026-05-20 after the game).

**(b) Board signal.** Board-vw (K=3) fired with a lead of **+66.6s**. Board-eq at K=3 did not catch this incident — the equal-weight aggregate was suppressed by thin-quote churn across markets without meaningful exposure, while the volume-weighted aggregate correctly tracked the markets where trader capital was concentrated. This is the cleanest in-sample demonstration of why volume-weighting is the recommended aggregate: a rebound credited to TEAM rather than to a named player creates a specific prop-coverage gap (no "TEAM rebounds" market), and volume-weighting finds the residual signal in the markets that do exist.

**(c) Off-price / trade-tape signal.** The off-price-print detector produced a catch at +66.6s — the same lead as board-vw. The two lanes agreed on timing for this incident.

**(d) What a desk would have seen.** A board-vw alert at +66.6s, corroborated by a trade-tape print in the same window. The TEAM credit means no single named player's prop fires, making this incident invisible to any paired-player or exact-prop approach. Without volume-weighting, the board also misses it. The ensemble (board-vw OR off-price-print) catches it; equal-weight board does not.

**(e) bet365 internal timing.** We cannot measure bet365's own line-move or suspension timestamp from this data store — that gap is never fabricated.

---

## Case Study 6: Cunningham Block — Pistons, 2026-05-08 (Low Confidence)

**Archetype: honest negative; label-quality caveat.**

**(a) T0 (provisional).** Derived T0: `2026-05-08T00:55:44.3Z` (game `nba-0042500202`). Source: tweet attributed to `@nbastats`, Q3 11:36, Cade Cunningham block. However, the only Q3 Cunningham block in the stored PBP for this game is at clock `PT01M27` — a 10-minute clock mismatch with the tweet's stated Q3 11:36. This label is marked **low confidence**.

**(b) Board signal.** Board-vw did not fire. Board-eq did not fire. No detector produced a catch for this incident.

**(c) Off-price / trade-tape signal.** The off-price-print detector also did not fire. No lane produced a positive lead.

**(d) What a desk would have seen.** Nothing from the external prediction-market surface. Whether that means: (i) there was no signal-generating stat misallocation (the block was correctly attributed), (ii) the Cunningham block market had insufficient coverage or liquidity to register, or (iii) the label itself is wrong about the play — cannot be determined from available data.

**(e) bet365 internal timing.** We cannot measure bet365's own line-move or suspension timestamp from this data store — that gap is never fabricated.

**Label-quality flag.** The tweet-vs-PBP clock discrepancy (Q3 11:36 stated vs. PT01M27 in data) means we cannot anchor this incident to a specific play with confidence. This is a genuine label-quality failure, not a detector failure — the two are distinct. This incident should be held out of recall numerators in any future calibration run until the label is resolved against video review.

---

## Archetype Summary

| Archetype | Lane(s) that fired | Typical lead post-T0 | Coverage implication |
|---|---|---|---|
| Whole-board cascade (cascade markets listed, liquid) | board-vw | +23s to +106s | Whole-board aggregator required; paired-player too narrow (movers are third parties) |
| Thin-prop coverage gap (cascade markets absent on fast venue) | off-price trade-tape only | +38s | OR-ensemble necessary; board alone misses this class entirely |
| TEAM-credited rebound (no named-player prop, volume-weighted board catches) | board-vw; also off-price | +67s | Volume-weighting over equal-weight; equal-weight suppressed by churn on thin markets |
| Low-confidence / coverage absent | neither lane | — | Label quality and venue coverage are co-determinants of detection; an honest negative is informative |

**Reading note on lead signs.** All positive leads in this table measure seconds from T0 (the disputed play) to first confirmed detector alert — i.e., how early post-event the desk would have known. The Cunningham block has no lead because no detector fired. The exact-prop detector for Hartenstein produced a pre-event negative lead (−33.8s) — classified as noise, not a catch, under the pre-committed [0, +300s] point-detector window.

**The bet365 timing gap.** Across all six case studies, bet365's own line-move and suspension timestamps are absent from this store. The leads measured here are entirely prediction-market external leads. Whether those leads beat, match, or lag bet365's internal desk is the open question this work motivates — it is never fabricated from available data.
