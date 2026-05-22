# API Spec

## Principles

- `API-001` All application routes shall be namespaced under `/api/v1` except for health probes.
- `API-002` Route params and query strings shall validate with Zod or equivalent schema parsing.
- `API-003` Responses shall return `{ data, meta }` for list and read-model routes.
- `API-004` Error responses shall return `{ error: { code, message, details?, operatorHint?, requestId? } }`.

## Health

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

## Games And Exports

- `GET /api/v1/games`
- `GET /api/v1/games/:gameId`
- `GET /api/v1/games/:gameId/markets`
- `GET /api/v1/games/:gameId/markets/:instrumentId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/timeline`
- `GET /api/v1/games/:gameId/markets/:instrumentId/sources`
- `GET /api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/export.csv`
- `GET /api/v1/games/:gameId/markets/:instrumentId/delta-series`
- `GET /api/v1/games/:gameId/markets/:instrumentId/lead-lag`
- `GET /api/v1/games/:gameId/markets/:instrumentId/lead-lag-series`
- `GET /api/v1/divergence`
- `GET /api/v1/exports`
- `GET /api/v1/exports/:dataset.:format`
- `GET /api/v1/exports/sqlite`
- `GET /api/v1/exports/full-package.sqlite`

## Research Routes

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

Route notes:

- `/api/v1/research/board-volatility` is the shared whole-board tripwire read model. Consumers must not reconstruct a different detector client-side.
- `/api/v1/research/board-alerts` and `/api/v1/research/board-volatility` must stay aligned on the same underlying board runtime.
- `/api/v1/research/board-alerts/incidents` requires `date=YYYY-MM-DD`.
- `/api/v1/research/market-anomalies` supports filters such as `includeHistorical`, `includeUnmapped`, `minScore`, `minConfidence`, `requireBet365`, `source`, `family`, and `skipQuoteAnomalies`.
- `/api/v1/research/player-prop-alerts` supports filters such as `minDelta`, `maxQuoteTimeGapMinutes`, `maxQuoteAgeMinutes`, `limit`, and `includeStale`.

## Admin Routes

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

## Readiness

- `API-005` Readiness shall return `503` when required live dependencies or persisted live data are missing.
- `API-006` Live routes shall not fall back to synthetic or curated data.
- `API-007` The undated games list shall default to the current slate so active NBA state is not buried under old persisted history.
- `API-008` Player-prop alert reads shall require mapped persisted `player-prop` instruments, Bet365 source markets, exchange source markets, and latest quote ticks for the same canonical instrument.
- `API-009` Line mismatch shall remain a separate comparison state, not a proxy for provider overlap.
- `API-010` Divergence and signal-mismatch routes shall expose DB-derived same-time comparison summaries rather than arbitrary latest-quote mashups.
- `API-011` Market anomaly routes shall score persisted quote ticks and microstructure events without requiring exact player attribution at detection time.
- `API-012` Event-context and incident routes shall use trustworthy persisted NBA play-by-play when possible, attempt sidecar hydration when appropriate, and otherwise fail honestly.
- `API-013` Historical incident surfaces shall label pretip or near-tip states honestly rather than decorating distant NBA rows as nearby incident evidence.
- `API-014` Readiness shall use bounded SQLite probes; large append-only tables may report high-water marks rather than full counts.
- `API-015` Admin backfill routes must describe real executable runtime behavior, not imaginary or legacy paths.
