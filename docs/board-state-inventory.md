# Board-State Inventory (B(t))

This note documents what the persisted live data store actually contains today, so the board-anomaly detector can be honest about what `B(t)` can hold and what it cannot. All claims here are verified against `packages/shared/src/migrations.ts` (schema version 14) and the `live-repository.ts` reads in `packages/shared/src/`.

## Tables Available For Board-State Reconstruction

| Table                          | Granularity                                                        | What it gives `B(t)`                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games`                        | one row per canonical NBA game                                     | game identity, scheduled tip, home/away participant JSON. Anchors every observation to a game.                                                                                                                                                                                                                                              |
| `game_states`                  | append-only, per capture                                           | live status (`scheduled` / `in-play` / `final` / `postponed` / `cancelled`), period, clock, home/away score, `started_at`, `final_at`. Source of clock/score/margin context.                                                                                                                                                                |
| `game_outcomes`                | one row per finished game                                          | final score and winner. Used only for post-game settlement context, never for live alert scoring.                                                                                                                                                                                                                                           |
| `market_instruments`           | one row per canonical (game, family, participant, line, selection) | instrument identity, in-play flag, display label. Anchors mapped observations to a shared instrument across sources.                                                                                                                                                                                                                        |
| `source_markets`               | one row per source market key                                      | per-source market identity, mapping status (`auto` / `manual` / `unmapped`), raw label, optional `raw_family`, raw metadata JSON. Carries the unmapped label evidence the detector falls back to when there is no canonical instrument.                                                                                                     |
| `quote_ticks`                  | append-only, one row per `(source_market_id, captured_at)`         | implied probability, sportsbook line, raw price/odds, best bid/ask, volume, depth score, heartbeat flag. Primary movement series for both sportsbook and prediction-market surfaces.                                                                                                                                                        |
| `market_microstructure_events` | append-only                                                        | trade / price-tick / candlestick / book-snapshot events with `event_timestamp` (source time), `captured_at` (local), price, previous price, trade price, size, notional, volume, final market volume, volume share, best bid/ask, spread, depth score, and raw payload pointer. Primary input for prediction-market microstructure scoring. |
| `raw_payloads`                 | append-only                                                        | source-attributed raw JSON for audit. Used by Inspect, not by scoring.                                                                                                                                                                                                                                                                      |
| `adapter_runs`                 | append-only                                                        | per-adapter run telemetry with `capture_mode` (`discovery` / `historical` / `live`). Used to gauge coverage gaps.                                                                                                                                                                                                                           |
| `mapping_resolutions`          | append-only                                                        | manual mapping decisions. Lets the fanout graph promote previously unmapped labels into mapped instruments.                                                                                                                                                                                                                                 |
| `market_anomaly_score_configs` | per-profile                                                        | tunable thresholds/weights/toggles. The board detector reads its own profile but reuses this storage shape.                                                                                                                                                                                                                                 |
| `board_volatility_baselines`   | materialized cohort rows by baseline version                       | phase-aware empirical ranges (`p50`, `p75`, `p90`, `p99`) for whole-board abnormality. The shared whole-board model uses these baselines for live alerts, replay, inspect, and desk surfaces.                                                                                                                                               |

## Fields Available Per Source

| Field family                   | bet365                                   | kalshi                                                               | polymarket                                                           | nba (game state) |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------- |
| implied probability            | yes (derived from odds)                  | yes                                                                  | yes                                                                  | n/a              |
| sportsbook line / handicap     | yes (`line_raw`)                         | n/a                                                                  | n/a                                                                  | n/a              |
| raw odds string                | yes (`odds_raw`)                         | n/a                                                                  | n/a                                                                  | n/a              |
| best bid / best ask            | partial                                  | yes (when book snapshot is persisted)                                | yes (when book snapshot is persisted)                                | n/a              |
| depth score                    | partial                                  | partial                                                              | partial                                                              | n/a              |
| traded volume                  | partial                                  | yes (when trade or candle is persisted)                              | yes (when trade or candle is persisted)                              | n/a              |
| size / notional / volume share | n/a                                      | yes (in `market_microstructure_events`)                              | yes (in `market_microstructure_events`)                              | n/a              |
| source timestamp               | `captured_at` only                       | `event_timestamp` for microstructure events, otherwise `captured_at` | `event_timestamp` for microstructure events, otherwise `captured_at` | `captured_at`    |
| captured timestamp             | yes                                      | yes                                                                  | yes                                                                  | yes              |
| game state context             | via `game_states` join                   | via `game_states` join                                               | via `game_states` join                                               | yes              |
| market family                  | via `market_instruments.family`          | via `market_instruments.family`                                      | via `market_instruments.family`                                      | n/a              |
| mapped player / team           | via `market_instruments.participant_key` | via `market_instruments.participant_key`                             | via `market_instruments.participant_key`                             | n/a              |
| unmapped label evidence        | via `source_markets.raw_label`           | via `source_markets.raw_label`                                       | via `source_markets.raw_label`                                       | n/a              |
| suspension / removal / reopen  | not yet                                  | partial                                                              | partial                                                              | n/a              |

`partial` means the field is in the schema but population depends on the adapter (Odds-API.io backup paths often do not emit book/volume; direct Kalshi/Polymarket ingest can).

## Source Coverage Today

- **bet365** — live odds (moneyline/spread/total/player-prop) via Odds-API.io backup ingest and an internal JSONL drop folder. No native bet365 book/trade microstructure today. Direct Playwright scrape exists but depends on a session-state path that may be cold.
- **kalshi** — direct API capture of game/spread/total/team-prop/player-prop/period/overtime markets via `KALSHI_API_KEY`. Trade and book microstructure ingestion into `market_microstructure_events` is partial and called out as in-progress in `PLAN.md`.
- **polymarket** — live and historical (minute-resolution) CLOB `prices-history` plus discovery via Gamma. Trade and book microstructure ingestion into `market_microstructure_events` is partial.
- **nba** — canonical games, append-only `game_states`, and `game_outcomes` through the Python `nba_api` sidecar.
- **fanduel** — not ingested. See [`docs/fanduel-draftkings-provider-scorecard.md`](fanduel-draftkings-provider-scorecard.md).
- **draftkings** — not ingested. See [`docs/fanduel-draftkings-provider-scorecard.md`](fanduel-draftkings-provider-scorecard.md).

## What Is Absent (Carried As Missing-Data)

The board detector must mark these as missing rather than imputing them:

- bet365 traded volume, bid/ask, and depth (Odds-API backup does not carry them).
- kalshi/polymarket trade-level fills when only sampled candles or sampled price-history points were captured.
- pre-mapping participant identity on `source_markets.raw_label` rows (`mapping_status = 'unmapped'`).
- explicit `suspension` / `removal` flags for sportsbook markets (today only inferred from absence of a fresh `quote_ticks` row).
- fanduel and draftkings entirely.
- post-game stat-correction events from upstream stat providers (the detector treats these as Inspect-time annotations, not scoring inputs).

## Replay Without Future Leakage

A completed game is replayed by:

1. selecting `quote_ticks`, `market_microstructure_events`, and `game_states` for the game in `[scheduled_start - pregame_window, final_at + ingestion_latency_buffer]`,
2. ordering them by `event_timestamp` when present, falling back to `captured_at`,
3. advancing a replay clock and feeding only rows with `event_timestamp <= clock` (or `captured_at <= clock` when event time is missing) into the detector,
4. ignoring `game_outcomes` for scoring (it is used only as an Inspect-time settlement annotation),
5. cutting the replay at `final_at` plus the configured ingestion-latency buffer; later rows are visible only as Inspect-time annotations.

This guarantees the replay sees what the live trader would have seen at the same wall-clock instant, and current divergence measured hours after the buzzer is not the primary signal.

## Whole-Board Calibration Layer

Whole-board `game-state-volatility` no longer treats “many hot rows” as the score by itself. The persisted store now also supports a calibration layer:

- board observations are residualized against H0 first,
- the runtime derives a phase (`pregame`, `near-tip`, `tip-burst`, `settled-live`, `restart-burst`, `crunch-time`, `final-minute`),
- core families (`moneyline`, `spread`, `total`, `team-prop`) define the board headline while player props only support it,
- the runtime looks up the empirical cohort range in `board_volatility_baselines`,
- a linear Kalman filter smooths persistence/decay over those normalized features,
- the same output feeds `/board-volatility`, whole-board cards in `/board-alerts`, replay, and desk/inspect surfaces.

If no calibrated cohort is available yet, the runtime marks the board-volatility payload as `baseline.source = "fallback"` instead of pretending the percentile is fully calibrated.

## What `B(t)` Actually Contains

At time `t` for one game, `B(t)` is the set of `BoardObservation` rows the detector can build from the data above:

- a `game_id`,
- per-source quote ticks (bet365 line + implied probability, kalshi/polymarket bid/ask/probability),
- per-source microstructure events when present (trades, book snapshots, candles),
- the most recent `game_states` row at or before `t`,
- the mapping status and either the canonical instrument or the unmapped raw label,
- per-row timestamps for source and capture,
- missing-data flags for each field the source did not provide.

Anything outside this set (X/Twitter posts, F360 deltas, upstream stat-correction rows, Inspect screenshots) is optional enrichment for Inspect and never a required detector input.
