# API Spec

## Principles

- `API-001` All application routes shall be namespaced under `/api/v1` except for health probes.
- `API-002` Route params and query strings shall validate with Zod.
- `API-003` Responses shall return `{ data, meta }` for list and read-model routes.
- `API-004` Error responses shall return `{ error: { code, message, details?, operatorHint?, requestId? } }`.

## Health

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

## Research Routes

- `GET /api/v1/games`
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
- `GET /api/v1/research/player-prop-alerts`
- `GET /api/v1/research/player-prop-alert-playback`
- `GET /api/v1/research/market-anomalies` with optional `skipQuoteAnomalies=true` for low-latency microstructure-only desk reads
- `GET /api/v1/research/board-alerts`
- `GET /api/v1/research/board-alerts/incidents`
- `GET /api/v1/research/board-alerts/event-context`
- `GET /api/v1/research/board-alerts/replay`
- `GET /api/v1/research/board-volatility` returns the shared board-vw whole-board tripwire read model for each live game: 60-second bucket state, trailing-window baseline summary, score/confidence, phase context, evidence/drivers, and inspect payload. It is the earliest whole-board tripwire layer and must stay aligned with `shockKind === "game-state-volatility"` rows in `/api/v1/research/board-alerts`; consumers must not reconstruct a different detector client-side.
- `GET /api/v1/research/market-anomaly-score-config`
- `PUT /api/v1/research/market-anomaly-score-config`
- `GET /api/v1/research/market-anomaly-playback`

## Admin Routes

- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/runtime-config`
- `GET /api/v1/admin/capture/runs`
- `POST /api/v1/admin/capture/restart`
- `POST /api/v1/admin/backfill/games`
- `POST /api/v1/admin/backfill/markets`
- `GET /api/v1/admin/unmapped-markets`
- `POST /api/v1/admin/mappings/resolve`
- `POST /api/v1/admin/timeline-materializations/rebuild`
- `POST /api/v1/admin/board-volatility-baselines/rebuild`
- `GET /api/v1/admin/storage/coverage`

`POST /api/v1/admin/backfill/markets` accepts historical market backfill payloads for `source = bet365 | kalshi | polymarket` over a date window. The Bet365 path uses real settled-game Odds API historical endpoints; it must not reply with a “not wired” lie when the runtime can actually execute the backfill.

## Readiness

- `API-005` Readiness shall return `503` when required live dependencies or persisted live data are missing.
- `API-006` Live routes shall not fall back to synthetic or curated data.
- `API-007` Player-prop alert reads shall be backed by persisted `player-prop` instruments, mapped Bet365 source markets, mapped Kalshi/Polymarket source markets, and latest quote ticks. The route shall expose source labels, quote timestamps, line terms, signed divergence, and quote-time windows so trading can verify attribution without guessing.
- `API-008` Player-prop divergence rows shall require Bet365 plus at least one Kalshi/Polymarket latest implied-probability quote for the same canonical instrument. Line mismatch remains a separate comparison-state filter, not a proxy for provider overlap.
- `API-009` Player-prop alert playback shall read persisted watcher JSONL frames only. Each frame includes the poll timestamp, alert payload snapshot, notified alert ids, and poll thresholds so trading can replay what the watcher saw at that moment.
- `API-010` The undated games list shall default to the current slate: games near `now` and recently started games must sort before old persisted history so the first page cannot hide active NBA state.
- `API-011` Runtime configuration visibility shall be exposed through `/api/v1/admin/runtime-config` with secrets masked, defaults shown, and environment keys grouped for the Settings surface.
- `API-012` Divergence and signal-mismatch routes shall expose DB-derived same-time comparison summaries. Date-scoped requests stay scoped to `scheduled_start` date; undated divergence defaults to the current slate. Final-game rows may show peak historical divergence, but they must not be labeled or ranked as live action.
- `API-013` Market anomaly routes shall score persisted quote ticks and microstructure events without requiring Bet365 exposure or exact player-prop pairing unless requested by query/config. Rows must expose score, confidence, signal labels, API surface, source market, mapping status, price/trade/volume/share, spread/depth, and instrument link when mapped.
- `API-014` Readiness shall use bounded SQLite probes; large append-only storage counts may be high-water marks rather than exact `COUNT(*)` scans.
- `API-015` `/api/v1/research/board-alerts/event-context` shall use persisted NBA play-by-play when already present, otherwise attempt sidecar hydration first. If trustworthy NBA context still cannot be obtained, the route shall fail honestly instead of returning synthetic or guessed game-clock confirmation.
- `API-016` `/api/v1/research/board-alerts/incidents` may best-effort hydrate missing NBA play-by-play for historical warning audit, but it shall never invent NBA event anchors or pretend the feed was available when it was not.
- `API-017` Historical board-alert incidents that occur before the first trustworthy NBA action row shall be labeled honestly as pregame or near-tip availability/timing tripwires. They shall not be presented as confirmed in-game attribution follow-up, and event-context surfaces shall not decorate many-hours-away NBA rows as nearby context.
- `API-018` Date-scoped games/history reads shall not hide real past games merely because a stale `scheduled` state survived. If persisted market coverage, NBA play-by-play, or outcomes prove the game was real, the route must keep the row visible and fail closed on the missing canonical state instead of pretending the game never existed.
