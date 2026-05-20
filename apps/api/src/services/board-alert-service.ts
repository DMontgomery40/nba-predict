import {
  getBoardAlertEventContext,
  listBoardAnomaliesAcrossGames,
  listGameStateVolatilityAcrossGames,
  replayBoardAnomaliesForGame,
} from "@signal-console/shared";

import { getBoardAnomalyIncidentsPayload } from "./board-alert-incident-payload";
import {
  buildBoardAlertWindowQuery,
  type BoardAlertsQuery,
  type BoardAlertsReplayQuery,
  type BoardEventContextQuery,
} from "./board-alert-service-support";
import { ensureNbaPlayByPlayPersisted } from "./nba-sidecar-service";
import {
  createServiceLogger,
  generatedMeta,
  getLogger,
  type ServiceContext,
} from "./service-support";

const boardAlertsLogger = createServiceLogger("board-alert-service");

export function getBoardAnomalyAlertsPayload(
  query: BoardAlertsQuery,
  context?: ServiceContext
) {
  const logger = getLogger(
    boardAlertsLogger,
    context,
    "getBoardAnomalyAlertsPayload"
  );
  const windowQuery = buildBoardAlertWindowQuery(query);
  const data = listBoardAnomaliesAcrossGames(windowQuery);
  logger.debug(
    { count: data.length, now: windowQuery.now },
    "Built trader incident payload."
  );
  return {
    data,
    meta: { ...generatedMeta(), now: windowQuery.now },
  };
}

export function getBoardGameStateVolatilityPayload(
  query: BoardAlertsQuery,
  context?: ServiceContext
) {
  const logger = getLogger(
    boardAlertsLogger,
    context,
    "getBoardGameStateVolatilityPayload"
  );
  const windowQuery = buildBoardAlertWindowQuery(query);
  const data = listGameStateVolatilityAcrossGames(windowQuery);
  logger.debug(
    { count: data.length, now: windowQuery.now },
    "Built board tripwire payload."
  );
  return {
    data,
    meta: { ...generatedMeta(), now: windowQuery.now },
  };
}

export { getBoardAnomalyIncidentsPayload };

export async function getBoardAnomalyEventContextPayload(
  query: BoardEventContextQuery,
  context?: ServiceContext
) {
  const logger = getLogger(
    boardAlertsLogger,
    context,
    "getBoardAnomalyEventContextPayload"
  );
  let hydration: {
    actionsSeen: number;
    actionsWritten: number;
    error: string | null;
    hydrated: boolean;
    persistedCountAfter: number | null;
  } = {
    actionsSeen: 0,
    actionsWritten: 0,
    error: null,
    hydrated: false,
    persistedCountAfter: null,
  };
  try {
    const result = await ensureNbaPlayByPlayPersisted(query.gameId);
    hydration = {
      ...result,
      error: null,
    };
  } catch (error) {
    hydration = {
      actionsSeen: 0,
      actionsWritten: 0,
      error: error instanceof Error ? error.message : String(error),
      hydrated: false,
      persistedCountAfter: null,
    };
    logger.warn(
      {
        gameId: query.gameId,
        hydrationError: hydration.error,
      },
      "Could not hydrate NBA play-by-play for trader incident event context."
    );
  }
  const data = getBoardAlertEventContext({
    anchorAt: query.anchorAt,
    alertId: query.alertId,
    gameId: query.gameId,
    limit: query.limit,
    windowSecondsAfter: query.windowSecondsAfter,
    windowSecondsBefore: query.windowSecondsBefore,
  });
  logger.debug(
    {
      gameId: query.gameId,
      hydrationError: hydration.error,
      hydrated: hydration.hydrated,
      pbp: data.playByPlay.length,
      predictionRows: data.predictionMarketContext.rows.length,
    },
    "Built trader incident event context payload."
  );
  return {
    data,
    meta: {
      ...generatedMeta(),
      playByPlayHydration: hydration,
    },
  };
}

export function getBoardAnomalyReplayPayload(
  query: BoardAlertsReplayQuery,
  context?: ServiceContext
) {
  const logger = getLogger(
    boardAlertsLogger,
    context,
    "getBoardAnomalyReplayPayload"
  );
  const data = replayBoardAnomaliesForGame({
    gameId: query.gameId,
    stepSeconds: query.stepSeconds ?? 30,
    windowEnd: query.windowEnd,
    windowStart: query.windowStart,
  });
  logger.debug(
    { count: data?.alertDeck.length ?? 0, gameId: query.gameId },
    "Built trader incident replay payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}
