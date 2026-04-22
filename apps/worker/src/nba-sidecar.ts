import {
  recordAdapterRun,
  recordGameStateObservation,
  upsertGame,
  upsertGameOutcome,
} from "@signal-console/shared";

type SidecarParticipant = {
  abbreviation?: string | null;
  key: string;
  name: string;
  shortName: string;
  side?: "away" | "home" | null;
};

type SidecarGame = {
  awayParticipant: SidecarParticipant;
  homeParticipant: SidecarParticipant;
  id: string;
  league: string;
  scheduledStart: string;
  sourceGameKeyNba?: string | null;
  sport: string;
};

type SidecarGameState = {
  awayScore?: number | null;
  capturedAt: string;
  clock?: string | null;
  finalAt?: string | null;
  homeScore?: number | null;
  isFinal: boolean;
  period?: number | null;
  startedAt?: string | null;
  status: "cancelled" | "final" | "in-play" | "postponed" | "scheduled";
};

type SidecarGameOutcome = {
  capturedAt: string;
  finalAwayScore: number;
  finalHomeScore: number;
  winnerKey?: string | null;
};

export type NbaSidecarScoreboardPayload = {
  generatedAt: string;
  requestedDate?: string | null;
  games: Array<{
    game: SidecarGame;
    gameState: SidecarGameState;
    outcome?: SidecarGameOutcome | null;
    sourcePayloadMeta?: Record<string, unknown>;
  }>;
};

type FetchLike = typeof fetch;

export type NbaSidecarWindowSummary = {
  datesSynced: string[];
  finishedAt: string;
  gamesSeen: number;
  ok: true;
  outcomesWritten: number;
  startedAt: string;
  statesWritten: number;
};

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function buildNbaSidecarUrl(
  baseUrl: string,
  pathname: string,
  query?: Record<string, string | undefined>
) {
  const url = new URL(`${trimTrailingSlash(baseUrl)}${pathname}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function formatDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildNbaSidecarDateWindow(options?: {
  lookaheadDays?: number;
  lookbackDays?: number;
  now?: () => Date;
}) {
  const lookbackDays = options?.lookbackDays ?? 1;
  const lookaheadDays = options?.lookaheadDays ?? 3;
  const anchorDate = options?.now?.() ?? new Date();
  const start = Date.UTC(
    anchorDate.getUTCFullYear(),
    anchorDate.getUTCMonth(),
    anchorDate.getUTCDate()
  );
  const dates: string[] = [];

  for (let offset = lookbackDays * -1; offset <= lookaheadDays; offset += 1) {
    dates.push(formatDateUtc(new Date(start + offset * 24 * 60 * 60 * 1000)));
  }

  return dates;
}

export async function fetchNbaSidecarScoreboard(options?: {
  baseUrl?: string;
  date?: string;
  fetchImpl?: FetchLike;
}) {
  const baseUrl = options?.baseUrl ?? process.env.NBA_SIDECAR_BASE_URL;
  if (!baseUrl) {
    throw new Error("NBA_SIDECAR_BASE_URL is not configured.");
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(
    buildNbaSidecarUrl(baseUrl, "/api/v1/scoreboard", {
      date: options?.date,
    })
  );

  if (!response.ok) {
    throw new Error(
      `NBA sidecar scoreboard request failed with status ${response.status}.`
    );
  }

  const payload = (await response.json()) as {
    data: NbaSidecarScoreboardPayload;
    meta?: Record<string, unknown>;
  };

  return payload.data;
}

export function ingestNbaSidecarScoreboard(
  payload: NbaSidecarScoreboardPayload
) {
  let statesWritten = 0;
  let outcomesWritten = 0;

  for (const entry of payload.games) {
    upsertGame(entry.game);
    const stateResult = recordGameStateObservation({
      ...entry.gameState,
      gameId: entry.game.id,
    });
    if (stateResult.wrote) {
      statesWritten += 1;
    }

    if (entry.outcome) {
      upsertGameOutcome({
        ...entry.outcome,
        gameId: entry.game.id,
      });
      outcomesWritten += 1;
    }
  }

  return {
    gamesSeen: payload.games.length,
    outcomesWritten,
    statesWritten,
  };
}

export async function syncNbaSidecarScoreboard(options?: {
  baseUrl?: string;
  date?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}) {
  const startedAt = (options?.now ?? (() => new Date()))().toISOString();

  try {
    const payload = await fetchNbaSidecarScoreboard(options);
    const summary = ingestNbaSidecarScoreboard(payload);
    const finishedAt = (options?.now ?? (() => new Date()))().toISOString();
    recordAdapterRun({
      finishedAt,
      recordsSeen: summary.gamesSeen,
      recordsWritten: summary.statesWritten + summary.outcomesWritten,
      source: "nba",
      startedAt,
      status: "ok",
    });

    return {
      ...summary,
      finishedAt,
      generatedAt: payload.generatedAt,
      ok: true as const,
      requestedDate: payload.requestedDate ?? null,
      startedAt,
    };
  } catch (error) {
    const finishedAt = (options?.now ?? (() => new Date()))().toISOString();
    recordAdapterRun({
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt,
      recordsSeen: 0,
      recordsWritten: 0,
      source: "nba",
      startedAt,
      status: "error",
    });
    throw error;
  }
}

export async function syncNbaSidecarWindow(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  lookaheadDays?: number;
  lookbackDays?: number;
  now?: () => Date;
}) {
  const now = options?.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const dates = buildNbaSidecarDateWindow({
    lookaheadDays: options?.lookaheadDays,
    lookbackDays: options?.lookbackDays,
    now,
  });

  try {
    let gamesSeen = 0;
    let outcomesWritten = 0;
    let statesWritten = 0;

    for (const date of dates) {
      const payload = await fetchNbaSidecarScoreboard({
        baseUrl: options?.baseUrl,
        date,
        fetchImpl: options?.fetchImpl,
      });
      const summary = ingestNbaSidecarScoreboard(payload);
      gamesSeen += summary.gamesSeen;
      outcomesWritten += summary.outcomesWritten;
      statesWritten += summary.statesWritten;
    }

    const finishedAt = now().toISOString();
    recordAdapterRun({
      finishedAt,
      recordsSeen: gamesSeen,
      recordsWritten: statesWritten + outcomesWritten,
      source: "nba",
      startedAt,
      status: "ok",
    });

    return {
      datesSynced: dates,
      finishedAt,
      gamesSeen,
      ok: true as const,
      outcomesWritten,
      startedAt,
      statesWritten,
    } satisfies NbaSidecarWindowSummary;
  } catch (error) {
    const finishedAt = now().toISOString();
    recordAdapterRun({
      errorMessage: error instanceof Error ? error.message : String(error),
      finishedAt,
      recordsSeen: 0,
      recordsWritten: 0,
      source: "nba",
      startedAt,
      status: "error",
    });
    throw error;
  }
}
