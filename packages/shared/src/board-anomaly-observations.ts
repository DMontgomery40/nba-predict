import type { BoardObservation } from "@signal-console/domain";

import { loadGameContext } from "./board-anomaly-observation-context";
import {
  microstructureRowToObservation,
  quoteRowToObservation,
  type MicrostructureRow,
  type QuoteRow,
} from "./board-anomaly-observation-converters";
import { parseTimestampMs } from "./board-anomaly-support";
import { executeDatabaseOperation, getDatabase } from "./db-core";

const STALE_QUOTE_AGE_MS = 10 * 60_000;

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
             COALESCE(
               qt.implied_probability,
               CASE WHEN qt.price_raw BETWEEN 0 AND 1 THEN qt.price_raw END
             ) AS impliedProbability,
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
             AND qt.captured_at >= ?
             AND qt.captured_at <= ?
             AND qt.is_heartbeat = 0
             AND COALESCE(
               qt.implied_probability,
               CASE WHEN qt.price_raw BETWEEN 0 AND 1 THEN qt.price_raw END
             ) IS NOT NULL
           ORDER BY qt.captured_at ASC, qt.id ASC`
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
             CASE
               WHEN mme.volume_share >= 0 AND mme.volume_share <= 1 THEN mme.volume_share
               ELSE NULL
             END AS volumeShare,
             mme.best_bid AS bestBid,
             mme.best_ask AS bestAsk,
             mme.spread AS spread,
             mme.depth_score AS depthScore
           FROM market_microstructure_events mme
           JOIN source_markets sm ON sm.id = mme.source_market_id
           LEFT JOIN market_instruments mi ON mi.id = mme.instrument_id
           WHERE mme.game_id = ?
             AND mme.event_timestamp >= ?
             AND mme.event_timestamp <= ?
           ORDER BY mme.event_timestamp ASC, mme.id ASC`
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
        if (
          Math.abs(observation.logitMove ?? 0) < 1e-6 &&
          Math.abs(observation.lineMove ?? 0) < 1e-6 &&
          observation.sourceKind !== "prediction-market"
        ) {
          continue;
        }
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
