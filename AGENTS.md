# nba-predict Agent Notes

This repo is live-only. Do not add synthetic modes, curated scenarios, seeded historical packs, or presentation-only data paths back into the runtime.

## Project-Local Memory

- If project-local Codex memory is used for this repo, use `~/.codex/projects/-Users-davidmontgomery-nba-predict/`.
- Do not read from or write to the AnalogLabor project-local memory path for work in this repo.

## Source Of Truth

- Live research data must come from persisted `games`, `game_states`, `market_instruments`, `source_markets`, `quote_ticks`, `raw_payloads`, `adapter_runs`, `mapping_resolutions`, and `game_outcomes`.
- NBA game-state truth comes through `apps/nba-sidecar`.
- If a workflow is not backed by persisted live data yet, describe it as pending rather than inventing a fallback.

## Architecture Boundaries

- `apps/api`
  - serves live research and admin routes only
- `apps/worker`
  - orchestrates ingestion and adapter run logging
- `apps/nba-sidecar`
  - Python `nba_api` sidecar
- `packages/shared`
  - repositories, migrations, errors, logging
- `packages/domain`
  - shared schemas and canonical live/research contracts

## Drift Prevention

- Update `README.md` whenever commands, required env, or runtime surfaces change.
- Update relevant `specs/*.md` files when storage, API, or UX contracts change.
- Update `PLAN.md` inline during long-running work so it reflects completed slices and the next concrete step.
- Do not describe the system as a presentation shell or synthetic-data console.
- If generated `dist` output is rebuilt locally, verify it stays aligned with the live-only source tree and does not reintroduce retired runtime language.

## Validation

- TypeScript workspace: `pnpm verify`
- Python sidecar when touched: `cd apps/nba-sidecar && uv run pytest`

## Guardrails

- Health and readiness should fail honestly when required live dependencies or persisted live data are missing.
- Spread/total/prop line mismatch must remain distinct from like-for-like probability divergence.
- Manual mapping flows should keep unmapped markets visible until they are explicitly resolved.

## Trader-First Purpose

- This product exists to help a trader suspend the right markets as fast as possible when a player stat may be misattributed, corrected, or otherwise unstable.
- Do not frame the product as a betting-picks, gambling, or market-commentary surface. It is an operator tool for another team.
- Live usefulness is primary. Historical replay exists to answer:
  - what the trader would have seen at the time,
  - how many seconds earlier a warning could have appeared,
  - which related markets would also have looked dangerous.
- Broad market or whole-board volatility is valid when it acts as the earliest tripwire, but it is not enough on its own. The operator-facing follow-up must fan out into the affected players, props, and related derivative markets.

## Trader Output Contract

- Operator-facing incident views should answer these questions first:
  - what happened,
  - when it happened in wall-clock time,
  - where it was in the game clock if known,
  - which player props or related markets should be reviewed or suspended first,
  - what evidence made the system think that,
  - what important uncertainty or missing feed data remains.
- If a surface cannot tell the trader which players or markets deserve immediate attention, it is not done.

## Market Incident Analysis Rules

These rules apply whenever analyzing NBA stat misallocation, stat correction, player-prop attribution, or prediction-market reaction incidents.

### Lead With Trader Action

- Start with the likely suspension or review target, not with generic volatility taxonomy.
- Show actual local timestamp first. Show game period/clock next if known.
- Use `T offset` as supporting research context after the trader-facing read, not as the opening line, unless the task is explicitly a backtest or incident report.
- If the first signal is a broad tripwire, say so plainly and then immediately enumerate the implicated player/prop follow-up.

### Start With The Real Event

- Do not present market timestamps without first anchoring them to the real-world game/stat event.
- Every incident report must start with an `Incident Timeline` table containing:
  - source-local time if supplied
  - UTC time
  - event description
  - affected players
  - affected stat/market family
- Every market row must include `T offset` from the relevant real-world event, such as `T+00:38` or `T-06:35`.
- Never write vague timing like "around then" when exact source times or API timestamps are available.
- If the real-world event time is unknown, say that first and mark market timing as unanchored.

### Analyze Paired Players And Related Props When Known

- Misattribution incidents usually involve at least two players:
  - credited player: the player who received the live stat
  - rightful player: the player who may have deserved the stat or related play component
- For post-hoc incident forensics, search markets for both players when the pair is known, not only the player shown on the sportsbook row.
- For live desk alerts, do not require knowing the rightful player. The live alert should scan broadly for prediction-market weirdness across mapped and unmapped markets, then tell the desk to inspect what happened.
- Expand beyond the exact sportsbook line when needed:
  - alternate lines for the same player/stat
  - related stat families affected by the play, such as points, rebounds, assists, RA, PRA, threes, steals, and blocks
  - both Yes/No or Over/Under sides when the venue exposes them separately
- A signal can be valid even when the exact sportsbook participant has no external market, if the paired player or related stat has abnormal market activity.

### Track Direct API Versus App Coverage

- Direct venue APIs are diagnostic tools; persisted app data remains the runtime source of truth only when the workflow is backed by persisted live data.
- If a direct API shows a market that the app missed, record this as a product-critical ingestion/query/mapping gap.
- For each incident target, distinguish:
  - market exists in direct venue API
  - market exists in persisted DB
  - market appears in the app/API response being inspected
  - market is genuinely absent from the venue
- Polymarket incident diagnostics should check, when relevant:
  - Gamma event/market metadata for event slug, condition ID, token IDs, outcomes, final reported volume
  - CLOB `prices-history` for timestamped price points by token
  - Data API `trades` for timestamp, side, outcome, size, price, wallet, transaction hash
- Kalshi incident diagnostics should check, when relevant:
  - event/market listings by series and event ticker
  - candlesticks for price, bid/ask, `volume_fp`, and `open_interest_fp`
- Do not assume the current app uses the best endpoint. For Polymarket, audit Gamma discovery, Data API trades/activity/holders, CLOB orderbooks/prices/midpoints/spreads/price history/last trade prices, and WebSocket market/sports/RTDS streams. For Kalshi, audit event/market/series listings, single and batch candlesticks, single and multiple orderbooks, trade/history endpoints, WebSockets, and open-interest/volume/depth fields.
- Before adding new ingestion, create an endpoint scorecard covering signal value, historical/live availability, timestamp precision, volume-share support, orderbook-depth support, auth/rate limits, current persistence, and current UI/API exposure.

### Treat Volume Share As A First-Class Signal

- Do not judge activity by raw notional alone. In thin player-prop markets, share of final market volume can be more important than dollars.
- Always compute:
  - raw size
  - raw notional
  - share of final reported market volume when available
  - distance between trade price and nearest sampled price-history ticks
  - whether the print caused sustained repricing or was an isolated print
- Concentrated off-price prints are high-priority market-structure alerts. Example: 26% of a market trading at 99c while sampled prices stay near 50c is a major anomaly even if the raw notional is small.

### Live Market Weirdness Comes First

- Live detection should prioritize any abnormal prediction-market activity, not only exact player-prop attribution rows.
- Escalate off-price prints, sudden volume share, volatility shocks, liquidity/spread shocks, and cross-venue disagreement across Kalshi and Polymarket.
- Treat Bet365/book exposure as optional context unless the workflow is explicitly an exact-line Bet365 risk check.

### Reporting Format

- Use compact tables for incident output. Avoid nested bullet stacks for data-heavy timelines.
- Required sections:
  - `Incident Timeline`
  - `Venue Coverage`
  - `Market Reaction`
  - `Read`
- `Market Reaction` rows should include:
  - venue
  - market
  - API surface (`price-history`, `trades`, `candlestick`, etc.)
  - timestamp UTC
  - `T offset`
  - action/type
  - price or price change
  - size
  - notional
  - volume share
  - interpretation
- For Kalshi, label candlestick timestamps as candle end times. Do not imply second-level trade precision from candle data.
- Keep settlement/adjudication separate from market reaction unless the task explicitly asks for settlement.
