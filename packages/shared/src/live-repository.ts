import { existsSync } from "node:fs";

import type {
  AdminSourceHealth,
  AdminUnmappedMarket,
  CanonicalGame,
  CanonicalGameState,
  ComparableState,
  CoverageRow,
  CoverageSummary,
  DivergenceRow,
  DivergenceSummary,
  GameOutcome,
  InstrumentComparisonView,
  InstrumentSourceDiagnostics,
  InstrumentTimeline,
  InstrumentTimelinePoint,
  LatestSourceView,
  MappingStatus,
  MarketFamily,
  MarketInstrument,
  MarketInstrumentView,
  PlayerPropAlertSource,
  PlayerPropDisagreementAlert,
  QuoteTick,
  RawPayloadAttachment,
  ResearchGameCard,
  ResearchGameDetail,
  ResearchGameStatus,
  ResearchSourceId,
  SignalMismatchRow,
  SourceMarket,
  StorageCoverageRow,
} from "@signal-console/domain";
import { marketFamilies, researchSourceIds } from "@signal-console/domain";

import {
  currentTimestamp,
  executeDatabaseOperation,
  getDatabase,
} from "./db-core";
import { DatabaseFailureError } from "./errors";

import type Database from "better-sqlite3";

type JsonValue = Record<string, unknown> | null | undefined;

type MarketFilters = {
  family?: MarketFamily;
  inPlay?: boolean;
  mappedOnly?: boolean;
  source?: ResearchSourceId;
};

type GamesFilters = {
  date?: string;
  hasUnmappedMarkets?: boolean;
  league?: string;
  limit?: number;
  sourceCoverage?: string;
  sport?: string;
  status?: string;
};

type DivergenceFilters = {
  date?: string;
  family?: MarketFamily;
  freshness?: string;
  inPlay?: boolean;
  league?: string;
  limit?: number;
  mappedState?: ComparableState;
  severity?: "low" | "medium" | "high" | "critical";
  sort?:
    | "captureRecency"
    | "divergence"
    | "freshness"
    | "lineMismatch"
    | "signalPriority";
  sourceSet?: string;
  sport?: string;
};

type PlayerPropAlertFilters = {
  includeStale?: boolean;
  limit?: number;
  maxPairGapMinutes?: number;
  maxQuoteAgeMinutes?: number;
  minDelta?: number;
  now?: Date | string;
};

type QuoteObservationInput = Omit<QuoteTick, "id" | "isHeartbeat"> & {
  heartbeatAfterMs?: number;
};

type AdminActionPayload = {
  payloadJson: Record<string, unknown>;
  requestedBy?: string;
  scope: string;
};

function parseJson<T>(payload: string | null | undefined, fallback: T): T {
  if (!payload) {
    return fallback;
  }

  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new DatabaseFailureError("Stored JSON payload is corrupt.", {
      cause: error,
      details: {
        payload,
      },
      operatorHint:
        "Inspect the offending SQLite JSON column before retrying this read path.",
    });
  }
}

function stringifyJson(payload: JsonValue) {
  return JSON.stringify(payload ?? {});
}

function toBoolean(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function nullableNumber(value: unknown) {
  if (value == null) {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function timestampValue(value: string | null | undefined) {
  if (!value) {
    return -1;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : -1;
}

function lineValuesMatch(
  left: number | null | undefined,
  right: number | null | undefined
) {
  if (left == null || right == null) {
    return true;
  }

  return Math.abs(left - right) < 0.000001;
}

function gapToSeverity(gap: number, lineMismatch: boolean) {
  if (gap >= 0.18) {
    return "critical" as const;
  }
  if (gap >= 0.1 || (lineMismatch && gap >= 0.04)) {
    return "high" as const;
  }
  if (gap >= 0.05 || lineMismatch) {
    return "medium" as const;
  }
  return "low" as const;
}

function computeCoverageSummary(
  sourceMarkets: SourceMarket[],
  latestTicks: Map<string, QuoteTick>,
  hasNbaState: boolean
): CoverageSummary {
  const availableSources = new Set<ResearchSourceId>();
  const unmappedSourceMarketCount = sourceMarkets.filter(
    (market) => market.mappingStatus === "unmapped"
  ).length;

  for (const sourceMarket of sourceMarkets) {
    if (latestTicks.has(sourceMarket.id)) {
      availableSources.add(sourceMarket.source);
    }
  }

  if (hasNbaState) {
    availableSources.add("nba");
  }

  const available = researchSourceIds.filter((sourceId) =>
    availableSources.has(sourceId)
  );

  return {
    activeSourceCount: available.length,
    availableSources: available,
    missingSources: researchSourceIds.filter(
      (sourceId) => !availableSources.has(sourceId)
    ),
    unmappedSourceMarketCount,
  };
}

function computeMappingStatus(sourceMarkets: SourceMarket[]): MappingStatus {
  if (sourceMarkets.length === 0) {
    return "unmapped";
  }
  if (
    sourceMarkets.some(
      (sourceMarket) => sourceMarket.mappingStatus === "unmapped"
    )
  ) {
    return "unmapped";
  }
  if (
    sourceMarkets.some(
      (sourceMarket) => sourceMarket.mappingStatus === "manual"
    )
  ) {
    return "manual";
  }
  return "auto";
}

function computeComparableState(
  instrument: MarketInstrument,
  mappingStatus: MappingStatus,
  latestSources: LatestSourceView[]
): ComparableState {
  if (mappingStatus === "unmapped") {
    return "unmapped";
  }

  if (
    instrument.family !== "moneyline" &&
    latestSources.some(
      (source) => !lineValuesMatch(source.raw.line, instrument.line)
    )
  ) {
    return "line-mismatch";
  }

  return "comparable";
}

function computeImpliedProbabilityGap(latestSources: LatestSourceView[]) {
  const comparable = latestSources
    .map((source) => source.impliedProbability)
    .filter((value): value is number => typeof value === "number");

  if (comparable.length < 2) {
    return null;
  }

  return Math.max(...comparable) - Math.min(...comparable);
}

function freshnessMsFromSourceViews(latestSources: LatestSourceView[]) {
  const timestamps = latestSources
    .map((source) => source.capturedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return Math.max(0, Date.now() - Math.max(...timestamps));
}

function freshnessBandFromMs(freshnessMs: number | null) {
  if (freshnessMs == null) {
    return "offline";
  }
  if (freshnessMs <= 60_000) {
    return "fresh";
  }
  if (freshnessMs <= 5 * 60_000) {
    return "aging";
  }
  return "stale";
}

function computeSignalPriority(
  impliedProbabilityGap: number | null,
  latestSources: LatestSourceView[],
  comparableState: ComparableState,
  inPlay: boolean
) {
  const gapScore = Math.round((impliedProbabilityGap ?? 0) * 1000);
  const coverageBonus =
    latestSources.filter((source) => source.capturedAt).length * 5;
  const mismatchPenalty = comparableState === "line-mismatch" ? -8 : 0;
  const inPlayBonus = inPlay ? 12 : 0;

  return Math.max(0, gapScore + coverageBonus + mismatchPenalty + inPlayBonus);
}

function sourceHasProbability(source: LatestSourceView) {
  return typeof source.impliedProbability === "number";
}

function quotedResearchSources(latestSources: LatestSourceView[]) {
  return uniqueResearchSources(
    latestSources.filter(sourceHasProbability).map((source) => source.source)
  );
}

function hasPlayerPropComparisonSource(latestSources: LatestSourceView[]) {
  const sources = new Set(quotedResearchSources(latestSources));
  return (
    sources.has("bet365") &&
    (sources.has("kalshi") || sources.has("polymarket"))
  );
}

function isVisibleDivergenceInstrument(instrumentView: MarketInstrumentView) {
  return (
    instrumentView.instrument.family !== "player-prop" ||
    hasPlayerPropComparisonSource(instrumentView.sources)
  );
}

function uniqueResearchSources(
  sources: Iterable<ResearchSourceId>,
  options?: { includeNba?: boolean }
) {
  const seen = new Set(sources);
  return researchSourceIds.filter((sourceId) =>
    options?.includeNba === true
      ? seen.has(sourceId)
      : sourceId !== "nba" && seen.has(sourceId)
  );
}

function normalizeCoverageFamily(
  value: string | null | undefined
): MarketFamily | null {
  if (value == null) {
    return "other";
  }

  return marketFamilies.includes(value as MarketFamily)
    ? (value as MarketFamily)
    : "other";
}

function buildCoverageSources(sourceMarkets: SourceMarket[]) {
  const availableSources = uniqueResearchSources(
    sourceMarkets.map((sourceMarket) => sourceMarket.source)
  );
  const unmappedSources = uniqueResearchSources(
    sourceMarkets
      .filter((sourceMarket) => sourceMarket.mappingStatus === "unmapped")
      .map((sourceMarket) => sourceMarket.source)
  );

  return {
    availableSources,
    missingSources: researchSourceIds.filter(
      (sourceId) => sourceId !== "nba" && !availableSources.includes(sourceId)
    ),
    unmappedSources,
  };
}

function rowToGame(row: Record<string, unknown>): CanonicalGame {
  return {
    awayParticipant: parseJson(String(row.awayParticipantJson), {
      key: "away",
      name: "Away",
      shortName: "Away",
    }),
    homeParticipant: parseJson(String(row.homeParticipantJson), {
      key: "home",
      name: "Home",
      shortName: "Home",
    }),
    id: String(row.id),
    league: String(row.league),
    scheduledStart: String(row.scheduledStart),
    sourceGameKeyNba:
      row.sourceGameKeyNba == null ? null : String(row.sourceGameKeyNba),
    sport: String(row.sport),
  };
}

function rowToGameState(
  row: Record<string, unknown> | undefined
): CanonicalGameState | null {
  if (!row) {
    return null;
  }

  return {
    awayScore: row.awayScore == null ? null : Number(row.awayScore),
    capturedAt: String(row.capturedAt),
    clock: row.clock == null ? null : String(row.clock),
    finalAt: row.finalAt == null ? null : String(row.finalAt),
    gameId: String(row.gameId),
    homeScore: row.homeScore == null ? null : Number(row.homeScore),
    id: Number(row.id),
    isFinal: toBoolean(row.isFinal as number | boolean | null | undefined),
    period: row.period == null ? null : Number(row.period),
    startedAt: row.startedAt == null ? null : String(row.startedAt),
    status: String(row.status) as ResearchGameStatus,
  };
}

function rowToOutcome(
  row: Record<string, unknown> | undefined
): GameOutcome | null {
  if (!row) {
    return null;
  }

  return {
    capturedAt: String(row.capturedAt),
    finalAwayScore: Number(row.finalAwayScore),
    finalHomeScore: Number(row.finalHomeScore),
    gameId: String(row.gameId),
    winnerKey: row.winnerKey == null ? null : String(row.winnerKey),
  };
}

function rowToInstrument(row: Record<string, unknown>): MarketInstrument {
  return {
    displayLabel: String(row.displayLabel),
    family: String(row.family) as MarketFamily,
    gameId: String(row.gameId),
    id: String(row.id),
    inPlay: toBoolean(row.inPlay as number | boolean | null | undefined),
    line: row.line == null ? null : Number(row.line),
    participantKey:
      row.participantKey == null ? null : String(row.participantKey),
    selection: String(row.selection),
  };
}

function rowToSourceMarket(row: Record<string, unknown>): SourceMarket {
  return {
    gameId: String(row.gameId),
    id: String(row.id),
    instrumentId: row.instrumentId == null ? null : String(row.instrumentId),
    mappingStatus: String(row.mappingStatus) as MappingStatus,
    rawFamily: row.rawFamily == null ? null : String(row.rawFamily),
    rawLabel: row.rawLabel == null ? null : String(row.rawLabel),
    rawMetadata: parseJson<Record<string, unknown> | null>(
      row.rawMetadataJson == null ? null : String(row.rawMetadataJson),
      null
    ),
    source: String(row.source) as ResearchSourceId,
    sourceMarketKey: String(row.sourceMarketKey),
    sourceSelectionKey:
      row.sourceSelectionKey == null ? null : String(row.sourceSelectionKey),
  };
}

function rowToQuoteTick(
  row: Record<string, unknown> | undefined
): QuoteTick | null {
  if (!row) {
    return null;
  }

  return {
    bestAsk: row.bestAsk == null ? null : Number(row.bestAsk),
    bestBid: row.bestBid == null ? null : Number(row.bestBid),
    capturedAt: String(row.capturedAt),
    depthScore: row.depthScore == null ? null : Number(row.depthScore),
    id: Number(row.id),
    impliedProbability:
      row.impliedProbability == null ? null : Number(row.impliedProbability),
    isHeartbeat: toBoolean(
      row.isHeartbeat as number | boolean | null | undefined
    ),
    lineRaw: row.lineRaw == null ? null : Number(row.lineRaw),
    oddsRaw: row.oddsRaw == null ? null : String(row.oddsRaw),
    priceRaw: row.priceRaw == null ? null : Number(row.priceRaw),
    sourceMarketId: String(row.sourceMarketId),
    volume: row.volume == null ? null : Number(row.volume),
  };
}

function rowToRawPayload(
  row: Record<string, unknown> | undefined
): RawPayloadAttachment | null {
  if (!row) {
    return null;
  }

  return {
    capturedAt: String(row.capturedAt),
    contentHash: String(row.contentHash),
    entityId: String(row.entityId),
    entityType: String(row.entityType),
    id: Number(row.id),
    payloadJson: parseJson<Record<string, unknown>>(
      String(row.payloadJson),
      {}
    ),
    source: String(row.source) as ResearchSourceId,
  };
}

function selectLatestGameState(db: Database.Database, gameId: string) {
  return rowToGameState(
    db
      .prepare(
        `
          SELECT
            id,
            game_id AS gameId,
            captured_at AS capturedAt,
            status,
            period,
            clock,
            home_score AS homeScore,
            away_score AS awayScore,
            is_final AS isFinal,
            started_at AS startedAt,
            final_at AS finalAt
          FROM game_states
          WHERE game_id = ?
          ORDER BY
            CASE
              WHEN datetime(captured_at) > datetime('now', '+10 minutes') THEN 1
              ELSE 0
            END,
            datetime(captured_at) DESC,
            id DESC
          LIMIT 1
        `
      )
      .get(gameId) as Record<string, unknown> | undefined
  );
}

function selectOutcome(db: Database.Database, gameId: string) {
  return rowToOutcome(
    db
      .prepare(
        `
          SELECT
            game_id AS gameId,
            final_home_score AS finalHomeScore,
            final_away_score AS finalAwayScore,
            winner_key AS winnerKey,
            captured_at AS capturedAt
          FROM game_outcomes
          WHERE game_id = ?
        `
      )
      .get(gameId) as Record<string, unknown> | undefined
  );
}

function selectInstrumentsForGame(db: Database.Database, gameId: string) {
  return db
    .prepare(
      `
        SELECT
          id,
          game_id AS gameId,
          family,
          selection,
          line,
          participant_key AS participantKey,
          in_play AS inPlay,
          display_label AS displayLabel
        FROM market_instruments
        WHERE game_id = ?
        ORDER BY
          CASE family
            WHEN 'moneyline' THEN 0
            WHEN 'spread' THEN 1
            WHEN 'total' THEN 2
            WHEN 'player-prop' THEN 3
            WHEN 'team-prop' THEN 4
            ELSE 5
          END,
          display_label ASC
      `
    )
    .all(gameId)
    .map((row) => rowToInstrument(row as Record<string, unknown>));
}

function selectSourceMarketsForGame(db: Database.Database, gameId: string) {
  return db
    .prepare(
      `
        SELECT
          id,
          source,
          source_market_key AS sourceMarketKey,
          source_selection_key AS sourceSelectionKey,
          game_id AS gameId,
          instrument_id AS instrumentId,
          raw_family AS rawFamily,
          raw_label AS rawLabel,
          mapping_status AS mappingStatus,
          raw_metadata_json AS rawMetadataJson
        FROM source_markets
        WHERE game_id = ?
        ORDER BY source ASC, raw_label ASC, source_market_key ASC
      `
    )
    .all(gameId)
    .map((row) => rowToSourceMarket(row as Record<string, unknown>));
}

function chunkValues<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function selectLatestTicksBySourceMarketIds(
  db: Database.Database,
  sourceMarketIds: string[]
) {
  const latest = new Map<string, QuoteTick>();
  if (sourceMarketIds.length === 0) {
    return latest;
  }

  for (const chunk of chunkValues(sourceMarketIds, 500)) {
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `
        SELECT
          q.id,
          q.source_market_id AS sourceMarketId,
          q.captured_at AS capturedAt,
          q.price_raw AS priceRaw,
          q.odds_raw AS oddsRaw,
          q.line_raw AS lineRaw,
          q.implied_probability AS impliedProbability,
          q.best_bid AS bestBid,
          q.best_ask AS bestAsk,
          q.volume,
          q.depth_score AS depthScore,
          q.is_heartbeat AS isHeartbeat
        FROM source_markets sm
        JOIN quote_ticks q ON q.id = (
          SELECT q2.id
          FROM quote_ticks q2
          WHERE q2.source_market_id = sm.id
          ORDER BY q2.captured_at DESC, q2.id DESC
          LIMIT 1
        )
        WHERE sm.id IN (${placeholders})
      `
      )
      .all(...chunk) as Record<string, unknown>[];

    for (const row of rows) {
      const tick = rowToQuoteTick(row);
      if (tick) {
        latest.set(tick.sourceMarketId, tick);
      }
    }
  }

  return latest;
}

function selectLatestRawPayloadsBySourceMarketIds(
  db: Database.Database,
  sourceMarketIds: string[],
  options: { includePayloadJson?: boolean } = { includePayloadJson: true }
) {
  const latest = new Map<string, RawPayloadAttachment>();
  if (sourceMarketIds.length === 0) {
    return latest;
  }

  for (const chunk of chunkValues(sourceMarketIds, 500)) {
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `
        SELECT
          rp.id,
          rp.source,
          rp.captured_at AS capturedAt,
          rp.entity_type AS entityType,
          rp.entity_id AS entityId,
          ${options.includePayloadJson ? "rp.payload_json" : "'{}'"} AS payloadJson,
          rp.content_hash AS contentHash
        FROM source_markets sm
        JOIN raw_payloads rp ON rp.id = (
          SELECT rp2.id
          FROM raw_payloads rp2
          WHERE rp2.entity_type = 'source_market'
            AND rp2.entity_id = sm.id
          ORDER BY rp2.captured_at DESC, rp2.id DESC
          LIMIT 1
        )
        WHERE sm.id IN (${placeholders})
      `
      )
      .all(...chunk) as Record<string, unknown>[];

    for (const row of rows) {
      const payload = rowToRawPayload(row);
      if (payload) {
        latest.set(payload.entityId, payload);
      }
    }
  }

  return latest;
}

function buildLatestSourceViews(
  sourceMarkets: SourceMarket[],
  latestTicks: Map<string, QuoteTick>,
  latestPayloads: Map<string, RawPayloadAttachment>
) {
  const latestBySource = new Map<ResearchSourceId, LatestSourceView>();

  for (const sourceMarket of sourceMarkets) {
    const latestTick = latestTicks.get(sourceMarket.id) ?? null;
    const latestPayload = latestPayloads.get(sourceMarket.id) ?? null;
    const freshnessMs = latestTick
      ? Math.max(0, Date.now() - new Date(latestTick.capturedAt).getTime())
      : null;

    const candidate = {
      capturedAt: latestTick?.capturedAt ?? null,
      freshnessMs,
      impliedProbability: latestTick?.impliedProbability ?? null,
      lastPayloadId: latestPayload?.id ?? null,
      mappingStatus: sourceMarket.mappingStatus,
      raw: {
        bestAsk: latestTick?.bestAsk ?? null,
        bestBid: latestTick?.bestBid ?? null,
        depthScore: latestTick?.depthScore ?? null,
        label: sourceMarket.rawLabel ?? null,
        line: latestTick?.lineRaw ?? null,
        odds: latestTick?.oddsRaw ?? null,
        price: latestTick?.priceRaw ?? null,
        volume: latestTick?.volume ?? null,
      },
      source: sourceMarket.source,
      sourceMarketId: sourceMarket.id,
    } satisfies LatestSourceView;

    const current = latestBySource.get(candidate.source);
    if (!current) {
      latestBySource.set(candidate.source, candidate);
      continue;
    }

    const candidateTimestamp = timestampValue(candidate.capturedAt);
    const currentTimestamp = timestampValue(current.capturedAt);
    if (candidateTimestamp > currentTimestamp) {
      latestBySource.set(candidate.source, candidate);
      continue;
    }

    if (
      candidateTimestamp === currentTimestamp &&
      (candidate.lastPayloadId ?? -1) > (current.lastPayloadId ?? -1)
    ) {
      latestBySource.set(candidate.source, candidate);
    }
  }

  return researchSourceIds
    .map((source) => latestBySource.get(source) ?? null)
    .filter((view): view is LatestSourceView => Boolean(view));
}

function buildMarketInstrumentView(
  instrument: MarketInstrument,
  sourceMarkets: SourceMarket[],
  latestTicks: Map<string, QuoteTick>,
  latestPayloads: Map<string, RawPayloadAttachment>
) {
  const latestSources = buildLatestSourceViews(
    sourceMarkets,
    latestTicks,
    latestPayloads
  );
  const mappingStatus = computeMappingStatus(sourceMarkets);
  const comparableState = computeComparableState(
    instrument,
    mappingStatus,
    latestSources
  );
  const impliedProbabilityGap =
    comparableState === "comparable"
      ? computeImpliedProbabilityGap(latestSources)
      : computeImpliedProbabilityGap(
          latestSources.filter((source) =>
            lineValuesMatch(source.raw.line, instrument.line)
          )
        );

  return {
    comparableState,
    impliedProbabilityGap,
    instrument,
    lineMismatch: comparableState === "line-mismatch",
    mappingStatus,
    signalPriority: computeSignalPriority(
      impliedProbabilityGap,
      latestSources,
      comparableState,
      instrument.inPlay
    ),
    sources: latestSources,
  } satisfies MarketInstrumentView;
}

function buildDivergenceRow(
  game: CanonicalGame,
  instrumentView: MarketInstrumentView
) {
  const freshnessMs = freshnessMsFromSourceViews(instrumentView.sources);
  const severity = gapToSeverity(
    instrumentView.impliedProbabilityGap ?? 0,
    instrumentView.lineMismatch
  );

  return {
    captureRecencyMs: freshnessMs,
    comparableState: instrumentView.comparableState,
    displayLabel: instrumentView.instrument.displayLabel,
    family: instrumentView.instrument.family,
    gameId: game.id,
    impliedProbabilityGap: instrumentView.impliedProbabilityGap,
    inPlay: instrumentView.instrument.inPlay,
    instrumentId: instrumentView.instrument.id,
    league: game.league,
    lineMismatch: instrumentView.lineMismatch,
    mappingStatus: instrumentView.mappingStatus,
    severity,
    signalPriority: instrumentView.signalPriority,
    sources: quotedResearchSources(instrumentView.sources),
    sport: game.sport,
  } satisfies DivergenceRow;
}

function formatGameLabel(game: CanonicalGame) {
  return `${game.awayParticipant.shortName} at ${game.homeParticipant.shortName}`;
}

function deriveResearchGameStatus(
  bundle: NonNullable<ReturnType<typeof selectGameBundle>>
) {
  if (bundle.outcome) {
    return "final" as const;
  }

  return bundle.gameState?.status ?? ("scheduled" as const);
}

function selectGameBundle(db: Database.Database, gameId: string) {
  const gameRow = db
    .prepare(
      `
        SELECT
          id,
          sport,
          league,
          source_game_key_nba AS sourceGameKeyNba,
          home_participant_json AS homeParticipantJson,
          away_participant_json AS awayParticipantJson,
          scheduled_start AS scheduledStart
        FROM games
        WHERE id = ?
      `
    )
    .get(gameId) as Record<string, unknown> | undefined;

  if (!gameRow) {
    return null;
  }

  const game = rowToGame(gameRow);
  const gameState = selectLatestGameState(db, gameId);
  const outcome = selectOutcome(db, gameId);
  const instruments = selectInstrumentsForGame(db, gameId);
  const sourceMarkets = selectSourceMarketsForGame(db, gameId);
  const latestTicks = selectLatestTicksBySourceMarketIds(
    db,
    sourceMarkets.map((sourceMarket) => sourceMarket.id)
  );
  const latestPayloads = selectLatestRawPayloadsBySourceMarketIds(
    db,
    sourceMarkets.map((sourceMarket) => sourceMarket.id)
  );

  return {
    game,
    gameState,
    instruments,
    latestPayloads,
    latestTicks,
    outcome,
    sourceMarkets,
  };
}

function buildGameCard(
  bundle: NonNullable<ReturnType<typeof selectGameBundle>>
) {
  const instrumentViews = bundle.instruments.map((instrument) =>
    buildMarketInstrumentView(
      instrument,
      bundle.sourceMarkets.filter(
        (sourceMarket) => sourceMarket.instrumentId === instrument.id
      ),
      bundle.latestTicks,
      bundle.latestPayloads
    )
  );

  const topDivergences = instrumentViews
    .filter(isVisibleDivergenceInstrument)
    .map((instrumentView) => {
      const divergence = buildDivergenceRow(bundle.game, instrumentView);
      return {
        displayLabel: divergence.displayLabel,
        family: divergence.family,
        impliedProbabilityGap: divergence.impliedProbabilityGap ?? 0,
        instrumentId: divergence.instrumentId,
        lineMismatch: divergence.lineMismatch,
        severity: divergence.severity,
      } satisfies DivergenceSummary;
    })
    .sort(
      (left, right) => right.impliedProbabilityGap - left.impliedProbabilityGap
    )
    .slice(0, 3);

  return {
    activeInstrumentCount: instrumentViews.length,
    coverage: computeCoverageSummary(
      bundle.sourceMarkets,
      bundle.latestTicks,
      Boolean(bundle.gameState || bundle.outcome)
    ),
    game: bundle.game,
    gameState: bundle.gameState,
    hasUnmappedMarkets: bundle.sourceMarkets.some(
      (sourceMarket) => sourceMarket.mappingStatus === "unmapped"
    ),
    outcome: bundle.outcome,
    topDivergences,
  } satisfies ResearchGameCard;
}

type ResearchDivergenceEntry = {
  bundle: NonNullable<ReturnType<typeof selectGameBundle>>;
  instrumentView: MarketInstrumentView;
  row: DivergenceRow;
};

function selectFilteredGameBundles(
  db: Database.Database,
  filters: Pick<GamesFilters, "date" | "league" | "limit" | "sport"> & {
    family?: MarketFamily;
    order?: "currentSlate" | "scheduledAsc";
  }
) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.sport) {
    clauses.push("sport = ?");
    params.push(filters.sport);
  }
  if (filters.league) {
    clauses.push("league = ?");
    params.push(filters.league);
  }
  if (filters.date) {
    clauses.push("substr(scheduled_start, 1, 10) = ?");
    params.push(filters.date);
  }
  if (filters.family) {
    clauses.push(
      "EXISTS (SELECT 1 FROM market_instruments mi WHERE mi.game_id = games.id AND mi.family = ?)"
    );
    params.push(filters.family);
  }

  const orderBy =
    filters.order === "currentSlate"
      ? `
        ORDER BY
          CASE
            WHEN (
              SELECT gs.status
              FROM game_states gs
              WHERE gs.game_id = games.id
              ORDER BY
                CASE
                  WHEN datetime(gs.captured_at) > datetime('now', '+10 minutes') THEN 1
                  ELSE 0
                END,
                datetime(gs.captured_at) DESC,
                gs.id DESC
              LIMIT 1
            ) = 'in-play'
              THEN 0
            WHEN datetime(scheduled_start) >= datetime('now', '-8 hours')
              AND datetime(scheduled_start) <= datetime('now', '+48 hours')
              THEN 1
            WHEN datetime(scheduled_start) >= datetime('now', '-8 hours')
              THEN 2
            ELSE 3
          END,
          ABS(strftime('%s', scheduled_start) - strftime('%s', 'now')) ASC,
          scheduled_start ASC,
          id ASC
      `
      : "ORDER BY scheduled_start ASC, id ASC";

  const gameRows = db
    .prepare(
      `
        SELECT
          id,
          sport,
          league,
          source_game_key_nba AS sourceGameKeyNba,
          home_participant_json AS homeParticipantJson,
          away_participant_json AS awayParticipantJson,
          scheduled_start AS scheduledStart
        FROM games
        ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
        ${orderBy}
        ${
          filters.limit != null && Number.isFinite(filters.limit)
            ? `LIMIT ${Math.min(500, Math.max(1, Math.floor(filters.limit)))}`
            : ""
        }
      `
    )
    .all(...params) as Record<string, unknown>[];

  if (gameRows.length === 0) return [];

  const gameIds = gameRows.map((row) => String(row.id));
  const gamePlaceholders = gameIds.map(() => "?").join(", ");

  const gameStateRows = db
    .prepare(
      `
        WITH ranked AS (
          SELECT
            id,
            game_id AS gameId,
            captured_at AS capturedAt,
            status,
            period,
            clock,
            home_score AS homeScore,
            away_score AS awayScore,
            is_final AS isFinal,
            started_at AS startedAt,
            final_at AS finalAt,
            ROW_NUMBER() OVER (
              PARTITION BY game_id
              ORDER BY
                CASE
                  WHEN datetime(captured_at) > datetime('now', '+10 minutes') THEN 1
                  ELSE 0
                END,
                datetime(captured_at) DESC,
                id DESC
            ) AS rn
          FROM game_states
          WHERE game_id IN (${gamePlaceholders})
        )
        SELECT * FROM ranked WHERE rn = 1
      `
    )
    .all(...gameIds) as Record<string, unknown>[];
  const latestStateByGame = new Map<string, CanonicalGameState>();
  for (const row of gameStateRows) {
    const state = rowToGameState(row);
    if (state) latestStateByGame.set(state.gameId, state);
  }

  const outcomeRows = db
    .prepare(
      `
        SELECT
          game_id AS gameId,
          final_home_score AS finalHomeScore,
          final_away_score AS finalAwayScore,
          winner_key AS winnerKey,
          captured_at AS capturedAt
        FROM game_outcomes
        WHERE game_id IN (${gamePlaceholders})
      `
    )
    .all(...gameIds) as Record<string, unknown>[];
  const outcomeByGame = new Map<string, GameOutcome>();
  for (const row of outcomeRows) {
    const outcome = rowToOutcome(row);
    if (outcome) outcomeByGame.set(outcome.gameId, outcome);
  }

  const instrumentClauses = [`game_id IN (${gamePlaceholders})`];
  const instrumentParams: unknown[] = [...gameIds];
  if (filters.family) {
    instrumentClauses.push("family = ?");
    instrumentParams.push(filters.family);
  }

  const instrumentRows = db
    .prepare(
      `
        SELECT
          id,
          game_id AS gameId,
          family,
          selection,
          line,
          participant_key AS participantKey,
          in_play AS inPlay,
          display_label AS displayLabel
        FROM market_instruments
        WHERE ${instrumentClauses.join(" AND ")}
        ORDER BY display_label ASC
      `
    )
    .all(...instrumentParams) as Record<string, unknown>[];
  const instrumentsByGame = new Map<string, MarketInstrument[]>();
  for (const row of instrumentRows) {
    const instrument = rowToInstrument(row);
    const list = instrumentsByGame.get(instrument.gameId) ?? [];
    list.push(instrument);
    instrumentsByGame.set(instrument.gameId, list);
  }

  const sourceMarketFamilyJoin = filters.family
    ? "JOIN market_instruments mi ON mi.id = sm.instrument_id"
    : "";
  const sourceMarketClauses = [`sm.game_id IN (${gamePlaceholders})`];
  const sourceMarketParams: unknown[] = [...gameIds];
  if (filters.family) {
    sourceMarketClauses.push("mi.family = ?");
    sourceMarketParams.push(filters.family);
  }

  const sourceMarketRows = db
    .prepare(
      `
        SELECT
          sm.id,
          sm.source,
          sm.source_market_key AS sourceMarketKey,
          sm.source_selection_key AS sourceSelectionKey,
          sm.game_id AS gameId,
          sm.instrument_id AS instrumentId,
          sm.raw_family AS rawFamily,
          sm.raw_label AS rawLabel,
          sm.mapping_status AS mappingStatus,
          sm.raw_metadata_json AS rawMetadataJson
        FROM source_markets sm
        ${sourceMarketFamilyJoin}
        WHERE ${sourceMarketClauses.join(" AND ")}
      `
    )
    .all(...sourceMarketParams) as Record<string, unknown>[];
  const sourceMarketsByGame = new Map<string, SourceMarket[]>();
  const allSourceMarketIds: string[] = [];
  for (const row of sourceMarketRows) {
    const sourceMarket = rowToSourceMarket(row);
    allSourceMarketIds.push(sourceMarket.id);
    const list = sourceMarketsByGame.get(sourceMarket.gameId) ?? [];
    list.push(sourceMarket);
    sourceMarketsByGame.set(sourceMarket.gameId, list);
  }

  const latestTicks = selectLatestTicksBySourceMarketIds(
    db,
    allSourceMarketIds
  );
  const latestPayloads = selectLatestRawPayloadsBySourceMarketIds(
    db,
    allSourceMarketIds,
    { includePayloadJson: false }
  );

  return gameRows
    .map((gameRow) => {
      const game = rowToGame(gameRow);
      const gameId = game.id;
      return {
        game,
        gameState: latestStateByGame.get(gameId) ?? null,
        instruments: instrumentsByGame.get(gameId) ?? [],
        latestPayloads,
        latestTicks,
        outcome: outcomeByGame.get(gameId) ?? null,
        sourceMarkets: sourceMarketsByGame.get(gameId) ?? [],
      };
    })
    .filter((bundle) => bundle !== null);
}

function compareDivergenceRows(
  left: DivergenceRow,
  right: DivergenceRow,
  sort: DivergenceFilters["sort"]
) {
  switch (sort) {
    case "captureRecency":
      return (
        (left.captureRecencyMs ?? Number.MAX_SAFE_INTEGER) -
        (right.captureRecencyMs ?? Number.MAX_SAFE_INTEGER)
      );
    case "freshness":
      return freshnessBandFromMs(left.captureRecencyMs ?? null).localeCompare(
        freshnessBandFromMs(right.captureRecencyMs ?? null)
      );
    case "lineMismatch":
      return Number(right.lineMismatch) - Number(left.lineMismatch);
    case "signalPriority":
      return right.signalPriority - left.signalPriority;
    case "divergence":
    default:
      return (
        (right.impliedProbabilityGap ?? 0) - (left.impliedProbabilityGap ?? 0)
      );
  }
}

function buildResearchDivergenceEntries(filters: DivergenceFilters = {}) {
  const db = getDatabase();
  let entries = selectFilteredGameBundles(db, {
    date: filters.date,
    family: filters.family,
    league: filters.league,
    sport: filters.sport,
  }).flatMap((bundle) =>
    bundle.instruments
      .filter((instrument) => {
        if (filters.family && instrument.family !== filters.family) {
          return false;
        }
        if (
          typeof filters.inPlay === "boolean" &&
          instrument.inPlay !== filters.inPlay
        ) {
          return false;
        }
        return true;
      })
      .flatMap((instrument) => {
        const instrumentView = buildMarketInstrumentView(
          instrument,
          bundle.sourceMarkets.filter(
            (sourceMarket) => sourceMarket.instrumentId === instrument.id
          ),
          bundle.latestTicks,
          bundle.latestPayloads
        );

        if (!isVisibleDivergenceInstrument(instrumentView)) {
          return [];
        }

        return [
          {
            bundle,
            instrumentView,
            row: buildDivergenceRow(bundle.game, instrumentView),
          } satisfies ResearchDivergenceEntry,
        ];
      })
  );

  if (filters.mappedState) {
    entries = entries.filter(
      (entry) => entry.row.comparableState === filters.mappedState
    );
  }
  if (filters.severity) {
    entries = entries.filter(
      (entry) => entry.row.severity === filters.severity
    );
  }
  if (filters.freshness) {
    entries = entries.filter(
      (entry) =>
        freshnessBandFromMs(entry.row.captureRecencyMs ?? null) ===
        filters.freshness
    );
  }
  if (filters.sourceSet) {
    const requestedSources = new Set(
      filters.sourceSet
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );

    entries = entries.filter((entry) =>
      entry.instrumentView.sources.every((source) =>
        requestedSources.has(source.source)
      )
    );
  }

  const sortedEntries = [...entries].sort((left, right) =>
    compareDivergenceRows(left.row, right.row, filters.sort)
  );
  if (filters.limit == null) {
    return sortedEntries;
  }

  const clampedLimit = Math.min(500, Math.max(1, Math.floor(filters.limit)));
  return sortedEntries.slice(0, clampedLimit);
}

function buildSignalMismatchRow(entry: ResearchDivergenceEntry) {
  const bySource = new Map(
    entry.instrumentView.sources.map((quote) => [quote.source, quote])
  );
  const bet365 = bySource.get("bet365")?.impliedProbability ?? null;
  const kalshi = bySource.get("kalshi")?.impliedProbability ?? null;
  const polymarket = bySource.get("polymarket")?.impliedProbability ?? null;
  const externalValues = [kalshi, polymarket].filter(
    (value): value is number => typeof value === "number"
  );
  const externalAverage =
    externalValues.length > 0
      ? externalValues.reduce((sum, value) => sum + value, 0) /
        externalValues.length
      : null;

  return {
    ...entry.row,
    bet365ImpliedProbability: bet365 ?? null,
    directionalDisagreement:
      typeof bet365 === "number" &&
      typeof externalAverage === "number" &&
      ((bet365 >= 0.5 && externalAverage < 0.5) ||
        (bet365 < 0.5 && externalAverage >= 0.5)),
    finalAwayScore: entry.bundle.outcome?.finalAwayScore ?? null,
    finalHomeScore: entry.bundle.outcome?.finalHomeScore ?? null,
    gameLabel: formatGameLabel(entry.bundle.game),
    gameStatus: deriveResearchGameStatus(entry.bundle),
    kalshiImpliedProbability: kalshi ?? null,
    polymarketImpliedProbability: polymarket ?? null,
    scheduledStart: entry.bundle.game.scheduledStart,
  } satisfies SignalMismatchRow;
}

function clampAlertLimit(value: number | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 25;
  }

  return Math.min(100, Math.max(1, Math.floor(value)));
}

function normalizeAlertNumber(
  value: number | undefined,
  fallback: number,
  min: number
) {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, value);
}

function playerPropAlertSourceFromRow(
  row: Record<string, unknown>,
  prefix: "bet365" | "external"
): PlayerPropAlertSource {
  return {
    bestAsk: nullableNumber(row[`${prefix}BestAsk`]),
    bestBid: nullableNumber(row[`${prefix}BestBid`]),
    capturedAt: String(row[`${prefix}CapturedAt`]),
    impliedProbability: Number(row[`${prefix}ImpliedProbability`]),
    lineRaw: nullableNumber(row[`${prefix}LineRaw`]),
    mappingStatus: String(row[`${prefix}MappingStatus`]) as MappingStatus,
    oddsRaw:
      row[`${prefix}OddsRaw`] == null ? null : String(row[`${prefix}OddsRaw`]),
    priceRaw: nullableNumber(row[`${prefix}PriceRaw`]),
    rawLabel:
      row[`${prefix}RawLabel`] == null
        ? null
        : String(row[`${prefix}RawLabel`]),
    source: String(row[`${prefix}Source`]) as PlayerPropAlertSource["source"],
    sourceMarketId: String(row[`${prefix}SourceMarketId`]),
    sourceMarketKey: String(row[`${prefix}SourceMarketKey`]),
    sourceSelectionKey:
      row[`${prefix}SourceSelectionKey`] == null
        ? null
        : String(row[`${prefix}SourceSelectionKey`]),
    volume: nullableNumber(row[`${prefix}Volume`]),
  };
}

function buildPlayerPropAlert(
  row: Record<string, unknown>,
  options: Required<
    Pick<
      PlayerPropAlertFilters,
      | "includeStale"
      | "limit"
      | "maxPairGapMinutes"
      | "maxQuoteAgeMinutes"
      | "minDelta"
    >
  > & { nowIso: string }
): PlayerPropDisagreementAlert | null {
  const bet365 = playerPropAlertSourceFromRow(row, "bet365");
  const predictionMarket = playerPropAlertSourceFromRow(row, "external");
  const bet365Timestamp = timestampValue(bet365.capturedAt);
  const predictionTimestamp = timestampValue(predictionMarket.capturedAt);
  const nowTimestamp = timestampValue(options.nowIso);

  if (
    bet365Timestamp < 0 ||
    predictionTimestamp < 0 ||
    nowTimestamp < 0 ||
    !Number.isFinite(bet365.impliedProbability) ||
    !Number.isFinite(predictionMarket.impliedProbability)
  ) {
    return null;
  }

  const absoluteDelta = Math.abs(
    predictionMarket.impliedProbability - bet365.impliedProbability
  );
  if (absoluteDelta < options.minDelta) {
    return null;
  }

  const pairGapMs = Math.abs(predictionTimestamp - bet365Timestamp);
  if (pairGapMs > options.maxPairGapMinutes * 60_000) {
    return null;
  }

  const bet365AgeMs = Math.max(0, nowTimestamp - bet365Timestamp);
  const predictionMarketAgeMs = Math.max(0, nowTimestamp - predictionTimestamp);
  if (
    !options.includeStale &&
    (bet365AgeMs > options.maxQuoteAgeMinutes * 60_000 ||
      predictionMarketAgeMs > options.maxQuoteAgeMinutes * 60_000)
  ) {
    return null;
  }

  const line = nullableNumber(row.line);
  const lineMismatch =
    !lineValuesMatch(bet365.lineRaw, line) ||
    !lineValuesMatch(predictionMarket.lineRaw, line) ||
    !lineValuesMatch(bet365.lineRaw, predictionMarket.lineRaw);
  const detectedAt = new Date(
    Math.max(bet365Timestamp, predictionTimestamp)
  ).toISOString();
  const signedDelta =
    predictionMarket.impliedProbability - bet365.impliedProbability;
  const direction =
    signedDelta > 0 ? "prediction-market-higher" : "bet365-higher";
  const severity = gapToSeverity(absoluteDelta, lineMismatch);
  const inPlay = toBoolean(row.inPlay as number | boolean | null | undefined);
  const riskScore = Math.max(
    0,
    Math.round(
      absoluteDelta * 1000 +
        (lineMismatch ? 120 : 0) +
        (inPlay ? 40 : 0) -
        pairGapMs / 60_000 -
        Math.min(bet365AgeMs, predictionMarketAgeMs) / 600_000
    )
  );
  const gameId = String(row.gameId);
  const instrumentId = String(row.instrumentId);

  return {
    absoluteDelta,
    action: "manual-review",
    bet365,
    detectedAt,
    direction,
    displayLabel: String(row.displayLabel),
    freshness: {
      bet365AgeMs,
      pairGapMs,
      predictionMarketAgeMs,
    },
    gameId,
    gameLabel: String(row.gameLabel),
    id: [
      gameId,
      instrumentId,
      predictionMarket.source,
      direction,
      bet365.sourceMarketId,
      predictionMarket.sourceMarketId,
    ].join(":"),
    inPlay,
    instrumentId,
    league: String(row.league),
    line,
    lineMismatch,
    participantKey:
      row.participantKey == null ? null : String(row.participantKey),
    predictionMarket,
    riskScore,
    scheduledStart: String(row.scheduledStart),
    selection: String(row.selection),
    severity,
    signedDelta,
    sport: String(row.sport),
  } satisfies PlayerPropDisagreementAlert;
}

export function listPlayerPropDisagreementAlerts(
  filters: PlayerPropAlertFilters = {}
) {
  return executeDatabaseOperation(
    "research.playerPropDisagreementAlerts.list",
    () => {
      const db = getDatabase();
      const nowIso =
        filters.now instanceof Date
          ? filters.now.toISOString()
          : (filters.now ?? currentTimestamp());
      const options = {
        includeStale: filters.includeStale ?? false,
        limit: clampAlertLimit(filters.limit),
        maxPairGapMinutes: normalizeAlertNumber(
          filters.maxPairGapMinutes,
          10,
          0
        ),
        maxQuoteAgeMinutes: normalizeAlertNumber(
          filters.maxQuoteAgeMinutes,
          10,
          0
        ),
        minDelta: normalizeAlertNumber(filters.minDelta, 0.15, 0),
        nowIso,
      };

      const rows = db
        .prepare(
          `
            WITH player_props AS (
              SELECT
                mi.id AS instrumentId,
                mi.game_id AS gameId,
                mi.display_label AS displayLabel,
                mi.selection,
                mi.line,
                mi.participant_key AS participantKey,
                mi.in_play AS inPlay,
                g.sport,
                g.league,
                g.scheduled_start AS scheduledStart,
                json_extract(g.away_participant_json, '$.shortName') || ' at ' ||
                  json_extract(g.home_participant_json, '$.shortName') AS gameLabel
              FROM market_instruments mi
              JOIN games g ON g.id = mi.game_id
              WHERE mi.family = 'player-prop'
            ),
            latest_source_ticks AS (
              SELECT
                p.*,
                sm.source,
                sm.id AS sourceMarketId,
                sm.source_market_key AS sourceMarketKey,
                sm.source_selection_key AS sourceSelectionKey,
                sm.raw_label AS rawLabel,
                sm.mapping_status AS mappingStatus,
                q.id AS tickId,
                q.captured_at AS capturedAt,
                q.implied_probability AS impliedProbability,
                q.line_raw AS lineRaw,
                q.odds_raw AS oddsRaw,
                q.price_raw AS priceRaw,
                q.best_bid AS bestBid,
                q.best_ask AS bestAsk,
                q.volume AS volume,
                ROW_NUMBER() OVER (
                  PARTITION BY sm.instrument_id, sm.source
                  ORDER BY q.captured_at DESC, q.id DESC
                ) AS sourceRank
              FROM player_props p
              JOIN source_markets sm ON sm.instrument_id = p.instrumentId
              JOIN quote_ticks q ON q.id = (
                SELECT q2.id
                FROM quote_ticks q2
                WHERE q2.source_market_id = sm.id
                  AND q2.implied_probability IS NOT NULL
                ORDER BY q2.captured_at DESC, q2.id DESC
                LIMIT 1
              )
              WHERE sm.source IN ('bet365', 'kalshi', 'polymarket')
                AND sm.mapping_status != 'unmapped'
            ),
            bet365_latest AS (
              SELECT * FROM latest_source_ticks
              WHERE source = 'bet365' AND sourceRank = 1
            ),
            external_latest AS (
              SELECT * FROM latest_source_ticks
              WHERE source IN ('kalshi', 'polymarket') AND sourceRank = 1
            )
            SELECT
              b.gameId,
              b.instrumentId,
              b.gameLabel,
              b.sport,
              b.league,
              b.scheduledStart,
              b.displayLabel,
              b.selection,
              b.line,
              b.participantKey,
              b.inPlay,
              b.source AS bet365Source,
              b.sourceMarketId AS bet365SourceMarketId,
              b.sourceMarketKey AS bet365SourceMarketKey,
              b.sourceSelectionKey AS bet365SourceSelectionKey,
              b.rawLabel AS bet365RawLabel,
              b.mappingStatus AS bet365MappingStatus,
              b.capturedAt AS bet365CapturedAt,
              b.impliedProbability AS bet365ImpliedProbability,
              b.lineRaw AS bet365LineRaw,
              b.oddsRaw AS bet365OddsRaw,
              b.priceRaw AS bet365PriceRaw,
              b.bestBid AS bet365BestBid,
              b.bestAsk AS bet365BestAsk,
              b.volume AS bet365Volume,
              e.source AS externalSource,
              e.sourceMarketId AS externalSourceMarketId,
              e.sourceMarketKey AS externalSourceMarketKey,
              e.sourceSelectionKey AS externalSourceSelectionKey,
              e.rawLabel AS externalRawLabel,
              e.mappingStatus AS externalMappingStatus,
              e.capturedAt AS externalCapturedAt,
              e.impliedProbability AS externalImpliedProbability,
              e.lineRaw AS externalLineRaw,
              e.oddsRaw AS externalOddsRaw,
              e.priceRaw AS externalPriceRaw,
              e.bestBid AS externalBestBid,
              e.bestAsk AS externalBestAsk,
              e.volume AS externalVolume
            FROM bet365_latest b
            JOIN external_latest e ON e.instrumentId = b.instrumentId
          `
        )
        .all() as Record<string, unknown>[];

      return rows
        .map((row) => buildPlayerPropAlert(row, options))
        .filter((row): row is PlayerPropDisagreementAlert => row != null)
        .sort((left, right) => {
          if (right.riskScore !== left.riskScore) {
            return right.riskScore - left.riskScore;
          }
          return right.absoluteDelta - left.absoluteDelta;
        })
        .slice(0, options.limit);
    },
    filters
  );
}

export function upsertGame(game: CanonicalGame) {
  executeDatabaseOperation(
    "games.upsert",
    () => {
      const db = getDatabase();
      db.prepare(
        `
          INSERT INTO games (
            id,
            sport,
            league,
            source_game_key_nba,
            home_participant_json,
            away_participant_json,
            scheduled_start
          )
          VALUES (
            @id,
            @sport,
            @league,
            @sourceGameKeyNba,
            @homeParticipantJson,
            @awayParticipantJson,
            @scheduledStart
          )
          ON CONFLICT(id) DO UPDATE SET
            sport = excluded.sport,
            league = excluded.league,
            source_game_key_nba = excluded.source_game_key_nba,
            home_participant_json = excluded.home_participant_json,
            away_participant_json = excluded.away_participant_json,
            scheduled_start = excluded.scheduled_start
        `
      ).run({
        awayParticipantJson: stringifyJson(game.awayParticipant),
        homeParticipantJson: stringifyJson(game.homeParticipant),
        id: game.id,
        league: game.league,
        scheduledStart: game.scheduledStart,
        sourceGameKeyNba: game.sourceGameKeyNba ?? null,
        sport: game.sport,
      });
    },
    {
      gameId: game.id,
    }
  );
}

export function recordGameStateObservation(
  input: Omit<CanonicalGameState, "id">
) {
  return executeDatabaseOperation(
    "gameStates.observe",
    () => {
      const db = getDatabase();
      const latest = selectLatestGameState(db, input.gameId);
      const unchanged =
        latest &&
        latest.status === input.status &&
        latest.period === (input.period ?? null) &&
        latest.clock === (input.clock ?? null) &&
        latest.homeScore === (input.homeScore ?? null) &&
        latest.awayScore === (input.awayScore ?? null) &&
        latest.isFinal === input.isFinal &&
        latest.startedAt === (input.startedAt ?? null) &&
        latest.finalAt === (input.finalAt ?? null);

      if (unchanged) {
        return {
          gameState: latest,
          reason: "deduped" as const,
          wrote: false,
        };
      }

      const result = db
        .prepare(
          `
            INSERT INTO game_states (
              game_id,
              captured_at,
              status,
              period,
              clock,
              home_score,
              away_score,
              is_final,
              started_at,
              final_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          input.gameId,
          input.capturedAt,
          input.status,
          input.period ?? null,
          input.clock ?? null,
          input.homeScore ?? null,
          input.awayScore ?? null,
          input.isFinal ? 1 : 0,
          input.startedAt ?? null,
          input.finalAt ?? null
        );

      return {
        gameState: {
          ...input,
          id: Number(result.lastInsertRowid),
        },
        reason: "changed" as const,
        wrote: true,
      };
    },
    {
      gameId: input.gameId,
      status: input.status,
    }
  );
}

export function upsertMarketInstrument(instrument: MarketInstrument) {
  executeDatabaseOperation(
    "marketInstruments.upsert",
    () => {
      const db = getDatabase();
      db.prepare(
        `
          INSERT INTO market_instruments (
            id,
            game_id,
            family,
            selection,
            line,
            participant_key,
            in_play,
            display_label
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            game_id = excluded.game_id,
            family = excluded.family,
            selection = excluded.selection,
            line = excluded.line,
            participant_key = excluded.participant_key,
            in_play = excluded.in_play,
            display_label = excluded.display_label
        `
      ).run(
        instrument.id,
        instrument.gameId,
        instrument.family,
        instrument.selection,
        instrument.line ?? null,
        instrument.participantKey ?? null,
        instrument.inPlay ? 1 : 0,
        instrument.displayLabel
      );
    },
    {
      gameId: instrument.gameId,
      instrumentId: instrument.id,
    }
  );
}

export function upsertSourceMarket(sourceMarket: SourceMarket) {
  executeDatabaseOperation(
    "sourceMarkets.upsert",
    () => {
      const db = getDatabase();
      db.prepare(
        `
          INSERT INTO source_markets (
            id,
            source,
            source_market_key,
            source_selection_key,
            game_id,
            instrument_id,
            raw_family,
            raw_label,
            mapping_status,
            raw_metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            source = excluded.source,
            source_market_key = excluded.source_market_key,
            source_selection_key = excluded.source_selection_key,
            game_id = excluded.game_id,
            instrument_id = excluded.instrument_id,
            raw_family = excluded.raw_family,
            raw_label = excluded.raw_label,
            mapping_status = excluded.mapping_status,
            raw_metadata_json = excluded.raw_metadata_json
        `
      ).run(
        sourceMarket.id,
        sourceMarket.source,
        sourceMarket.sourceMarketKey,
        sourceMarket.sourceSelectionKey ?? null,
        sourceMarket.gameId,
        sourceMarket.instrumentId ?? null,
        sourceMarket.rawFamily ?? null,
        sourceMarket.rawLabel ?? null,
        sourceMarket.mappingStatus,
        stringifyJson(sourceMarket.rawMetadata)
      );
    },
    {
      source: sourceMarket.source,
      sourceMarketId: sourceMarket.id,
    }
  );
}

export type HistoricalTickInput = Omit<QuoteTick, "id" | "isHeartbeat">;

export type HistoricalTickResult = {
  id: number | null;
  inserted: boolean;
};

export function appendHistoricalTick(
  tick: HistoricalTickInput
): HistoricalTickResult {
  return executeDatabaseOperation(
    "quoteTicks.appendHistorical",
    () => {
      const db = getDatabase();
      const result = db
        .prepare(
          `
            INSERT OR IGNORE INTO quote_ticks (
              source_market_id,
              captured_at,
              price_raw,
              odds_raw,
              line_raw,
              implied_probability,
              best_bid,
              best_ask,
              volume,
              depth_score,
              is_heartbeat
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          `
        )
        .run(
          tick.sourceMarketId,
          tick.capturedAt,
          tick.priceRaw ?? null,
          tick.oddsRaw ?? null,
          tick.lineRaw ?? null,
          tick.impliedProbability ?? null,
          tick.bestBid ?? null,
          tick.bestAsk ?? null,
          tick.volume ?? null,
          tick.depthScore ?? null
        );

      return {
        id: result.changes > 0 ? Number(result.lastInsertRowid) : null,
        inserted: result.changes > 0,
      } satisfies HistoricalTickResult;
    },
    {
      sourceMarketId: tick.sourceMarketId,
    }
  );
}

export function appendQuoteTick(tick: Omit<QuoteTick, "id">) {
  return executeDatabaseOperation(
    "quoteTicks.append",
    () => {
      const db = getDatabase();
      const result = db
        .prepare(
          `
            INSERT INTO quote_ticks (
              source_market_id,
              captured_at,
              price_raw,
              odds_raw,
              line_raw,
              implied_probability,
              best_bid,
              best_ask,
              volume,
              depth_score,
              is_heartbeat
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          tick.sourceMarketId,
          tick.capturedAt,
          tick.priceRaw ?? null,
          tick.oddsRaw ?? null,
          tick.lineRaw ?? null,
          tick.impliedProbability ?? null,
          tick.bestBid ?? null,
          tick.bestAsk ?? null,
          tick.volume ?? null,
          tick.depthScore ?? null,
          tick.isHeartbeat ? 1 : 0
        );

      return {
        ...tick,
        id: Number(result.lastInsertRowid),
      } satisfies QuoteTick;
    },
    {
      sourceMarketId: tick.sourceMarketId,
    }
  );
}

export function recordQuoteObservation(input: QuoteObservationInput) {
  return executeDatabaseOperation(
    "quoteTicks.observe",
    () => {
      const db = getDatabase();
      const latest = rowToQuoteTick(
        db
          .prepare(
            `
              SELECT
                id,
                source_market_id AS sourceMarketId,
                captured_at AS capturedAt,
                price_raw AS priceRaw,
                odds_raw AS oddsRaw,
                line_raw AS lineRaw,
                implied_probability AS impliedProbability,
                best_bid AS bestBid,
                best_ask AS bestAsk,
                volume,
                depth_score AS depthScore,
                is_heartbeat AS isHeartbeat
              FROM quote_ticks
              WHERE source_market_id = ?
              ORDER BY captured_at DESC, id DESC
              LIMIT 1
            `
          )
          .get(input.sourceMarketId) as Record<string, unknown> | undefined
      );

      const sameShape =
        latest &&
        latest.priceRaw === (input.priceRaw ?? null) &&
        latest.oddsRaw === (input.oddsRaw ?? null) &&
        latest.lineRaw === (input.lineRaw ?? null) &&
        latest.impliedProbability === (input.impliedProbability ?? null) &&
        latest.bestBid === (input.bestBid ?? null) &&
        latest.bestAsk === (input.bestAsk ?? null) &&
        latest.volume === (input.volume ?? null) &&
        latest.depthScore === (input.depthScore ?? null);

      if (sameShape && latest) {
        const heartbeatAfterMs = input.heartbeatAfterMs ?? 0;
        const elapsedMs =
          new Date(input.capturedAt).getTime() -
          new Date(latest.capturedAt).getTime();

        if (heartbeatAfterMs > 0 && elapsedMs >= heartbeatAfterMs) {
          const heartbeatTick = appendQuoteTick({
            ...input,
            isHeartbeat: true,
          });

          return {
            reason: "heartbeat" as const,
            tick: heartbeatTick,
            wrote: true,
          };
        }

        return {
          reason: "deduped" as const,
          tick: latest,
          wrote: false,
        };
      }

      const tick = appendQuoteTick({
        ...input,
        isHeartbeat: false,
      });

      return {
        reason: "changed" as const,
        tick,
        wrote: true,
      };
    },
    {
      sourceMarketId: input.sourceMarketId,
    }
  );
}

export function recordRawPayload(input: {
  capturedAt: string;
  contentHash: string;
  entityId: string;
  entityType: string;
  payloadJson: Record<string, unknown>;
  source: ResearchSourceId;
}) {
  return executeDatabaseOperation(
    "rawPayloads.append",
    () => {
      const db = getDatabase();
      const result = db
        .prepare(
          `
            INSERT INTO raw_payloads (
              source,
              captured_at,
              entity_type,
              entity_id,
              payload_json,
              content_hash
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          input.source,
          input.capturedAt,
          input.entityType,
          input.entityId,
          JSON.stringify(input.payloadJson),
          input.contentHash
        );

      return {
        ...input,
        id: Number(result.lastInsertRowid),
      } satisfies RawPayloadAttachment;
    },
    {
      entityId: input.entityId,
      source: input.source,
    }
  );
}

export type AdapterCaptureMode = "discovery" | "historical" | "live";

export function recordAdapterRun(input: {
  captureMode?: AdapterCaptureMode;
  errorCode?: string | null;
  errorMessage?: string | null;
  finishedAt?: string | null;
  recordsSeen?: number;
  recordsWritten?: number;
  source: string;
  startedAt: string;
  status: "error" | "ok" | "queued" | "running";
}) {
  return executeDatabaseOperation(
    "adapterRuns.append",
    () => {
      const db = getDatabase();
      const result = db
        .prepare(
          `
            INSERT INTO adapter_runs (
              source,
              started_at,
              finished_at,
              status,
              error_code,
              error_message,
              records_seen,
              records_written,
              capture_mode
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          input.source,
          input.startedAt,
          input.finishedAt ?? null,
          input.status,
          input.errorCode ?? null,
          input.errorMessage ?? null,
          input.recordsSeen ?? 0,
          input.recordsWritten ?? 0,
          input.captureMode ?? "live"
        );

      return Number(result.lastInsertRowid);
    },
    {
      captureMode: input.captureMode ?? "live",
      source: input.source,
      status: input.status,
    }
  );
}

export function upsertGameOutcome(outcome: GameOutcome) {
  executeDatabaseOperation(
    "gameOutcomes.upsert",
    () => {
      const db = getDatabase();
      db.prepare(
        `
          INSERT INTO game_outcomes (
            game_id,
            final_home_score,
            final_away_score,
            winner_key,
            captured_at
          )
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(game_id) DO UPDATE SET
            final_home_score = excluded.final_home_score,
            final_away_score = excluded.final_away_score,
            winner_key = excluded.winner_key,
            captured_at = excluded.captured_at
        `
      ).run(
        outcome.gameId,
        outcome.finalHomeScore,
        outcome.finalAwayScore,
        outcome.winnerKey ?? null,
        outcome.capturedAt
      );
    },
    {
      gameId: outcome.gameId,
    }
  );
}

export function resolveSourceMarketMapping(input: {
  instrumentId: string;
  reason: string;
  resolvedBy: string;
  sourceMarketId: string;
}) {
  return executeDatabaseOperation(
    "mappings.resolve",
    () => {
      const db = getDatabase();

      const sourceMarket = db
        .prepare("SELECT id FROM source_markets WHERE id = ?")
        .get(input.sourceMarketId) as { id: string } | undefined;
      if (!sourceMarket) {
        throw new DatabaseFailureError("Source market could not be resolved.", {
          details: {
            sourceMarketId: input.sourceMarketId,
          },
          operatorHint:
            "Confirm the unmapped source market exists before attempting a manual resolution.",
        });
      }

      const instrument = db
        .prepare("SELECT id FROM market_instruments WHERE id = ?")
        .get(input.instrumentId) as { id: string } | undefined;
      if (!instrument) {
        throw new DatabaseFailureError(
          "Target market instrument could not be resolved.",
          {
            details: {
              instrumentId: input.instrumentId,
            },
            operatorHint:
              "Create or locate the target canonical instrument before linking the source market.",
          }
        );
      }

      db.prepare(
        `
          UPDATE source_markets
          SET instrument_id = ?, mapping_status = 'manual'
          WHERE id = ?
        `
      ).run(input.instrumentId, input.sourceMarketId);

      const resolvedAt = currentTimestamp();
      const result = db
        .prepare(
          `
            INSERT INTO mapping_resolutions (
              source_market_id,
              instrument_id,
              resolved_by,
              resolved_at,
              reason
            )
            VALUES (?, ?, ?, ?, ?)
          `
        )
        .run(
          input.sourceMarketId,
          input.instrumentId,
          input.resolvedBy,
          resolvedAt,
          input.reason
        );

      return Number(result.lastInsertRowid);
    },
    {
      instrumentId: input.instrumentId,
      sourceMarketId: input.sourceMarketId,
    }
  );
}

function enqueueAdminAction(actionType: string, payload: AdminActionPayload) {
  return executeDatabaseOperation(
    "adminActions.enqueue",
    () => {
      const db = getDatabase();
      const requestedAt = currentTimestamp();
      const result = db
        .prepare(
          `
            INSERT INTO admin_actions (
              action_type,
              scope,
              requested_at,
              requested_by,
              status,
              payload_json
            )
            VALUES (?, ?, ?, ?, 'queued', ?)
          `
        )
        .run(
          actionType,
          payload.scope,
          requestedAt,
          payload.requestedBy ?? "operator",
          JSON.stringify(payload.payloadJson)
        );

      return {
        actionType,
        id: Number(result.lastInsertRowid),
        requestedAt,
        status: "queued" as const,
      };
    },
    {
      actionType,
      scope: payload.scope,
    }
  );
}

export function enqueueCaptureRestart(payload: AdminActionPayload) {
  return enqueueAdminAction("capture-restart", payload);
}

export function enqueueGameBackfill(payload: AdminActionPayload) {
  return enqueueAdminAction("games-backfill", payload);
}

export function enqueueMarketBackfill(payload: AdminActionPayload) {
  return enqueueAdminAction("markets-backfill", payload);
}

export function enqueueTimelineMaterializationRebuild(
  payload: AdminActionPayload
) {
  return enqueueAdminAction("timeline-materialization-rebuild", payload);
}

export function listResearchGames(filters: GamesFilters = {}) {
  return executeDatabaseOperation(
    "research.games.list",
    () => {
      const db = getDatabase();
      const hasPostBundleFilter =
        filters.status != null ||
        filters.hasUnmappedMarkets != null ||
        filters.sourceCoverage != null;
      const cards = selectFilteredGameBundles(db, {
        date: filters.date,
        league: filters.league,
        limit: hasPostBundleFilter ? undefined : filters.limit,
        order: filters.date ? "scheduledAsc" : "currentSlate",
        sport: filters.sport,
      })
        .map((bundle) => buildGameCard(bundle))
        .filter((card) => {
          if (filters.status && card.gameState?.status !== filters.status) {
            return false;
          }
          if (
            typeof filters.hasUnmappedMarkets === "boolean" &&
            card.hasUnmappedMarkets !== filters.hasUnmappedMarkets
          ) {
            return false;
          }
          if (filters.sourceCoverage === "complete") {
            return card.coverage.missingSources.length === 0;
          }
          if (filters.sourceCoverage === "partial") {
            return (
              card.coverage.availableSources.length > 0 &&
              card.coverage.missingSources.length > 0
            );
          }
          if (filters.sourceCoverage === "missing") {
            return card.coverage.availableSources.length === 0;
          }
          return true;
        });

      if (hasPostBundleFilter && filters.limit != null) {
        return cards.slice(
          0,
          Math.min(500, Math.max(1, Math.floor(filters.limit)))
        );
      }

      return cards;
    },
    filters
  );
}

export function getResearchGame(gameId: string) {
  return executeDatabaseOperation(
    "research.games.get",
    () => {
      const db = getDatabase();
      const bundle = selectGameBundle(db, gameId);
      if (!bundle) {
        return null;
      }

      const familyCounts = bundle.instruments.reduce<
        Array<{ family: MarketFamily; count: number }>
      >((counts, instrument) => {
        const existing = counts.find(
          (entry) => entry.family === instrument.family
        );
        if (existing) {
          existing.count += 1;
        } else {
          counts.push({ family: instrument.family, count: 1 });
        }
        return counts;
      }, []);

      return {
        coverageSummary: computeCoverageSummary(
          bundle.sourceMarkets,
          bundle.latestTicks,
          Boolean(bundle.gameState || bundle.outcome)
        ),
        game: bundle.game,
        gameState: bundle.gameState,
        marketFamilyCounts: familyCounts,
        outcome: bundle.outcome,
      } satisfies ResearchGameDetail;
    },
    {
      gameId,
    }
  );
}

export function listGameMarkets(gameId: string, filters: MarketFilters = {}) {
  return executeDatabaseOperation(
    "research.markets.list",
    () => {
      const db = getDatabase();
      const bundle = selectGameBundle(db, gameId);
      if (!bundle) {
        return [];
      }

      return bundle.instruments
        .filter((instrument) => {
          if (filters.family && instrument.family !== filters.family) {
            return false;
          }
          if (
            typeof filters.inPlay === "boolean" &&
            instrument.inPlay !== filters.inPlay
          ) {
            return false;
          }
          return true;
        })
        .map((instrument) =>
          buildMarketInstrumentView(
            instrument,
            bundle.sourceMarkets.filter((sourceMarket) => {
              if (sourceMarket.instrumentId !== instrument.id) {
                return false;
              }
              if (filters.source && sourceMarket.source !== filters.source) {
                return false;
              }
              return true;
            }),
            bundle.latestTicks,
            bundle.latestPayloads
          )
        )
        .filter((instrumentView) =>
          filters.mappedOnly
            ? instrumentView.mappingStatus !== "unmapped"
            : true
        );
    },
    {
      ...filters,
      gameId,
    }
  );
}

export function getInstrumentComparison(gameId: string, instrumentId: string) {
  return executeDatabaseOperation(
    "research.instrument.get",
    () => {
      const db = getDatabase();
      const bundle = selectGameBundle(db, gameId);
      if (!bundle) {
        return null;
      }

      const instrument = bundle.instruments.find(
        (entry) => entry.id === instrumentId
      );
      if (!instrument) {
        return null;
      }

      const sourceMarkets = bundle.sourceMarkets.filter(
        (sourceMarket) => sourceMarket.instrumentId === instrumentId
      );
      const latestQuotesBySource = buildLatestSourceViews(
        sourceMarkets,
        bundle.latestTicks,
        bundle.latestPayloads
      );
      const mappingStatus = computeMappingStatus(sourceMarkets);
      const comparableState = computeComparableState(
        instrument,
        mappingStatus,
        latestQuotesBySource
      );
      const impliedProbabilityGap = computeImpliedProbabilityGap(
        comparableState === "line-mismatch"
          ? latestQuotesBySource.filter((source) =>
              lineValuesMatch(source.raw.line, instrument.line)
            )
          : latestQuotesBySource
      );

      return {
        derivedComparison: {
          comparableState,
          impliedProbabilityGap,
          lineMismatch: comparableState === "line-mismatch",
          sourceCount: latestQuotesBySource.length,
        },
        gameState: bundle.gameState,
        instrument,
        latestQuotesBySource,
        latestRawReferences: latestQuotesBySource
          .filter((source) => source.lastPayloadId && source.capturedAt)
          .map((source) => ({
            capturedAt: source.capturedAt!,
            payloadId: source.lastPayloadId!,
            source: source.source,
          })),
      } satisfies InstrumentComparisonView;
    },
    {
      gameId,
      instrumentId,
    }
  );
}

export function getInstrumentTimeline(
  gameId: string,
  instrumentId: string,
  filters: {
    from?: string;
    source?: ResearchSourceId[];
    to?: string;
  } = {}
) {
  return executeDatabaseOperation(
    "research.instrument.timeline",
    () => {
      const db = getDatabase();
      const bundle = selectGameBundle(db, gameId);
      if (!bundle) {
        return null;
      }

      const instrument = bundle.instruments.find(
        (entry) => entry.id === instrumentId
      );
      if (!instrument) {
        return null;
      }

      const sourceMarkets = bundle.sourceMarkets.filter((sourceMarket) => {
        if (sourceMarket.instrumentId !== instrumentId) {
          return false;
        }
        if (filters.source && !filters.source.includes(sourceMarket.source)) {
          return false;
        }
        return true;
      });

      const quoteSeriesBySource: Record<
        ResearchSourceId,
        InstrumentTimelinePoint[]
      > = {
        bet365: [],
        kalshi: [],
        nba: [],
        polymarket: [],
      };

      for (const sourceMarket of sourceMarkets) {
        const clauses = ["source_market_id = ?"];
        const params: unknown[] = [sourceMarket.id];
        if (filters.from) {
          clauses.push("captured_at >= ?");
          params.push(filters.from);
        }
        if (filters.to) {
          clauses.push("captured_at <= ?");
          params.push(filters.to);
        }

        const rows = db
          .prepare(
            `
              SELECT
                id,
                source_market_id AS sourceMarketId,
                captured_at AS capturedAt,
                price_raw AS priceRaw,
                odds_raw AS oddsRaw,
                line_raw AS lineRaw,
                implied_probability AS impliedProbability,
                best_bid AS bestBid,
                best_ask AS bestAsk,
                volume,
                depth_score AS depthScore,
                is_heartbeat AS isHeartbeat
              FROM quote_ticks
              WHERE ${clauses.join(" AND ")}
              ORDER BY captured_at ASC, id ASC
            `
          )
          .all(...params) as Record<string, unknown>[];

        quoteSeriesBySource[sourceMarket.source].push(
          ...rows
            .map((row) => rowToQuoteTick(row))
            .filter((tick): tick is QuoteTick => Boolean(tick))
            .map((tick) => ({
              bestAsk: tick.bestAsk ?? null,
              bestBid: tick.bestBid ?? null,
              capturedAt: tick.capturedAt,
              depthScore: tick.depthScore ?? null,
              impliedProbability: tick.impliedProbability ?? null,
              isHeartbeat: tick.isHeartbeat,
              line: tick.lineRaw ?? null,
              source: sourceMarket.source,
              volume: tick.volume ?? null,
            }))
        );
      }

      const gameStateClauses = ["game_id = ?"];
      const gameStateParams: unknown[] = [gameId];
      if (filters.from) {
        gameStateClauses.push("captured_at >= ?");
        gameStateParams.push(filters.from);
      }
      if (filters.to) {
        gameStateClauses.push("captured_at <= ?");
        gameStateParams.push(filters.to);
      }

      const gameStateSeries = db
        .prepare(
          `
            SELECT
              id,
              game_id AS gameId,
              captured_at AS capturedAt,
              status,
              period,
              clock,
              home_score AS homeScore,
              away_score AS awayScore,
              is_final AS isFinal,
              started_at AS startedAt,
              final_at AS finalAt
            FROM game_states
            WHERE ${gameStateClauses.join(" AND ")}
            ORDER BY captured_at ASC, id ASC
          `
        )
        .all(...gameStateParams)
        .map((row) => rowToGameState(row as Record<string, unknown>))
        .filter((state): state is CanonicalGameState => Boolean(state));

      const lineMismatchWindows: Array<{
        end?: string | null;
        sources: ResearchSourceId[];
        start: string;
      }> = [];

      for (const source of ["bet365", "kalshi", "polymarket"] as const) {
        const points = quoteSeriesBySource[source];
        let activeWindow: {
          end?: string | null;
          sources: ResearchSourceId[];
          start: string;
        } | null = null;

        for (const point of points) {
          const mismatched =
            instrument.family !== "moneyline" &&
            !lineValuesMatch(point.line, instrument.line);

          if (mismatched && !activeWindow) {
            activeWindow = {
              sources: [source],
              start: point.capturedAt,
            };
            continue;
          }

          if (!mismatched && activeWindow) {
            activeWindow.end = point.capturedAt;
            lineMismatchWindows.push(activeWindow);
            activeWindow = null;
          }
        }

        if (activeWindow) {
          lineMismatchWindows.push(activeWindow);
        }
      }

      return {
        annotations: [
          ...lineMismatchWindows.map((window) => ({
            capturedAt: window.start,
            detail:
              "One or more source lines diverged from the canonical instrument line.",
            label: "Line mismatch",
            source: "system" as const,
          })),
          ...gameStateSeries.map((state) => ({
            capturedAt: state.capturedAt,
            detail:
              `${state.status} ${state.period ? `P${state.period}` : ""} ${state.clock ?? ""}`.trim(),
            label: "Game state",
            source: "system" as const,
          })),
        ].sort((left, right) =>
          left.capturedAt.localeCompare(right.capturedAt)
        ),
        gameStateSeries,
        lineMismatchWindows,
        quoteSeriesBySource,
      } satisfies InstrumentTimeline;
    },
    {
      ...filters,
      gameId,
      instrumentId,
    }
  );
}

export function getInstrumentSources(gameId: string, instrumentId: string) {
  return executeDatabaseOperation(
    "research.instrument.sources",
    () => {
      const db = getDatabase();
      const bundle = selectGameBundle(db, gameId);
      if (!bundle) {
        return [];
      }

      const instrument = bundle.instruments.find(
        (entry) => entry.id === instrumentId
      );
      if (!instrument) {
        return [];
      }

      return bundle.sourceMarkets
        .filter((sourceMarket) => sourceMarket.instrumentId === instrumentId)
        .map((sourceMarket) => {
          const latestQuote = bundle.latestTicks.get(sourceMarket.id) ?? null;
          const latestRawPayload =
            bundle.latestPayloads.get(sourceMarket.id) ?? null;
          const freshnessMs = latestQuote
            ? Math.max(
                0,
                Date.now() - new Date(latestQuote.capturedAt).getTime()
              )
            : null;

          return {
            diagnostics: {
              captureLagMs: freshnessMs,
              lineMismatch:
                instrument.family !== "moneyline" &&
                !lineValuesMatch(latestQuote?.lineRaw ?? null, instrument.line),
              mappingStatus: sourceMarket.mappingStatus,
            },
            freshnessMs,
            latestQuote,
            latestRawPayload,
            source: sourceMarket.source,
            sourceMarket,
          } satisfies InstrumentSourceDiagnostics;
        });
    },
    {
      gameId,
      instrumentId,
    }
  );
}

export function getInstrumentRawSource(
  gameId: string,
  instrumentId: string,
  source: ResearchSourceId
) {
  return executeDatabaseOperation(
    "research.instrument.rawSource",
    () => {
      const db = getDatabase();
      const bundle = selectGameBundle(db, gameId);
      if (!bundle) {
        return null;
      }

      const instrument = bundle.instruments.find(
        (entry) => entry.id === instrumentId
      );
      if (!instrument) {
        return null;
      }

      const sourceMarket = bundle.sourceMarkets
        .filter(
          (entry) =>
            entry.instrumentId === instrumentId && entry.source === source
        )
        .sort((left, right) => {
          const leftLatestTick = bundle.latestTicks.get(left.id) ?? null;
          const rightLatestTick = bundle.latestTicks.get(right.id) ?? null;
          const leftTimestamp = Math.max(
            timestampValue(leftLatestTick?.capturedAt ?? null),
            timestampValue(
              bundle.latestPayloads.get(left.id)?.capturedAt ?? null
            )
          );
          const rightTimestamp = Math.max(
            timestampValue(rightLatestTick?.capturedAt ?? null),
            timestampValue(
              bundle.latestPayloads.get(right.id)?.capturedAt ?? null
            )
          );

          if (rightTimestamp !== leftTimestamp) {
            return rightTimestamp - leftTimestamp;
          }

          return right.id.localeCompare(left.id);
        })[0];

      if (!sourceMarket) {
        return null;
      }

      const latestQuote = bundle.latestTicks.get(sourceMarket.id) ?? null;
      const recentRawPayloads = db
        .prepare(
          `
            SELECT
              id,
              source,
              captured_at AS capturedAt,
              entity_type AS entityType,
              entity_id AS entityId,
              payload_json AS payloadJson,
              content_hash AS contentHash
            FROM raw_payloads
            WHERE source = ?
              AND entity_type = 'source_market'
              AND entity_id = ?
            ORDER BY captured_at DESC, id DESC
            LIMIT 10
          `
        )
        .all(source, sourceMarket.id)
        .map((row) => rowToRawPayload(row as Record<string, unknown>))
        .filter((payload): payload is RawPayloadAttachment => Boolean(payload));

      return {
        captureDiagnostics: {
          freshnessBand: freshnessBandFromMs(
            latestQuote
              ? Math.max(
                  0,
                  Date.now() - new Date(latestQuote.capturedAt).getTime()
                )
              : null
          ),
          lastQuoteCapturedAt: latestQuote?.capturedAt ?? null,
          mappingStatus: sourceMarket.mappingStatus,
        },
        latestQuote,
        parserOutput: {
          impliedProbability: latestQuote?.impliedProbability ?? null,
          line: latestQuote?.lineRaw ?? null,
          odds: latestQuote?.oddsRaw ?? null,
          price: latestQuote?.priceRaw ?? null,
        },
        rawPayloads: recentRawPayloads,
        sourceMarket,
      };
    },
    {
      gameId,
      instrumentId,
      source,
    }
  );
}

export function listResearchDivergence(filters: DivergenceFilters = {}) {
  return executeDatabaseOperation(
    "research.divergence.list",
    () => buildResearchDivergenceEntries(filters).map((entry) => entry.row),
    filters
  );
}

export function listSignalMismatches(filters: DivergenceFilters = {}) {
  return executeDatabaseOperation(
    "research.signalMismatches.list",
    () => {
      const { limit, ...entryFilters } = filters;
      const rows = buildResearchDivergenceEntries({
        ...entryFilters,
        sort: entryFilters.sort ?? "divergence",
      })
        .map((entry) => buildSignalMismatchRow(entry))
        .filter(
          (row) =>
            row.directionalDisagreement ||
            (row.impliedProbabilityGap ?? 0) >= 0.08
        );

      if (limit == null) {
        return rows as SignalMismatchRow[];
      }

      const clampedLimit = Math.min(500, Math.max(1, Math.floor(limit)));
      return rows.slice(0, clampedLimit) as SignalMismatchRow[];
    },
    filters
  );
}

export function getResearchCoverage() {
  return executeDatabaseOperation("research.coverage.get", () => {
    const db = getDatabase();
    const gameRows = db
      .prepare(
        `
          SELECT
            id,
            sport,
            league
          FROM games
          ORDER BY
            CASE
              WHEN datetime(scheduled_start) >= datetime('now', '-8 hours')
                AND datetime(scheduled_start) <= datetime('now', '+48 hours')
                THEN 0
              WHEN datetime(scheduled_start) >= datetime('now', '-8 hours')
                THEN 1
              ELSE 2
            END,
            ABS(strftime('%s', scheduled_start) - strftime('%s', 'now')) ASC,
            scheduled_start ASC,
            id ASC
          LIMIT 25
        `
      )
      .all() as Array<{ id: string; league: string; sport: string }>;
    if (gameRows.length === 0) {
      return [];
    }

    const gameIds = gameRows.map((row) => row.id);
    const gamePlaceholders = gameIds.map(() => "?").join(", ");
    const instrumentsByGame = new Map<
      string,
      Array<{ family: MarketFamily; id: string }>
    >();
    const sourceMarketsByGame = new Map<string, SourceMarket[]>();
    const stateGameIds = new Set<string>(
      (
        db
          .prepare(
            `
              SELECT DISTINCT game_id AS gameId
              FROM game_states
              WHERE game_id IN (${gamePlaceholders})
            `
          )
          .all(...gameIds) as Array<{ gameId: string }>
      ).map((row) => row.gameId)
    );
    const outcomeGameIds = new Set<string>(
      (
        db
          .prepare(
            `
              SELECT game_id AS gameId
              FROM game_outcomes
              WHERE game_id IN (${gamePlaceholders})
            `
          )
          .all(...gameIds) as Array<{ gameId: string }>
      ).map((row) => row.gameId)
    );

    for (const row of db
      .prepare(
        `
          SELECT
            id,
            game_id AS gameId,
            family
          FROM market_instruments
          WHERE game_id IN (${gamePlaceholders})
          ORDER BY display_label ASC
        `
      )
      .all(...gameIds) as Array<{
      family: MarketFamily;
      gameId: string;
      id: string;
    }>) {
      const existing = instrumentsByGame.get(row.gameId) ?? [];
      existing.push({ family: row.family, id: row.id });
      instrumentsByGame.set(row.gameId, existing);
    }

    for (const row of db
      .prepare(
        `
          SELECT
            id,
            source,
            game_id AS gameId,
            instrument_id AS instrumentId,
            raw_family AS rawFamily,
            mapping_status AS mappingStatus
          FROM source_markets
          WHERE game_id IN (${gamePlaceholders})
          ORDER BY source ASC, raw_label ASC, source_market_key ASC
        `
      )
      .all(...gameIds) as Array<{
      gameId: string;
      id: string;
      instrumentId: string | null;
      mappingStatus: MappingStatus;
      rawFamily: string | null;
      source: ResearchSourceId;
    }>) {
      const sourceMarket = {
        gameId: row.gameId,
        id: row.id,
        instrumentId: row.instrumentId,
        mappingStatus: row.mappingStatus,
        rawFamily: row.rawFamily,
        rawLabel: null,
        rawMetadata: null,
        source: row.source,
        sourceMarketKey: row.id,
        sourceSelectionKey: null,
      } satisfies SourceMarket;
      const existing = sourceMarketsByGame.get(row.gameId) ?? [];
      existing.push(sourceMarket);
      sourceMarketsByGame.set(row.gameId, existing);
    }

    const rows: CoverageRow[] = [];
    const maxRows = 500;
    const pushCoverageRow = (row: CoverageRow) => {
      if (rows.length < maxRows) {
        rows.push(row);
      }
    };

    for (const game of gameRows) {
      if (rows.length >= maxRows) {
        break;
      }
      const sourceMarkets = sourceMarketsByGame.get(game.id) ?? [];
      const sourceMarketsByInstrument = new Map<string, SourceMarket[]>();
      for (const sourceMarket of sourceMarkets) {
        if (sourceMarket.instrumentId == null) {
          continue;
        }
        const existing =
          sourceMarketsByInstrument.get(sourceMarket.instrumentId) ?? [];
        existing.push(sourceMarket);
        sourceMarketsByInstrument.set(sourceMarket.instrumentId, existing);
      }

      const hasNbaState =
        stateGameIds.has(game.id) || outcomeGameIds.has(game.id);
      const gameCoverageSources = buildCoverageSources(sourceMarkets);
      const gameAvailableSources = hasNbaState
        ? uniqueResearchSources(
            [...gameCoverageSources.availableSources, "nba"],
            { includeNba: true }
          )
        : gameCoverageSources.availableSources;

      pushCoverageRow({
        availableSources: gameAvailableSources,
        gameId: game.id,
        league: game.league,
        missingSources: researchSourceIds.filter(
          (sourceId) => !gameAvailableSources.includes(sourceId)
        ),
        sport: game.sport,
        unmappedSources: uniqueResearchSources(
          sourceMarkets
            .filter((sourceMarket) => sourceMarket.mappingStatus === "unmapped")
            .map((sourceMarket) => sourceMarket.source)
        ),
      });

      for (const instrument of instrumentsByGame.get(game.id) ?? []) {
        if (rows.length >= maxRows) {
          break;
        }
        const coverageSources = buildCoverageSources(
          sourceMarketsByInstrument.get(instrument.id) ?? []
        );
        pushCoverageRow({
          availableSources: coverageSources.availableSources,
          family: instrument.family,
          gameId: game.id,
          instrumentId: instrument.id,
          league: game.league,
          missingSources: coverageSources.missingSources,
          sport: game.sport,
          unmappedSources: coverageSources.unmappedSources,
        });
      }

      const orphanUnmappedMarkets = sourceMarkets.filter(
        (sourceMarket) =>
          sourceMarket.instrumentId == null &&
          sourceMarket.mappingStatus === "unmapped"
      );
      const orphanGroups = new Map<MarketFamily | null, SourceMarket[]>();

      for (const sourceMarket of orphanUnmappedMarkets) {
        const family = normalizeCoverageFamily(sourceMarket.rawFamily);
        const existing = orphanGroups.get(family) ?? [];
        existing.push(sourceMarket);
        orphanGroups.set(family, existing);
      }

      for (const [family, sourceMarkets] of orphanGroups) {
        if (rows.length >= maxRows) {
          break;
        }
        const coverageSources = buildCoverageSources(sourceMarkets);
        pushCoverageRow({
          availableSources: coverageSources.availableSources,
          family,
          gameId: game.id,
          instrumentId: null,
          league: game.league,
          missingSources: coverageSources.missingSources,
          sport: game.sport,
          unmappedSources: coverageSources.unmappedSources,
        });
      }
    }

    return rows;
  });
}

function latestSuccessfulRun(source: string) {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT
          id,
          source,
          started_at AS startedAt,
          finished_at AS finishedAt,
          status,
          error_code AS errorCode,
          error_message AS errorMessage,
          records_seen AS recordsSeen,
          records_written AS recordsWritten,
          capture_mode AS captureMode
        FROM adapter_runs
        WHERE source = ? AND status = 'ok'
        ORDER BY started_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(source) as Record<string, unknown> | undefined;

  return row
    ? {
        errorCode: row.errorCode == null ? null : String(row.errorCode),
        errorMessage:
          row.errorMessage == null ? null : String(row.errorMessage),
        finishedAt: row.finishedAt == null ? null : String(row.finishedAt),
        id: Number(row.id),
        recordsSeen: Number(row.recordsSeen),
        recordsWritten: Number(row.recordsWritten),
        source: String(row.source),
        startedAt: String(row.startedAt),
        status: String(row.status),
      }
    : null;
}

function latestRun(source: string) {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT
          id,
          source,
          started_at AS startedAt,
          finished_at AS finishedAt,
          status,
          error_code AS errorCode,
          error_message AS errorMessage,
          records_seen AS recordsSeen,
          records_written AS recordsWritten,
          capture_mode AS captureMode
        FROM adapter_runs
        WHERE source = ?
        ORDER BY started_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(source) as Record<string, unknown> | undefined;

  return row
    ? {
        errorCode: row.errorCode == null ? null : String(row.errorCode),
        errorMessage:
          row.errorMessage == null ? null : String(row.errorMessage),
        finishedAt: row.finishedAt == null ? null : String(row.finishedAt),
        id: Number(row.id),
        recordsSeen: Number(row.recordsSeen),
        recordsWritten: Number(row.recordsWritten),
        source: String(row.source),
        startedAt: String(row.startedAt),
        status: String(row.status),
      }
    : null;
}

export function listAdminSources() {
  return executeDatabaseOperation("admin.sources.list", () => {
    const oddsApiKey = process.env.ODDS_API_KEY ?? process.env.ODDS_API_IO_KEY;
    const bet365SessionStatePath = process.env.BET365_SESSION_STATE_PATH;
    const bet365SessionReady =
      typeof bet365SessionStatePath === "string" &&
      bet365SessionStatePath.length > 0 &&
      existsSync(bet365SessionStatePath);
    const kalshiKey = process.env.KALSHI_API_KEY;
    const kalshiSecret = process.env.KALSHI_API_SECRET;
    const nbaSidecarBaseUrl = process.env.NBA_SIDECAR_BASE_URL;
    const polymarketKey = process.env.POLYMARKET_API_KEY;
    const polymarketSecret = process.env.POLYMARKET_API_SECRET;
    const polymarketPassphrase = process.env.POLYMARKET_API_PASSPHRASE;
    const polymarketReady = Boolean(
      polymarketKey && polymarketSecret && polymarketPassphrase
    );

    const sources: Array<{
      authState: "configured" | "invalid" | "missing";
      bootstrapState?: "invalid" | "missing" | "ready";
      configured: boolean;
      source: string;
      subscriptionState?: "active" | "inactive" | "unknown";
    }> = [
      {
        authState:
          oddsApiKey || bet365SessionReady
            ? "configured"
            : bet365SessionStatePath != null
              ? "invalid"
              : "missing",
        bootstrapState: oddsApiKey
          ? "ready"
          : bet365SessionStatePath == null
            ? "missing"
            : bet365SessionReady
              ? "ready"
              : bet365SessionStatePath.length === 0
                ? "invalid"
                : "invalid",
        configured: Boolean(oddsApiKey || bet365SessionReady),
        source: "bet365",
        subscriptionState: oddsApiKey ? "active" : "unknown",
      },
      {
        authState:
          oddsApiKey || (kalshiKey && kalshiSecret)
            ? "configured"
            : kalshiKey || kalshiSecret
              ? "invalid"
              : "missing",
        configured: Boolean(oddsApiKey || (kalshiKey && kalshiSecret)),
        source: "kalshi",
        subscriptionState: oddsApiKey ? "active" : "unknown",
      },
      {
        authState: polymarketReady
          ? "configured"
          : polymarketKey || polymarketSecret || polymarketPassphrase
            ? "invalid"
            : "missing",
        configured: polymarketReady,
        source: "polymarket",
        subscriptionState: "unknown",
      },
      {
        authState: nbaSidecarBaseUrl ? "configured" : "missing",
        configured: Boolean(nbaSidecarBaseUrl),
        source: "nba",
      },
    ];

    return sources.map((sourceInfo) => {
      const success = latestSuccessfulRun(sourceInfo.source);
      const latest = latestRun(sourceInfo.source);
      const lagMs = success?.finishedAt
        ? Math.max(0, Date.now() - new Date(success.finishedAt).getTime())
        : null;
      const currentBackoffMs =
        latest?.status === "error" && latest.finishedAt
          ? Math.max(0, Date.now() - new Date(latest.finishedAt).getTime())
          : null;

      return {
        authState: sourceInfo.authState,
        bootstrapState: sourceInfo.bootstrapState,
        configured: sourceInfo.configured,
        currentBackoffMs,
        lagMs,
        lastSuccessAt: success?.finishedAt ?? success?.startedAt ?? null,
        source: sourceInfo.source,
        status:
          sourceInfo.source === "polymarket"
            ? success != null
              ? "ok"
              : "error"
            : sourceInfo.authState === "configured" &&
                (sourceInfo.source === "nba"
                  ? success != null
                  : sourceInfo.configured)
              ? "ok"
              : "error",
        subscriptionState: sourceInfo.subscriptionState,
      } satisfies AdminSourceHealth;
    });
  });
}

export function listAdapterRuns(limit = 50) {
  return executeDatabaseOperation(
    "admin.captureRuns.list",
    () => {
      const db = getDatabase();
      return db
        .prepare(
          `
            SELECT
              id,
              source,
              started_at AS startedAt,
              finished_at AS finishedAt,
              status,
              error_code AS errorCode,
              error_message AS errorMessage,
              records_seen AS recordsSeen,
              records_written AS recordsWritten,
              capture_mode AS captureMode
            FROM adapter_runs
            ORDER BY started_at DESC, id DESC
            LIMIT ?
          `
        )
        .all(limit);
    },
    {
      limit,
    }
  );
}

export function listUnmappedMarkets() {
  return executeDatabaseOperation("admin.unmappedMarkets.list", () => {
    const db = getDatabase();
    const rows = db
      .prepare(
        `
          SELECT
            id,
            source,
            source_market_key AS sourceMarketKey,
            source_selection_key AS sourceSelectionKey,
            game_id AS gameId,
            instrument_id AS instrumentId,
            raw_family AS rawFamily,
            raw_label AS rawLabel,
            mapping_status AS mappingStatus,
            raw_metadata_json AS rawMetadataJson
          FROM source_markets
          WHERE mapping_status = 'unmapped'
          ORDER BY source ASC, raw_label ASC, source_market_key ASC
        `
      )
      .all() as Record<string, unknown>[];

    return rows.map((row) => {
      const sourceMarket = rowToSourceMarket(row);
      const latestQuote = rowToQuoteTick(
        db
          .prepare(
            `
              SELECT
                id,
                source_market_id AS sourceMarketId,
                captured_at AS capturedAt,
                price_raw AS priceRaw,
                odds_raw AS oddsRaw,
                line_raw AS lineRaw,
                implied_probability AS impliedProbability,
                best_bid AS bestBid,
                best_ask AS bestAsk,
                volume,
                depth_score AS depthScore,
                is_heartbeat AS isHeartbeat
              FROM quote_ticks
              WHERE source_market_id = ?
              ORDER BY captured_at DESC, id DESC
              LIMIT 1
            `
          )
          .get(sourceMarket.id) as Record<string, unknown> | undefined
      );

      const game = rowToGame(
        db
          .prepare(
            `
              SELECT
                id,
                sport,
                league,
                source_game_key_nba AS sourceGameKeyNba,
                home_participant_json AS homeParticipantJson,
                away_participant_json AS awayParticipantJson,
                scheduled_start AS scheduledStart
              FROM games
              WHERE id = ?
            `
          )
          .get(sourceMarket.gameId) as Record<string, unknown>
      );

      return {
        game,
        latestQuote,
        sourceMarket,
      } satisfies AdminUnmappedMarket;
    });
  });
}

export function getStorageCoverage() {
  return executeDatabaseOperation("admin.storageCoverage.get", () => {
    const db = getDatabase();
    return db
      .prepare(
        `
          WITH selected_source_markets AS (
            SELECT
              sm.id AS sourceMarketId,
              sm.source AS source,
              g.sport AS sport,
              g.league AS league,
              g.id AS gameId,
              g.scheduled_start AS scheduledStart,
              mi.family AS family
            FROM source_markets sm
            JOIN games g ON g.id = sm.game_id
            LEFT JOIN market_instruments mi ON mi.id = sm.instrument_id
            ORDER BY
              CASE
                WHEN datetime(g.scheduled_start) >= datetime('now', '-8 hours')
                  AND datetime(g.scheduled_start) <= datetime('now', '+48 hours')
                  THEN 0
                WHEN datetime(g.scheduled_start) >= datetime('now', '-8 hours')
                  THEN 1
                ELSE 2
              END,
              ABS(strftime('%s', g.scheduled_start) - strftime('%s', 'now')) ASC,
              g.scheduled_start ASC,
              sm.source ASC
            LIMIT 1000
          )
          SELECT
            ssm.source AS source,
            ssm.sport AS sport,
            ssm.league AS league,
            ssm.gameId AS gameId,
            ssm.family AS family,
            COUNT(ssm.sourceMarketId) AS sourceMarketCount,
            SUM((
              SELECT COUNT(*)
              FROM quote_ticks qt
              WHERE qt.source_market_id = ssm.sourceMarketId
            )) AS quoteTickCount,
            SUM((
              SELECT COUNT(*)
              FROM raw_payloads rp
              WHERE rp.entity_type = 'source_market'
                AND rp.entity_id = ssm.sourceMarketId
            )) AS rawPayloadCount
          FROM selected_source_markets ssm
          GROUP BY ssm.source, ssm.sport, ssm.league, ssm.gameId, ssm.family
          ORDER BY MIN(ssm.scheduledStart) ASC, ssm.source ASC
        `
      )
      .all()
      .map((row) => ({
        family:
          (row as { family?: string | null }).family == null
            ? null
            : (String((row as { family: string }).family) as MarketFamily),
        gameId: String((row as { gameId: string }).gameId),
        league: String((row as { league: string }).league),
        quoteTickCount: Number(
          (row as { quoteTickCount: number }).quoteTickCount
        ),
        rawPayloadCount: Number(
          (row as { rawPayloadCount: number }).rawPayloadCount
        ),
        source: String((row as { source: string }).source),
        sourceMarketCount: Number(
          (row as { sourceMarketCount: number }).sourceMarketCount
        ),
        sport: String((row as { sport: string }).sport),
      })) satisfies StorageCoverageRow[];
  });
}
