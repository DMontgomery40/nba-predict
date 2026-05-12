type GameStateRow = {
  game: {
    scheduledStart: string;
  };
  gameState?: {
    capturedAt?: string | null;
    status: string;
  } | null;
};

export type GameOperationalState = {
  detail: string;
  label: string;
  tone: "critical" | "live" | "neutral" | "warning";
};

function parseTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function formatAge(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export function getGameOperationalState(
  row: GameStateRow,
  now = new Date()
): GameOperationalState {
  const scheduledAt = parseTime(row.game.scheduledStart);
  const capturedAt = parseTime(row.gameState?.capturedAt);
  const nowMs = now.getTime();
  const status = row.gameState?.status.toLowerCase() ?? "missing";
  const stateAgeMs = capturedAt == null ? null : nowMs - capturedAt;
  const startsInMs = scheduledAt == null ? null : scheduledAt - nowMs;
  const startedAgoMs = scheduledAt == null ? null : nowMs - scheduledAt;
  const inExpectedLiveWindow =
    startsInMs != null &&
    startsInMs <= 30 * 60_000 &&
    startsInMs >= -4 * 60 * 60_000;
  const finalLikelyDue =
    startedAgoMs != null &&
    startedAgoMs > 4 * 60 * 60_000 &&
    startedAgoMs <= 12 * 60 * 60_000 &&
    status !== "final";

  if (status === "in-play" || status === "live") {
    return {
      detail:
        stateAgeMs == null
          ? "NBA state is live; capture age unavailable"
          : `NBA state updated ${formatAge(stateAgeMs)} ago`,
      label: "Live",
      tone: "live",
    };
  }

  if (status === "final") {
    return {
      detail:
        stateAgeMs == null
          ? "Final state captured"
          : `Final state captured ${formatAge(stateAgeMs)} ago`,
      label: "Final",
      tone: "neutral",
    };
  }

  if (inExpectedLiveWindow && status === "scheduled") {
    return {
      detail:
        stateAgeMs == null
          ? "Tip window is open but no NBA state capture is attached"
          : `Tip window is open but NBA state is still scheduled; last capture ${formatAge(
              stateAgeMs
            )} ago`,
      label: "NBA state stale",
      tone: "critical",
    };
  }

  if (inExpectedLiveWindow && status === "missing") {
    return {
      detail: "Tip window is open but no NBA state row is persisted",
      label: "NBA state missing",
      tone: "critical",
    };
  }

  if (finalLikelyDue) {
    return {
      detail:
        stateAgeMs == null
          ? "Game window has elapsed but no final NBA state is attached"
          : `Game window has elapsed; last NBA state capture ${formatAge(
              stateAgeMs
            )} ago`,
      label: "Final state overdue",
      tone: "warning",
    };
  }

  if (
    stateAgeMs != null &&
    stateAgeMs > 6 * 60 * 60_000 &&
    startedAgoMs != null &&
    startedAgoMs <= 12 * 60 * 60_000
  ) {
    return {
      detail: `Last NBA state capture ${formatAge(stateAgeMs)} ago`,
      label: "State aged",
      tone: "warning",
    };
  }

  return {
    detail:
      startsInMs != null && startsInMs > 0
        ? `Scheduled in ${formatAge(startsInMs)}`
        : "NBA state is not currently live",
    label: row.gameState?.status ?? "No state",
    tone: "neutral",
  };
}

export function needsGameStateAttention(row: GameStateRow) {
  const state = getGameOperationalState(row);
  return state.tone === "critical" || state.tone === "warning";
}
