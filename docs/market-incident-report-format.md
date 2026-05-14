# Market Incident Report Format

Use this format for NBA stat-misallocation, stat-correction, and player-prop market reaction reviews.

The goal is not to tell a story in bullets. The goal is to make the real-world event and market reaction line up in a way an operator can scan in seconds.

This is a post-hoc incident report format. Live anomaly detection does not require knowing the paired/rightful player before alerting; it should surface broad prediction-market weirdness first, then use this format once a real-world event anchor is known.

## Required Output Shape

### 1. Incident Timeline

Start every report here. If the real-world event time is missing, say so before showing market movement.

| Seq | Source time | UTC time | T anchor | Event | Players | Stat family |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `05:51:40 UK` | `2026-05-12T04:51:40Z` | `T0` | Rebound credited to Austin Reaves instead of Jaxson Hayes | Reaves / Hayes | Rebounds |
| 2 | `06:11:49 UK` | `2026-05-12T05:11:49Z` | `T+20:09` | Later Hayes rebound before end | Hayes | Rebounds |
| 3 | `06:23:27 UK` | `2026-05-12T05:23:27Z` | `T+31:47` | Match finished | Both | Rebounds |

Rules:

- `T0` must be the disputed or corrected game event unless the user says otherwise.
- Always include source-local time when provided.
- Always include UTC.
- Use `T+MM:SS` or `T-HH:MM:SS` offsets, not vague timing.

### 2. Venue Coverage

Show which markets existed before interpreting movement.

| Venue | Player | Market found | Market/line | API surface checked | Coverage read |
| --- | --- | --- | --- | --- | --- |
| Polymarket | Austin Reaves | Yes | `Rebounds O/U 4.5` | Gamma, CLOB price-history, Data trades | Paired-player market exists |
| Polymarket | Jaxson Hayes | No | None found | Gamma | No direct Hayes rebound market |
| Kalshi | Austin Reaves | No | No rebound market | Event listing | No direct rebound confirmation |
| Kalshi | Jaxson Hayes | No | No rebound market | Event listing | No direct Hayes market |

Rules:

- Do not collapse "market absent" and "app missed market" into one bucket.
- If direct API has a market but persisted app data does not, mark `Direct API found / app missing`.
- If only the paired player has a market, say that clearly.

### 3. Market Reaction

Use one table for market movement. Every row must tie to a real event through `T offset`.

| Venue | Market | API surface | UTC time | T offset | Type | Price / Change | Size | Notional | Volume share | Read |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T04:51:05Z` | `T-00:35` | price tick | `0.495` | | | | Pre-event sampled price |
| Polymarket | Reaves rebounds O4.5 | trades | `2026-05-12T04:52:18Z` | `T+00:38` | BUY Yes | `0.9894` | `101.0713` | `$100.00` | `24.6%` | Off-price concentrated print |
| Polymarket | Reaves rebounds O4.5 | trades | `2026-05-12T04:52:18Z` | `T+00:38` | BUY Yes | `0.9900` | `5.7200` | `$5.66` | `1.4%` | Same-second follow-on print |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T04:53:05Z` | `T+01:25` | price tick | `0.510` | | | | Sampled price still near 50c |
| Polymarket | Reaves rebounds O4.5 | price-history | `2026-05-12T05:26:04Z` | `T+34:24` | price jump | `0.510 -> 0.995` | | | | Later sustained repricing |

Rules:

- Use one row per trade when the trade is important.
- Use a rollup row only after the exact rows.
- `Volume share` is `trade size / final reported market volume` when available.
- For a multi-trade window, include both per-trade share and window-total share if it changes the interpretation.
- For Kalshi, write `candlestick` in `API surface` and call the timestamp a candle end time.
- Do not mix Polymarket second-level trade precision with Kalshi candle precision.

### 4. Read

Keep the interpretation short and explicit.

Recommended phrasing style:

```text
Read: This is a high-priority market-structure anomaly, not a clean sustained-confidence signal at T0. Within 38 seconds of the disputed rebound, 26.0% of final Polymarket volume printed as Yes at roughly 99c while sampled price-history ticks stayed near 49.5c/51c. Kalshi had no direct rebound market, so there was no direct cross-venue confirmation.
```

## Signal Labels

Use these exact labels when possible:

| Label | Meaning |
| --- | --- |
| `sustained repricing` | Price history moves and stays moved after the event. |
| `isolated off-price print` | One or more trades occur far from surrounding sampled price history. |
| `volume-share anomaly` | A small dollar amount is large relative to final market volume. |
| `cross-venue confirmation` | Two venues move in the same direction on comparable markets. |
| `cross-venue disagreement` | One venue moves or resolves directionally while another comparable venue does not. |
| `coverage absence` | The venue did not list a relevant market. |
| `app coverage gap` | Direct API had the market but the app/persisted path did not surface it. |
| `unanchored market move` | Market move found, but real-world event time is unknown. |

## CSV Schema For Exports

When exporting or staging data, use this column order:

```csv
incident_id,game,source_time,utc_time,t_anchor,event_description,credited_player,rightful_player,stat_family,venue,market,line,api_surface,market_timestamp_utc,t_offset,type,side,outcome,price_before,price_after,trade_price,size,notional,final_market_volume,volume_share,coverage_status,signal_label,interpretation,condition_id,token_id,ticker,transaction_hash,wallet
```

## Formatting Rules

- Prefer tables over bullets for data.
- Never put more than one logical event into one row.
- Use exact timestamps with seconds when available.
- Include `T offset` for every market row.
- If using a rollup like `top minute`, also show the underlying second-level trades.
- Do not say "around that time" when exact timestamps exist.
- Do not lead with settlement. Lead with market reaction.
