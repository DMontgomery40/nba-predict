export type BoardAlertsQuery = {
  now?: string;
  limit?: number;
  contextWindowMinutes?: number;
};

export type BoardIncidentsQuery = {
  date: string;
  gameId?: string;
  minGap?: number;
  limit?: number;
};

export type BoardEventContextQuery = {
  gameId: string;
  anchorAt: string;
  alertId?: string;
  limit?: number;
  windowSecondsBefore?: number;
  windowSecondsAfter?: number;
};

export type BoardAlertsReplayQuery = {
  gameId: string;
  windowStart: string;
  windowEnd: string;
  stepSeconds?: number;
};

export function buildBoardAlertWindowQuery(query: BoardAlertsQuery) {
  return {
    contextWindowMinutes: query.contextWindowMinutes ?? 30,
    limit: query.limit ?? 10,
    now: query.now ?? new Date().toISOString(),
  };
}

export function buildBoardIncidentQuery(query: BoardIncidentsQuery) {
  const limit = query.limit ?? 10;
  return {
    limit,
    queryForLimit: {
      date: query.date,
      gameId: query.gameId,
      limit: Math.max(limit, 50),
      minGap: query.minGap ?? 0.15,
    },
  };
}
