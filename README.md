# Signal Console

Signal Console is a live NBA trader-incident console for Bet365-style operator review. The current product thesis is board-first: the primary live trigger is whole-board money-weighted volatility, and once that tripwire fires the product is supposed to fan out into likely players, stat families, and suspension targets. Exact-line player-prop disagreement still matters, but it is a follow-up lane, not the headline trigger.

The live board runtime is the shared `board-vw` detector used by Desk, Board Alerts, replay, and inspect. Today it buckets in-play quote movement into 60-second whole-board windows, scores `Σ |Δ implied probability| * log1p(volume)`, and fires on a causal trailing `median + 3*MAD` threshold over the prior 20 non-empty buckets after an 8-bucket warmup. The research report in `outputs/innovation-team-suspend-signal-report/` explains why this family of signal exists; current code and current API payloads define the exact live runtime behavior.

This repo is live-only and persisted-data-only. Do not add synthetic runtime modes, curated scenarios, or presentation shells back into it.

## Current Truth

- Trader Desk leads with whole-board `game-state-volatility`, not isolated prop rows.
- `/api/v1/research/market-anomalies` is the broad prediction-market weirdness lane: off-price prints, volume share, spread/depth stress, and cross-venue disagreement.
- `/api/v1/research/player-prop-alerts` is the strict exact-line compatibility route for mapped Bet365 vs Kalshi/Polymarket follow-up.
- Historical replay exists to answer what the trader would have seen and how much earlier the warning could have arrived. It is not a generic post-game recap surface.
- The default runtime DB path is `data/signal-console.sqlite`. `data/signal-console.e2e.sqlite` is seeded test data and must never be presented as live evidence.
- Stale prompts, proposals, and exploratory notes were moved into `.docs-archive/2026-05-repo-audit/`. They are archival only.

## Repo Layout

- `apps/web`
  - trader-facing console routes
- `apps/api`
  - Fastify read models, health, research, exports, and admin routes
- `apps/worker`
  - ingest orchestrator, backfills, and watcher jobs
- `apps/nba-sidecar`
  - Python `nba_api` sidecar for normalized scoreboard and play-by-play
- `packages/domain`
  - shared contracts and schemas
- `packages/shared`
  - SQLite access, repositories, env loading, shared signal logic, errors, and logging
- `packages/adapters`
  - sportsbook and prediction-market capture and backfill adapters
- `specs`
  - active product, architecture, API, signal, and test specs
- `docs`
  - ADRs plus a few low-level reference docs

## Main Operator Surfaces

- `/`
  - Trader Desk. Ranked live queue led by whole-board volatility.
- `/board-alerts`
  - trader incidents and warning audit
- `/market-anomalies`
  - broad prediction-market weirdness queue
- `/prop-alerts`
  - strict exact-line player-prop follow-up
- `/games`
  - current slate and game workspaces
- `/history`
  - persisted research history
- `/exports`
  - data-engineering exports
- `/settings`
  - readiness, source state, config, admin controls, coverage, and mappings

## Local Run

1. Install JS dependencies:

```bash
pnpm install
```

2. Sync sidecar dependencies if needed:

```bash
cd apps/nba-sidecar
uv sync --extra dev
```

3. Set the minimum local env in repo-root `.env.local`:

```dotenv
SIGNAL_CONSOLE_DB_PATH=/Users/davidmontgomery/nba-predict/data/signal-console.sqlite
NBA_SIDECAR_BASE_URL=http://127.0.0.1:9393
ODDS_API_KEY=...
KALSHI_API_KEY=...
```

4. Start the NBA sidecar:

```bash
cd apps/nba-sidecar
uv run uvicorn nba_sidecar.main:app --reload --host 0.0.0.0 --port 9393
```

5. Start the web, API, and worker:

```bash
pnpm dev
```

## Runtime Env Loading

- `apps/api` and `apps/worker` automatically load repo-root `.env.local` and then `.env`
- explicit shell environment variables still win and are never overwritten
- the web dev server proxies `/api` and `/health` to `SIGNAL_CONSOLE_API_TARGET`, which defaults to `http://127.0.0.1:8788`

Default local ports:

- web: `http://127.0.0.1:4120`
- api: `http://127.0.0.1:8788`
- nba sidecar: `http://127.0.0.1:9393`

Temporary public local hosting:

```bash
pnpm --filter @signal-console/web build
TEMP_HOST_DISABLE_AUTH=1 pnpm host:temporary
```

## Key Environment

- `SIGNAL_CONSOLE_DB_PATH`
- `NBA_SIDECAR_BASE_URL`
- `NBA_SIDECAR_LOOKBACK_DAYS`
- `NBA_SIDECAR_LOOKAHEAD_DAYS`
- `ODDS_API_KEY`
- `ODDS_API_IO_KEY`
- `ODDS_API_TARGET_LOOKAHEAD_HOURS`
- `ODDS_API_TARGET_LOOKBACK_MINUTES`
- `BET365_INTERNAL_DUMP_DIR`
- `KALSHI_API_KEY`
- `KALSHI_API_SECRET`
- `KALSHI_LIVE_MAX_EVENTS`
- `KALSHI_LIVE_LOOKBACK_DAYS`
- `POLYMARKET_API_KEY`
- `POLYMARKET_API_SECRET`
- `POLYMARKET_API_PASSPHRASE`
- `WORKER_INTERVAL_MS`
- `WORKER_MAX_BACKOFF_MS`
- `BET365_RATE_LIMIT_COOLDOWN_MS`
- `PLAYER_PROP_ALERT_*`
- `MARKET_ANOMALY_*`
- `TEMP_HOST_*`
- `BASIC_AUTH_USERNAME`
- `BASIC_AUTH_PASSWORD`
- `LOG_LEVEL`
- `LOG_PRETTY`
- `NODE_ENV`
- `CI`

## Quality Gates

```bash
pnpm verify
cd apps/nba-sidecar && uv run pytest
```

`pnpm verify` runs the repo standard format, lint, typecheck, and test path for the TypeScript workspace.

## Runtime Surface

- `GET /health/live`
- `GET /health/ready`
- `GET /health`
- `GET /api/v1/games`
- `GET /api/v1/games/:gameId`
- `GET /api/v1/games/:gameId/markets`
- `GET /api/v1/games/:gameId/markets/:instrumentId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/timeline`
- `GET /api/v1/games/:gameId/markets/:instrumentId/sources`
- `GET /api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/export.csv`
- `GET /api/v1/divergence`
- `GET /api/v1/exports`
- `GET /api/v1/exports/sqlite`
- `GET /api/v1/exports/full-package.sqlite`
- `GET /api/v1/research/coverage`
- `GET /api/v1/research/signal-mismatches`
- `GET /api/v1/research/mismatches`
- `GET /api/v1/research/player-prop-alerts`
- `GET /api/v1/research/player-prop-alert-playback`
- `GET /api/v1/research/market-anomalies`
- `GET /api/v1/research/market-anomaly-score-config`
- `PUT /api/v1/research/market-anomaly-score-config`
- `GET /api/v1/research/market-anomaly-playback`
- `GET /api/v1/research/board-alerts`
- `GET /api/v1/research/board-volatility`
- `GET /api/v1/research/board-alerts/incidents`
- `GET /api/v1/research/board-alerts/event-context`
- `GET /api/v1/research/board-alerts/replay`
- `GET /api/v1/research/signal-quality`
- `GET /api/v1/research/closed-games`
- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/capture/runs`
- `GET /api/v1/admin/runtime-config`
- `GET /api/v1/admin/unmapped-markets`
- `GET /api/v1/admin/storage/coverage`
- `POST /api/v1/admin/capture/restart`
- `POST /api/v1/admin/backfill/games`
- `POST /api/v1/admin/backfill/markets`
- `POST /api/v1/admin/mappings/resolve`
- `POST /api/v1/admin/board-volatility-baselines/rebuild`
- `POST /api/v1/admin/timeline-materializations/rebuild`

See [`specs/05-api-spec.md`](specs/05-api-spec.md) for the current route contract and route-level notes.

## Common Commands

```bash
pnpm backfill --help
pnpm backfill nba --lookbackDays 7
pnpm backfill kalshi --since 2026-05-01 --maxEvents 200
pnpm market-anomaly-watch
pnpm prop-alert-watch
pnpm host:temporary
```

The worker backfill path uses the same live-only persistence model as the rest of the repo. It should never create synthetic rows just to make historical UI surfaces look healthy.

## Active Docs

- [`AGENTS.md`](AGENTS.md)
- [`PLAN.md`](PLAN.md)
- [`specs/01-product-requirements.md`](specs/01-product-requirements.md)
- [`specs/03-architecture-spec.md`](specs/03-architecture-spec.md)
- [`specs/04-data-contracts.md`](specs/04-data-contracts.md)
- [`specs/05-api-spec.md`](specs/05-api-spec.md)
- [`specs/06-signal-engine-spec.md`](specs/06-signal-engine-spec.md)
- [`specs/06b-board-anomaly-model.md`](specs/06b-board-anomaly-model.md)
- [`specs/07-test-plan.md`](specs/07-test-plan.md)
- [`docs/board-state-inventory.md`](docs/board-state-inventory.md)
- [`docs/bet365-internal-dump-schema.md`](docs/bet365-internal-dump-schema.md)
- [`outputs/innovation-team-suspend-signal-report/report.html`](outputs/innovation-team-suspend-signal-report/report.html)

Everything under `.docs-archive/` is preserved for archaeology, not for live repo guidance.
