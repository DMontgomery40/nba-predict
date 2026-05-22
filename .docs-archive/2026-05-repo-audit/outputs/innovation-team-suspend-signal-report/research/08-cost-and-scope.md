# Cost grounding & multi-sport scope — live-checked 2026-05-21 (codemode)

Replaces the hand-wavy "$0–2M yearly cost" slider with real facts. All statuses are real
responses observed via Deno `fetch()` through the codemode bridge (WebSearch/WebFetch broken).

## What the prediction-market DATA actually costs

| Source | Access | Cost | Evidence |
|---|---|---|---|
| **Polymarket** Gamma API + Data API | **Fully public, no authentication** | **$0** | docs.polymarket.com Overview: "The Gamma API and Data API are fully public — no authentication." Live-pulled trade rows confirm no key needed. |
| **Polymarket** CLOB (orders) | API key (free, wallet-derived) | $0 for data; trading fees only if you trade | docs.polymarket.com/developers/CLOB; a "Fees / Builder Fees Tiers" page exists but covers TRADING, not data. |
| **Kalshi** REST + WebSocket market data | Free API key from account settings; **token-based rate-limit tiers** | **$0** per-seat for data; higher throughput is qualification-based, no published list price | docs.kalshi.com "API Keys" (200) + "Rate Limits and Tiers" (token-based; "every authenticated request costs tokens; your tier defines…"). Use bound by Kalshi Developer Agreement. |
| **Odds-API** | n/a | **Not needed** (per David) | — |

**Bottom line on data:** the prediction-market feed is essentially **free / public**. There is no
enterprise data-licensing line item to fear for Polymarket; Kalshi is free with tiered rate limits
(market-maker tiers grant more throughput, by application, not by a price sheet).

## Where the real money goes (the cost side of the inequality)

1. **Engineering build** — detector + ingestion + the trader-facing surface. One-time-ish.
2. **Always-on live capture** — the bet-by-bet tape **cannot be backfilled** (proven: resolved-market
   trade history is not retrievable from public endpoints). So you must run recorders during games.
   Modest cloud cost, but ongoing and **scales with how many sports/games you cover, not with a data licence**.
3. **bet365 internal integration** — the dominant, genuinely-unknown number. The personal-view
   paragraph already names it: "a massive system that cannot mess up… a great deal of time and expense."
   This is an internal engineering/risk cost, not a vendor invoice.

## Scope: this is 1 of bet365's ~92 sports

- We validated **NBA basketball only** (the data we hold). bet365 covers **~92 sports** (David).
- A Polymarket/Kalshi feed already spans **many** of those (major US/global sports, plus politics/econ).
  The **same pipeline and the same free data feed** would serve most overlapping sports — the build
  cost is largely **fixed and amortized across all covered sports**, not per-sport.
- We have **no evidence** on any non-NBA sport. The misallocation mechanism (live stat feed credits
  the wrong participant; humans repricing the market before the official correction) is **plausibly
  general** to any sport with live stats + a listed prediction market, but that is a hypothesis to
  test sport-by-sport, not a measured result. Stated as an explicit unknown, never as a claim.

## Trader-review "cost" — reframed

Traders are **already at the desk**. A false alarm does not add payroll; its real cost is **attention
and alert-fatigue** (too many cries-wolf → real ones get ignored). So the calculator's review-cost
input is a **soft, optional** number — set it to whatever a glance is worth to you, or $0 — and the
honest risk to watch is alert-fatigue, not headcount.
