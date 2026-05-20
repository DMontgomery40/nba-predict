import {
  AdapterFailureError,
  GameNotFoundError,
  getDatabase,
  recordNbaPlayByPlayActions,
} from "@signal-console/shared";

type NbaSidecarPlayByPlayPayload = {
  actions: Array<{
    actionNumber?: number | null;
    actionType?: string | null;
    clock?: string | null;
    description?: string | null;
    period?: number | null;
    scoreAway?: string | null;
    scoreHome?: string | null;
    teamTricode?: string | null;
    timeActual?: string | null;
  }>;
  gameId: string;
  generatedAt: string;
};

function getNbaSidecarBaseUrl() {
  const baseUrl = process.env.NBA_SIDECAR_BASE_URL?.trim();
  if (!baseUrl) {
    throw new AdapterFailureError("NBA sidecar URL is not configured.", {
      operatorHint:
        "Set NBA_SIDECAR_BASE_URL and keep the NBA sidecar running before trusting trader incident timing or game-clock context.",
    });
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function getGameRow(gameId: string) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT
         id,
         source_game_key_nba AS sourceGameKeyNba
       FROM games
       WHERE id = ?`
    )
    .get(gameId) as
    | {
        id: string;
        sourceGameKeyNba: string | null;
      }
    | undefined;
  if (!row) {
    throw new GameNotFoundError(gameId);
  }
  return row;
}

function countPersistedPlayByPlay(gameId: string) {
  const db = getDatabase();
  return Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM nba_play_by_play_actions
           WHERE game_id = ?`
        )
        .get(gameId) as { count: number } | undefined
    )?.count ?? 0
  );
}

async function fetchNbaSidecarPlayByPlay(nbaGameId: string) {
  const response = await fetch(
    `${getNbaSidecarBaseUrl()}/api/v1/games/${nbaGameId}/play-by-play`
  ).catch((error) => {
    throw new AdapterFailureError("NBA sidecar play-by-play request failed.", {
      cause: error,
      details: { nbaGameId },
      operatorHint:
        "Bring the NBA sidecar up and confirm it serves /play-by-play before using trader incident inspection.",
    });
  });

  if (!response.ok) {
    throw new AdapterFailureError(
      `NBA sidecar play-by-play request failed with status ${response.status}.`,
      {
        details: { nbaGameId, status: response.status },
        operatorHint:
          "Check the NBA sidecar health and the source NBA game id before trusting trader incident context.",
      }
    );
  }

  const payload = (await response.json()) as {
    data?: NbaSidecarPlayByPlayPayload;
  };

  if (!payload.data || !Array.isArray(payload.data.actions)) {
    throw new AdapterFailureError(
      "NBA sidecar play-by-play payload was malformed.",
      {
        details: { nbaGameId },
        operatorHint:
          "Inspect the NBA sidecar payload shape before using it to hydrate trader incident context.",
      }
    );
  }

  return payload.data;
}

export async function ensureNbaPlayByPlayPersisted(gameId: string) {
  const persistedCountBefore = countPersistedPlayByPlay(gameId);
  if (persistedCountBefore > 0) {
    return {
      actionsSeen: persistedCountBefore,
      actionsWritten: 0,
      hydrated: false,
      persistedCountAfter: persistedCountBefore,
    };
  }

  const game = getGameRow(gameId);
  if (!game.sourceGameKeyNba) {
    throw new AdapterFailureError(
      "Game is missing its NBA source game key, so play-by-play cannot be hydrated.",
      {
        details: { gameId },
        operatorHint:
          "Backfill or repair the canonical game mapping before trusting trader incident game-clock context.",
      }
    );
  }

  const payload = await fetchNbaSidecarPlayByPlay(game.sourceGameKeyNba);
  const result = recordNbaPlayByPlayActions({
    actions: payload.actions
      .filter(
        (
          action
        ): action is NbaSidecarPlayByPlayPayload["actions"][number] & {
          actionNumber: number;
        } => action.actionNumber != null && Number.isFinite(action.actionNumber)
      )
      .map((action) => ({
        ...action,
        actionNumber: action.actionNumber,
        rawMetadata: action,
      })),
    capturedAt: payload.generatedAt,
    gameId,
  });

  return {
    actionsSeen: result.actionsSeen,
    actionsWritten: result.actionsWritten,
    hydrated: result.actionsWritten > 0,
    persistedCountAfter: countPersistedPlayByPlay(gameId),
  };
}
