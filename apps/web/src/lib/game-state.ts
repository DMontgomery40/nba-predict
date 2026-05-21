import { classifyGameLifecycle } from "@signal-console/domain";

import { formatOperatorTime } from "./time-format";

type GameStateRow = {
  game: {
    scheduledStart: string;
  };
  gameState?: {
    awayScore?: number | null;
    capturedAt?: string | null;
    clock?: string | null;
    homeScore?: number | null;
    isFinal?: boolean | null;
    period?: number | null;
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

function formatPeriod(period?: number | null) {
  if (period == null || period <= 0) {
    return null;
  }
  if (period <= 4) {
    return `Q${period}`;
  }
  return period === 5 ? "OT" : `${period - 4}OT`;
}

function formatClock(clock?: string | null) {
  if (!clock || clock.toLowerCase() === "none") {
    return null;
  }

  const isoMatch = clock.match(
    /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i
  );
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0);
    const minutes = Number(isoMatch[2] ?? 0) + hours * 60;
    const seconds = Math.floor(Number(isoMatch[3] ?? 0));
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return clock.trim();
}

export function formatGamePeriodClock(
  gameState?: GameStateRow["gameState"] | null
) {
  if (!gameState) {
    return null;
  }

  const period = formatPeriod(gameState.period);
  const clock = formatClock(gameState.clock);
  if (period && clock) {
    return `${period} ${clock}`;
  }
  return period ?? clock;
}

export function formatGameScoreClock(row: GameStateRow) {
  const state = getGameOperationalState(row);
  if (state.kind === "final") {
    const awayScore =
      row.outcome?.finalAwayScore ?? row.gameState?.awayScore ?? "-";
    const homeScore =
      row.outcome?.finalHomeScore ?? row.gameState?.homeScore ?? "-";
    return `${awayScore}-${homeScore} final`;
  }

  if (state.kind === "scheduled") {
    return `Tip ${formatOperatorTime(row.game.scheduledStart)}`;
  }

  if (!row.gameState) {
    return `Tip ${formatOperatorTime(row.game.scheduledStart)}`;
  }

  const score = `${row.gameState.awayScore ?? "-"}-${row.gameState.homeScore ?? "-"}`;
  const periodClock = formatGamePeriodClock(row.gameState);
  if (row.gameState.status === "scheduled") {
    return `Tip ${formatOperatorTime(row.game.scheduledStart)}`;
  }
  return periodClock
    ? `${score} · ${periodClock}`
    : `${score} · ${row.gameState.status}`;
}

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
