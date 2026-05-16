# Productization update, 2026-04-23

This zip has a hardening pass focused on making the live-data claim auditable.

New pieces:

- `GET /api/v1/admin/runtime-audit`
- Settings page `Runtime evidence` panel
- `pnpm db:audit`
- `docs/live-db-handoff.md`
- `docs/product-readiness-gap-analysis.md`
- `docs/demo-runbook.md`

Important: the packaged `data/signal-console.sqlite` is schema-only, and `data/signal-console.e2e.sqlite` is seeded test data. David's live desk must be pointed at `/Users/davidmontgomery/nba-predict/data/signal-console.sqlite` with `SIGNAL_CONSOLE_DB_PATH` before presenting the dashboard as live-data-backed.

```bash
cd /Users/davidmontgomery/nba-predict && printf '%s\n' 'SIGNAL_CONSOLE_DB_PATH=/Users/davidmontgomery/nba-predict/data/signal-console.sqlite' 'PORT=8788' 'VITE_API_BASE_URL=http://localhost:8788' >> .env.local && pnpm db:audit
```

---

# Signal Console

Signal Console is a sparse NBA board-anomaly detector for Bet365 trader inspection. It continuously monitors relevant NBA market boards across pregame, near-tip, live game, and immediate operational settlement context, comparing normal market dynamics (H0) against abnormal board shocks (H1) and surfacing a small number of high-confidence board-level alert cards.

It is live-only, persisted-data-only, and never substitutes synthetic runtime modes for missing live data. Sportsbooks (Bet365, FanDuel, DraftKings) and prediction markets (Kalshi, Polymarket) are five distinct source families normalized onto a common probability axis but scored with distinct microstructure feature sets. Per-instrument divergence, per-source-market microstructure anomalies, and the exact-line player-prop monitor remain as building blocks and Inspect detail surfaces; they are not the headline product. See [`specs/01-product-requirements.md`](specs/01-product-requirements.md) and [`specs/06b-board-anomaly-model.md`](specs/06b-board-anomaly-model.md) for the full contract and model spec, and [`docs/board-state-inventory.md`](docs/board-state-inventory.md) for what the persisted `B(t)` actually contains today.

## Repo Layout

- `apps/web`
  - live research operator console
- `apps/api`
  - Fastify API for games, instruments, divergence, coverage, admin, and health routes
- `apps/worker`
  - capture orchestrator and NBA sidecar ingest loop
- `apps/nba-sidecar`
  - Python `nba_api` service for normalized NBA scoreboard, box score, and play-by-play payloads
- `packages/domain`
  - shared live/research contracts and schemas
- `packages/shared`
  - SQLite migrations, repositories, errors, and logging
- `packages/adapters`
  - live source integrations and external market adapters
- `specs`
  - live-only product, UX, architecture, API, data, and delivery specs
- `docs`
  - ADRs and traceability notes

## Run It

JavaScript apps:

```bash
pnpm install
pnpm dev
```

NBA sidecar:

```bash
cd apps/nba-sidecar
uv run uvicorn nba_sidecar.main:app --reload --host 0.0.0.0 --port 9393
```

## Runtime Env Loading

- `apps/api` and `apps/worker` automatically load repo-root `.env.local` and then `.env`
- explicit shell environment variables still win and are never overwritten
- the recommended local path is:
  1. run the NBA sidecar on `http://127.0.0.1:9393`
  2. set `NBA_SIDECAR_BASE_URL=http://127.0.0.1:9393` in `.env.local`
  3. keep source credentials such as `ODDS_API_KEY` and Polymarket keys in `.env.local` or `.env`
  4. run `pnpm dev`

Default local ports:

- web: `http://127.0.0.1:4120`
- api: `http://127.0.0.1:8787`
- nba sidecar: `http://127.0.0.1:9393`

SQLite state is stored at `data/signal-console.sqlite` by default.

Temporary public local hosting:

```bash
pnpm --filter @signal-console/web build
TEMP_HOST_DISABLE_AUTH=1 pnpm host:temporary
```

The temporary host serves the built web console from `apps/web/dist`, proxies
`/api` and `/health` to the local Fastify API, and listens on
`http://127.0.0.1:4210` by default. Put a Cloudflare tunnel in front of that
single local URL when a short-lived public link is needed. If you explicitly
need HTTP Basic Auth for a private operator bridge, leave
`TEMP_HOST_DISABLE_AUTH` unset and provide `BASIC_AUTH_USERNAME` plus
`BASIC_AUTH_PASSWORD`.

## Key Environment

- `SIGNAL_CONSOLE_DB_PATH`
- `NBA_SIDECAR_BASE_URL`
- `NBA_SIDECAR_LOOKBACK_DAYS`
- `NBA_SIDECAR_LOOKAHEAD_DAYS`
- `ODDS_API_KEY`
- `ODDS_API_IO_KEY`
- `ODDS_API_TARGET_LOOKAHEAD_HOURS` (optional; defaults to `8` for active Bet365 backup event discovery)
- `ODDS_API_TARGET_LOOKBACK_MINUTES` (optional; defaults to `90` for active Bet365 backup event discovery)
- `BET365_SESSION_STATE_PATH` (optional legacy bootstrap path)
- `BET365_INTERNAL_DUMP_DIR` (optional internal JSONL import folder)
- `KALSHI_API_KEY`
- `KALSHI_API_SECRET` (optional; not required for direct market-data capture)
- `KALSHI_LIVE_MAX_EVENTS` (optional; defaults to `200` for bounded live worker cycles)
- `KALSHI_LIVE_LOOKBACK_DAYS` (optional; defaults to `2` for recent live worker milestones)
- `POLYMARKET_API_KEY`
- `POLYMARKET_API_SECRET`
- `POLYMARKET_API_PASSPHRASE`
- `WORKER_INTERVAL_MS` and `WORKER_MAX_BACKOFF_MS`
- `PLAYER_PROP_ALERT_LIMIT`, `PLAYER_PROP_ALERT_INCLUDE_STALE`, `PLAYER_PROP_ALERT_PLAYBACK_DIR`, and `PLAYER_PROP_ALERT_TIME_ZONE`
- `MARKET_ANOMALY_LIMIT`, `MARKET_ANOMALY_MIN_SCORE`, `MARKET_ANOMALY_MIN_CONFIDENCE`, `MARKET_ANOMALY_INCLUDE_UNMAPPED`, `MARKET_ANOMALY_REQUIRE_BET365`, `MARKET_ANOMALY_PLAYBACK_DIR`, and `MARKET_ANOMALY_TIME_ZONE`
- `TEMP_HOST_PORT`, `TEMP_HOST_WEB_ROOT`, `TEMP_HOST_API_TARGET`, `TEMP_HOST_DISABLE_AUTH`, `BASIC_AUTH_USERNAME`, and `BASIC_AUTH_PASSWORD`
- `LOG_LEVEL`, `LOG_PRETTY`, `NODE_ENV`, and `CI`

## Quality Gates

```bash
pnpm verify
cd apps/nba-sidecar && uv run pytest
```

`pnpm verify` runs the repo standard format, lint, typecheck, and test path for the TypeScript workspace.

Historical backfills use the live-only persistence model and never load synthetic packs:

```bash
pnpm backfill nba --lookbackDays 365 --lookaheadDays 0
pnpm backfill kalshi --maxEvents 200 --periodInterval 60
pnpm backfill polymarket --since 2024-10-01 --maxEvents 200 --fidelity 1
pnpm backfill bet365-internal
pnpm backfill all
```

The NBA sidecar window backfill records per-date failures in the adapter run
error fields and continues when at least one requested date succeeds. If every
requested date fails, it fails the run honestly instead of writing a fake-green
zero-row window.

## Runtime Surface

- `GET /health/live`
- `GET /health/ready`
- `GET /health/ready` uses fast SQLite readiness probes: it skips full
  integrity checks and reports high-water marks for large append-only tables
  instead of exact row scans.
- `GET /api/v1/games?limit=N` (defaults to 25 and orders the undated list by the current slate before old persisted history)
- `GET /api/v1/games/:gameId`
- `GET /api/v1/games/:gameId/markets`
- `GET /api/v1/games/:gameId/markets/:instrumentId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/timeline`
- `GET /api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/export.csv`
- `GET /api/v1/exports`
- `GET /api/v1/exports/:dataset.csv`
- `GET /api/v1/exports/:dataset.jsonl`
- `GET /api/v1/exports/sqlite`
- `GET /api/v1/exports/full-package.sqlite`
- `GET /api/v1/divergence?date=YYYY-MM-DD&limit=N`
- `GET /api/v1/research/coverage`
- `GET /api/v1/research/signal-mismatches?date=YYYY-MM-DD`
- `GET /api/v1/research/player-prop-alerts?minDelta=0.15&maxQuoteTimeGapMinutes=10&maxQuoteAgeMinutes=10`
- `GET /api/v1/research/player-prop-alert-playback?date=YYYY-MM-DD&limit=300`
- `GET /api/v1/research/market-anomalies?minScore=45&minConfidence=0.45&includeUnmapped=true`
- `GET /api/v1/research/market-anomaly-score-config`
- `PUT /api/v1/research/market-anomaly-score-config`
- `GET /api/v1/research/market-anomaly-playback?date=YYYY-MM-DD&limit=300`
- `GET /api/v1/research/signal-quality?closingCutoff=pregame|live-final`
- `GET /api/v1/research/closed-games?closingCutoff=pregame|live-final&limit=N`

For `family=player-prop`, divergence rows require real comparison evidence:
persisted Bet365 quote ticks and at least one persisted Kalshi or Polymarket
quote tick must resolve to the same canonical instrument, and at least one
Bet365-vs-exchange quote pair must fall inside the same-time window. Current
alert rows add the stricter live-action requirement that both sides are still
inside the quote-age window.

Divergence summaries are DB-derived from persisted quote ticks on the canonical
probability scale. Final-game review rows use the peak same-time Bet365-vs-
exchange comparison for the game; live rows use the latest same-time comparison.
The payload also carries threshold duration and source probabilities from the
exact comparison bucket so the UI does not combine unrelated latest quotes.
Slate and desk game cards only show a top market signal when a same-time
comparison was measured. Coverage-only rows stay visible as market work without
being turned into fake zero-gap signals, and market-feed coverage is displayed
separately from NBA game-state availability.

- `GET /api/v1/games/:gameId/markets/:instrumentId/delta-series?bucketSeconds=60`
- `GET /api/v1/games/:gameId/markets/:instrumentId/lead-lag?bucketSeconds=60&maxLagBuckets=20`
- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/runtime-config`
- `GET /api/v1/admin/unmapped-markets`

## Historical Backfill

```bash
# Seed canonical NBA games + outcomes from nba_api (needs the Python sidecar)
pnpm backfill nba --lookbackDays 90

# Direct Kalshi NBA market-data capture across milestone-related game, spread,
# total, team-prop, player-prop, period, overtime, and related event families
pnpm backfill kalshi --since 2026-04-20 --maxEvents 900

# Public Kalshi KXNBAGAME settled event candles at 1h OHLC
# (or periodInterval=1 for minute)
pnpm backfill kalshi-historical --maxEvents 600 --periodInterval 60

# Polymarket closed NBA events at 1-min fidelity
pnpm backfill polymarket --maxEvents 200 --fidelity 1

# Bet365 internal JSONL dump (see docs/bet365-internal-dump-schema.md)
pnpm backfill bet365-internal

# Bet365 direct Playwright scrape (needs BET365_SESSION_STATE_PATH)
pnpm backfill bet365-direct

# All of the above (nba → kalshi → polymarket → bet365-internal)
pnpm backfill all
```

Backfills are idempotent: `quote_ticks` has a UNIQUE constraint on `(source_market_id, captured_at)` and all historical adapters use `INSERT OR IGNORE`. Each call also writes one `adapter_runs` row with `capture_mode = 'historical'`.

## Live Player-Prop Alert Watcher

```bash
pnpm prop-alert-watch
```

The watcher polls the same live player-prop disagreement read model used by the
desk, sends a macOS notification for each newly observed alert id, and appends
every poll frame to `data/player-prop-alert-playback/YYYY-MM-DD.jsonl`. Live
prop alerts require Bet365 plus Kalshi or Polymarket, matching player/outcome,
matching line, and quote timestamps inside the same-time window. Useful knobs:

- `PLAYER_PROP_ALERT_WATCH_INTERVAL_MS=10000`
- `PLAYER_PROP_ALERT_WATCH_DURATION_MS=21600000`
- `PLAYER_PROP_ALERT_MIN_DELTA=0.15`
- `PLAYER_PROP_ALERT_MAX_QUOTE_TIME_GAP_MINUTES=10`
- `PLAYER_PROP_ALERT_MAX_QUOTE_AGE_MINUTES=10`
- `PLAYER_PROP_ALERT_NOTIFY=1`

## Live Market Anomaly Watcher

```bash
pnpm market-anomaly-watch
```

The watcher polls the generalized prediction-market anomaly read model, sends a
macOS notification for each newly observed anomaly id, and appends every poll
frame to `data/market-anomaly-playback/YYYY-MM-DD.jsonl`. It does not require a
known paired player or Bet365 context unless `MARKET_ANOMALY_REQUIRE_BET365=1`
is set. Useful knobs:

- `MARKET_ANOMALY_WATCH_INTERVAL_MS=10000`
- `MARKET_ANOMALY_WATCH_DURATION_MS=21600000`
- `MARKET_ANOMALY_LIMIT=25`
- `MARKET_ANOMALY_MIN_SCORE=45`
- `MARKET_ANOMALY_MIN_CONFIDENCE=0.45`
- `MARKET_ANOMALY_INCLUDE_UNMAPPED=1`
- `MARKET_ANOMALY_REQUIRE_BET365=0`
- `MARKET_ANOMALY_NOTIFY=1`

## Current Status

- Live research storage, repository, and read APIs are in place. Schema version 9 includes UNIQUE `(source_market_id, captured_at)` on `quote_ticks`, `capture_mode` on `adapter_runs`, canonical instrument consolidation so all sources map to one instrument per `(game, family, participant, line)`, indexed source-market lookup for same-time divergence summaries, and persisted `market_microstructure_events` plus score configs for prediction-market anomaly detection.
- **Ingestion** — Polymarket NBA live + historical (minute-resolution CLOB `/prices-history`, including player-prop O/U markets), direct Kalshi NBA market-data capture via `KALSHI_API_KEY` across game, spread, total, team-prop, player-prop, period, overtime, and related event families, Kalshi historical `KXNBAGAME` candlesticks, Bet365 live-backup via Odds-API including player-prop markets, Bet365 internal JSONL drop folder, Bet365 direct Playwright scrape (awaits `BET365_SESSION_STATE_PATH`). The Odds-API Bet365 backup discovery call is limited to pending/live NBA events around the active target slate (`ODDS_API_TARGET_LOOKAHEAD_HOURS`, `ODDS_API_TARGET_LOOKBACK_MINUTES`) before requesting odds for matched event ids. NBA canonical games + outcomes via the Python sidecar, with graceful per-date error isolation and an official NBA CDN schedule fallback for future playoff games missing from `scoreboardv2`.
- **Worker resilience** — Market-provider failures are isolated inside a cycle: a Bet365 rate-limit or upstream outage is reported in the heartbeat `providerFailures` field and adapter runs, but does not prevent Kalshi or Polymarket from refreshing. Live Kalshi scans are bounded by `KALSHI_LIVE_MAX_EVENTS` and `KALSHI_LIVE_LOOKBACK_DAYS`.
- **Prediction-market weirdness** — `/api/v1/research/market-anomalies` is the broad desk-first anomaly route. It scores persisted Kalshi/Polymarket/Bet365 quote ticks plus persisted microstructure events for off-price prints, volume-share anomalies, volatility shocks, liquidity/spread/depth shocks, and cross-venue disagreement. It does not require knowing the paired/rightful player at detection time. `/market-anomalies` exposes the queue and score knobs, `pnpm market-anomaly-watch` records playback/notifications, and the trader desk popup now points to this generalized weirdness feed first.
- **Player-prop attribution risk** — `/api/v1/research/player-prop-alerts` remains the strict compatibility/safety route. It compares mapped player-prop quotes from Bet365 against Kalshi/Polymarket, filters by configurable divergence threshold and quote-time window, fails closed on player/outcome or line mismatch, and returns manual-review alerts with source labels, line terms, quote ages, and a risk score. `pnpm prop-alert-watch` can run out-of-band for desktop notifications and writes persisted alert checks served by `/api/v1/research/player-prop-alert-playback`.
- **Exports** — `/exports` is package-first for data engineering: the primary control downloads the full live SQLite snapshot (`/api/v1/exports/full-package.sqlite`) with all persisted tables, timestamps, quote volume columns, and raw payloads. The same route also exposes API-backed CSV/JSONL table exports plus filtered quote pulls for provider/family slices such as all player props or Kalshi player props.
- **Signal-quality analytics** — `signal-quality`, `closed-games`, per-instrument `delta-series` and `lead-lag` (source-to-source Pearson cross-correlation). Closing cutoff is pregame by default (`scheduled_start`), switchable to live-final. Calibration reports Brier and log-loss per source.
- **Web app** is a trader-terminal shell: flat dense grids, monospace numerics, keyboard nav (`g b` desk, `g a` anomalies, `g p` prop alerts, `g g` slate, `g d` divergence, `g r` research, `g h` history, `g e` exports, `g s` settings). Routes: `/`, `/market-anomalies`, `/prop-alerts`, `/divergence`, `/research`, `/history`, `/exports`, `/settings`, `/games/:gameId`, `/games/:gameId/markets/:instrumentId`. The root trader desk puts prediction-market weirdness first. `/prop-alerts` remains the exact-line Bet365-vs-exchange prop monitor. The instrument workspace shows peak divergence, latest measured divergence, threshold duration, same-time source rows, a mini chart, and raw source details behind a secondary control.
- **Perf** — `listSignalMismatches` / `listResearchDivergence` use window functions, batched game-bundle loading, and indexed instrument-to-source-market quote lookups so current-slate divergence summaries do not scan the full quote history before the operator desk can load.
- Legacy presentation-only runtime paths have been removed; storyline tables dropped in migration 3.
