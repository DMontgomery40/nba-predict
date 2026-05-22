# Signal bake-off — locked output shape (decide once; HTML consumes this JSON)

**"Best signal" metric (pre-committed): LEAD-TIME AT A FIXED, DESK-TOLERABLE FALSE-POSITIVE RATE.**
The desk's review-cost tolerance sets an FP ceiling (fires per in-play minute). For each detector we sweep its threshold to the K that hits that same FP rate (the common operating point), then compare lead-time at that point. This matches the user's framing: "unless we beat Δt seconds, it's not worth the expense."

## Detectors compared
1. `exact-prop` — interior→extreme crossing on the disputed prop's own sampled price.
2. `paired-player` — same, on credited+rightful player cluster (max over cluster).
3. `board-eq` — whole-board game-state volatility, equal-weight (board_signal_v2).
4. `board-vw` — whole-board, volume-weighted.
5. `offprice-print` — concentrated off-price trade-tape print (volume_share≥θ, |price−prevailing|≥θ).
6. `ensemble-OR` — fire if (board OR offprice-print) fires; the two-lane design.

## Per-detector × per-threshold-K record (JSON)
```
{
  "detector": "...", "K": <float>,
  "fp_fires_per_inplay_min": <float>,        # broad density, ALL 64 games
  "frac_incidents_caught": <0..1>,           # of the labeled set (n reported)
  "per_incident_lead_s": { "<incident>": <seconds or null> },  # +=earlier than event-confirm
  "lead_vs_pricehist": { "n": N, "median": s, "p25": s, "p75": s, "frac_earlier": f }
}
```
- `fp_fires_per_inplay_min` is the cost-side denominator (specificity), computed on all 64 PBP games.
- `lead_vs_pricehist` is the statistically meaningful distribution (broad market n, NOT the 6 labels).
- `per_incident_lead_s` + `frac_incidents_caught` are the validation cases (n≈6, honest about n).
- Lead sign convention: detection-confirmed time (bucket END for board) minus event/baseline; positive = earlier.

## Operating-point comparison (the headline table)
At the chosen desk-tolerable FP rate (e.g. 0.05 fires/min ≈ current board baseline), report each detector's
median lead + incidents-caught. Recommended signal = highest lead at that FP ceiling that also catches the
most labeled incidents. State n and confidence honestly; n=6 labels cannot yield a real recall.

## Output files
`research/bakeoff-results.json` (array of the per-detector×K records) + `research/board-signal-v2.json`
(already exists). HTML SVG charts read these.
