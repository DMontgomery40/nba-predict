# Data Contracts

## Core Persisted Live Entities

- `Game`
- `GameState`
- `GameOutcome`
- `NbaPlayByPlayAction`
- `MarketInstrument`
- `SourceMarket`
- `QuoteTick`
- `RawPayloadAttachment`
- `AdapterRun`
- `MappingResolution`

## Supporting Signal And Ops Artifacts

- `MarketMicrostructureEvent`
- `BoardVolatilityBaseline`
- `MarketAnomalyAlert`
- `MarketAnomalyScoreConfig`
- `MarketAnomalyPlaybackFrame`
- `PlayerPropAlertPlaybackFrame`

## Contract Rules

- `DATA-001` Canonical entities must be sport and league aware.
- `DATA-002` Every persisted source observation must retain provenance.
- `DATA-003` Probability-like values must normalize into decimal implied probability when possible.
- `DATA-004` Raw source terms and normalized values must both remain visible.
- `DATA-005` Spread, total, and prop comparisons must distinguish line mismatch from comparable state.
- `DATA-006` Live API responses should be assembled from repository-backed records rather than route-local anonymous shapes.
- `DATA-007` NBA play-by-play `time_actual` is the trustworthy incident anchor when available. Do not substitute `game_states.started_at` or `game_states.final_at` for incident math.
- `DATA-008` Runtime errors shall use stable codes such as `VALIDATION_ERROR`, `EVENT_NOT_FOUND`, `GAME_NOT_FOUND`, `INSTRUMENT_NOT_FOUND`, `DATABASE_FAILURE`, and `ADAPTER_FAILURE`.
- `DATA-009` Worker heartbeats should expose source-scoped provider failures without erasing successful refresh counts from other providers in the same cycle.
- `DATA-010` Player-prop disagreement alerts must retain both sides of the comparison: canonical instrument id, display label, participant key, line, side, source labels, latest probabilities, latest quote times, signed divergence, quote-time gap, and quote age.
- `DATA-011` Player-prop and market-anomaly playback frames are operational evidence written by live watcher jobs. They must not be seeded or synthetic runtime data.
- `DATA-012` Instrument divergence summaries must be derived from persisted quote ticks on one canonical probability scale. Summary payloads carry comparison count, first and latest comparison times, latest gap, peak gap, threshold duration, and the source probabilities from the exact latest or peak comparison bucket.
- `DATA-013` Market anomaly alerts must be backed by persisted quote ticks or persisted microstructure events. Unmapped prediction-market activity stays visible with mapping status and source-market provenance rather than being forced into a false exact match.
- `DATA-014` Whole-board volatility and board-alert read models must come from the shared persisted board runtime, not separate per-surface implementations.
