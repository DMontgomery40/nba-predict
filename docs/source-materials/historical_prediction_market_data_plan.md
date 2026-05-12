# Historical Prediction Market Data Plan

## Objective

Build one to two seasons of NBA market research history without adding synthetic
or presentation-only paths. Historical rows must land in the same canonical
`games`, `game_states`, `market_instruments`, `source_markets`, `quote_ticks`,
`raw_payloads`, `adapter_runs`, `mapping_resolutions`, and `game_outcomes`
model used by live capture.

## Source Feasibility

| Source     | Historical path                                           | Status                        | Notes                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kalshi     | Official historical markets, candlesticks, and trades     | Feasible after ticker mapping | Kalshi documents historical endpoints for older settled markets, including market candlesticks and trades. Use this to rebuild price history once Kalshi tickers are mapped to canonical NBA instruments. |
| Polymarket | Public Gamma discovery plus CLOB price history and trades | Feasible after token mapping  | Polymarket documents public Gamma discovery endpoints, CLOB price-history endpoints, and Data API trades. Use Gamma to discover events/markets and CLOB/Data APIs for historical prices/trades.           |
| bet365     | Internal or licensed historical sportsbook odds feed      | Pending external data         | Public historical bet365 line history should not be assumed. Treat this as an internal export or approved vendor feed until a concrete source exists.                                                     |

References:

- Kalshi historical data overview: https://docs.kalshi.com/getting_started/historical_data
- Kalshi historical market candlesticks: https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks
- Polymarket market data overview: https://docs.polymarket.com/market-data/overview
- Polymarket API introduction: https://docs.polymarket.com/api-reference/introduction

## Backfill Shape

Tested worker backfills now exist for Kalshi historical candlesticks,
Polymarket CLOB price history, and internal bet365 JSONL/NDJSON imports. They
map source market identifiers, persist raw payloads, and append normalized rows
into canonical storage.

1. Use NBA sidecar/game outcomes to establish the canonical game season window.
2. Discover prediction-market events and source markets for those games.
3. Persist raw discovery payloads before normalizing.
4. Map source markets to canonical instruments using deterministic team, date,
   family, selection, and line matching.
5. Write historical quotes as append-only `quote_ticks`; never overwrite live
   observations.
6. Record each source pull as an `adapter_run`, including partial failures. NBA
   sidecar windows continue through isolated date failures, but a window where
   every date fails remains a hard error.
7. Keep unmapped historical source markets visible in the admin queue.

Run paths:

```bash
pnpm backfill nba --lookbackDays 365 --lookaheadDays 0
pnpm backfill kalshi --maxEvents 200 --periodInterval 60
pnpm backfill polymarket --since 2024-10-01 --maxEvents 200 --fidelity 1
pnpm backfill bet365-internal
```

## User Behavior Signal Proposal

Add an `Attention Pressure Index` only after user behavior events are persisted.
The metric should be computed per market and per short time bucket:

```text
attention_pressure =
  z(action_rate_30s)
  + z(focus_concentration_change)
  + z(repeat_edit_cancel_loop_rate)
  + z(betslip_open_rate)
  - z(price_move_30s)
```

Useful raw event families:

- market view or focus start/end
- price cell hover, expand, or detail open
- betslip open/close
- stake edit
- add, remove, suspend, reject, or cancel selection
- manual refresh or reprice action

This should flag concentrated user pressure before visible market movement, and
also flag weird attention with no matching line or price move. Until these events
are persisted, the UI must label the signal as pending rather than display a
fake value.
