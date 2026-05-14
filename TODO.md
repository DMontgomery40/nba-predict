# Market Incident Audit TODO / Memory

This repo is being used for a real bet365/Kalshi/Polymarket incident review. Do not let the work drift into settlement adjudication. The core question is: **what did external prediction markets do at the exact moment a stat feed looked wrong or was corrected?**

## Critical Lessons From May 2026 Review

### 1. Direct API results diverged from what the app surfaced

- A prior app/session answer said the Reaves/Hayes example had no useful signal.
- Direct API inspection later found a real Polymarket market for `Austin Reaves: Rebounds O/U 4.5` on `nba-okc-lal-2026-05-11`.
- That market showed a concentrated trade burst near the disputed stat window and later repricing:
  - disputed event: `2026-05-12 05:51:40 UK` / `2026-05-12T04:51:40Z`
  - Polymarket trade burst: `2026-05-12T04:52:00Z`, 2 trades, 106.79 shares, about $105.66 notional
  - Polymarket price around disputed event stayed near 49.5c/51c rather than holding the spike
  - later post-game move: `2026-05-12T05:26:04Z`, 51c to 99.5c
- This means the app may be using incomplete endpoints, incomplete token/condition mapping, incomplete historical backfill, or a screen/query that hides available markets.
- TODO: audit app ingestion/query paths against direct endpoints:
  - Polymarket Gamma event discovery: event + market metadata, condition IDs, token IDs, aggregate volume
  - Polymarket CLOB `prices-history`: second/minute price history by token
  - Polymarket Data API `trades`: per-trade timestamp, side, size, price, condition ID
  - Kalshi market/event endpoints and candlesticks: price, bid/ask, volume_fp, open_interest_fp
- TODO: add an explicit diagnostic route/export that says, for each incident target:
  - market exists in direct API
  - market exists in persisted DB
  - market appears in app screen/query
  - if missing, exactly which layer dropped it

### 2. Post-hoc misattribution reports are paired-player incidents

For stat-feed mistakes, there are usually at least two affected players once the incident is understood:

- credited player: got the stat in the live feed but may not deserve it
- rightful player: should have received the stat, or should have received the shot/rebound/assist/steal/block context

The incident forensics workflow must not only search the named player in the market row. It must scan both sides of the attribution when the pair is known.

The live alert workflow is different: it should not wait until the rightful player is known. It should scan broadly for prediction-market weirdness, including off-price prints, volume-share anomalies, sudden repricing, liquidity shocks, and cross-venue disagreement across mapped and unmapped markets.

Example: Reaves/Hayes, Thunder at Lakers, May 11/12 2026:

- Source material says `05:51:40 UK` rebound assigned to Austin Reaves instead of Jaxson Hayes.
- Screenshot/bet365 exposure is on `Jaxson Hayes Over 4.5 rebounds`.
- Polymarket had `Austin Reaves Rebounds O/U 4.5`.
- Direct API search did not find a Kalshi/Polymarket `Jaxson Hayes rebounds` market for that game.
- Therefore the external-market signal can still exist through Reaves even when the sportsbook exposure is Hayes.

TODO: incident scanner must build a paired context object:

- `creditedPlayer`
- `rightfulPlayer`
- `statType`
- `originalEventTime`
- `correctionTime` if known
- `laterRelevantPlayTime` if known
- all markets for both players across the relevant stat family
- adjacent markets affected by the same play, such as points, rebounds, assists, RA, PRA, threes, steals, blocks
- all alternate lines for both players, not only the exact sportsbook line

TODO: alert logic should flag **any weird volume, volatility, or cross-venue disagreement in the paired context**, even if:

- only one of the two players has an external market
- only an alternate line exists
- the exact sportsbook line is missing
- the external signal shows up in a related market rather than the exact disputed stat

### 3. Reports must be exact-time event windows, not vague recaps

The output is being used for real incident review with real timestamps. It must be second/minute specific and anchored to the real-world game event before listing market movement.

Every example response should include:

- event timestamp in the source timezone, plus UTC
- nearest external price tick before the event
- nearest external price tick after the event
- trade/volume in a tight event window, such as T-2m to T+5m
- whether movement was immediate, delayed, or absent
- if delayed, exact delay in minutes/seconds
- whether the movement persisted, reverted, or only printed as isolated trades
- whether the relevant market existed on each venue
- whether the missing market is a coverage issue, mapping issue, or genuinely absent from the venue

Do not write "around that time" when source material gives exact times. Use exact rows like:

- `05:51:40 UK / 04:51:40Z event`
- `04:51:05Z price`
- `04:52:18Z trade`
- `04:53:05Z price`
- `05:11:49 UK / 05:11:49Z later Hayes rebound`
- `06:23:27 UK / 05:23:27Z match finished`

### 3b. Off-price concentrated prints are high-priority WTF alerts

The Reaves/Hayes Polymarket example showed a pair of `BUY Yes` trades at about 99c while the sampled CLOB price history was about 49.5c/51c. The notional was only about $105, but that was roughly 26% of the final reported market volume for the Reaves rebound market. In this product, that is a high-priority market-structure anomaly even if it is not sustained repricing.

TODO: classify incident-window trades with both absolute and relative context:

- absolute notional in the tight window
- share of total market volume
- distance between trade price and nearest pre/post price-history ticks
- whether the trade produced sustained repricing
- whether the print was repeated by other wallets or venues
- whether opposite-side prices/orderbook data confirm the move

For operator language, distinguish:

- `sustained market repricing`: price history moves and stays moved
- `isolated anomalous print`: one/few trades far away from surrounding price history; if it is a large share of market volume, escalate as a WTF/liquidity/anomaly alert
- `volume-only blip`: trade volume rises without a price move
- `coverage absence`: no matching market on the venue

In the Reaves/Hayes case, the 99c Polymarket buys should be described as a **high-priority isolated anomalous print**: about 26% of final market volume traded at 99c, 38 seconds after the disputed stat event, while surrounding sampled prices stayed near 49.5c/51c. That is a real alert, even if it is not broad sustained market repricing.

### 4. Incident-response framing for the two screenshot examples

Example 1: Celtics at Heat, April 1/2 2026, Neemias Queta assists

- Incident window:
  - `01:01:43 UK` basket scored with no assist allocated, Queta assisted
  - `01:08:35 UK` Queta updated with assist
- Direct API finding:
  - Kalshi had no Neemias Queta assist market for the game.
  - Polymarket had no Neemias Queta assist market for the game.
  - Polymarket did have Queta points/rebounds, but those were not direct assist signals and looked flat in the event window.
- Review answer shape:
  - "No clear Kalshi/Polymarket signal was available for this exact Queta assist misallocation because neither venue listed the relevant Queta assist market. This is a coverage limitation, not evidence that the market ignored the event."

Example 2: Thunder at Lakers, May 11/12 2026, Reaves/Hayes rebound

- Incident window:
  - `05:51:40 UK` / `2026-05-12T04:51:40Z`: rebound assigned to Austin Reaves instead of Jaxson Hayes
  - `06:11:49 UK` / `2026-05-12T05:11:49Z`: Hayes had another rebound before the end
  - `06:23:27 UK` / `2026-05-12T05:23:27Z`: match finished, not reallocated
- Direct API finding:
  - Polymarket had `Austin Reaves: Rebounds O/U 4.5`.
  - Direct API search did not find `Jaxson Hayes rebounds` on Kalshi/Polymarket for that game.
  - Kalshi did not have Reaves/Hayes rebounds; Kalshi had Reaves assists ladders.
- Market behavior at the disputed event:
  - Polymarket Reaves rebounds showed two Yes trades at `2026-05-12T04:52:18Z`, roughly 38 seconds after the disputed rebound, totaling 106.79 shares and about $105.66 notional.
  - The price series did not sustain a decisive move immediately: it was roughly 49.5c before/after the disputed event and 51c by `05:12Z`.
  - The decisive move came after match end: `2026-05-12T05:26:04Z`, from about 51c to 99.5c.
- Review answer shape:
  - "Yes, there was a detectable Polymarket tape reaction in the paired Reaves/Hayes context, but it was an isolated trade burst rather than an immediate sustained repricing. Kalshi did not provide a direct rebound-market confirmation."

## Product Work Implied

- Add incident-window API/export: given game, stat event time, players, stat, and line, return exact pre/post ticks and trade buckets.
- Add paired-player market expansion for every incident.
- Add alternate-line expansion for every player/stat.
- Add related-stat expansion for plays that can affect multiple props.
- Add venue-coverage diagnostics: absent venue market vs absent app mapping vs absent persisted history.
- Add a full venue API-surface audit. The current app and ad hoc scripts are using only a narrow slice of Kalshi/Polymarket data, and some endpoints/parameters are likely useless for signal while better signal surfaces are missing.
- For Polymarket, audit and classify these API surfaces:
  - Gamma discovery/metadata: `/events`, `/events/slug/{slug}`, `/markets/{id}`, `/public-search`, sports metadata, tags, series, active/closed/archived filters, slug/title/team/player search, `enableOrderBook`, `conditionId`, token IDs, outcomes, final volume, liquidity, open interest.
  - CLOB point-in-time liquidity: `/book?token_id=...`, `/books`, `/price`, `/prices`, `/midpoint`, `/midpoints`, `/spread`, `/spreads`, last-trade-price endpoints, tick size, minimum order size, bid/ask depth, book hash.
  - CLOB history: `/prices-history` with absolute `startTs`/`endTs` and `fidelity`, not just broad interval shortcuts.
  - Data API: `/trades`, positions, activity, open interest, holder/leaderboard surfaces where they help identify concentrated counterparties or repeated wallets.
  - WebSockets: market channel for `book`, `price_change`, `last_trade_price`, `best_bid_ask`, `new_market`, `market_resolved`; sports channel/RTDS if it gives faster event context.
- For Kalshi, audit and classify these API surfaces:
  - event/market/series listings, including nested market listings and sports/player-prop event discovery
  - single and batch candlesticks, including `include_latest_before_start` where available for price continuity
  - single and multiple market orderbooks, including YES/NO bid structures and derived asks
  - market trades/history if available for the relevant market class
  - WebSocket orderbook/trade/market data streams for live capture
  - open interest, volume, `volume_24h`, `volume_fp`, `open_interest_fp`, bid/ask, and depth-derived liquidity metrics
- Add an endpoint scorecard before implementing more ingestion:
  - signal value for incident detection
  - historical availability
  - live availability
  - timestamp precision
  - whether it supports volume/share calculations
  - whether it supports depth/slippage calculations
  - auth/rate-limit constraints
  - current app coverage status
- Add UI columns for:
  - event time
  - nearest pre-event external price
  - nearest post-event external price
  - T-2m/T+5m volume
  - volume share of final reported market volume
  - trade price distance from nearest sampled price
  - best bid / best ask / spread when available
  - orderbook depth near touch when available
  - biggest trade minute
  - first sustained move time
  - delay from event
  - paired player with market
  - exact venue coverage
  - direct API market found but app missing
  - API surface used
  - endpoint confidence / signal usefulness
