# Market Incident Audit Handoff Prompt

You are continuing work in `/Users/davidmontgomery/pm-anomaly`.

The user is investigating NBA stat-feed misallocation/correction incidents and how Kalshi/Polymarket behaved at the exact real-world event times. The user is frustrated because prior responses:

- reported market timestamps without anchoring them to the real game/stat event;
- treated small raw notional as weak even when it was a large share of a thin market;
- failed to search both players in a misattribution pair;
- gave nested bullet output that was hard to scan;
- mixed settlement-style commentary with the actual market-reaction question.

Do not repeat those mistakes.

## Non-Negotiable Objective

For each incident, answer:

> At the exact real-world event time, what did Kalshi and Polymarket show in price, volume, trades, volatility, and venue coverage?

Do not drift into final adjudication unless explicitly asked. This is about market behavior during the incident window.

## Must-Read Repo Files

- `AGENTS.md`
  - Now contains market incident analysis rules.
- `TODO.md`
  - Contains product-critical lessons from the current investigation.
- `docs/market-incident-report-format.md`
  - Defines the table format that should be used for all future incident outputs.

## Formatting Requirement

Use the format in `docs/market-incident-report-format.md`.

Every incident response must contain:

1. `Incident Timeline`
2. `Venue Coverage`
3. `Market Reaction`
4. `Read`

Every market reaction row must include:

- venue
- market
- API surface
- UTC timestamp
- `T offset` from the real-world event
- type/action
- price or price change
- size
- notional
- volume share when available
- interpretation

Do not use deeply nested bullets for data-heavy output.

## Timing Rules

- Real-world event time comes first.
- Every market time must be expressed relative to the real-world event: `T+00:38`, `T-06:35`, etc.
- If the real-world event time is unknown, mark the market movement as `unanchored`.
- Use exact seconds whenever the API provides them.
- Kalshi candlesticks are minute buckets; label those timestamps as candle end times.

## Misattribution Rule

Every stat misattribution incident must be treated as a paired-player problem.

Track:

- credited player
- rightful player
- stat type
- original event time
- correction time if known
- later relevant play time if known
- all markets for both players across the relevant stat family
- alternate lines and related stat families

A signal can exist even if the sportsbook-exposed player has no market, because the paired player may have the external market.

## Direct API Versus App Coverage

There is a known product-critical discrepancy:

- A prior app/session answer missed the Reaves/Hayes signal.
- Direct Polymarket API inspection found `Austin Reaves: Rebounds O/U 4.5` on `nba-okc-lal-2026-05-11`.
- This means a market can exist in direct venue APIs while the app path fails to surface it.

Always distinguish:

- direct API market exists
- persisted DB market exists
- app/API screen surfaces market
- venue genuinely has no market

## API Surface Audit Backlog

The current app/ad hoc workflow is almost certainly using an incomplete and uneven set of venue endpoints. Do not assume the existing ingestion path is using the best signal surfaces. Before adding more conclusions or implementing more ingestion, make an endpoint scorecard for each venue.

Score each endpoint/surface for:

- signal value for incident detection
- historical availability
- live availability
- timestamp precision
- whether it supports volume/share calculations
- whether it supports book-depth/slippage calculations
- whether it supports player/team/market discovery
- auth/rate-limit constraints
- whether the app currently persists it
- whether the app currently surfaces it

### Polymarket Surfaces To Audit

Polymarket API families:

- Gamma API: `https://gamma-api.polymarket.com`
  - markets, events, tags, series, comments, sports, search, public profiles
  - primary source for discovery/metadata
- Data API: `https://data-api.polymarket.com`
  - trades, positions, activity, holders/open interest, leaderboards, builder analytics
  - useful for volume concentration, repeated wallets, holder changes, and trade-tape checks
- CLOB API: `https://clob.polymarket.com`
  - orderbook, prices, midpoints, spreads, price history, last trade prices
  - useful for executable liquidity, slippage, spread, and sampled price history
- WebSockets:
  - market channel: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
  - sports channel: `wss://sports-api.polymarket.com/ws`
  - RTDS: `wss://ws-live-data.polymarket.com`
  - useful for live book/price/trade capture; historical replay is not guaranteed

Polymarket endpoints/fields to audit:

- Gamma discovery/metadata:
  - `GET /events`
  - `GET /events/slug/{eventSlug}`
  - `GET /markets/{id}`
  - `GET /public-search`
  - sports/team metadata where useful
  - important fields/parameters: slug, title, start time, end time, active/closed/archived state, tags, series, teams, question, condition ID, token IDs, outcomes, `enableOrderBook`, volume, liquidity, open interest, and market status
- CLOB price history:
  - `GET /prices-history?market={tokenId}&startTs={unix}&endTs={unix}&fidelity=1`
  - Use absolute `startTs`/`endTs` for incident windows; avoid broad interval shortcuts when exact source times exist.
  - This is sampled price history, not historical orderbook depth.
- CLOB point-in-time orderbook/pricing:
  - `GET /book?token_id={tokenId}`
  - `POST /books`
  - `GET /midpoint?token_id={tokenId}` and `POST /midpoints`
  - `GET /spread?token_id={tokenId}` and `POST /spreads`
  - price endpoints for best buy/sell where available
  - last-trade-price endpoints where available
  - critical for detecting off-price prints, spread blowouts, and whether a 99c trade was executable slippage versus a data artifact
- Data API:
  - `GET /trades?market={conditionId}&limit=500&offset=0`
  - audit user/market activity, holder/open-interest, and position endpoints if they can identify repeated wallets, concentrated counterparties, or sudden holder changes
- WebSocket market channel:
  - subscribe by asset/token IDs
  - capture `book`, `price_change`, `last_trade_price`, `best_bid_ask`, `new_market`, `market_resolved`
  - needed for future live runtime because REST price history does not provide historical book depth

Polymarket endpoint mistakes to avoid:

- Do not use Gamma `outcomePrices` as the only live signal; it can lag or represent display state rather than executable book.
- Do not treat CLOB `prices-history` as orderbook history.
- Do not evaluate a trade without nearest price-history ticks and, where possible, book/spread/depth context.
- Do not use broad `interval=max` when an incident has exact `startTs`/`endTs`; use absolute windows and explicit `fidelity`.
- Do not only search exact player/line. Use Gamma search/event metadata plus all markets in the event, both paired players, alternate lines, and related stat families.

### Kalshi Surfaces To Audit

Kalshi endpoints/surfaces to audit:

- Event/market listings:
  - `GET /events/{eventTicker}?with_nested_markets=true`
  - audit series/event/market listing endpoints for player-prop discovery, alternate lines, event metadata, status, open/close times, volume, `volume_24h`, and open interest
- Candlesticks:
  - `GET /series/{series}/markets/{ticker}/candlesticks?start_ts={unix}&end_ts={unix}&period_interval=1`
  - audit batch candlesticks, including `/markets/candlesticks`, for pulling many paired/alternate markets at once
  - use continuity parameters such as `include_latest_before_start` where available so charts do not start blank or miss the last pre-event price
  - use `volume_fp`, `open_interest_fp`, price, yes bid/ask; treat timestamps as candle end times
- Orderbooks:
  - single market orderbook: `/markets/{ticker}/orderbook`
  - multiple market orderbooks: `/markets/orderbooks`
  - Kalshi orderbooks expose yes/no bid ladders; derive asks and spreads carefully for binary markets
  - needed to detect depth, slippage, stale top-of-book, and whether a candle price was executable
- Trades/history:
  - audit market trade endpoints/history endpoints available for the relevant market class
  - prefer trade-level timestamps when available; otherwise label candle data as minute buckets
- WebSockets:
  - audit live orderbook/trade/market-data streams and auth requirements
  - future live runtime should capture these rather than relying only on polling snapshots
- Metrics:
  - open interest, volume, `volume_24h`, `volume_fp`, `open_interest_fp`, bid/ask, spread, and depth-derived liquidity metrics

Kalshi endpoint mistakes to avoid:

- Do not imply second-level trade precision from candlestick data.
- Do not compare Kalshi candles directly to Polymarket trades without labeling precision.
- Do not use only event-level volume when market-level `volume_fp`/`open_interest_fp` is available.
- Do not stop at direct exact-line lookup; scan all alternate ladders for both players and related stats.

### Narrow Surfaces Already Used

So far, the investigation mostly used:

- Polymarket Gamma event-by-slug discovery.
- Polymarket CLOB `prices-history`.
- Polymarket Data API `/trades`.
- Kalshi event listings with nested markets.
- Kalshi single-market candlesticks.

This is not enough for production incident detection. The next implementation should explicitly choose signal endpoints, not simply preserve the narrow set above.

## Important Known Findings

### Example 1: Celtics at Heat, April 1/2 2026, Neemias Queta assists

Real-world incident timeline from source material:

- `01:01:43 UK`: basket scored with no assist allocated; Queta reportedly assisted.
- `01:08:35 UK`: Queta updated with an assist.

Direct API coverage:

- Kalshi did not list a Neemias Queta assist market for that game.
- Polymarket did not list a Neemias Queta assist market for that game.
- Polymarket had Queta points/rebounds markets, but not the disputed assist market.
- The Queta points/rebounds markets looked flat in the event window.

Correct interpretation:

- This is a coverage absence for the direct disputed stat.
- Do not say the market ignored the event; the relevant market did not exist on the checked venues.

### Example 2: Thunder at Lakers, May 11/12 2026, Reaves/Hayes rebound

Real-world incident timeline from source material:

| Seq | Source time   | UTC time               | T anchor  | Event                                                     | Players        | Stat family |
| --- | ------------- | ---------------------- | --------- | --------------------------------------------------------- | -------------- | ----------- |
| 1   | `05:51:40 UK` | `2026-05-12T04:51:40Z` | `T0`      | Rebound assigned to Austin Reaves instead of Jaxson Hayes | Reaves / Hayes | Rebounds    |
| 2   | `06:11:49 UK` | `2026-05-12T05:11:49Z` | `T+20:09` | Later Hayes rebound before end                            | Hayes          | Rebounds    |
| 3   | `06:23:27 UK` | `2026-05-12T05:23:27Z` | `T+31:47` | Match finished, not reallocated in source material        | Reaves / Hayes | Rebounds    |

Venue coverage:

| Venue      | Player        | Market found | Market/line                                  | API surface checked                    | Coverage read                  |
| ---------- | ------------- | ------------ | -------------------------------------------- | -------------------------------------- | ------------------------------ |
| Polymarket | Austin Reaves | Yes          | `Rebounds O/U 4.5`                           | Gamma, CLOB price-history, Data trades | Paired-player market exists    |
| Polymarket | Austin Reaves | Yes          | `Points O/U 21.5`, `Assists O/U 6.5`         | Gamma                                  | Related markets exist          |
| Polymarket | Jaxson Hayes  | No           | None found                                   | Gamma                                  | No direct Hayes market         |
| Kalshi     | Austin Reaves | No           | No rebound market                            | Event listing                          | No direct rebound market       |
| Kalshi     | Jaxson Hayes  | No           | No rebound market                            | Event listing                          | No direct Hayes market         |
| Kalshi     | Austin Reaves | Yes          | assist ladders `2+`, `4+`, `6+`, `8+`, `10+` | Event listing/candlesticks             | Related but not direct rebound |

Polymarket Reaves rebound exact reaction:

Final reported market volume: `410.166918`.

| Venue      | Market               | API surface   | UTC time               | T offset  | Type       | Price / Change   |       Size |  Notional | Volume share | Read                               |
| ---------- | -------------------- | ------------- | ---------------------- | --------- | ---------- | ---------------- | ---------: | --------: | -----------: | ---------------------------------- |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T04:51:05Z` | `T-00:35` | price tick | `0.495`          |            |           |              | Pre-event sampled price            |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T04:52:05Z` | `T+00:25` | price tick | `0.495`          |            |           |              | Sampled price still near 50c       |
| Polymarket | Reaves rebounds O4.5 | trades        | `2026-05-12T04:52:18Z` | `T+00:38` | BUY Yes    | `0.9894`         | `101.0713` | `$100.00` |      `24.6%` | Off-price concentrated print       |
| Polymarket | Reaves rebounds O4.5 | trades        | `2026-05-12T04:52:18Z` | `T+00:38` | BUY Yes    | `0.9900`         |   `5.7200` |   `$5.66` |       `1.4%` | Same-second off-price print        |
| Polymarket | Reaves rebounds O4.5 | rollup        | `2026-05-12T04:52:18Z` | `T+00:38` | 2 trades   | about `0.99`     | `106.7913` | `$105.66` |      `26.0%` | High-priority volume-share anomaly |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T04:53:05Z` | `T+01:25` | price tick | `0.510`          |            |           |              | Sampled price still near 50c       |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T05:26:04Z` | `T+34:24` | price jump | `0.510 -> 0.995` |            |           |              | Later sustained repricing          |

Correct interpretation:

- This is a high-priority market-structure anomaly.
- It is not weak just because the raw notional is about $105; it is 26.0% of the final reported market volume.
- The weirdness is that two Yes buys printed near 99c 38 seconds after T0 while sampled price-history ticks stayed near 49.5c/51c.
- Do not phrase this as broad sustained market confidence at T0. Phrase it as a concentrated off-price print plus later sustained repricing.
- Kalshi did not provide direct rebound-market confirmation.

Kalshi Reaves assist related market:

This is related but not direct. Use only as context.

| Venue  | Market        | API surface | UTC time               | T offset from T0 | Type   | Price / Change                                  |               Size | Read                                             |
| ------ | ------------- | ----------- | ---------------------- | ---------------- | ------ | ----------------------------------------------- | -----------------: | ------------------------------------------------ |
| Kalshi | Reaves AST 6+ | candlestick | `2026-05-12T04:45:00Z` | `T-06:40`        | candle | price `0.44`, bid `0.30`, ask `0.43`            |   `1000` contracts | Related assist activity, before disputed rebound |
| Kalshi | Reaves AST 6+ | candlestick | `2026-05-12T05:07:00Z` | `T+15:20`        | candle | mid `0.630 -> 0.985` from prior candle sequence | `861.67` contracts | Related assist repricing, not direct rebound     |

## Other Known Polymarket/Kalshi Signals

These need real-world game/stat anchors before being used as final incident conclusions. The market API times below are useful, but if the exact real-world stat event time is unknown, mark them `unanchored`.

### Scottie Barnes assists, TOR-DET, Mar 31 / Apr 1

Polymarket `Scottie Barnes: Assists O/U 6.5`, final volume `2230.815337`:

- price move: `2026-04-01T01:39:42Z` `0.525` -> `2026-04-01T01:40:38Z` `0.995`
- shock-window trades:
  - `2026-04-01T01:39:47Z` BUY Yes `99.97 @ 0.99`, notional `$98.9703`
  - `2026-04-01T01:39:51Z` BUY Yes `11.9964 @ 0.99`, notional `$11.8764`
  - shock-window total: `159.3864` shares, `7.1%`
- top trade:
  - `2026-04-01T02:37:59Z` SELL Yes `356 @ 0.999`, notional `$355.644`, `16.0%`

Polymarket `Scottie Barnes: Assists O/U 7.5`, final volume `939.435883`:

- price move: `2026-04-01T01:50:53Z` `0.535` -> `2026-04-01T01:51:47Z` `0.995`
- shock-window trades:
  - `2026-04-01T01:50:01Z` BUY Yes `100.9798 @ 0.99`
  - `2026-04-01T01:50:07Z` BUY Yes `10.9767 @ 0.99`
- top trade:
  - `2026-04-01T02:21:27Z` BUY Yes `687.6461 @ 0.998359`, notional `$686.5174`, `73.2%`

Kalshi:

- `Scottie AST 7+`: `2026-04-01T01:40:00Z` candle, `280` contracts, price `0.99`
- `Scottie AST 8+`: `2026-04-01T01:48:00Z` candle, `376` contracts, price `0.99`; mid moved `0.800 -> 0.995` by `01:50:00Z`

### Josh Hart rebounds, NYK-OKC, Mar 29 / Mar 30

Polymarket `Josh Hart: Rebounds O/U 6.5`, final volume `442.407168`:

- price move: `2026-03-30T02:30:37Z` `0.49` -> `2026-03-30T02:31:48Z` `0.005`
- no trades in immediate price-shock window
- top trade:
  - `2026-03-30T02:15:10Z` BUY No `96 @ 0.99`, notional `$95.04`, `21.7%`

Kalshi:

- `Hart REB 7+`: `2026-03-30T02:09:00Z` candle, `400` contracts, price `0.99`
- `Hart REB 8+`: `2026-03-30T02:11:00Z` mid `0.010` -> `2026-03-30T02:12:00Z` mid `0.880`
- `Hart REB 8+` notable candles:
  - `02:08:00Z` vol `83`, price `0.87`
  - `02:11:00Z` vol `82`, price `0.01`
  - `02:12:00Z` vol `76`, price `0.88`

Potential interpretation once anchored:

- Could be audit-grade cross-venue disagreement, but do not finalize without a real-world stat event timestamp.

### LeBron rebounds, LAL-GSW, Apr 9 / Apr 10

Polymarket `LeBron James: Rebounds O/U 7.5`, final volume `1603.804243`:

- price move: `2026-04-10T06:08:39Z` `0.505` -> `2026-04-10T06:09:38Z` `0.995`
- no trades in immediate price-shock window
- top trade:
  - `2026-04-10T01:48:39Z` BUY Yes `348.5989 @ 0.51842`, notional `$180.7208`, `21.7%`

Kalshi `LeBron REB 8+`:

- `2026-04-10T02:13:00Z` candle, `512` contracts, price `0.50`
- later near-certainty candles:
  - `04:15:00Z` vol `183`, price `0.97`
  - `04:16:00Z` vol `227`, price `0.99`
  - `04:17:00Z` vol `195`, price `0.99`

### Kennard assists, LAL-GSW, Apr 9 / Apr 10

Polymarket `Luke Kennard: Assists O/U 5.5`, final volume `877.648798`:

- price move: `2026-04-10T03:50:44Z` `0.51` -> `2026-04-10T03:51:43Z` `0.995`
- shock-window trade:
  - `2026-04-10T03:53:45Z` SELL Yes `4.99 @ 0.999`, `0.6%`
- top trade:
  - `2026-04-10T04:03:03Z` SELL Yes `143.4 @ 0.999`, notional `$143.2566`, `16.3%`
- Kalshi did not have the Kennard assist market in the checked listings.

### Other leads

Moussa Diabate rebounds:

- Polymarket `Moussa Diabate: Rebounds O/U 8.5`
- price move: `2026-01-29T02:20:16Z` `0.56` -> `2026-01-29T02:21:14Z` `0.995`
- top minute:
  - `02:20:16Z` BUY Yes `11 @ 0.99`
  - `02:20:22Z` BUY Yes `235 @ 0.99`
  - `02:20:32Z` BUY No `100 @ 0.01`
  - share: `79.8%`

Banchero rebounds:

- Polymarket `Paolo Banchero: Rebounds O/U 2.5`
- price move: `2026-04-12T22:19:49Z` `0.50` -> `2026-04-12T22:20:53Z` `0.995`
- top minute `23:17:01Z` to `23:17:25Z`, total `132.018`, share `49.0%`
- Kalshi `Banchero REB 6+`: `2026-04-12T23:05:00Z`, `386` contracts, price `0.99`

Castle assists:

- Polymarket `Stephon Castle: Assists O/U 7.5`
- price move: `2026-04-22T02:41:05Z` `0.50` -> `2026-04-22T02:42:04Z` `0.005`
- shock-window trades:
  - `02:40:54Z` BUY No `5.5767 @ 0.98`
  - `02:41:12Z` BUY No `29.991 @ 0.99`
  - `02:44:42Z` SELL No `29.99 @ 0.999`
  - `02:45:56Z` SELL No `3.18 @ 0.999`
  - total `68.7377`, share `16.6%`

Jaylen Brown assists:

- Polymarket `Jaylen Brown: Assists O/U 4.5`
- price move: `2026-01-27T04:16:10Z` `0.455` -> `2026-01-27T04:17:13Z` `0.005`
- shock-window trades:
  - `04:15:19Z` BUY No `80 @ 0.99`
  - `04:15:21Z` BUY No `21.81 @ 0.985415`
  - `04:15:21Z` BUY No `100 @ 0.99`
  - `04:16:27Z` BUY No `11.19 @ 0.99`
  - total `213`, share `49.4%`

DeRozan assists:

- Polymarket `DeMar DeRozan: Assists O/U 3.5`
- price move: `2026-01-22T05:29:14Z` `0.50` -> `2026-01-22T05:30:21Z` `0.01`
- trades:
  - `05:28:44Z` BUY No `220 @ 0.963636`
  - `05:30:38Z` BUY No `20 @ 0.99`
  - `05:35:06Z` BUY No `34.99 @ 0.999`
  - total share `100%`

Dyson Daniels assists:

- Polymarket `Dyson Daniels: Assists Over 6.5`
- price move: `2026-01-14T05:53:11Z` `0.49` -> `2026-01-14T05:54:11Z` `0.005`
- trade:
  - `05:51:54Z` BUY No `30.58 @ 0.99`, share `100%`

## What To Do Next

1. Use the report format file before answering any incident question.
2. For any market time already found, obtain or reconstruct the real-world stat event time before calling it a strong incident match.
3. Add app-side diagnostics later:
   - direct API found
   - DB persisted
   - app route surfaced
   - missing layer
4. When implementing UI, add columns:
   - `source_time`
   - `utc_time`
   - `t_offset`
   - `paired_player_market`
   - `venue_coverage`
   - `api_surface`
   - `price_before`
   - `price_after`
   - `trade_price`
   - `trade_size`
   - `notional`
   - `volume_share`
   - `signal_label`
   - `coverage_status`
5. Do not produce nested bullet stacks for incident tables.
6. Do not call a market move meaningful unless it is anchored to the real-world event or explicitly labeled `unanchored`.
