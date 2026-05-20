import {
  listForensicFinishedGameIncidents,
  listFinishedGameIncidents,
} from "@signal-console/shared";

import {
  buildBoardIncidentQuery,
  type BoardIncidentsQuery,
} from "./board-alert-service-support";
import { ensureNbaPlayByPlayPersisted } from "./nba-sidecar-service";
import {
  createServiceLogger,
  generatedMeta,
  getLogger,
  type ServiceContext,
  type ServiceLogger,
} from "./service-support";

const boardAlertIncidentsLogger = createServiceLogger(
  "board-alert-incident-payload"
);

async function hydrateMissingBoardIncidentPlayByPlay(
  gameIds: string[],
  logger: ServiceLogger
) {
  for (const gameId of gameIds) {
    try {
      const result = await ensureNbaPlayByPlayPersisted(gameId);
      logger.info(
        {
          actionsSeen: result.actionsSeen,
          actionsWritten: result.actionsWritten,
          gameId,
          hydrated: result.hydrated,
          persistedCountAfter: result.persistedCountAfter,
        },
        "Ensured NBA play-by-play is persisted for trader incident context."
      );
    } catch (error) {
      logger.warn(
        {
          error:
            error instanceof Error
              ? { message: error.message, name: error.name }
              : { message: String(error), name: "unknown" },
          gameId,
        },
        "Could not hydrate NBA play-by-play for trader incident context."
      );
    }
  }
}

function collectMissingPlayByPlayGameIds(
  forensic: ReturnType<typeof listForensicFinishedGameIncidents>,
  replay: ReturnType<typeof listFinishedGameIncidents>
) {
  return Array.from(
    new Set(
      [...forensic, ...replay]
        .filter((incident) => !incident.playByPlay.available)
        .map((incident) => incident.gameId)
    )
  );
}

function dedupeAndSortBoardIncidents(
  forensic: ReturnType<typeof listForensicFinishedGameIncidents>,
  replay: ReturnType<typeof listFinishedGameIncidents>,
  limit: number
) {
  const seen = new Set<string>();
  return [...forensic, ...replay]
    .filter((incident) => {
      if (seen.has(incident.id)) return false;
      seen.add(incident.id);
      return true;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(a.firstPopAt) - Date.parse(b.firstPopAt);
    })
    .slice(0, limit);
}

export async function getBoardAnomalyIncidentsPayload(
  query: BoardIncidentsQuery,
  context?: ServiceContext
) {
  const logger = getLogger(
    boardAlertIncidentsLogger,
    context,
    "getBoardAnomalyIncidentsPayload"
  );
  const { limit, queryForLimit } = buildBoardIncidentQuery(query);
  let forensic = listForensicFinishedGameIncidents(queryForLimit);
  let replay = listFinishedGameIncidents(queryForLimit);
  const missingPlayByPlayGameIds = collectMissingPlayByPlayGameIds(
    forensic,
    replay
  );
  if (missingPlayByPlayGameIds.length > 0) {
    await hydrateMissingBoardIncidentPlayByPlay(
      missingPlayByPlayGameIds,
      logger
    );
    forensic = listForensicFinishedGameIncidents(queryForLimit);
    replay = listFinishedGameIncidents(queryForLimit);
  }

  const data = dedupeAndSortBoardIncidents(forensic, replay, limit);
  logger.debug(
    {
      count: data.length,
      date: query.date,
      forensicCount: forensic.length,
      replayCount: replay.length,
    },
    "Built historical trader incident payload."
  );
  return { data, meta: { ...generatedMeta(), date: query.date } };
}
