# Cascade / domino experiment — computed evidence (lead, 2026-05-21)

Tests the user's core thesis: a stat misallocation dominoes across the board (the player's other props, the team/quarter markets, the rightful player), and the **aggregate** of that cluster is a louder/earlier tripwire than the thin exact prop. Computed directly from `data/signal-console.sqlite`. Two PBP-anchored incidents, opposite outcomes — the contrast IS the finding.

## Incident A — Hartenstein/Cason-Wallace rebound (game `nba-0042500222`, T0=2026-05-08T03:12:36.8Z). CASCADE WORKED.
Sampled-price (`quote_ticks`, Polymarket, 1-min cadence) moves in the window 03:11–03:14, per-market |Δ implied_prob| > 0.04:

| Time (UTC) | Market | Δip |
|---|---|---|
| 03:12:04 (~T−32s) | Marcus Smart rebounds o/u 0.5 | **+0.265** |
| 03:12:04 | Luguentz Dort points o/u 2.5 | +0.10 |
| 03:13:04 (~T+28s) | Austin Reaves points o/u 18.5 | +0.255 |
| 03:13–03:14 | Dort assists, OKC/LAL moneyline | 0.04–0.49 |

A *cluster* of related markets repriced together around the disputed rebound → the board-state-volatility engine (`board_signal_v2.py`) crossed its trailing baseline in the same 60s bucket (`03:12:00Z`), confirmable at bucket-end ≈ **T+23s**. This is the domino thesis demonstrated: the board aggregate fired without anyone naming the rightful player.

## Incident B — Reaves/Hayes rebound (games `nba-0042500224`/`223`, T0=2026-05-12T04:51:40.2Z). CASCADE ABSENT — only the thin exact prop fired.
Polymarket coverage for this game: 120 player-prop markets, **12 Reaves, 0 Hayes**, and **no team/quarter-rebound markets**. The cascade targets (rightful player Hayes; Lakers team rebounds; Reaves triple-double) are simply **not listed on the only fast venue**.

Trade-tape (`market_microstructure_events`) around T0:

| Time (UTC) | Market | price | vol-share | $ |
|---|---|---|---|---|
| 04:51:08 | Reaves points o/21.5 | 0.99 | 0.5% | 5.9 |
| 04:52:07 | LeBron points o/21.5 | 0.99 | 0.3% | 13.2 |
| **04:52:18 (T+38s)** | **Reaves rebounds o/4.5** | **0.989** | **24.6%** | **100.0** |
| 04:52:18 | Reaves rebounds o/4.5 | 0.99 | 1.4% | 5.7 |
| 04:53–04:55 | LeBron points o/21.5 (×6) | 0.99 | 0.1–0.8% | 3–35 |

The disputed prop's own print is **by far** the loudest event (24.6% vol-share vs neighbors' <1%, which are routine near-certainty points prints). No board/cascade amplification — there was nothing to amplify. The sampled price of the Reaves rebound market itself never moved (0.495↔0.51 all game); the 0.99 burst existed ONLY in the trade tape. So the board engine (sampled-price surface) correctly did not fire, and the off-price-print lane is what caught it.

## Conclusion (the two-lane justification, earned not asserted)
- The **board/cascade signal is real and fires when the cascade markets are listed and liquid** (Hartenstein).
- When the cascade markets are **absent on the fast venue** (Reaves — no Hayes/team/triple-double markets on Polymarket), the cascade cannot be observed and the **thin exact prop's concentrated off-price trade-tape print** is the only available signal.
- Therefore **coverage — which markets a venue lists — is the dominant determinant of which lane fires.** This is the empirical basis for an OR-ensemble (board OR off-price-print), not a single threshold. It also makes "expand venue/market coverage" a first-order recommendation, not a footnote.
- Caveat: board surface = *sampled* `quote_ticks` (1-min, lagging); trade tape = row-level (~2s). They are different data surfaces, which is why an incident can be invisible to one and loud on the other.

## Next (open)
- Repeat on the other anchored labels (Cunningham block, Sasser rebound, LeVert/Jenkins assist) to see how often each lane is the one that fires → feeds `frac_incidents_caught` per detector in the bake-off (`BAKEOFF_SHAPE.md`).
- Quantify "cluster aggregate vs thin exact prop" lead within Hartenstein-type cases where both surfaces have data.
