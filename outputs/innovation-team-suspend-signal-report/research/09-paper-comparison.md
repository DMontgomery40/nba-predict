# Independent paper comparison — arXiv 2605.00864 (read 2026-05-21, codemode)

**Paper:** "Arbitrage Analysis in Polymarket NBA Markets," Guang Cheng, Jiaxin Yang, Haoxuan Zou
(UCLA; corresponding Prof. Guang Cheng). arXiv:2605.00864v1 [q-fin.TR]. **Submitted 22 Apr 2026.**
PDF/HTML live-verified.

**Timing (the striking fact):** this bet365 project's first repo commit was **21 Apr 2026**; the paper
was submitted to arXiv **22 Apr 2026** — one day apart, independently. Two teams converged on Polymarket
NBA microstructure within a day. Reads as: the area is real, valuable, and being actively raced on.

## What the paper does (a DIFFERENT question)
Studies **risk-free algorithmic arbitrage**: (1) single-market — complementary YES/NO shares mispriced
so they don't sum to $1; (2) combinatorial — price inconsistencies across related markets. Built from
**75M limit-order-book snapshots across 173 regular-season games** (full order-book depth, polling-based
capture with latency/desync handling, state imputation, unified event timeline). Novelty vs prior work
(Saguillo et al. 2025, executed-trade data; Ng et al. 2025, political forecasting) = using full LOB
*depth* snapshots, not just trades.

**Findings:** profound microstructural efficiency. Single-market arb rare — 7 in-game episodes, median
**3.6s** duration. Combinatorial — 290 episodes, concentrated in the **final minutes**, median **~101 bps
(~1%)** return; the "Middle" jackpot never realized. Books shallow: **76.9% capped at ~14.8 shares**.
Risk-free extraction confined to retail scale.

## Honest dimension-by-dimension comparison
| Dimension | Their paper | This work |
|---|---|---|
| Question | Is there risk-free arbitrage profit? (efficiency) | Is there an early SUSPEND signal for stat misallocation? (informed-flow / event detection) |
| Data | 75M **full order-book** snapshots, 173 games | sampled implied-prob quotes (64 games) + bet-by-bet trade tape (18 games); **no full-depth LOB** |
| Real-world anchor | none (purely price-internal) | **NBA play-by-play to the second** — every signal tied to a disputed play |
| Metrics | arbitrage frequency / duration / profitability | **lead-time (seconds early) + false-alarm density** (desk-operational) |
| Output | academic efficiency result | a trader's suspend/review decision tool |
| Scale & rigor | **greater** (full LOB, 173 games, peer-style data engineering) | smaller, purpose-built, validated on 6 known cases |

## Honest verdict (not flattery)
Not "ours is better" / "theirs is better" — **different questions**. On THEIR question (arbitrage
efficiency) their study is larger and more rigorous than anything we attempt, and we don't try to. On
OUR question (an early suspend signal for mis-credited stats) the paper is **silent** — no concept of a
real-world stat error, no event anchoring, no lead-time or false-alarm measurement. Our methodology is
purpose-built for exactly that. **Complementary, not competing.**

## Why it matters for bet365 (the important part)
1. **It independently corroborates our core design.** Price inconsistencies vanishing in a median **3.6s**
   confirms the fast signal lives in the **raw bet-by-bet tape, not the slower price chart** — our
   "tape leads the chart by a median ~3¾ min" result. Shallow ~14.8-share books confirm a **small
   concentrated off-price bet genuinely moves the market** — exactly why the $100 / 99¢ Reaves print is
   a credible informed-flow tell, not noise.
2. **It closes off the wrong play.** The paper proves there's essentially **no risk-free arbitrage money
   here at scale**. So bet365 should NOT chase this as an arbitrage-profit play; the value is what we
   study — **loss-avoidance via an early suspend**. The paper strengthens our framing by ruling out the
   alternative.
3. **Competitive urgency + a free baseline.** A UCLA group (plus the prior work it cites) is already
   mining this; the data is free and others are racing → any edge is perishable. But they've also handed
   us a rigorous **full-order-book-depth** microstructure baseline — exactly the depth analysis we lack —
   to build the live-capture infrastructure on.

**Caveat to check in the trial:** their combinatorial-arbitrage concentration in the **final minutes** is
end-game noise we must ensure doesn't inflate our false-alarm count.
