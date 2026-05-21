# Signal bake-off — findings (Phase 2 "find the solution"), 2026-05-21

Source: `scripts/bakeoff.py` (read-only), output `research/bakeoff-results.json`. Validation set = 6 second-anchorable incidents from `labels.json` (5 rebound misallocations + 1 low-confidence block). Metric pre-committed in `BAKEOFF_SHAPE.md`: lead-time at a fixed desk-tolerable FP rate. Leads are detection-confirmed time minus PBP event T0 (positive = AFTER the real-world play; "how early we'd know").

## Headline result table (lead seconds per incident; FP = fires/in-play-minute, all 64 games)

| Detector | K | FP/min | caught | reaves | harten | allen_S | allen_M | merrill | cunning |
|---|---|---|---|---|---|---|---|---|---|
| board-eq | 3 | 0.129 | 4/6 | 139.8 | 23.2 | 57.6 | 105.7 | — | — |
| board-eq | 6 | 0.061 | 3/6 | — | 23.2 | 117.6 | 225.7 | — | — |
| **board-vw** | **3** | **0.123** | **5/6** | 139.8 | 23.2 | 57.6 | 105.7 | 66.6 | — |
| board-vw | 5 | 0.070 | 4/6 | — | 23.2 | 117.6 | 105.7 | 66.6 | — |
| board-vw | 6 | 0.056 | 3/6 | — | 23.2 | 117.6 | 225.7 | — | — |
| exact-prop | – | – | (weak) | — | −33.8 | −43.4 | −9.3 | — | — |
| paired-player | – | – | **0/6** | — | — | — | — | — | — |
| offprice-print* | – | 0.86* | (3/6)* | 37.8 | −40.8 | — | — | 66.6 | — |
| ensemble-OR(board-eq@6 ∪ offprice) | 6 | ~0.92† | 5/6 | 37.8 | −40.8 | 117.6 | 225.7 | 66.6 | — |

\* offprice FP/catch are OVERSTATED — see Fix 1. † ensemble FP is the SUM of both lanes, not the board-only number the script printed (Fix 3).

## What the data says (robust to the fixes below)
1. **Whole-board volatility is the best single detector, and volume-weighting wins.** `board-vw` ≥ `board-eq` at every K, and catches `merrill_team` (a rebound credited to TEAM) that equal-weight misses. Volume-weighting suppresses thin-quote churn and tracks trader exposure — it is the recommended aggregate.
2. **The thin exact prop is the worst signal.** `exact-prop` misses Reaves outright and otherwise only fires pre-event noise. This is the empirical vindication of the project's whole arc away from single-prop staring.
3. **Narrow paired-player fails (0/6); the cascade is a WHOLE-BOARD phenomenon.** At the Hartenstein event the movers were *third parties* (Smart rebounds +0.265, Reaves points +0.255), not Hartenstein/Wallace's own markets. So "track the credited+rightful player" is too narrow — you must watch the whole board. This is a concrete, surprising, non-obvious finding.
4. **Coverage decides the lane (from `05-cascade-experiment.md`).** Reaves is invisible to the board (cascade markets unlisted on the fast venue) and only the trade tape caught it (+37.8s); Hartenstein is the reverse. The OR-ensemble is therefore not redundancy — it is necessary, because different incidents are only visible on different surfaces.
5. **"How early": tens of seconds to ~4 minutes after the disputed play** (board confirms +23s to +226s). Whether that beats bet365's own desk is the UNMEASURED internal-timing gap — never fabricated.

## Recommended operating point (pre-committed metric)
At a desk-tolerable FP ≈ 0.06 fires/min (≈ 1 review per ~17 in-play minutes, ~9/game), **board-vw@K≈5–6** gives 3–4/6 recall with leads of +23s to +226s; dropping to **K=3** raises recall to 5/6 at ~0.12/min (~18/game). The ensemble adds the trade-tape lane to recover Reaves-type (coverage-gap) incidents. **The desk sets the FP ceiling from review cost; we supply the lead-at-that-ceiling curve.** With n=6 labels this is an existence-and-ordering result, NOT a calibrated recall — stated honestly.

## POST-FIX RE-RUN (2026-05-21, all fixes applied — supersedes the table above where they differ)
After applying the four fixes, `scripts/bakeoff.py` was re-run on all 64 games. Net changes:
- **Fix 1 (off-price distance gate `|trade_price−prevailing|≥0.35`):** `offprice_fp` fell from **0.86 → 0.076 fires/min** (the inflated near-certainty prints are gone); Reaves stays caught at **+37.8s** (|0.989−0.495|=0.494); offprice now catches **1/6** honestly.
- **Fix 2 (point window [0,+300]):** Hartenstein's −40.8s off-price "catch" and the exact-prop pre-event negatives are now correctly NULL. With the post-event-only window, `exact-prop` shows small positive catches on 3/6 (harten +26.2, allen_strus +1.6, allen_merrill +48.7) — but it still **misses Reaves** (the canonical thin prop) and has **no measurable FP density**, so it cannot be placed at the FP ceiling. `board-vw@K3` (5/6) remains the recommended signal.
- **Fix 3 (ensemble FP = board+offprice):** the ensemble combines the RECOMMENDED board lane (board-vw@K3) with the off-price lane — not the weak eq@6 board, which made the ensemble look slower/worse than board-vw@3 alone (a logical contradiction for an OR). Corrected ensemble-OR(board-vw@3 ∪ offprice) FP = 0.123 + 0.076 = **0.199/min** (the honest sum), recall **5/6**; it dominates board-vw@3 (Reaves drops +139.8→+37.8s via the off-price lane) and never trails it.
- **Fix 4 (broad `lead_vs_pricehist`, corrected to a catch-up-lag definition):** across the 18 trade-tape games, **316 Polymarket instruments** had a decisive off-price tape move; the sampled price-history reflected it a **median 224s later** (IQR 65–1085s), and **87/316 = 27.5% were never reflected at all in the in-play window** ("tape-only"). This is the quantified justification for a raw-tape lane: a quarter of decisive prints never show up in the sampled surface the board watches.

Headline operating point unchanged: **board-vw@K3 → 5/6 recall at 0.123 fires/min (~18/game); board-vw@K5 → 4/6 at 0.070/min (~10/game).** Volume-weighting still strictly dominates equal-weight (catches `merrill_team`, the TEAM-credited rebound, that eq misses).

## Fixes queued before final (do not overclaim until done)
1. **offprice-print needs its off-price-DISTANCE gate** (|trade_price − prevailing| ≥ 0.35), not just volume_share ≥ 0.10. Current FP (0.86/min) and catches are inflated by ordinary near-certainty prints.
2. **Point-detector catch window** should be [0, +300s] (at/after event); only the bucketed board may use [−60, +300] (a bucket start legitimately precedes the event it contains). Pre-event negative leads for exact/offprice are noise, not catches.
3. **Ensemble FP** = board FP + offprice FP (≈0.92/min as printed config), report the sum.
4. Add `lead_vs_pricehist` broad distribution (trade-tape vs sampled price) across the 18 trade-tape games — the statistically meaningful n (~147 markets) — to complement the n=6 incident anchoring.
