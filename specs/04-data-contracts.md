# Data Contracts

## Canonical Live Entities

- `Game`
- `GameState`
- `GameOutcome`
- `MarketInstrument`
- `SourceMarket`
- `QuoteTick`
- `RawPayloadAttachment`
- `AdapterRun`
- `MappingResolution`

## Operational Artifacts

- `PlayerPropAlertPlaybackFrame`
- `MarketMicrostructureEvent`
- `MarketAnomalyAlert`
- `MarketAnomalyScoreConfig`
- `MarketAnomalyPlaybackFrame`

## Contract Rules

- `DATA-001` Canonical entities must be sport and league aware.
- `DATA-002` Every persisted source observation must retain provenance.
- `DATA-003` Probability-like values must normalize into decimal implied probability when possible.
- `DATA-004` Raw source terms and normalized values must both remain visible.
- `DATA-005` Spread, total, and prop comparisons must distinguish line mismatch from comparable state.
- `DATA-006` Live API responses should be assembled from repository-backed records rather than route-local anonymous shapes.
- `DATA-007` Runtime errors shall use stable codes such as `VALIDATION_ERROR`, `INVALID_MODE`, `EVENT_NOT_FOUND`, `GAME_NOT_FOUND`, `INSTRUMENT_NOT_FOUND`, `DATABASE_FAILURE`, and `ADAPTER_FAILURE`.
- `DATA-008` Worker heartbeats should expose source-scoped provider failures without erasing successful refresh counts from other providers in the same cycle.
- `DATA-009` Player-prop disagreement alerts must retain both sides of the attribution check: canonical instrument id, display label, participant key, line, side, Bet365 source market id/source label/latest probability/latest quote time, Kalshi/Polymarket source market id/source label/latest probability/latest quote time, signed divergence, quote-time gap, quote ages, and manual-review action.
- `DATA-010` Player-prop alert playback frames must retain the exact alert snapshot, captured-at time, notified alert ids, and poll thresholds. These frames are operational evidence written by the live watcher and shall not be seeded or synthetic runtime data.
- `DATA-011` Instrument divergence summaries must be derived from persisted quote ticks on one canonical probability scale. Summary payloads carry comparison count, first/latest comparison times, latest gap, peak gap, threshold duration, and the source probabilities from the exact latest/peak comparison bucket; UI surfaces must not combine unrelated latest source quotes.
- `DATA-012` Market anomaly alerts must be backed by persisted quote ticks or persisted microstructure events. A row may represent unmapped prediction-market activity, but it must carry mapping status and source-market provenance rather than being hidden or forced into an exact player-prop match.
