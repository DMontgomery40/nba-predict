import type {
  BoardAnomalyAlert,
  BoardAnomalyDetectorConfig,
  BoardAnomalyReplayOutput,
  BoardAnomalyShockKind,
  BoardObservation,
  BoardObservationFlags,
  BoardObservationGameState,
  BoardObservationLabelTokens,
  BoardObservationMissing,
  MarketAnomalyAlert,
  MarketFamily,
  ResearchGameStatus,
  ResearchSourceId,
  SignalMismatchRow,
} from "@signal-console/domain";

import {
  detectBoardAnomalies as detectBoardAnomaliesPure,
  replayBoardAnomalies as replayBoardAnomaliesPure,
} from "./board-anomaly";
import { scoreToSeverity } from "./board-anomaly/config";
import { executeDatabaseOperation, getDatabase } from "./db-core";
import {
  listMarketAnomalyAlerts,
  listSignalMismatches,
} from "./live-repository";

const STALE_QUOTE_AGE_MS = 10 * 60_000;

const NUMERIC_LABEL_TOKEN_RE = /^\d+(\.\d+)?$/;

function tokenize(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9. ]+/g, " ")
    .split(/\s+/)
    .filter(
      (token) => token.length >= 3 && !NUMERIC_LABEL_TOKEN_RE.test(token)
    );
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function sourceKindFor(source: string): "sportsbook" | "prediction-market" {
  if (source === "kalshi" || source === "polymarket")
    return "prediction-market";
  return "sportsbook";
}

function statFamilyHintFromTokens(tokens: string[]): string[] {
  const hints: string[] = [];
  for (const token of tokens) {
    if (token.startsWith("rebound")) hints.push("rebounds");
    if (token.startsWith("assist")) hints.push("assists");
    if (token.startsWith("steal")) hints.push("steals");
    if (token.startsWith("block")) hints.push("blocks");
    if (token.startsWith("three") || token === "3pt" || token === "3s")
      hints.push("threes");
    if (token === "pts" || token.startsWith("point")) hints.push("points");
    if (token === "pra") hints.push("pra");
    if (token === "ra") hints.push("ra");
    if (token === "pa") hints.push("pa");
  }
  return Array.from(new Set(hints));
}

type GameContextRow = {
  gameId: string;
  homeName: string;
  awayName: string;
  homeKey: string;
  awayKey: string;
  scheduledStart: string;
};

type GameStateRow = {
  gameId: string;
  capturedAt: string;
  status: ResearchGameStatus;
  period?: number | null;
  clock?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
};

type QuoteRow = {
  observationKind: "quote";
  observationId: number;
  sourceMarketId: string;
  source: ResearchSourceId;
  instrumentId: string | null;
  rawFamily: string | null;
  rawLabel: string | null;
  mappingStatus: string;
  family: MarketFamily | null;
  selection: string | null;
  participantKey: string | null;
  line: number | null;
  displayLabel: string | null;
  capturedAt: string;
  impliedProbability: number | null;
  lineRaw: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  volume: number | null;
  depthScore: number | null;
  isHeartbeat: number;
};

type MicrostructureRow = {
  observationKind: "microstructure";
  observationId: number;
  sourceMarketId: string;
  source: ResearchSourceId;
  instrumentId: string | null;
  rawFamily: string | null;
  rawLabel: string | null;
  mappingStatus: string;
  family: MarketFamily | null;
  selection: string | null;
  participantKey: string | null;
  line: number | null;
  displayLabel: string | null;
  eventType: string;
  apiSurface: string;
  eventTimestamp: string;
  capturedAt: string;
  price: number | null;
  previousPrice: number | null;
  tradePrice: number | null;
  size: number | null;
  notional: number | null;
  volume: number | null;
  finalMarketVolume: number | null;
  volumeShare: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  depthScore: number | null;
};

function loadGameContext(gameId: string): {
  game: GameContextRow;
  gameStates: GameStateRow[];
} | null {
  const db = getDatabase();
  const gameRow = db
    .prepare(
      `SELECT
         g.id AS gameId,
         g.home_participant_json AS homeJson,
         g.away_participant_json AS awayJson,
         g.scheduled_start AS scheduledStart
       FROM games g
       WHERE g.id = ?`
    )
    .get(gameId) as
    | {
        gameId: string;
        homeJson: string;
        awayJson: string;
        scheduledStart: string;
      }
    | undefined;
  if (!gameRow) return null;
  const homeParticipant = JSON.parse(gameRow.homeJson) as {
    key: string;
    name: string;
    shortName?: string;
    abbreviation?: string;
  };
  const awayParticipant = JSON.parse(gameRow.awayJson) as {
    key: string;
    name: string;
    shortName?: string;
    abbreviation?: string;
  };

  const gameStateRows = db
    .prepare(
      `SELECT
         game_id AS gameId,
         captured_at AS capturedAt,
         status,
         period,
         clock,
         home_score AS homeScore,
         away_score AS awayScore
       FROM game_states
       WHERE game_id = ?
       ORDER BY datetime(captured_at) ASC, id ASC`
    )
    .all(gameId) as GameStateRow[];

  return {
    game: {
      gameId: gameRow.gameId,
      homeName: homeParticipant.shortName ?? homeParticipant.name,
      awayName: awayParticipant.shortName ?? awayParticipant.name,
      homeKey: homeParticipant.key,
      awayKey: awayParticipant.key,
      scheduledStart: gameRow.scheduledStart,
    },
    gameStates: gameStateRows,
  };
}

function gameStateAt(
  gameStates: GameStateRow[],
  timestampMs: number,
  scheduledStartMs: number
): BoardObservationGameState {
  let active: GameStateRow | null = null;
  for (const row of gameStates) {
    const ts = parseTimestampMs(row.capturedAt);
    if (ts == null) continue;
    if (ts <= timestampMs) {
      active = row;
    } else {
      break;
    }
  }
  if (!active) {
    return {
      status: "scheduled",
      period: null,
      clock: null,
      homeScore: null,
      awayScore: null,
      scoreMargin: null,
      minutesToTip: Number.isFinite(scheduledStartMs)
        ? Math.max(0, (scheduledStartMs - timestampMs) / 60_000)
        : null,
    };
  }
  const scoreMargin =
    active.homeScore != null && active.awayScore != null
      ? Math.abs(active.homeScore - active.awayScore)
      : null;
  const minutesToTip =
    active.status === "scheduled" && Number.isFinite(scheduledStartMs)
      ? Math.max(0, (scheduledStartMs - timestampMs) / 60_000)
      : null;
  return {
    status: active.status,
    period: active.period ?? null,
    clock: active.clock ?? null,
    homeScore: active.homeScore ?? null,
    awayScore: active.awayScore ?? null,
    scoreMargin,
    minutesToTip,
  };
}

function buildLabels(
  rawFamily: string | null,
  rawLabel: string | null,
  participantKey: string | null,
  displayLabel: string | null
): BoardObservationLabelTokens {
  const labelTokens = tokenize(rawLabel ?? displayLabel ?? "");
  const participantHints = participantKey
    ? [participantKey]
    : labelTokens.filter((token) => token.length >= 4);
  return {
    rawFamily,
    rawLabel,
    normalizedTokens: labelTokens,
    participantHints,
    statFamilyHints: statFamilyHintFromTokens(labelTokens),
  };
}

function quoteRowToObservation(
  row: QuoteRow,
  gameStates: GameStateRow[],
  scheduledStartMs: number,
  previousProbabilityByMarket: Map<string, number | null>
): BoardObservation | null {
  const capturedMs = parseTimestampMs(row.capturedAt);
  if (capturedMs == null) return null;
  const previousProbability =
    previousProbabilityByMarket.get(row.sourceMarketId) ?? null;
  const impliedProbability = row.impliedProbability ?? null;
  const logitMove =
    previousProbability != null && impliedProbability != null
      ? Math.log(
          Math.min(0.999, Math.max(0.001, impliedProbability)) /
            (1 - Math.min(0.999, Math.max(0.001, impliedProbability)))
        ) -
        Math.log(
          Math.min(0.999, Math.max(0.001, previousProbability)) /
            (1 - Math.min(0.999, Math.max(0.001, previousProbability)))
        )
      : 0;
  previousProbabilityByMarket.set(row.sourceMarketId, impliedProbability);

  const flags: BoardObservationFlags = {
    isUnmapped: row.mappingStatus === "unmapped",
    isHeartbeat: row.isHeartbeat === 1,
    isSuspended: false,
    isStale: false,
  };
  const missing: BoardObservationMissing = {
    impliedProbability: impliedProbability == null,
    line: row.lineRaw == null,
    bestBid: row.bestBid == null,
    bestAsk: row.bestAsk == null,
    volume: row.volume == null,
    depthScore: row.depthScore == null,
    tradePrice: true,
    tradeSize: true,
    participantKey: row.participantKey == null,
  };

  return {
    observationId: `quote:${row.observationId}`,
    gameId: "",
    source: row.source,
    sourceKind: sourceKindFor(row.source),
    sourceMarketId: row.sourceMarketId,
    instrumentId: row.instrumentId,
    family: row.family,
    selection: row.selection,
    participantKey: row.participantKey,
    line: row.line,
    mappingStatus: row.mappingStatus as BoardObservation["mappingStatus"],
    displayLabel: row.displayLabel ?? row.rawLabel ?? row.sourceMarketId,
    labels: buildLabels(
      row.rawFamily,
      row.rawLabel,
      row.participantKey,
      row.displayLabel
    ),
    eventTimestamp: row.capturedAt,
    capturedAt: row.capturedAt,
    quoteAgeMs: 0,
    impliedProbability,
    previousImpliedProbability: previousProbability,
    priceMove: 0,
    lineMove: 0,
    logitMove,
    bestBid: row.bestBid,
    bestAsk: row.bestAsk,
    spread:
      row.bestBid != null && row.bestAsk != null
        ? Math.max(0, row.bestAsk - row.bestBid)
        : null,
    depthScore: row.depthScore,
    volume: row.volume,
    tradePrice: null,
    tradeSize: null,
    notional: null,
    volumeShare: null,
    finalMarketVolume: null,
    flags,
    missing,
    gameState: gameStateAt(gameStates, capturedMs, scheduledStartMs),
  };
}

function microstructureRowToObservation(
  row: MicrostructureRow,
  gameStates: GameStateRow[],
  scheduledStartMs: number
): BoardObservation | null {
  const eventMs =
    parseTimestampMs(row.eventTimestamp) ?? parseTimestampMs(row.capturedAt);
  if (eventMs == null) return null;
  const impliedProbability = row.price ?? row.tradePrice ?? null;
  const previousImpliedProbability = row.previousPrice ?? null;
  const logitMove =
    impliedProbability != null && previousImpliedProbability != null
      ? Math.log(
          Math.min(0.999, Math.max(0.001, impliedProbability)) /
            (1 - Math.min(0.999, Math.max(0.001, impliedProbability)))
        ) -
        Math.log(
          Math.min(0.999, Math.max(0.001, previousImpliedProbability)) /
            (1 - Math.min(0.999, Math.max(0.001, previousImpliedProbability)))
        )
      : 0;
  const flags: BoardObservationFlags = {
    isUnmapped: row.mappingStatus === "unmapped",
    isHeartbeat: false,
    isSuspended: false,
    isStale: false,
  };
  const missing: BoardObservationMissing = {
    impliedProbability: impliedProbability == null,
    line: true,
    bestBid: row.bestBid == null,
    bestAsk: row.bestAsk == null,
    volume: row.volume == null,
    depthScore: row.depthScore == null,
    tradePrice: row.tradePrice == null,
    tradeSize: row.size == null,
    participantKey: row.participantKey == null,
  };
  return {
    observationId: `microstructure:${row.observationId}`,
    gameId: "",
    source: row.source,
    sourceKind: sourceKindFor(row.source),
    sourceMarketId: row.sourceMarketId,
    instrumentId: row.instrumentId,
    family: row.family,
    selection: row.selection,
    participantKey: row.participantKey,
    line: row.line,
    mappingStatus: row.mappingStatus as BoardObservation["mappingStatus"],
    displayLabel: row.displayLabel ?? row.rawLabel ?? row.sourceMarketId,
    labels: buildLabels(
      row.rawFamily,
      row.rawLabel,
      row.participantKey,
      row.displayLabel
    ),
    eventTimestamp: row.eventTimestamp,
    capturedAt: row.capturedAt,
    quoteAgeMs: Math.max(
      0,
      (parseTimestampMs(row.capturedAt) ?? eventMs) - eventMs
    ),
    impliedProbability,
    previousImpliedProbability,
    priceMove: 0,
    lineMove: 0,
    logitMove,
    bestBid: row.bestBid,
    bestAsk: row.bestAsk,
    spread: row.spread,
    depthScore: row.depthScore,
    volume: row.volume,
    tradePrice: row.tradePrice,
    tradeSize: row.size,
    notional: row.notional,
    volumeShare: row.volumeShare,
    finalMarketVolume: row.finalMarketVolume,
    flags,
    missing,
    gameState: gameStateAt(gameStates, eventMs, scheduledStartMs),
  };
}

export type MaterializeBoardObservationsInput = {
  gameId: string;
  windowStart: string;
  windowEnd: string;
};

export function materializeBoardObservations(
  input: MaterializeBoardObservationsInput
): { gameLabel: string; observations: BoardObservation[] } | null {
  return executeDatabaseOperation(
    "board-anomaly.materializeBoardObservations",
    () => {
      const context = loadGameContext(input.gameId);
      if (!context) return null;
      const db = getDatabase();
      const scheduledStartMs =
        parseTimestampMs(context.game.scheduledStart) ?? Number.NaN;

      const quoteRows = db
        .prepare(
          `SELECT
             qt.id AS observationId,
             qt.source_market_id AS sourceMarketId,
             sm.source AS source,
             sm.instrument_id AS instrumentId,
             sm.raw_family AS rawFamily,
             sm.raw_label AS rawLabel,
             sm.mapping_status AS mappingStatus,
             mi.family AS family,
             mi.selection AS selection,
             mi.participant_key AS participantKey,
             mi.line AS line,
             mi.display_label AS displayLabel,
             qt.captured_at AS capturedAt,
             qt.implied_probability AS impliedProbability,
             qt.line_raw AS lineRaw,
             qt.best_bid AS bestBid,
             qt.best_ask AS bestAsk,
             qt.volume AS volume,
             qt.depth_score AS depthScore,
             qt.is_heartbeat AS isHeartbeat
           FROM quote_ticks qt
           JOIN source_markets sm ON sm.id = qt.source_market_id
           LEFT JOIN market_instruments mi ON mi.id = sm.instrument_id
           WHERE sm.game_id = ?
             AND datetime(qt.captured_at) >= datetime(?)
             AND datetime(qt.captured_at) <= datetime(?)
           ORDER BY datetime(qt.captured_at) ASC, qt.id ASC`
        )
        .all(input.gameId, input.windowStart, input.windowEnd) as Omit<
        QuoteRow,
        "observationKind"
      >[];

      const microRows = db
        .prepare(
          `SELECT
             mme.id AS observationId,
             mme.source_market_id AS sourceMarketId,
             mme.source AS source,
             mme.instrument_id AS instrumentId,
             sm.raw_family AS rawFamily,
             sm.raw_label AS rawLabel,
             sm.mapping_status AS mappingStatus,
             mi.family AS family,
             mi.selection AS selection,
             mi.participant_key AS participantKey,
             mi.line AS line,
             mi.display_label AS displayLabel,
             mme.event_type AS eventType,
             mme.api_surface AS apiSurface,
             mme.event_timestamp AS eventTimestamp,
             mme.captured_at AS capturedAt,
             mme.price AS price,
             mme.previous_price AS previousPrice,
             mme.trade_price AS tradePrice,
             mme.size AS size,
             mme.notional AS notional,
             mme.volume AS volume,
             mme.final_market_volume AS finalMarketVolume,
             mme.volume_share AS volumeShare,
             mme.best_bid AS bestBid,
             mme.best_ask AS bestAsk,
             mme.spread AS spread,
             mme.depth_score AS depthScore
           FROM market_microstructure_events mme
           JOIN source_markets sm ON sm.id = mme.source_market_id
           LEFT JOIN market_instruments mi ON mi.id = mme.instrument_id
           WHERE mme.game_id = ?
             AND datetime(mme.event_timestamp) >= datetime(?)
             AND datetime(mme.event_timestamp) <= datetime(?)
           ORDER BY datetime(mme.event_timestamp) ASC, mme.id ASC`
        )
        .all(input.gameId, input.windowStart, input.windowEnd) as Omit<
        MicrostructureRow,
        "observationKind"
      >[];

      const previousProbabilityByMarket = new Map<string, number | null>();
      const observations: BoardObservation[] = [];

      for (const row of quoteRows) {
        const observation = quoteRowToObservation(
          { ...row, observationKind: "quote" } as QuoteRow,
          context.gameStates,
          scheduledStartMs,
          previousProbabilityByMarket
        );
        if (!observation) continue;
        observation.gameId = input.gameId;
        observations.push(observation);
      }

      for (const row of microRows) {
        const observation = microstructureRowToObservation(
          { ...row, observationKind: "microstructure" } as MicrostructureRow,
          context.gameStates,
          scheduledStartMs
        );
        if (!observation) continue;
        observation.gameId = input.gameId;
        observations.push(observation);
      }

      const windowEndMs = parseTimestampMs(input.windowEnd);
      if (windowEndMs != null) {
        for (const observation of observations) {
          const eventMs =
            parseTimestampMs(observation.eventTimestamp) ??
            parseTimestampMs(observation.capturedAt);
          if (eventMs == null) continue;
          const age = windowEndMs - eventMs;
          observation.quoteAgeMs = Math.max(0, age);
          if (age >= STALE_QUOTE_AGE_MS) {
            observation.flags = { ...observation.flags, isStale: true };
          }
        }
      }

      const gameLabel = `${context.game.awayName} @ ${context.game.homeName}`;
      return { gameLabel, observations };
    },
    input
  );
}

export type DetectBoardAnomaliesForGameInput = {
  gameId: string;
  now: string;
  contextWindowMinutes?: number;
  config?: Partial<BoardAnomalyDetectorConfig>;
};

export function detectBoardAnomaliesForGame(
  input: DetectBoardAnomaliesForGameInput
): BoardAnomalyAlert[] {
  const nowMs = parseTimestampMs(input.now);
  if (nowMs == null) return [];
  const contextMinutes = input.contextWindowMinutes ?? 30;
  const windowStart = new Date(nowMs - contextMinutes * 60_000).toISOString();
  const materialized = materializeBoardObservations({
    gameId: input.gameId,
    windowStart,
    windowEnd: input.now,
  });
  if (!materialized) return [];
  return detectBoardAnomaliesPure({
    gameId: input.gameId,
    gameLabel: materialized.gameLabel,
    observations: materialized.observations,
    now: input.now,
    config: input.config,
  });
}

export type ReplayBoardAnomaliesForGameInput = {
  gameId: string;
  windowStart: string;
  windowEnd: string;
  stepSeconds?: number;
  ingestionLatencyBufferSeconds?: number;
  config?: Partial<BoardAnomalyDetectorConfig>;
};

export function replayBoardAnomaliesForGame(
  input: ReplayBoardAnomaliesForGameInput
): BoardAnomalyReplayOutput | null {
  const materialized = materializeBoardObservations({
    gameId: input.gameId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
  });
  if (!materialized) return null;
  return replayBoardAnomaliesPure({
    gameId: input.gameId,
    gameLabel: materialized.gameLabel,
    observations: materialized.observations,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    stepSeconds: input.stepSeconds,
    ingestionLatencyBufferSeconds: input.ingestionLatencyBufferSeconds,
    config: input.config,
  });
}

export type PlayByPlayContext = {
  available: boolean;
  totalActions: number;
  nearestBefore: PlayByPlayAnchor | null;
  nearestAfter: PlayByPlayAnchor | null;
};

export type PlayByPlayAnchor = {
  actionNumber: number;
  actionType: string | null;
  period: number | null;
  clock: string | null;
  description: string | null;
  teamTricode: string | null;
  timeActual: string | null;
  offsetSeconds: number | null;
};

function rowToAnchor(
  row: Record<string, unknown> | undefined,
  referenceMs: number | null
): PlayByPlayAnchor | null {
  if (!row) return null;
  const actionNumber = Number(row.actionNumber);
  if (!Number.isFinite(actionNumber)) return null;
  const timeActual = row.timeActual == null ? null : String(row.timeActual);
  const offsetSeconds =
    timeActual && referenceMs != null
      ? Math.round((referenceMs - Date.parse(timeActual)) / 1000)
      : null;
  return {
    actionNumber,
    actionType: row.actionType == null ? null : String(row.actionType),
    period: row.period == null ? null : Number(row.period),
    clock: row.clock == null ? null : String(row.clock),
    description: row.description == null ? null : String(row.description),
    teamTricode: row.teamTricode == null ? null : String(row.teamTricode),
    timeActual,
    offsetSeconds: Number.isFinite(offsetSeconds ?? NaN) ? offsetSeconds : null,
  };
}

export function getPlayByPlayContext(
  gameId: string,
  referenceIso: string
): PlayByPlayContext {
  return executeDatabaseOperation(
    "board-anomaly.getPlayByPlayContext",
    () => {
      const db = getDatabase();
      const totalRow = db
        .prepare(
          `SELECT COUNT(*) AS total FROM nba_play_by_play_actions WHERE game_id = ?`
        )
        .get(gameId) as { total: number } | undefined;
      const total = totalRow?.total ?? 0;
      if (total === 0) {
        return {
          available: false,
          totalActions: 0,
          nearestBefore: null,
          nearestAfter: null,
        };
      }
      const referenceMs = parseTimestampMs(referenceIso);
      const before = db
        .prepare(
          `SELECT
             action_number AS actionNumber,
             action_type AS actionType,
             period,
             clock,
             description,
             team_tricode AS teamTricode,
             time_actual AS timeActual
           FROM nba_play_by_play_actions
           WHERE game_id = ?
             AND time_actual IS NOT NULL
             AND datetime(time_actual) <= datetime(?)
           ORDER BY datetime(time_actual) DESC, action_number DESC
           LIMIT 1`
        )
        .get(gameId, referenceIso) as Record<string, unknown> | undefined;
      const after = db
        .prepare(
          `SELECT
             action_number AS actionNumber,
             action_type AS actionType,
             period,
             clock,
             description,
             team_tricode AS teamTricode,
             time_actual AS timeActual
           FROM nba_play_by_play_actions
           WHERE game_id = ?
             AND time_actual IS NOT NULL
             AND datetime(time_actual) > datetime(?)
           ORDER BY datetime(time_actual) ASC, action_number ASC
           LIMIT 1`
        )
        .get(gameId, referenceIso) as Record<string, unknown> | undefined;
      return {
        available: true,
        totalActions: total,
        nearestBefore: rowToAnchor(before, referenceMs),
        nearestAfter: rowToAnchor(after, referenceMs),
      };
    },
    { gameId, referenceIso }
  );
}

export type VigAdjustedSide = {
  source: "bet365" | "kalshi" | "polymarket";
  rawAskProbability: number | null;
  rawOppositeAskProbability: number | null;
  vigPercent: number | null;
  fairProbability: number | null;
  twoSided: boolean;
  note: string;
};

export type VigAdjustedComparison = {
  instrumentOverId: string;
  instrumentUnderId: string | null;
  rawGap: number;
  fairGap: number | null;
  sides: VigAdjustedSide[];
  honestRead: string;
};

export type FinishedGameIncident = BoardAnomalyAlert & {
  playByPlay: PlayByPlayContext;
  vigAdjusted: VigAdjustedComparison | null;
};

export type EventContextTradeRow = {
  eventTimestamp: string;
  source: string;
  sourceMarketKey: string;
  displayLabel: string | null;
  family: string | null;
  apiSurface: string;
  tradePrice: number | null;
  price: number | null;
  size: number | null;
  notional: number | null;
  volumeShare: number | null;
  finalMarketVolume: number | null;
  offsetSeconds: number;
};

export type EventContextPbpRow = {
  actionNumber: number;
  timeActual: string | null;
  period: number | null;
  clock: string | null;
  description: string | null;
  teamTricode: string | null;
  offsetSeconds: number | null;
};

export type EventContextOutput = {
  gameId: string;
  gameLabel: string;
  anchorAt: string;
  windowStart: string;
  windowEnd: string;
  trades: EventContextTradeRow[];
  playByPlay: EventContextPbpRow[];
};

export function getBoardAlertEventContext(input: {
  gameId: string;
  anchorAt: string;
  windowSecondsBefore?: number;
  windowSecondsAfter?: number;
  limit?: number;
}): EventContextOutput {
  return executeDatabaseOperation(
    "board-anomaly.getBoardAlertEventContext",
    () => {
      const db = getDatabase();
      const anchorMs = parseTimestampMs(input.anchorAt);
      if (anchorMs == null) {
        throw new Error(`Invalid anchorAt: ${input.anchorAt}`);
      }
      const before = (input.windowSecondsBefore ?? 7200) * 1000;
      const after = (input.windowSecondsAfter ?? 3600) * 1000;
      const startIso = new Date(anchorMs - before).toISOString();
      const endIso = new Date(anchorMs + after).toISOString();

      const gameRow = db
        .prepare(
          `SELECT
             g.id AS id,
             g.home_participant_json AS homeJson,
             g.away_participant_json AS awayJson
           FROM games g
           WHERE g.id = ?`
        )
        .get(input.gameId) as
        | { id: string; homeJson: string; awayJson: string }
        | undefined;
      let gameLabel = input.gameId;
      if (gameRow) {
        const home = JSON.parse(gameRow.homeJson) as {
          shortName?: string;
          name?: string;
        };
        const away = JSON.parse(gameRow.awayJson) as {
          shortName?: string;
          name?: string;
        };
        gameLabel = `${away.shortName ?? away.name ?? "Away"} @ ${
          home.shortName ?? home.name ?? "Home"
        }`;
      }

      const limit = Math.max(1, Math.min(200, input.limit ?? 60));
      const tradeRows = db
        .prepare(
          `SELECT
             mme.event_timestamp AS eventTimestamp,
             mme.source AS source,
             sm.source_market_key AS sourceMarketKey,
             mi.display_label AS displayLabel,
             mi.family AS family,
             mme.api_surface AS apiSurface,
             mme.trade_price AS tradePrice,
             mme.price AS price,
             mme.size AS size,
             mme.notional AS notional,
             mme.volume_share AS volumeShare,
             mme.final_market_volume AS finalMarketVolume
           FROM market_microstructure_events mme
           JOIN source_markets sm ON sm.id = mme.source_market_id
           LEFT JOIN market_instruments mi ON mi.id = mme.instrument_id
           WHERE mme.game_id = ?
             AND mme.event_type = 'trade'
             AND datetime(mme.event_timestamp) >= datetime(?)
             AND datetime(mme.event_timestamp) <= datetime(?)
           ORDER BY datetime(mme.event_timestamp) ASC, mme.id ASC
           LIMIT ?`
        )
        .all(input.gameId, startIso, endIso, limit) as Array<
        Omit<EventContextTradeRow, "offsetSeconds">
      >;
      const trades: EventContextTradeRow[] = tradeRows.map((row) => {
        const ts = parseTimestampMs(row.eventTimestamp);
        const offsetSeconds = ts != null ? Math.round((ts - anchorMs) / 1000) : 0;
        return { ...row, offsetSeconds };
      });

      const pbpRows = db
        .prepare(
          `SELECT
             action_number AS actionNumber,
             time_actual AS timeActual,
             period,
             clock,
             description,
             team_tricode AS teamTricode
           FROM nba_play_by_play_actions
           WHERE game_id = ?
             AND time_actual IS NOT NULL
             AND datetime(time_actual) >= datetime(?)
             AND datetime(time_actual) <= datetime(?)
           ORDER BY datetime(time_actual) ASC, action_number ASC
           LIMIT ?`
        )
        .all(input.gameId, startIso, endIso, limit) as Array<{
        actionNumber: number;
        timeActual: string | null;
        period: number | null;
        clock: string | null;
        description: string | null;
        teamTricode: string | null;
      }>;
      const playByPlay: EventContextPbpRow[] = pbpRows.map((row) => {
        const ts = row.timeActual ? parseTimestampMs(row.timeActual) : null;
        return {
          ...row,
          offsetSeconds:
            ts != null ? Math.round((ts - anchorMs) / 1000) : null,
        };
      });

      return {
        gameId: input.gameId,
        gameLabel,
        anchorAt: input.anchorAt,
        windowStart: startIso,
        windowEnd: endIso,
        trades,
        playByPlay,
      };
    },
    input
  );
}

export type ListFinishedGameIncidentsInput = {
  date: string;
  minGap?: number;
  limit?: number;
};

function buildIncidentReason(row: SignalMismatchRow): string {
  const gapPp = Math.round((row.impliedProbabilityGap ?? 0) * 1000) / 10;
  const summary = row.comparisonSummary;
  const aboveMs = summary?.aboveThresholdDurationMs ?? 0;
  const aboveText =
    aboveMs > 60_000
      ? ` and stayed above the threshold for ${formatDuration(aboveMs)}`
      : "";
  const sides: string[] = [];
  if (row.bet365ImpliedProbability != null) {
    sides.push(`Bet365 ${(row.bet365ImpliedProbability * 100).toFixed(1)}%`);
  }
  if (row.kalshiImpliedProbability != null) {
    sides.push(`Kalshi ${(row.kalshiImpliedProbability * 100).toFixed(1)}%`);
  }
  if (row.polymarketImpliedProbability != null) {
    sides.push(
      `Polymarket ${(row.polymarketImpliedProbability * 100).toFixed(1)}%`
    );
  }
  const directional = row.directionalDisagreement
    ? " · directional disagreement"
    : "";
  const lineMismatch = row.lineMismatch ? " · line mismatch" : "";
  return `${row.displayLabel}: ${gapPp.toFixed(1)}pp peak (${sides.join(
    " vs "
  )})${directional}${lineMismatch}${aboveText}.`;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h${minutes}m`;
}

function classifyIncidentKind(
  row: SignalMismatchRow,
  hasPbpAnchor: boolean
): BoardAnomalyShockKind {
  if (
    row.gameStatus === "scheduled" ||
    (row.comparisonSummary?.firstAboveThresholdAt &&
      Date.parse(row.scheduledStart) >
        Date.parse(row.comparisonSummary.firstAboveThresholdAt))
  ) {
    return "pregame-availability";
  }
  if (hasPbpAnchor) {
    return "attribution-shaped";
  }
  return "cross-surface-disagreement";
}

function findOppositeInstrumentId(instrumentId: string): string | null {
  const overIndex = instrumentId.lastIndexOf("-over-");
  if (overIndex !== -1) {
    return (
      instrumentId.slice(0, overIndex) +
      "-under-" +
      instrumentId.slice(overIndex + "-over-".length)
    );
  }
  const underIndex = instrumentId.lastIndexOf("-under-");
  if (underIndex !== -1) {
    return (
      instrumentId.slice(0, underIndex) +
      "-over-" +
      instrumentId.slice(underIndex + "-under-".length)
    );
  }
  return null;
}

function latestImpliedProbability(
  db: ReturnType<typeof getDatabase>,
  instrumentId: string,
  source: "bet365" | "kalshi" | "polymarket",
  beforeIso: string
): number | null {
  const row = db
    .prepare(
      `SELECT qt.implied_probability AS p
       FROM quote_ticks qt
       JOIN source_markets sm ON sm.id = qt.source_market_id
       WHERE sm.source = ?
         AND sm.instrument_id = ?
         AND qt.is_heartbeat = 0
         AND qt.implied_probability IS NOT NULL
         AND datetime(qt.captured_at) <= datetime(?)
       ORDER BY datetime(qt.captured_at) DESC, qt.id DESC
       LIMIT 1`
    )
    .get(source, instrumentId, beforeIso) as { p: number } | undefined;
  return row?.p ?? null;
}

function buildVigAdjustedComparison(
  db: ReturnType<typeof getDatabase>,
  row: SignalMismatchRow
): VigAdjustedComparison | null {
  if (row.family !== "player-prop" && row.family !== "team-prop") {
    if (row.family !== "moneyline") return null;
  }
  const referenceTimestamp =
    row.comparisonSummary?.maxGapAt ??
    row.comparisonSummary?.firstAboveThresholdAt ??
    row.comparisonSummary?.latestComparisonAt ??
    new Date().toISOString();
  const oppositeId = findOppositeInstrumentId(row.instrumentId);

  const sides: VigAdjustedSide[] = [];
  const sourcesToConsider: Array<"bet365" | "kalshi" | "polymarket"> = [
    "bet365",
    "kalshi",
    "polymarket",
  ];
  let fairOverFromAnySource: number | null = null;
  let fairOpposite: number | null = null;

  for (const source of sourcesToConsider) {
    const overP = latestImpliedProbability(
      db,
      row.instrumentId,
      source,
      referenceTimestamp
    );
    if (overP == null) continue;
    const underP = oppositeId
      ? latestImpliedProbability(db, oppositeId, source, referenceTimestamp)
      : null;
    if (underP != null) {
      const totalImplied = overP + underP;
      const vigPercent = (totalImplied - 1) * 100;
      const fair = overP / totalImplied;
      sides.push({
        source,
        rawAskProbability: Number(overP.toFixed(5)),
        rawOppositeAskProbability: Number(underP.toFixed(5)),
        vigPercent: Number(vigPercent.toFixed(2)),
        fairProbability: Number(fair.toFixed(5)),
        twoSided: true,
        note: `over ask ${(overP * 100).toFixed(1)}% / under ask ${(underP * 100).toFixed(1)}% → vig ${vigPercent.toFixed(2)}%, fair over ${(fair * 100).toFixed(1)}%`,
      });
      if (source === "bet365") {
        fairOverFromAnySource = fair;
      } else if (fairOverFromAnySource == null) {
        fairOverFromAnySource = fair;
      }
    } else {
      sides.push({
        source,
        rawAskProbability: Number(overP.toFixed(5)),
        rawOppositeAskProbability: null,
        vigPercent: null,
        fairProbability: null,
        twoSided: false,
        note: `over-side only (${(overP * 100).toFixed(1)}%); cannot de-vig — raw gap may include ~4–8% bookmaker vig`,
      });
      if (source === "polymarket" || source === "kalshi") {
        if (fairOpposite == null) fairOpposite = overP;
      }
      if (source === "bet365" && fairOverFromAnySource == null) {
        fairOverFromAnySource = overP;
      }
    }
  }

  if (sides.length < 2) return null;

  const fairBet365 = sides.find(
    (side) => side.source === "bet365" && side.fairProbability != null
  )?.fairProbability;
  const exchangeRefSide = sides.find(
    (side) =>
      (side.source === "polymarket" || side.source === "kalshi") &&
      (side.fairProbability != null || side.rawAskProbability != null)
  );
  const exchangeRef =
    exchangeRefSide?.fairProbability ??
    exchangeRefSide?.rawAskProbability ??
    null;

  const fairGap =
    fairBet365 != null && exchangeRef != null
      ? Math.abs(fairBet365 - exchangeRef)
      : null;

  const rawGap = row.impliedProbabilityGap ?? 0;

  let honestRead: string;
  if (fairGap == null) {
    honestRead = `Raw ask-vs-ask gap ${(rawGap * 100).toFixed(1)}pp. Cannot de-vig (only one side available on at least one source). Treat the gap as an upper bound — bookmaker vig typically inflates by 4–8pp.`;
  } else {
    const inflated = (rawGap - fairGap) * 100;
    if (inflated > 0.5) {
      honestRead = `Raw ${(rawGap * 100).toFixed(1)}pp → vig-adjusted ${(fairGap * 100).toFixed(1)}pp (vig inflated by ${inflated.toFixed(1)}pp). Real disagreement is the vig-adjusted figure.`;
    } else if (inflated < -0.5) {
      honestRead = `Raw ${(rawGap * 100).toFixed(1)}pp → vig-adjusted ${(fairGap * 100).toFixed(1)}pp (vig direction does not help; both sides priced tightly). The gap is real.`;
    } else {
      honestRead = `Raw ${(rawGap * 100).toFixed(1)}pp ≈ vig-adjusted ${(fairGap * 100).toFixed(1)}pp. Vig is small on both sides; the gap is real.`;
    }
  }

  return {
    instrumentOverId: row.instrumentId,
    instrumentUnderId: oppositeId,
    rawGap: Number(rawGap.toFixed(5)),
    fairGap: fairGap == null ? null : Number(fairGap.toFixed(5)),
    sides,
    honestRead,
  };
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function buildMarketStructureReason(alert: MarketAnomalyAlert): string {
  const parts: string[] = [];
  parts.push(`${alert.displayLabel} (${alert.source})`);
  const m = alert.metrics;
  if (m.tradePrice != null) {
    const note =
      m.referencePrice != null
        ? ` vs reference ${formatNumber(m.referencePrice, 3)} (off-price ${formatNumber(m.tradeDistance, 3)})`
        : "";
    parts.push(`trade ${formatNumber(m.tradePrice, 3)}${note}`);
  }
  if (m.size != null) {
    parts.push(`size ${formatNumber(m.size, 2)}`);
  }
  if (m.notional != null) {
    parts.push(`notional $${formatNumber(m.notional, 2)}`);
  }
  if (m.volumeShare != null) {
    const shareSource =
      m.finalMarketVolume != null ? "FINAL-volume (forensic)" : "live-to-date";
    parts.push(
      `${(m.volumeShare * 100).toFixed(1)}% volume share [${shareSource}]`
    );
  }
  if (m.spread != null && alert.source !== "bet365") {
    parts.push(`spread ${formatNumber(m.spread, 3)}`);
  }
  const labels = alert.labels.length > 0 ? ` · ${alert.labels.join(", ")}` : "";
  return `${parts.join(" · ")}${labels}.`;
}

function marketAnomalyToBoardCard(
  alert: MarketAnomalyAlert,
  pbp: PlayByPlayContext,
  candleEnd: boolean
): FinishedGameIncident {
  const surface = alert.apiSurface.toLowerCase();
  const isCandle = candleEnd || surface.includes("candle");
  const evidence = [
    {
      observationId: `microstructure:${alert.id}`,
      source: alert.source,
      sourceKind:
        alert.source === "bet365"
          ? ("sportsbook" as const)
          : ("prediction-market" as const),
      family: alert.family ?? null,
      participantKey: null,
      displayLabel: alert.displayLabel,
      contribution: Number((alert.score / 100).toFixed(3)),
      reason: alert.labels.join(", ") || alert.apiSurface,
      evidenceUnmapped: alert.mappingStatus === "unmapped",
    },
  ];

  const drivers: string[] = [];
  if (isCandle) {
    drivers.push("candle-end, not executable");
  }
  if (alert.metrics.finalMarketVolume != null) {
    drivers.push(
      "volume-share computed against FINAL market volume (forensic, not live)"
    );
  }
  if (!pbp.available) {
    drivers.push("no play-by-play available");
  }

  return {
    id: `incident:${alert.gameId}:market-structure:${alert.id}`,
    gameId: alert.gameId,
    gameLabel: alert.gameLabel,
    shockKind: "market-structure",
    firstPopAt: alert.eventTimestamp,
    detectedAt: new Date().toISOString(),
    score: alert.score,
    confidence: alert.confidence,
    severity: alert.severity,
    reason: buildMarketStructureReason(alert),
    primaryEntityKey: null,
    primaryFamily: (alert.family ?? null) as MarketFamily | null,
    components: {
      residual: Number(
        ((alert.components.offPrice + alert.components.volatility) / 2).toFixed(
          3
        )
      ),
      microstructure: Number(
        (
          (alert.components.crossVenue +
            alert.components.liquidity +
            alert.components.offPrice +
            alert.components.volatility +
            alert.components.volumeShare) /
          5
        ).toFixed(3)
      ),
      coherence: 0,
      coverage: 0,
    },
    h0Adjustments: {
      appliedSuppression: 0,
      drivers,
    },
    evidence,
    missingDataNotes: pbp.available
      ? []
      : [
          {
            source: "nba",
            reason: "no play-by-play actions captured for this game",
          },
        ],
    inspect: {
      payloadVersion: 1,
      instrumentIds: alert.instrumentId ? [alert.instrumentId] : [],
      sourceMarketIds: [alert.sourceMarketId],
      relationFamilies: alert.family ? [alert.family] : [],
    },
    playByPlay: pbp,
    vigAdjusted: null,
  };
}

export function listFinishedGameIncidents(
  input: ListFinishedGameIncidentsInput
): FinishedGameIncident[] {
  return executeDatabaseOperation(
    "board-anomaly.listFinishedGameIncidents",
    () => {
      const db = getDatabase();
      const mismatches = listSignalMismatches({
        date: input.date,
        sort: "divergence",
        limit: 200,
      });
      const minGap = input.minGap ?? 0.15;
      const filtered = mismatches.filter(
        (row) => (row.impliedProbabilityGap ?? 0) >= minGap
      );
      const minMarketStructureNotional = 20;

      const byGame = new Map<string, SignalMismatchRow[]>();
      for (const row of filtered) {
        const list = byGame.get(row.gameId) ?? [];
        list.push(row);
        byGame.set(row.gameId, list);
      }

      const incidents: FinishedGameIncident[] = [];
      for (const [gameId, rows] of byGame.entries()) {
        rows.sort(
          (a, b) =>
            (b.impliedProbabilityGap ?? 0) - (a.impliedProbabilityGap ?? 0)
        );
        const headline = rows[0];
        const summary = headline.comparisonSummary;
        const firstPopAt =
          summary?.firstAboveThresholdAt ??
          summary?.maxGapAt ??
          headline.scheduledStart;
        const pbp = getPlayByPlayContext(gameId, firstPopAt);
        const peakGap = headline.impliedProbabilityGap ?? 0;
        const aboveMs = summary?.aboveThresholdDurationMs ?? 0;
        const score = Math.min(
          100,
          Math.max(
            0,
            Math.round(peakGap * 100 * 2 + Math.min(20, aboveMs / 60000))
          )
        );
        const sustainedBonus = aboveMs >= 30 * 60_000 ? 0.05 : 0;
        const confidence = Math.min(
          0.95,
          0.55 + peakGap * 0.6 + sustainedBonus
        );
        const reason = buildIncidentReason(headline);
        const hasPbpAnchor =
          pbp.available && pbp.nearestBefore?.timeActual != null;
        const shockKind = classifyIncidentKind(headline, hasPbpAnchor);

        const evidence = rows.slice(0, 8).map((row) => ({
          observationId: `instrument:${row.instrumentId}`,
          source: (row.sources?.[0] ?? "bet365") as
            | "bet365"
            | "kalshi"
            | "polymarket",
          sourceKind:
            row.sources?.[0] === "bet365"
              ? ("sportsbook" as const)
              : ("prediction-market" as const),
          family: row.family,
          participantKey: null,
          displayLabel: row.displayLabel,
          contribution: Number(
            Math.min(1, (row.impliedProbabilityGap ?? 0) * 2).toFixed(3)
          ),
          reason: `${((row.impliedProbabilityGap ?? 0) * 100).toFixed(1)}pp gap`,
          evidenceUnmapped: row.mappingStatus === "unmapped",
        }));

        const inspectInstrumentIds = rows.map((row) => row.instrumentId);
        const inspectSourceMarkets: string[] = [];
        const inspectRelationFamilies = Array.from(
          new Set(rows.map((row) => row.family ?? "other"))
        );

        const alert: BoardAnomalyAlert = {
          id: `incident:${gameId}:${firstPopAt}`,
          gameId,
          gameLabel: headline.gameLabel,
          shockKind,
          firstPopAt,
          detectedAt: new Date().toISOString(),
          score,
          confidence: Number(confidence.toFixed(3)),
          severity: scoreToSeverity(score),
          reason,
          primaryEntityKey: null,
          primaryFamily: (headline.family ?? null) as MarketFamily | null,
          components: {
            residual: Number(Math.min(1, peakGap * 2).toFixed(3)),
            microstructure: 0,
            coherence: Number(Math.min(1, rows.length / 4).toFixed(3)),
            coverage: 0,
          },
          h0Adjustments: {
            appliedSuppression: 0,
            drivers: hasPbpAnchor ? [] : ["no play-by-play available"],
          },
          evidence,
          missingDataNotes: pbp.available
            ? []
            : [
                {
                  source: "nba" as const,
                  reason: "no play-by-play actions captured for this game",
                },
              ],
          inspect: {
            payloadVersion: 1 as const,
            instrumentIds: inspectInstrumentIds,
            sourceMarketIds: inspectSourceMarkets,
            relationFamilies: inspectRelationFamilies,
          },
        };
        const vigAdjusted = buildVigAdjustedComparison(db, headline);
        incidents.push({ ...alert, playByPlay: pbp, vigAdjusted });
      }

      const marketAnomalies = listMarketAnomalyAlerts({
        date: input.date,
        limit: 50,
        includeUnmapped: true,
        includeHistorical: true,
        skipQuoteAnomalies: true,
      });
      const anomaliesByGame = new Map<string, MarketAnomalyAlert[]>();
      for (const anomaly of marketAnomalies) {
        const list = anomaliesByGame.get(anomaly.gameId) ?? [];
        list.push(anomaly);
        anomaliesByGame.set(anomaly.gameId, list);
      }
      for (const [gameId, anomalies] of anomaliesByGame.entries()) {
        const sized = anomalies.filter(
          (a) => (a.metrics.notional ?? 0) >= minMarketStructureNotional
        );
        sized.sort((a, b) => {
          const aNotional = a.metrics.notional ?? 0;
          const bNotional = b.metrics.notional ?? 0;
          if (bNotional !== aNotional) return bNotional - aNotional;
          const aShare = a.metrics.volumeShare ?? 0;
          const bShare = b.metrics.volumeShare ?? 0;
          return bShare - aShare;
        });
        const top = sized.slice(0, 6);
        for (const anomaly of top) {
          const pbp = getPlayByPlayContext(gameId, anomaly.eventTimestamp);
          const surface = anomaly.apiSurface.toLowerCase();
          const candleEnd = surface.includes("candle");
          incidents.push(marketAnomalyToBoardCard(anomaly, pbp, candleEnd));
        }
      }

      incidents.sort((a, b) => b.score - a.score);
      const limit = Math.max(1, Math.min(50, input.limit ?? 10));
      return incidents.slice(0, limit);
    },
    input
  );
}

export type ListBoardAnomaliesAcrossGamesInput = {
  now: string;
  contextWindowMinutes?: number;
  gameIds?: string[];
  limit?: number;
  config?: Partial<BoardAnomalyDetectorConfig>;
};

export function listBoardAnomaliesAcrossGames(
  input: ListBoardAnomaliesAcrossGamesInput
): BoardAnomalyAlert[] {
  return executeDatabaseOperation(
    "board-anomaly.listAcrossGames",
    () => {
      const db = getDatabase();
      const nowMs = parseTimestampMs(input.now);
      if (nowMs == null) return [];
      const lookbackMs = (input.contextWindowMinutes ?? 30) * 60_000;
      const sinceIso = new Date(nowMs - lookbackMs).toISOString();
      let gameIds = input.gameIds;
      if (!gameIds || gameIds.length === 0) {
        gameIds = db
          .prepare(
            `SELECT DISTINCT g.id AS id
             FROM games g
             WHERE EXISTS (
               SELECT 1
               FROM quote_ticks qt
               JOIN source_markets sm ON sm.id = qt.source_market_id
               WHERE sm.game_id = g.id
                 AND datetime(qt.captured_at) >= datetime(?)
             )
             ORDER BY g.scheduled_start DESC
             LIMIT 25`
          )
          .all(sinceIso)
          .map((row) => (row as { id: string }).id);
      }
      const alerts: BoardAnomalyAlert[] = [];
      for (const gameId of gameIds) {
        const gameAlerts = detectBoardAnomaliesForGame({
          gameId,
          now: input.now,
          contextWindowMinutes: input.contextWindowMinutes,
          config: input.config,
        });
        alerts.push(...gameAlerts);
      }
      alerts.sort((a, b) => b.score - a.score);
      const limit = Math.max(1, Math.min(50, input.limit ?? 10));
      return alerts.slice(0, limit);
    },
    input
  );
}
