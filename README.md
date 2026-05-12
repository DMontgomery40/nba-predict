# Signal Console

Signal Console is a live research system for in-game market comparison. It captures bet365, Kalshi, Polymarket, and NBA game-state data, persists append-only quote and game-state history, and exposes instrument-first APIs and operator surfaces for divergence analysis.

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

Temporary authenticated local hosting:

```bash
pnpm --filter @signal-console/web build
BASIC_AUTH_USERNAME=nba BASIC_AUTH_PASSWORD=change-me pnpm host:temporary
```

The temporary host serves the built web console from `apps/web/dist`, proxies
`/api` and `/health` to the local Fastify API, and listens on
`http://127.0.0.1:4210` by default. Put a Cloudflare tunnel in front of that
single local URL when a short-lived public link is needed.

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
- `TEMP_HOST_PORT`, `TEMP_HOST_WEB_ROOT`, `TEMP_HOST_API_TARGET`, `BASIC_AUTH_USERNAME`, and `BASIC_AUTH_PASSWORD`
- `LOG_LEVEL`, `LOG_PRETTY`, `NODE_ENV`, and `CI`

## Quality Gates

```bash
pnpm verify
cd apps/nba-sidecar && uv run pytest
```

`pnpm verify` runs the repo standard format, lint, typecheck, and test path for the TypeScript workspace.

## Runtime Surface

- `GET /health/live`
- `GET /health/ready`
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
- `GET /api/v1/research/player-prop-alerts?minDelta=0.15&maxPairGapMinutes=10&maxQuoteAgeMinutes=10`
- `GET /api/v1/research/player-prop-alert-playback?date=YYYY-MM-DD&limit=300`
- `GET /api/v1/research/signal-quality?closingCutoff=pregame|live-final`
- `GET /api/v1/research/closed-games?closingCutoff=pregame|live-final&limit=N`

For `family=player-prop`, divergence rows are actionable comparison rows only:
Bet365 must have a latest implied-probability quote and at least one latest
Kalshi or Polymarket implied-probability quote for the same canonical
instrument.

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

The watcher polls the same live player-prop disagreement read model used by the desk, sends a macOS notification for each newly observed alert id, and appends every poll frame to `data/player-prop-alert-playback/YYYY-MM-DD.jsonl`. Useful knobs:

- `PLAYER_PROP_ALERT_WATCH_INTERVAL_MS=10000`
- `PLAYER_PROP_ALERT_WATCH_DURATION_MS=21600000`
- `PLAYER_PROP_ALERT_MIN_DELTA=0.15`
- `PLAYER_PROP_ALERT_MAX_PAIR_GAP_MINUTES=10`
- `PLAYER_PROP_ALERT_MAX_QUOTE_AGE_MINUTES=10`
- `PLAYER_PROP_ALERT_NOTIFY=1`

## Current Status

- Live research storage, repository, and read APIs are in place. Schema version 5 includes UNIQUE `(source_market_id, captured_at)` on `quote_ticks`, `capture_mode` on `adapter_runs`, and canonical instrument consolidation so all sources map to one instrument per `(game, family, participant, line)`.
- **Ingestion** — Polymarket NBA live + historical (minute-resolution CLOB `/prices-history`, including player-prop O/U markets), direct Kalshi NBA market-data capture via `KALSHI_API_KEY` across game, spread, total, team-prop, player-prop, period, overtime, and related event families, Kalshi historical `KXNBAGAME` candlesticks, Bet365 live-backup via Odds-API including player-prop markets, Bet365 internal JSONL drop folder, Bet365 direct Playwright scrape (awaits `BET365_SESSION_STATE_PATH`). The Odds-API Bet365 backup discovery call is limited to pending/live NBA events around the active target slate (`ODDS_API_TARGET_LOOKAHEAD_HOURS`, `ODDS_API_TARGET_LOOKBACK_MINUTES`) before requesting odds for matched event ids. NBA canonical games + outcomes via the Python sidecar, with graceful per-date error isolation and an official NBA CDN schedule fallback for future playoff games missing from `scoreboardv2`.
- **Worker resilience** — Market-provider failures are isolated inside a cycle: a Bet365 rate-limit or upstream outage is reported in the heartbeat `providerFailures` field and adapter runs, but does not prevent Kalshi or Polymarket from refreshing. Live Kalshi scans are bounded by `KALSHI_LIVE_MAX_EVENTS` and `KALSHI_LIVE_LOOKBACK_DAYS`.
- **Player-prop attribution risk** — `/api/v1/research/player-prop-alerts` is the urgent trading safety route. It compares fresh mapped player-prop quotes from Bet365 against Kalshi/Polymarket, filters by configurable probability gap and timestamp window, and returns manual-review alerts with raw labels, source market ids, line terms, quote ages, and a risk score. The trader desk polls this route every five seconds and shows a popup plus first-panel queue when active prop disagreements appear. `pnpm prop-alert-watch` can run out-of-band for desktop notifications and writes a replay tape served by `/api/v1/research/player-prop-alert-playback`.
- **Exports** — `/exports` is package-first for data engineering: the primary control downloads the full live SQLite snapshot (`/api/v1/exports/full-package.sqlite`) with all persisted tables, timestamps, quote volume columns, and raw payloads. The same route also exposes API-backed CSV/JSONL table exports plus filtered quote pulls for provider/family slices such as all player props or Kalshi player props.
- **Signal-quality analytics** — `signal-quality`, `closed-games`, per-instrument `delta-series` and `lead-lag` (pair-wise Pearson cross-correlation). Closing cutoff is pregame by default (`scheduled_start`), switchable to live-final. Calibration reports Brier and log-loss per source.
- **Web app** is a trader-terminal shell: flat dense grids, monospace numerics, keyboard nav (`g b` desk, `g p` prop alerts, `g g` slate, `g d` divergence, `g r` research, `g h` history, `g e` exports, `g s` settings). Routes: `/`, `/prop-alerts`, `/divergence`, `/research`, `/history`, `/exports`, `/settings`, `/games/:gameId`, `/games/:gameId/markets/:instrumentId`. The root trader desk puts player-prop attribution alerts first, including a live popup for fresh Bet365-vs-prediction-market prop disagreement. `/prop-alerts` shows the live review queue plus the watcher replay tape. The instrument workspace carries a `SignalQualityStrip` with overlap buckets, peak |Δ| bet365↔external, and lead/lag pair.
- **Perf** — `listSignalMismatches` / `listResearchDivergence` use window functions + batched game-bundle loading; ~2× faster on the current DB and scales linearly, not per-tick.
- Legacy presentation-only runtime paths have been removed; storyline tables dropped in migration 3.
