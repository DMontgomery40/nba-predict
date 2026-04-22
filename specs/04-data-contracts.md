# Data Contracts

## Canonical Contract Principles

- `DATA-001` All source records shall normalize into canonical IDs before entering UI-facing read models.
- `DATA-002` Every record shall include provenance: `source`, `sourceTimestamp`, `ingestedAt`, and `freshnessStatus`.
- `DATA-003` All probability-like values shall be normalized into decimal probability form in the range `[0, 1]`.
- `DATA-004` Adapter-specific quirks shall remain in normalization notes and raw payload attachments, not in top-level UI fields.

## Canonical Types

### `SportEvent`

- `id`
- `league`
- `status`
- `tipoffAt`
- `homeTeamId`
- `awayTeamId`
- `marketType`
- `venue`
- `tags`

### `Team`

- `id`
- `league`
- `name`
- `shortName`
- `abbreviation`
- `city`

### `MarketSource`

- `id`
- `name`
- `kind`
- `modeAvailability`
- `reliabilityWeight`

### `MarketInstrument`

- `id`
- `eventId`
- `marketType`
- `selection`
- `line`
- `displayLabel`

### `MarketQuote`

- `id`
- `eventId`
- `instrumentId`
- `sourceId`
- `probability`
- `price`
- `spread`
- `volume`
- `depthScore`
- `sourceTimestamp`
- `ingestedAt`
- `freshnessStatus`
- `normalizationNotes`

### `OrderBookSnapshot`

- `id`
- `eventId`
- `sourceId`
- `bids`
- `asks`
- `bestBid`
- `bestAsk`
- `depthImbalance`
- `capturedAt`

### `SignalSnapshot`

- `id`
- `eventId`
- `capturedAt`
- `mode`
- `bookProbability`
- `consensusProbability`
- `divergenceScore`
- `confidenceScore`
- `watchlistPriority`
- `reasonCodes`
- `riskFlags`

### `DivergenceRecord`

- `eventId`
- `severityBand`
- `severityScore`
- `leadingSource`
- `laggingSource`
- `consensusGap`
- `exposureUrgency`

### `ConfidenceAssessment`

- `eventId`
- `score`
- `band`
- `freshnessWeight`
- `liquidityWeight`
- `reliabilityWeight`
- `agreementWeight`
- `completenessPenalty`

### `NarrativeCard`

- `id`
- `eventId`
- `title`
- `tone`
- `summary`
- `reasonCodes`
- `evidence`

### `WatchlistItem`

- `eventId`
- `priority`
- `alertReasons`
- `updatedAt`
- `status`
- `owner`

### `TimelineEvent`

- `id`
- `eventId`
- `capturedAt`
- `sourceProbabilities`
- `consensusProbability`
- `divergenceScore`
- `annotations`

### `AdapterHealth`

- `sourceId`
- `status`
- `lastSuccessAt`
- `lagMs`
- `errorCode`
- `message`

### `ReplayFrame`

- `id`
- `storylineId`
- `frameIndex`
- `capturedAt`
- `eventIds`
- `signalSnapshotIds`
- `annotations`

## Zod Schema Plan

- `DATA-005` Zod schemas shall be defined for every canonical type in `packages/domain/src/schemas`.
- `DATA-006` API responses shall use schema-safe read models assembled from canonical domain records rather than anonymous route-local objects.

Planned schema files:

- `packages/domain/src/schemas/core.ts`
- `packages/domain/src/schemas/signals.ts`
- `packages/domain/src/schemas/api.ts`
- `packages/domain/src/schemas/replay.ts`

## API Request / Response Contract Rules

- `DATA-007` Query filters shall use explicit enums or typed ranges where possible.
- `DATA-008` Response lists shall include `meta` blocks for paging, counts, or freshness summaries when relevant.
- `DATA-009` All event-detail responses shall include a `sources` block and a `signal` block so provenance and scoring stay co-located.

## Provenance Rules

- `DATA-010` Each UI-visible quote or score shall be traceable back to source timestamps and adapter identity.
- `DATA-011` If a value is derived from multiple sources, the response shall include the contributing sources and the calculation timestamp.

## Freshness Rules

- `DATA-012` Freshness statuses shall be one of `fresh`, `aging`, `stale`, or `offline`.
- `DATA-013` Freshness thresholds shall be source-specific and centrally configured.
- `DATA-014` Stale values may remain visible for context, but must never masquerade as current.

## Error Contracts

- `DATA-015` Runtime errors shall use stable codes such as `VALIDATION_ERROR`, `INVALID_MODE`, `EVENT_NOT_FOUND`, `FIXTURE_NOT_FOUND`, `REPLAY_SELECTION_INVALID`, `REPLAY_FRAME_OUT_OF_RANGE`, `DATABASE_FAILURE`, and `ADAPTER_FAILURE`.
- `DATA-016` Error payloads shall include enough context for diagnostics without leaking raw adapter internals by default.
- `DATA-017` API error envelopes shall expose `code`, `message`, `details`, and optional `operatorHint` and `requestId`.
