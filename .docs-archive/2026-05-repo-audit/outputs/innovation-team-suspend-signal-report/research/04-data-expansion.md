# 04 — Polymarket Trade-Tape Data Expansion: Attempt, Findings, and Blockers

**Agent:** datapull  
**Date:** 2026-05-21  
**Goal:** Widen Polymarket historical trade coverage from 18 games (existing `market_microstructure_events`) to all 64 PBP games, persisting into `data/extra-trades.sqlite`.

---

## Summary

**Outcome: 50-game event mapping delivered. 0 historical trades retrieved.**

The PM→PBP game mapping is complete and persisted to `data/extra-trades.sqlite/pull_log` (50 rows, status=`mapped_no_trades`). Historical trade tape for these 50 games cannot be pulled via any accessible public endpoint. The `data-api.polymarket.com/trades` endpoint — the same one used for the 18 live-pulled games — is a global descending feed that ignores all filter parameters for resolved/closed markets. Every alternative route (CLOB API, The Graph, Dune Analytics, Polygon RPC) is either auth-blocked, DNS-blocked, or structurally unsuitable.

The existing 18 games' trade tape was captured **live** during games. Expanding to the other 50 games requires either (a) running the worker live during future games, or (b) obtaining a Polymarket API key / Dune API key that grants access to historical trade data.

---

## What Worked

### 1. Event Discovery via Gamma API

`gamma-api.polymarket.com/events?slug=<slug>` returned full event metadata including:
- `gameStartTime` — exact scheduled tip-off UTC timestamp (critical for game matching)
- `markets[]` — array of all markets per event (moneyline, spreads, player props), each with `conditionId` and `clobTokenIds`
- `teams[]` — team metadata for outcome mapping

This endpoint is fully functional for resolved events. No authentication required.

### 2. Game-to-Event Matching via `gameStartTime`

PBP time windows (`MIN/MAX(time_actual)` from `nba_play_by_play_actions`) were compared to Gamma event `gameStartTime`. All 50 missing games were matched within a ±20 minute delta threshold.

Matching method: for each PBP game, compute `pbp_min_time_actual`; query Gamma for events in a ±4-hour window around that time using the NBA playoff slug pattern (`nba-{away}-{home}-YYYY-MM-DD`); select the event with minimum `|gameStartTime - pbp_min|`.

Two edge cases required direct slug queries:
- `nba-0042500232` → `nba-min-sas-2026-05-06` (id:437431) — automated match returned wrong event; corrected by direct slug lookup
- `nba-0042500233` → `nba-sas-min-2026-05-08` (id:439913) — same issue, home/away slug order

### 3. Condition ID Coverage

Total conditions (markets) discoverable per game: 37–68, median ~45. These are available for any future ingest once a working historical trades endpoint is found. They are not stored in `extra-trades.sqlite` (would require another Gamma pass, but the event IDs in `pull_log` make this trivial).

---

## What Was Probed and Failed

### `data-api.polymarket.com/trades?market=<conditionId>`

**Finding: market= filter is non-functional for resolved markets.**

Probed with multiple filter parameter names (`market`, `condition_id`, `asset`, `token`, `conditionId`, `marketId`). All returned the same global descending feed of recent trades regardless of the conditionId supplied. The `asset` field in returned rows did not match the requested token — Bitcoin/ETH trades appeared when filtering by an NBA player prop conditionId. This is consistent with the endpoint being a time-descending global feed with the filter param simply ignored when the market is closed/resolved.

**Why the 18 existing games work:** The worker polls this endpoint *live during the game*. At that moment the market is still active and `market=` filtering works. After resolution the filter stops working. The existing adapter (`packages/adapters/src/polymarket-trades.ts:296-317`) uses `since`/`until` as client-side filters applied after retrieval, not as server-side query params.

**Reference:** `packages/adapters/src/polymarket-trades.ts:294-317` (`fetchTradesPage`), `apps/worker/src/backfill.ts` (`polymarket-trades` backfill type with `--since`/`--until` ISO8601 params).

### `clob.polymarket.com/prices-history` and `/timeseries`

- `prices-history` returned `{"error": ...}` without an API key
- `timeseries` returned 404 for all tested condition IDs

These endpoints require a Polymarket CLOB API key (Bearer token).

### Strapi (`strapi.polymarket.com`)

DNS not resolvable from this environment.

### The Graph (Subgraph query)

`thegraph.com` DNS not resolvable. All subgraph URLs (hosted service, decentralized network) returned connection refused or DNS failure.

### Dune Analytics (`api.dune.com`)

Requires API key. `DUNE_API_KEY` not set in environment. Free tier key would work for historical queries but is not available here.

### Polygon RPC (`1rpc.io/matic`) — `eth_getLogs`

Accessible, but `eth_getLogs` is capped at 50-block range on this free endpoint (`-32602: eth_getLogs is limited to 0 - 50 blocks range`). A game spans ~10,000+ Polygon blocks (~14,400 blocks/hour × 2.5 hours). Retrieving a full game's trades would require 200+ RPC calls, well beyond what a 30s codemode call can handle.

Additionally: the CTF Exchange `OrderFilled` event (`0xbc9a2432...` on `0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e`) has all 4 event topics as indexed parameters and `data=0x`. There are no price/amount fields in the log — amounts are only available in the transaction input data, which requires `eth_getTransactionByHash` per trade. This makes on-chain reconstruction impractical at scale.

---

## Deliverable: `data/extra-trades.sqlite`

### Schema

```sql
CREATE TABLE extra_trades(
  game_id TEXT, condition_id TEXT, token_id TEXT, ts TEXT,
  side TEXT, price REAL, size REAL, notional REAL, src TEXT
);
CREATE TABLE pull_log(
  game_id TEXT, pm_event_slug TEXT, pm_event_id TEXT,
  status TEXT, n_trades INTEGER, note TEXT,
  pulled_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_extra_trades_game ON extra_trades(game_id);
CREATE INDEX idx_extra_trades_ts ON extra_trades(ts);
```

### Current state

| Table | Rows |
|---|---|
| `extra_trades` | 0 |
| `pull_log` | 50 |

### `pull_log` status codes

| Status | Count | Meaning |
|---|---|---|
| `mapped_no_trades` | 50 | PM event confirmed, game→event mapping verified, historical trades inaccessible |

### Full mapping (pbpGameId → pmEventSlug / pmEventId)

| PBP Game ID | PM Event Slug | PM Event ID | Conditions |
|---|---|---|---|
| nba-0042500132 | nba-tor-cle-2026-04-20 | 382086 | 54 |
| nba-0042500122 | nba-atl-nyk-2026-04-20 | 382088 | 41 |
| nba-0042500162 | nba-min-den-2026-04-20 | 382090 | 43 |
| nba-0042500112 | nba-phi-bos-2026-04-21 | 385417 | 56 |
| nba-0042500152 | nba-por-sas-2026-04-21 | 382092 | 37 |
| nba-0042500172 | nba-hou-lal-2026-04-21 | 382093 | 44 |
| nba-0042500102 | nba-orl-det-2026-04-22 | 391578 | 68 |
| nba-0042500142 | nba-phx-okc-2026-04-22 | 391579 | 45 |
| nba-0042500123 | nba-nyk-atl-2026-04-23 | 388787 | 40 |
| nba-0042500133 | nba-cle-tor-2026-04-23 | 388789 | 41 |
| nba-0042500163 | nba-den-min-2026-04-23 | 388790 | 40 |
| nba-0042500113 | nba-bos-phi-2026-04-24 | 391582 | 61 |
| nba-0042500173 | nba-lal-hou-2026-04-24 | 391580 | 44 |
| nba-0042500153 | nba-sas-por-2026-04-24 | 391581 | 41 |
| nba-0042500103 | nba-det-orl-2026-04-25 | 395795 | 56 |
| nba-0042500143 | nba-okc-phx-2026-04-25 | 395797 | 43 |
| nba-0042500124 | nba-nyk-atl-2026-04-25 | 395792 | 39 |
| nba-0042500164 | nba-den-min-2026-04-25 | 395794 | 41 |
| nba-0042500134 | nba-cle-tor-2026-04-26 | 399497 | 61 |
| nba-0042500154 | nba-sas-por-2026-04-26 | 399498 | 41 |
| nba-0042500114 | nba-bos-phi-2026-04-26 | 399501 | 67 |
| nba-0042500174 | nba-lal-hou-2026-04-26 | 399500 | 44 |
| nba-0042500104 | nba-det-orl-2026-04-27 | 403099 | 39 |
| nba-0042500144 | nba-okc-phx-2026-04-27 | 403101 | 41 |
| nba-0042500165 | nba-min-den-2026-04-27 | 403097 | 42 |
| nba-0042500115 | nba-phi-bos-2026-04-28 | 405167 | 62 |
| nba-0042500125 | nba-atl-nyk-2026-04-28 | 405164 | 38 |
| nba-0042500155 | nba-por-sas-2026-04-28 | 405160 | 43 |
| nba-0042500105 | nba-orl-det-2026-04-29 | 408550 | 60 |
| nba-0042500135 | nba-tor-cle-2026-04-29 | 408544 | 68 |
| nba-0042500175 | nba-hou-lal-2026-04-29 | 408548 | 41 |
| nba-0042500126 | nba-nyk-atl-2026-04-30 | 411944 | 41 |
| nba-0042500116 | nba-bos-phi-2026-04-30 | 411950 | 39 |
| nba-0042500166 | nba-den-min-2026-04-30 | 411947 | 42 |
| nba-0042500106 | nba-det-orl-2026-05-01 | 415401 | 64 |
| nba-0042500136 | nba-cle-tor-2026-05-01 | 415395 | 58 |
| nba-0042500176 | nba-lal-hou-2026-05-01 | 415399 | 41 |
| nba-0042500117 | nba-phi-bos-2026-05-02 | 418799 | 59 |
| nba-0042500107 | nba-orl-det-2026-05-03 | 422417 | 58 |
| nba-0042500137 | nba-tor-cle-2026-05-03 | 422402 | 52 |
| nba-0042500211 | nba-phi-nyk-2026-05-04 | 443239 | 38 |
| nba-0042500231 | nba-min-sas-2026-05-04 | 437429 | 49 |
| nba-0042500201 | nba-cle-det-2026-05-05 | 446686 | 55 |
| nba-0042500221 | nba-lal-okc-2026-05-05 | 440790 | 43 |
| nba-0042500212 | nba-phi-nyk-2026-05-06 | 443244 | 45 |
| nba-0042500232 | nba-min-sas-2026-05-06 | 437431 | 49 |
| nba-0042500213 | nba-nyk-phi-2026-05-08 | 443247 | 42 |
| nba-0042500233 | nba-sas-min-2026-05-08 | 439913 | 40 |
| nba-0042500236 | nba-sas-min-2026-05-15 | 465143 | 52 |
| nba-0042500311 | nba-sas-okc-2026-05-18 | 491091 | 57 |

---

## Implications for the Report

### What this means for Phase 2 signal bake-off

The 18 games with live-pulled trade tape in `market_microstructure_events` remain the only PM trade data available. These 18 games **are** the PM signal dataset. The bake-off must be honest about this: PM microstructure signal results have N=18, not N=64.

The `quote_ticks` table (37M rows, bet365+PM+Kalshi price quotes) covers all 64 PBP games and is the primary data source for board-signal and cross-venue analysis. The `nba_play_by_play_actions` table (64 games, sub-second `time_actual`) is the ground-truth anchor for all timing calculations.

### What would unblock historical PM trade coverage

1. **Dune Analytics API key** — Polymarket has a published Dune dataset (`polymarket/polymarket_trades`) that covers historical fills. A free or paid Dune API key would enable SQL queries over the full trade history. Cost: ~$0 for free tier (rate limited).

2. **Polymarket CLOB API key** — `clob.polymarket.com/prices-history?market=<conditionId>&startTs=<unix>&endTs=<unix>` would return OHLCV candles per condition per time window. Requires a Polymarket account + API key. Cost: free.

3. **Running the worker live for remaining 2026 playoff games** — For any games still to be played (conference finals, NBA Finals), the existing `polymarket-trades` backfill in `apps/worker/src/backfill.ts` with `--since`/`--until` will capture live trade tape exactly as it did for the 18 existing games. This is the zero-cost path for future coverage.

4. **Full Polygon archive node** — `eth_getLogs` against an archive node (e.g., Alchemy, QuickNode) with no block-range cap would allow reconstructing all CTF Exchange `OrderFilled` events. However, the on-chain logs do not contain price/size data (those are in calldata), making this approach impractical for trade-level microstructure reconstruction without per-transaction decoding.

---

## Source Code References

| File | Role |
|---|---|
| `packages/adapters/src/polymarket-trades.ts:294-317` | `fetchTradesPage()` — uses `market=<conditionId>` filter that is non-functional for resolved markets |
| `packages/adapters/src/polymarket-trades.ts:379-612` | `syncPolymarketNbaTrades()` — applies `since`/`until` as client-side time filter, not server params |
| `apps/worker/src/backfill.ts` | `polymarket-trades` backfill type; requires `--since`/`--until` ISO8601; used for live-game pulls |
| `packages/shared/src/live-repository.ts:~3883` | `INSERT OR IGNORE INTO market_microstructure_events` — writer for main DB trade tape |
