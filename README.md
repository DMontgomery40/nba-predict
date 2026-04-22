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

## Key Environment

- `SIGNAL_CONSOLE_DB_PATH`
- `NBA_SIDECAR_BASE_URL`
- `NBA_SIDECAR_LOOKBACK_DAYS`
- `NBA_SIDECAR_LOOKAHEAD_DAYS`
- `ODDS_API_KEY`
- `ODDS_API_IO_KEY`
- `BET365_SESSION_STATE_PATH` (optional legacy bootstrap path)
- `KALSHI_API_KEY`
- `KALSHI_API_SECRET` (optional direct Kalshi path)
- `POLYMARKET_API_KEY`
- `POLYMARKET_API_SECRET`
- `POLYMARKET_API_PASSPHRASE`

## Quality Gates

```bash
pnpm verify
cd apps/nba-sidecar && uv run pytest
```

`pnpm verify` runs the repo standard format, lint, typecheck, and test path for the TypeScript workspace.

## Runtime Surface

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/games`
- `GET /api/v1/games/:gameId`
- `GET /api/v1/games/:gameId/markets`
- `GET /api/v1/games/:gameId/markets/:instrumentId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/timeline`
- `GET /api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/export.csv`
- `GET /api/v1/divergence`
- `GET /api/v1/research/coverage`
- `GET /api/v1/research/signal-mismatches`
- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/unmapped-markets`

## Current Status

- Live research storage, repository, and read APIs are in place.
- The NBA sidecar exists and the worker now ingests a recent-plus-lookahead NBA schedule window so future scheduled games can map to live source markets.
- When `ODDS_API_KEY` is present, the worker now writes real Bet365 and Kalshi NBA markets into canonical instruments, source markets, quote ticks, raw payloads, and adapter runs through the backend-only Odds-API.io backup provider.
- The worker writes real Polymarket NBA game markets into `market_instruments`, `source_markets`, `quote_ticks`, `raw_payloads`, and `adapter_runs`.
- The web app now exposes first-class `Games`, `Divergence`, `History`, `Exports`, and `Settings` surfaces so persisted research remains visible even when the live slate is empty.
- The web app exposes the missing game-level workspace and a CSV timeline export path for instrument research artifacts, plus top-level dataset export actions for persisted capture runs, storage coverage, research coverage, and signal mismatches.
- The legacy presentation-only runtime path has been removed from the repo and regenerated build output.
- The remaining work is direct public-site Bet365 capture, richer charting depth, and broader end-to-end live validation.
