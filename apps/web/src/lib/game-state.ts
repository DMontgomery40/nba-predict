import { classifyGameLifecycle } from "@signal-console/domain";

type GameStateRow = {
  game: {
    scheduledStart: string;
  };
  gameState?: {
    capturedAt?: string | null;
    isFinal?: boolean | null;
    status: string;
  } | null;
  outcome?: {
    capturedAt?: string | null;
    finalAwayScore?: number | null;
    finalHomeScore?: number | null;
    winnerKey?: string | null;
  } | null;
};

export type GameOperationalState = ReturnType<typeof classifyGameLifecycle>;

export function getGameOperationalState(
  row: GameStateRow,
  now = new Date()
): GameOperationalState {
  return classifyGameLifecycle(
    {
      gameState: row.gameState
        ? {
            capturedAt: row.gameState.capturedAt,
            isFinal: row.gameState.isFinal === true,
            status: row.gameState.status,
          }
        : null,
      outcome: row.outcome ?? null,
      scheduledStart: row.game.scheduledStart,
    },
    now
  );
}

export function needsGameStateAttention(row: GameStateRow) {
  const state = getGameOperationalState(row);
  return state.tone === "critical" || state.tone === "warning";
}
