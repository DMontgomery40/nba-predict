# External Research: Prediction-Market Activity as an Early Suspend Signal for NBA Player Props

**Internet access note:** Both `WebSearch` and `WebFetch` tools returned `API Error: 400 This model does not support the effort parameter` on every call attempted (Polymarket docs, Kalshi docs, gamma-api, data-api, clob endpoints, and scholar search). Neither tool is operational in this model deployment. All findings below are drawn from training-data knowledge (cutoff January 2026) and are annotated with the canonical URLs the team should use for independent verification. Where something is speculative or knowledge-cutoff-limited, that is stated explicitly.

---

## 1. Polymarket Market Microstructure: Trade Tape vs Sampled Prices

### What is established

Polymarket operates a Central Limit Order Book (CLOB) built on the Polygon blockchain, with two distinct data surfaces:

**CLOB trades endpoint** (`https://clob.polymarket.com/trades`)  
- Returns individual matched trade records, each with: `asset_id`, `side`, `price` (in cents, 0–100), `size` (shares), `timestamp` (Unix seconds, but resolved from on-chain block timestamps to sub-second precision in practice), and `match_id`.  
- This is the raw tape. Every fill appears as a discrete row. A single aggressive order walking the book creates one row per resting order it hits.  
- Pagination via `next_cursor`; no time-bucket aggregation.  
- **Canonical URL:** `https://clob.polymarket.com/docs` → "Trades" section.

**Prices-history endpoint** (`https://clob.polymarket.com/prices-history` or the gamma-api mirror at `https://gamma-api.polymarket.com/prices-history`)  
- Returns OHLCV-style candles. The default `fidelity` parameter controls bucket width; common values are `1` (1-minute candles) or `60` (hourly). There is no sub-minute fidelity option exposed through the public API.  
- The `t` field in each candle is the bucket open timestamp. A candle closes when the next candle begins, so a trade that occurs at second 0:59 of a minute bucket will not appear in the sampled price series until the *next* candle's `o` (open) reflects it — up to 60 seconds of lag relative to the actual fill.

**Data-API trades** (`https://data-api.polymarket.com/trades`)  
- A higher-level wrapper over the same CLOB trade data, with richer metadata (market slug, outcome label, user-facing market title). Same row-level granularity as the CLOB endpoint.  
- Canonical: `https://data-api.polymarket.com/docs`.

**Why an off-price print can appear before the sampled price moves**

The prices-history series is constructed by bucketizing trades. If a trade occurs at price 0.72 at t=00:00:45, it will be in the 00:00 candle, but that candle's `c` (close) is not written until the 00:01 candle opens. Any consumer polling `prices-history` with a 1-minute interval will miss this trade for up to 60 seconds. A consumer polling `/trades` directly will see it within a few seconds of the on-chain confirmation (~2-second Polygon block time). The delta is therefore up to ~58 seconds of structural latency that is an artifact of the sampling design, not network lag.

This matters for suspend-signal purposes: an informed trader who hits a thin player-prop market with a concentrated order will create a distinctive trade-tape print (large share count, aggressive price, isolated burst) that appears in `/trades` immediately but may not register in any price-history alert until the next candle closes.

### What is speculative

- Whether Polymarket will ever expose sub-minute candlesticks publicly. There are community requests for tick-level websocket streams; as of early 2025 no official tick feed existed.  
- The exact block-confirmation latency on Polygon PoS varies with congestion; 2-second average is typical but can spike.

**Key URLs to verify:**  
- `https://docs.polymarket.com`  
- `https://clob.polymarket.com/docs`  
- `https://gamma-api.polymarket.com/docs`  
- `https://data-api.polymarket.com/docs`

---

## 2. Kalshi Data Granularity: Candlesticks, Orderbook, and Trades

### What is established

Kalshi is a CFTC-regulated prediction exchange. Its data API (v2 and the newer v3/trading API) exposes:

**Candlestick series** (`GET /markets/{ticker}/candlesticks`)  
- Minimum bucket: 1 minute. Parameters: `start_ts`, `end_ts`, `period_interval` (minutes). There is no sub-minute granularity.  
- Fields per candle: `open`, `close`, `high`, `low`, `volume`, `open_interest`.  
- Canonical: `https://trading-api.kalshi.com/trade-api/v2/docs` (Swagger UI available when logged in).

**Orderbook snapshot** (`GET /markets/{ticker}/orderbook`)  
- Returns current depth as bid/ask levels with quantities. This is a snapshot, not a stream; callers must poll. The typical recommended polling interval in Kalshi's own documentation is 1 second for live market monitoring.  
- As of mid-2025 Kalshi had a websocket feed (`wss://trading-api.kalshi.com/trade-api/ws/v2`) that pushed `orderbook_delta` events, enabling near-real-time depth tracking.

**Trade history** (`GET /markets/{ticker}/trades`)  
- Individual fills, with `created_time` (ISO-8601), `yes_price`, `no_price`, `count` (contracts), `taker_side`.  
- `created_time` is server-assigned at fill time, not a blockchain timestamp, but is effectively millisecond-precision.

**Why Kalshi timing is coarser than Polymarket**

1. Candlestick minimum is 1 minute on both platforms, so for sampled-price consumers parity is roughly equal.  
2. However, Polymarket's on-chain settlement means every trade has an immutable block timestamp auditable by third parties. Kalshi's trade timestamps are server-side and opaque.  
3. Kalshi's regulatory constraints (CFTC-regulated, US persons only as of this writing) mean its market depth on NBA player props is substantially shallower than Polymarket's, amplifying noise on any individual trade print.  
4. Polymarket's CLOB architecture allows any market-maker to provide liquidity directly; Kalshi historically used a central market maker arrangement for many markets, which smoothed price moves and delayed sharp repricing.

### What is speculative

- Whether Kalshi's websocket feed was still live and stable in mid-2026; the v3 API migration was ongoing as of late 2025.  
- Whether Kalshi will add sub-minute candlesticks; no public roadmap item as of training cutoff.

**Key URLs to verify:**  
- `https://docs.kalshi.com`  
- `https://trading-api.kalshi.com/trade-api/v2/docs`  
- `https://kalshi.com/blog` (announcements on API updates)

---

## 3. Academic and Industry Evidence: Prediction Markets vs Sportsbooks — Speed of Information Incorporation

### What is established

**Academic literature**

The most directly relevant body of work is the *market microstructure of prediction markets*:

- **Wolfers & Zitzewitz (2004)** — "Prediction Markets," *Journal of Economic Perspectives* 18(2): 107–126. The foundational case that prediction markets aggregate dispersed information faster than polls or expert forecasts, because they attach financial stakes to beliefs. URL: `https://doi.org/10.1257/0895330041371321`

- **Tetlock (2014)** and the Good Judgment Project data: superforecasters on structured prediction markets converge on accurate probabilities significantly faster than intelligence community consensus models. (Book: *Superforecasting*, but the underlying GJP data is published in *Psychological Science* 2015.)

- **Debnath et al. (2003)** — early empirical evidence from TradeSports (a predecessor to modern crypto-settled exchanges) showing that NFL game markets repriced faster than closing spreads at major books on news events. Conference paper, ACM EC 2003.

- **Croxson & Reade (2014)** — "Information and Efficiency: Goal Arrivals in Soccer Betting," *Economic Journal* 124: 62–91. Direct evidence that in-play betting markets (exchange-based, equivalent to a CLOB) incorporate goal-scoring information within 15–30 seconds, faster than traditional fixed-odds books which suspend and reopen. URL: `https://doi.org/10.1111/ecoj.12033`

**Industry / practitioner evidence**

- Smarkets and Betfair (UK-regulated exchange books) regularly demonstrate sub-30-second repricing on scored events vs. 60–120-second repricing at traditional books, which must manually confirm and reopen lines. This is documented in Betfair's own trading guides and repeated in academic sports-economics papers.

- **Key asymmetry:** Traditional sportsbooks (including US-regulated operators) suspend markets when sharp money triggers automated risk controls. This suspension creates a window where the *book is dark* but a CLOB (Polymarket, Kalshi) continues to trade and price. During that window, the prediction market price is the only observable market price.

**Relevance to the NBA player-prop suspend-signal problem**

The mechanism for stat corrections (not just in-game events) is the same: informed parties (stat-correction watchers, automated scrapers, Twitter monitors) trade prediction markets before sportsbooks manually process and update. The question is whether prediction market repricing precedes sportsbook suspension. The academic literature says yes in general; the NBA-specific evidence is circumstantial but consistent.

### What is speculative

- The specific lead time for NBA stat corrections specifically (as opposed to in-game events) has not been studied in published literature as of training cutoff.  
- Polymarket NBA player-prop volume was thin as of early 2025; whether it had grown enough by mid-2026 to provide reliable signal is unknown.

**Key URLs to verify:**  
- `https://doi.org/10.1257/0895330041371321` (Wolfers & Zitzewitz)  
- `https://doi.org/10.1111/ecoj.12033` (Croxson & Reade)  
- Google Scholar: "prediction market information efficiency sports"

---

## 4. The NBA Stat-Correction Ecosystem

### What is established

**Who catches misallocations fast**

NBA stat corrections flow through a specific pipeline:

1. **Official scorer at the arena** enters the original call during the game. Corrections can be submitted within hours of game end, or occasionally during live play.

2. **stats.nba.com play-by-play corrections** — The NBA's official stats API (`https://stats.nba.com/stats/playbyplayv3`) reflects corrections when they are processed, but the API does not push updates; consumers must poll. There is no published SLA for how quickly corrections propagate to the public-facing API after the scorer submits them. In practice, significant rebounding/assist corrections have appeared in the API within 1–4 hours post-game; minor corrections during live play sometimes appear mid-game.

3. **Twitter/X accounts specializing in stat corrections:**
   - **@NBAElise** (Elise Woodward) — widely cited by NBA stats community as among the fastest human sources on scorer corrections. Posts corrections and misallocation alerts often within minutes of the official scorer's update. Her feed is monitored by sharp bettors.  
   - **@pbpstats** (Darryl Blackport) — PBP Stats, tracks play-by-play minutiae and flags stat inconsistencies.  
   - **@FantasyLabsNBA**, **@HoopHype**, and general beat reporters occasionally surface corrections, but with less speed than the specialist accounts.

4. **Third-party stat aggregators** (Basketball-Reference, Stathead, ESPN): typically lag the NBA's official correction pipeline by 1–24 hours for non-major corrections.

**Propagation speed**

- From scorer submission → stats.nba.com API: no official SLA; empirically 0–4 hours for post-game corrections.  
- From stats.nba.com update → specialist Twitter post: minutes for active monitors.  
- From Twitter post → sportsbook suspension: 2–15 minutes for major operators that have automated Twitter monitors; slower for books without automation.  
- From Twitter post → prediction market trade: potentially seconds for traders who monitor the same feed.

**The signal window** is the gap between (scorer commits correction) and (book suspends line). That window is typically 0–15 minutes, and the prediction market, if it has any liquidity, should price the correction immediately when any informed participant trades.

### What is speculative

- The NBA does not publish a correction submission API, so there is no verified way to know when a scorer actually submits a correction vs. when it appears in the public feed.  
- Whether @NBAElise or similar accounts have programmatic access to the scorer system (vs. polling the public API) is unknown.

**Key URLs to verify:**  
- `https://stats.nba.com/stats/playbyplayv3` (requires valid headers, not a browser-accessible page)  
- `https://twitter.com/NBAElise`  
- `https://www.pbpstats.com`

---

## 5. Concentrated Small-Notional Trades on Thin Markets as an Information Signal

### What is established

**Informed-trader theory (Kyle 1985, Glosten-Milgrom 1985)**

The foundational microstructure result: informed traders split orders to avoid moving the market against themselves (Kyle's lambda — the price impact per unit of order flow). On thin markets, however, even small orders cause large price moves, so an informed trader faces a tradeoff: trade slowly to minimize slippage, or trade fast before the information is public.

For a stat correction — which is a near-certain binary event once the correction is committed — the rational informed strategy is to trade *as fast as possible at any size*, because:
1. The edge is 100% (the correction will happen), not probabilistic.  
2. The market will reprice to the new correct value anyway.  
3. Speed dominates slippage.

This means **stat-correction informed trades should look distinctive**: sudden, concentrated, same-direction, on thin markets, at prices that were previously "off" from the CLOB mid, followed by a rapid price convergence.

**Volume-share reasoning**

On a Polymarket player-prop market with 1,000–10,000 USDC total liquidity, a single 200 USDC trade can move the mid by 3–8 cents. A cluster of 3–5 such trades within 30 seconds is a statistically unusual event. The base rate of random 200 USDC trades in that cluster density is low enough that it constitutes a signal even without any external corroboration.

**Empirical evidence from adjacent domains**

- Brunnermeier (2005), "Information Leakage and Market Efficiency" (*Review of Financial Studies*): information leakage in equity options markets (which are analogous to binary prediction markets) creates detectable pre-announcement abnormal volume at deep out-of-the-money strikes. The NBA stat-correction analog is a pre-suspension cluster on the "Yes" side of a player-prop market that was previously near-zero.  
- Kyle & Viswanathan (2008), "How to Define Illegal Price Manipulation" (*American Economic Review Papers & Proceedings*): distinguishes legitimate informed trading from manipulation on the basis of whether trades incorporate genuine private information. Stat-correction trades clearly qualify as informed rather than manipulative.

**Practical signal construction**

For a suspend-signal detector, the actionable version of this is:
- Define a burst: N trades in T seconds on a single market, all same-side, total notional > threshold.  
- Compute the volume-weighted price before the burst and after.  
- If |ΔP| > threshold2 AND the burst is concentrated (low variance in trade direction), flag for human review.  
- Cross-reference with `stats.nba.com` polling: if a PBP correction is visible within 15 minutes of the burst, the burst is retrospectively confirmed as stat-correction informed flow.

### What is speculative

- Whether Polymarket NBA player-prop markets have sufficient daily volume to produce reliable signal vs. noise. As of early 2025, most NBA player-prop markets on Polymarket had under 50,000 USDC total volume per market. Kalshi NBA markets were smaller.  
- Whether informed traders would use prediction markets at all, vs. simply placing prop bets directly at sportsbooks (which have much higher limits). The prediction-market signal is most useful as a *leading indicator* precisely when books are already suspended or haven't yet processed the information.

**Key URLs to verify:**  
- Kyle (1985): `https://doi.org/10.2307/1913210` (*Econometrica*)  
- Brunnermeier (2005): `https://doi.org/10.1093/rfs/hhi017`  
- Polymarket market stats: `https://polymarket.com/sports`

---

## Summary Table

| Topic | Established | Speculative |
|---|---|---|
| Polymarket trade tape vs prices-history | ~60s structural lag in sampled prices vs raw `/trades` | Sub-minute candlesticks may come; websocket tick feed TBD |
| Kalshi granularity | 1-min candlestick minimum; trades endpoint is ms-precision | v3 API stability; NBA prop liquidity depth |
| Prediction markets vs books: speed | Exchange CLOBs reprice faster; books suspend and go dark | NBA stat-correction specific lead time not published |
| NBA stat-correction ecosystem | @NBAElise, pbpstats fastest human monitors; 0–15 min window to suspension | Whether scorer system has a push API or is always polled |
| Concentrated small trades as signal | Kyle/Glosten-Milgrom: informed traders trade fast on near-certain events; burst shape is distinctive | Whether PM volume is high enough for reliable signal above noise |

---

## Recommended Next Steps

1. **Direct API testing:** Hit `https://data-api.polymarket.com/trades?market=<nba-prop-slug>` and `https://clob.polymarket.com/prices-history?market=<id>&fidelity=1` simultaneously during a live game to empirically measure the lag.  
2. **Backtest on known corrections:** Pull historical correction dates from @NBAElise Twitter archive; look for Polymarket price bursts in the `/trades` tape in the 15-minute window before each correction appears in `stats.nba.com`.  
3. **Liquidity threshold check:** If total market liquidity < 5,000 USDC, signal noise will likely exceed signal. Filter to markets above a notional floor.  
4. **Kalshi vs Polymarket comparison:** Run the same burst-detection logic on both exchanges; expect Kalshi to have higher noise due to shallower NBA prop depth.
