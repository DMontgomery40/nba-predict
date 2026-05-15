# Market Anomaly Endpoint Scorecard

This scorecard is for live prediction-market weirdness detection. It is distinct
from incident forensics: live alerts do not require knowing a paired/rightful
player in the moment.

## Polymarket

| Surface                               | Signal value                                                 | Historical                     | Live   | Precision               | Volume share                | Depth/slippage | Current app coverage     | Priority |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------ | ------ | ----------------------- | --------------------------- | -------------- | ------------------------ | -------- |
| Gamma `/events`, `/markets`, search   | Market identity, condition IDs, token IDs, final/live volume | Yes                            | Poll   | API timestamps          | Volume denominators         | No depth       | Persisted for discovery  | P0       |
| Data API `/trades`                    | Executed prints, size, price, side, wallet, tx               | Yes                            | Poll   | Seconds                 | Yes with volume denominator | No depth       | Missing                  | P0       |
| CLOB `/prices-history`                | Repricing path and trade-vs-sampled-price context            | Yes                            | Poll   | Sampled seconds/minutes | No size                     | No depth       | Persisted as quote ticks | P0       |
| CLOB `/book`, `/books`                | Current executable depth and spread                          | Snapshot only unless persisted | Poll   | Local capture time      | No                          | Yes            | Missing                  | P0       |
| CLOB midpoint/spread/price/last-trade | Cheap quote drift and spread checks                          | Snapshot only unless persisted | Poll   | Local capture time      | Limited                     | Partial        | Missing                  | P1       |
| Market WebSocket                      | Live book, best bid/ask, trades, lifecycle                   | Only if locally persisted      | Stream | Message timestamps      | Yes for trades              | Yes            | Missing                  | P0       |

## Kalshi

| Surface                                 | Signal value                                | Historical                     | Live   | Precision           | Volume share           | Depth/slippage | Current app coverage       | Priority |
| --------------------------------------- | ------------------------------------------- | ------------------------------ | ------ | ------------------- | ---------------------- | -------------- | -------------------------- | -------- |
| `/markets`, `/events`, `/series`        | Market identity, status, volume, OI, prices | Partial via historical routes  | Poll   | RFC3339 fields      | Yes                    | Top quote only | Persisted for direct scans | P0       |
| `/markets/trades`, `/historical/trades` | Executed prints and quantity                | Yes                            | Poll   | RFC3339/seconds     | Yes with market volume | No depth       | Missing                    | P0       |
| Candlesticks and batch candlesticks     | OHLC, bid/ask, volume, OI windows           | Yes                            | Poll   | Candle end time     | Yes                    | Bid/ask only   | Partial                    | P0       |
| Single/batch orderbooks                 | Current executable depth                    | Snapshot only unless persisted | Poll   | Local capture time  | No                     | Yes            | Missing                    | P0       |
| WebSocket orderbook/trades/ticker       | Best live precision and depth changes       | Only if locally persisted      | Stream | Seconds/ms plus seq | Yes for trades/ticker  | Yes            | Missing                    | P0       |
| `/historical/cutoff`                    | Route old reads to historical endpoints     | Yes                            | Poll   | RFC3339             | Indirect               | No             | Missing                    | P1       |

## Implementation Read

- The robust detector needs discovery, trades, sampled price/candles, and book snapshots.
- Historical orderbook depth is unavailable unless the app persists live snapshots.
- Kalshi candlesticks are candle-end evidence and must carry lower confidence than trade-level rows.
- Unmapped source markets must remain visible as coverage/mapping work when they show abnormal activity.

## References

- Polymarket API overview: <https://docs.polymarket.com/api-reference>
- Polymarket CLOB price history: <https://docs.polymarket.com/api-reference/markets/get-prices-history>
- Polymarket Data API trades: <https://docs.polymarket.com/api-reference/core/get-trades-for-a-user-or-markets>
- Polymarket CLOB orderbook: <https://docs.polymarket.com/api-reference/market-data/get-order-book>
- Kalshi API overview: <https://docs.kalshi.com/welcome>
- Kalshi candlesticks: <https://docs.kalshi.com/api-reference/market/get-market-candlesticks>
- Kalshi batch candlesticks: <https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks>
- Kalshi multiple orderbooks: <https://docs.kalshi.com/api-reference/market/get-multiple-market-orderbooks>
- Kalshi historical trades: <https://docs.kalshi.com/api-reference/historical/get-historical-trades>
