import { isStrictYmdDate } from "@signal-console/domain";

import { formatGamePeriodClock } from "../../lib/game-state";

import type {
  BoardAnomalyAlertDto,
  BoardEventContextPayload,
  BoardIncidentDto,
  BoardIncidentPbpAnchor,
  BoardIncidentPbpContext,
} from "../../data/api";

export const INCIDENT_BURST_WINDOW_SECONDS = 120;

export type BoardAlertIncidentRow = {
  alert: BoardAnomalyAlertDto;
  pbp: BoardIncidentDto["playByPlay"] | null;
};

type BoardAlertKind = BoardAnomalyAlertDto["shockKind"];

export const BOARD_ALERT_KIND_LABELS = {
  "pregame-availability": "Pregame availability tripwire",
  "near-tip-availability": "Near-tip availability tripwire",
  "game-state-volatility": "Whole-board tripwire",
  "attribution-shaped": "Player-focused follow-up",
  "market-structure": "Market-structure tripwire",
  "cross-surface-disagreement": "Cross-surface follow-up",
  "coverage-gap": "Coverage / timing gap",
} satisfies Record<BoardAlertKind, string>;

const BOARD_ALERT_DISPLAY_PRIORITY = {
  "attribution-shaped": 60,
  "market-structure": 55,
  "cross-surface-disagreement": 50,
  "game-state-volatility": 45,
  "near-tip-availability": 40,
  "pregame-availability": 35,
  "coverage-gap": 20,
} satisfies Record<BoardAlertKind, number>;

export type BoardAlertReviewTarget =
  BoardAnomalyAlertDto["evidence"][number] & {
    sourceAlertId: string;
  };

export type BoardAlertPredictionSourceSummary = NonNullable<
  BoardEventContextPayload["data"]
>["predictionMarketContext"]["bySource"][number];

export type BoardAlertPredictionMarketRow = NonNullable<
  BoardEventContextPayload["data"]
>["predictionMarketContext"]["rows"][number];

export type BoardAlertPbpRow = NonNullable<
  BoardEventContextPayload["data"]
>["playByPlay"][number];

export type BoardAlertPbpRowLike = {
  actionNumber: number;
  clock: string | null;
  description: string | null;
  offsetSeconds: number | null;
  period: number | null;
  teamTricode: string | null;
  timeActual: string | null;
};

export function utcIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDateInputValue(value: string | null): value is string {
  return value != null && isStrictYmdDate(value);
}

export function displayBoardAlertEntity(entityKey: string): string {
  return entityKey
    .split(/[\s-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function boardAlertTitle(alert: BoardAnomalyAlertDto): string {
  if (alert.shockKind === "game-state-volatility") {
    return "Whole-board tripwire";
  }
  if (alert.primaryEntityKey) {
    return displayBoardAlertEntity(alert.primaryEntityKey);
  }
  return "Multi-market incident";
}

export function preferPrimaryBoardAlert(
  candidate: BoardAnomalyAlertDto,
  existing: BoardAnomalyAlertDto
): boolean {
  const entityDelta =
    Number(Boolean(candidate.primaryEntityKey)) -
    Number(Boolean(existing.primaryEntityKey));
  if (entityDelta !== 0) return entityDelta > 0;
  const priorityDelta =
    BOARD_ALERT_DISPLAY_PRIORITY[candidate.shockKind] -
    BOARD_ALERT_DISPLAY_PRIORITY[existing.shockKind];
  if (priorityDelta !== 0) return priorityDelta > 0;
  return candidate.score > existing.score;
}

export function buildBoardAlertInspectPath(
  alert: Pick<
    BoardAnomalyAlertDto,
    "firstPopAt" | "gameId" | "gameLabel" | "id"
  >,
  dateParam?: string | null
) {
  const params = new URLSearchParams({
    alertId: alert.id,
    at: alert.firstPopAt,
    label: alert.gameLabel,
  });
  if (dateParam) params.set("date", dateParam);
  return `/board-alerts/${encodeURIComponent(alert.gameId)}?${params.toString()}`;
}

export function pickPrimaryLiveIncidentRows(rows: BoardAlertIncidentRow[]) {
  const oneCardPerGame = new Map<string, BoardAlertIncidentRow>();
  for (const row of rows) {
    const existing = oneCardPerGame.get(row.alert.gameLabel);
    if (!existing) {
      oneCardPerGame.set(row.alert.gameLabel, row);
      continue;
    }
    if (preferPrimaryBoardAlert(row.alert, existing.alert)) {
      oneCardPerGame.set(row.alert.gameLabel, row);
    }
  }

  return Array.from(oneCardPerGame.values()).sort(
    (a, b) => b.alert.score - a.alert.score
  );
}

export function formatTimestampToSecond(
  iso: string | null | undefined
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso ?? "—";
  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZoneName: "short",
    year: "numeric",
  });
}

export function formatOffset(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const abs = Math.abs(seconds);
  const sign = seconds >= 0 ? "+" : "-";
  if (abs < 60) return `T${sign}${abs}s`;
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  if (abs < 3600) return `T${sign}${mins}m${String(secs).padStart(2, "0")}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `T${sign}${hours}h${String(remMins).padStart(2, "0")}m${String(secs).padStart(2, "0")}s`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatLeadFromSeconds(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) return `${abs}s`;
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  if (abs < 3600) {
    return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (remMins === 0) return `${hours}h`;
  return `${hours}h ${remMins}m`;
}

function deltaSecondsBetween(anchorIso: string, candidateIso: string) {
  return Math.abs(
    Math.round((Date.parse(anchorIso) - Date.parse(candidateIso)) / 1000)
  );
}

function timingPosition(
  alert: BoardAnomalyAlertDto | null,
  anchorIso: string
): {
  kind: "pregame" | "postgame" | "in-range" | "unknown";
  leadSeconds: number | null;
} {
  const pbp = asIncidentPlayByPlayContext(alert);
  const anchorMs = Date.parse(anchorIso);
  if (!pbp?.available || !Number.isFinite(anchorMs)) {
    return { kind: "unknown", leadSeconds: null };
  }
  const firstActionMs = Date.parse(pbp.firstActionAt ?? "");
  if (Number.isFinite(firstActionMs) && anchorMs < firstActionMs) {
    return {
      kind: "pregame",
      leadSeconds: Math.round((firstActionMs - anchorMs) / 1000),
    };
  }
  const lastActionMs = Date.parse(pbp.lastActionAt ?? "");
  if (Number.isFinite(lastActionMs) && anchorMs > lastActionMs) {
    return {
      kind: "postgame",
      leadSeconds: Math.round((anchorMs - lastActionMs) / 1000),
    };
  }
  return { kind: "in-range", leadSeconds: null };
}

function asIncidentPlayByPlayContext(
  alert: BoardAnomalyAlertDto | null
): BoardIncidentPbpContext | null {
  const candidate = alert as Partial<BoardIncidentDto> | null;
  return candidate?.playByPlay ?? null;
}

export function nearestIncidentPbpAnchor(
  context: BoardIncidentPbpContext | null
): BoardIncidentPbpAnchor | null {
  if (!context) return null;
  return (
    [context.nearestBefore, context.nearestAfter]
      .filter((row): row is BoardIncidentPbpAnchor => row != null)
      .sort(
        (a, b) =>
          Math.abs(a.offsetSeconds ?? Number.POSITIVE_INFINITY) -
          Math.abs(b.offsetSeconds ?? Number.POSITIVE_INFINITY)
      )[0] ?? null
  );
}

export function pickNearestPbp(
  incidentPbp: BoardIncidentDto["playByPlay"] | null,
  windowRows: BoardAlertPbpRow[]
): BoardAlertPbpRowLike | null {
  const before = incidentPbp?.nearestBefore ?? null;
  const after = incidentPbp?.nearestAfter ?? null;
  const anchored = [before, after]
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort(
      (a, b) =>
        Math.abs(a.offsetSeconds ?? Number.POSITIVE_INFINITY) -
        Math.abs(b.offsetSeconds ?? Number.POSITIVE_INFINITY)
    )[0];
  if (anchored) return anchored;
  return (
    [...windowRows].sort(
      (a, b) =>
        Math.abs(a.offsetSeconds ?? Number.POSITIVE_INFINITY) -
        Math.abs(b.offsetSeconds ?? Number.POSITIVE_INFINITY)
    )[0] ?? null
  );
}

export function formatPbpGameClock(
  row: { clock?: string | null; period?: number | null } | null | undefined
) {
  return formatGamePeriodClock(
    row
      ? {
          clock: row.clock ?? null,
          period: row.period ?? null,
          status: "in-play",
        }
      : null
  );
}

export function formatBoardAlertCardTime(alert: BoardAnomalyAlertDto): string {
  const wallClock = formatTimestampToSecond(alert.firstPopAt);
  const timing = timingPosition(alert, alert.firstPopAt);
  if (timing.kind === "pregame" && timing.leadSeconds != null) {
    const lead = formatLeadFromSeconds(timing.leadSeconds);
    return `Pregame · ${lead} before tip · ${wallClock}`;
  }
  if (timing.kind === "postgame" && timing.leadSeconds != null) {
    const lead = formatLeadFromSeconds(timing.leadSeconds);
    return `Postgame · ${lead} after final action · ${wallClock}`;
  }
  const pbp = asIncidentPlayByPlayContext(alert);
  const nearestPbp = nearestIncidentPbpAnchor(pbp);
  const gameClock = formatPbpGameClock(nearestPbp);
  if (gameClock) {
    return `${gameClock} · ${wallClock}`;
  }
  return wallClock;
}

export function formatLeadLabel(
  anchorIso: string,
  candidateIso: string
): string {
  const deltaSeconds = Math.round(
    (Date.parse(anchorIso) - Date.parse(candidateIso)) / 1000
  );
  if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) return "selected";
  return deltaSeconds > 0
    ? `${formatLeadFromSeconds(deltaSeconds)} earlier`
    : `${formatLeadFromSeconds(deltaSeconds)} later`;
}

export function sortPredictionMarketContextByImpact(
  rows: BoardAlertPredictionMarketRow[]
) {
  return [...rows].sort((a, b) => {
    if (b.signalStrength !== a.signalStrength) {
      return b.signalStrength - a.signalStrength;
    }
    const bShare = b.volumeShare ?? 0;
    const aShare = a.volumeShare ?? 0;
    if (bShare !== aShare) return bShare - aShare;
    const bNotional = b.notional ?? 0;
    const aNotional = a.notional ?? 0;
    if (bNotional !== aNotional) return bNotional - aNotional;
    return Math.abs(a.offsetSeconds) - Math.abs(b.offsetSeconds);
  });
}

export function describePredictionMarketEvidenceSummary(
  rows: BoardAlertPredictionMarketRow[]
) {
  const sources = Array.from(new Set(rows.map((row) => row.source))).sort();
  const tradeCount = rows.filter((row) => row.kind === "trade").length;
  const quoteCount = rows.length - tradeCount;
  if (sources.length === 0) {
    return "No persisted prediction-market observations in this window";
  }
  const observationLabel = `observation${rows.length === 1 ? "" : "s"}`;
  const kindParts: string[] = [];
  if (quoteCount > 0) {
    kindParts.push(`${quoteCount} quote${quoteCount === 1 ? "" : "s"}`);
  }
  if (tradeCount > 0) {
    kindParts.push(`${tradeCount} trade${tradeCount === 1 ? "" : "s"}`);
  }
  return `${rows.length} ${observationLabel} from ${sources.join("/")} · ${kindParts.join(" · ")}`;
}

export function describePredictionMarketContextSummary(
  summaries: BoardAlertPredictionSourceSummary[]
) {
  if (summaries.length === 0) {
    return "No persisted prediction-market observations in this window";
  }
  const observationCount = summaries.reduce(
    (total, summary) => total + summary.observationCount,
    0
  );
  const quoteCount = summaries.reduce(
    (total, summary) => total + summary.quoteCount,
    0
  );
  const tradeCount = summaries.reduce(
    (total, summary) => total + summary.tradeCount,
    0
  );
  return `${observationCount} observations across ${summaries
    .map((summary) => summary.source)
    .join("/")} · ${quoteCount} quotes · ${tradeCount} trades`;
}

export function describePredictionSourceSummary(
  summary: BoardAlertPredictionSourceSummary
) {
  const parts = [
    `${summary.observationCount} observations`,
    `${summary.quoteCount} quotes`,
  ];
  if (summary.tradeCount > 0) {
    parts.push(`${summary.tradeCount} trades`);
  }
  return parts.join(" · ");
}

function priceShockLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "market pressure";
  if (value >= 1.5) return "extreme price shock vs baseline";
  if (value >= 0.75) return "strong price shock vs baseline";
  if (value >= 0.35) return "moderate price shock vs baseline";
  if (value > 0) return "mild price shock vs baseline";
  return "market pressure";
}

export function describePredictionMarketContextRow(
  row: BoardAlertPredictionMarketRow
) {
  const reasons: string[] = [priceShockLabel(row.signalStrength)];
  if (row.kind === "trade") {
    if ((row.volumeShare ?? 0) >= 0.2) reasons.push("heavy volume-share print");
    if ((row.notional ?? 0) >= 50) reasons.push("sized trade");
  } else {
    if ((row.spread ?? 0) >= 0.08) reasons.push("wide spread");
    if ((row.depthScore ?? 100) <= 35) reasons.push("thin liquidity");
  }
  return reasons.join("; ");
}

export function describeBoardAlertGameClock(options: {
  alert: BoardAnomalyAlertDto | null;
  anchorAt: string;
  nearestPbp: { clock?: string | null; period?: number | null } | null;
  pbpMissing: boolean;
}) {
  const timing = timingPosition(options.alert, options.anchorAt);
  if (timing.kind === "pregame") {
    return "Pregame / no game clock yet";
  }
  if (timing.kind === "postgame") {
    return "Postgame / no nearby NBA row";
  }
  const gameClock = formatPbpGameClock(options.nearestPbp);
  if (gameClock) return gameClock;
  return options.pbpMissing ? "Persisted NBA row missing" : "No nearby NBA row";
}

export function familyLabel(value: string | null | undefined): string {
  if (!value) return "market";
  return value.replace(/-/g, " ");
}

export function isPlayerFocusedAlert(alert: BoardAnomalyAlertDto): boolean {
  return (
    Boolean(alert.primaryEntityKey) ||
    alert.primaryFamily === "player-prop" ||
    alert.shockKind === "attribution-shaped" ||
    alert.evidence.some(
      (row) => row.family === "player-prop" || row.participantKey != null
    )
  );
}

export function alertFamilies(alert: BoardAnomalyAlertDto): string {
  const families = Array.from(
    new Set(
      alert.evidence
        .map((row) => familyLabel(row.family))
        .filter((value) => value !== "market")
    )
  );
  return families.length > 0
    ? families.join(", ")
    : familyLabel(alert.primaryFamily);
}

export function selectAnchorAlert<T extends BoardAnomalyAlertDto>(
  rows: T[],
  gameId: string,
  anchorAt: string,
  alertId: string | null
): T | null {
  const gameRows = rows.filter((row) => row.gameId === gameId);
  if (gameRows.length === 0) return null;
  if (alertId) {
    const exact = gameRows.find((row) => row.id === alertId);
    if (exact) return exact;
  }
  const anchoredRows = gameRows.filter(
    (row) => row.firstPopAt === anchorAt || row.detectedAt === anchorAt
  );
  const candidates = anchoredRows.length > 0 ? anchoredRows : gameRows;
  return candidates.reduce((best, row) =>
    preferPrimaryBoardAlert(row, best) ? row : best
  );
}

function sameBurstDeltaSeconds(
  anchorAlert: BoardAnomalyAlertDto | null,
  anchorAt: string,
  candidateIso: string
) {
  const referenceIso = anchorAlert?.firstPopAt ?? anchorAt;
  return deltaSecondsBetween(referenceIso, candidateIso);
}

export function buildTraderRead(
  anchorAlert: BoardAnomalyAlertDto | null,
  relatedPlayerIncidents: BoardAnomalyAlertDto[]
) {
  if (!anchorAlert) return null;
  if (isPlayerFocusedAlert(anchorAlert)) {
    const entity =
      anchorAlert.primaryEntityKey != null
        ? displayBoardAlertEntity(anchorAlert.primaryEntityKey)
        : boardAlertTitle(anchorAlert);
    const families = alertFamilies(anchorAlert);
    return `Likely player-focused incident. Review or suspend ${entity} ${families} markets first, then check related derivative markets touched by the same stat event.`;
  }
  if (relatedPlayerIncidents.length > 0) {
    const names = relatedPlayerIncidents
      .slice(0, 3)
      .map((alert) =>
        alert.primaryEntityKey
          ? displayBoardAlertEntity(alert.primaryEntityKey)
          : boardAlertTitle(alert)
      )
      .join(", ");
    return `Broad tripwire fired first. Treat this alert as the fast “pay attention now” signal, then act from the player-specific follow-up on ${names}.`;
  }
  return `Broad market tripwire fired, but no player-specific follow-up is persisted within ${INCIDENT_BURST_WINDOW_SECONDS}s of this alert. Treat it as an early warning only until a same-burst player read appears.`;
}

export function listRelatedPlayerIncidents(
  anchorAlert: BoardAnomalyAlertDto | null,
  anchorAt: string,
  candidateAlerts: BoardAnomalyAlertDto[]
) {
  return candidateAlerts
    .filter((alert) => isPlayerFocusedAlert(alert))
    .sort((a, b) => {
      const aDelta = sameBurstDeltaSeconds(anchorAlert, anchorAt, a.firstPopAt);
      const bDelta = sameBurstDeltaSeconds(anchorAlert, anchorAt, b.firstPopAt);
      if (aDelta !== bDelta) return aDelta - bDelta;
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(a.firstPopAt) - Date.parse(b.firstPopAt);
    })
    .filter((alert) => {
      if (alert.id === anchorAlert?.id) return false;
      return (
        sameBurstDeltaSeconds(anchorAlert, anchorAt, alert.firstPopAt) <=
        INCIDENT_BURST_WINDOW_SECONDS
      );
    });
}

export function buildReviewSourceAlerts(
  anchorAlert: BoardAnomalyAlertDto | null,
  relatedPlayerIncidents: BoardAnomalyAlertDto[]
) {
  if (!anchorAlert) return [];
  if (isPlayerFocusedAlert(anchorAlert)) {
    return [anchorAlert, ...relatedPlayerIncidents];
  }
  if (relatedPlayerIncidents.length > 0) return relatedPlayerIncidents;
  return [anchorAlert];
}

export function buildReviewTargets(
  reviewSourceAlerts: BoardAnomalyAlertDto[]
): BoardAlertReviewTarget[] {
  const playerTargets = new Map<string, BoardAlertReviewTarget>();
  const allTargets = new Map<string, BoardAlertReviewTarget>();

  for (const alert of reviewSourceAlerts) {
    for (const row of alert.evidence) {
      const keyedRow = { ...row, sourceAlertId: alert.id };
      if (!allTargets.has(row.displayLabel)) {
        allTargets.set(row.displayLabel, keyedRow);
      }
      if (
        row.family === "player-prop" ||
        row.participantKey != null ||
        alert.primaryFamily === "player-prop" ||
        alert.primaryEntityKey != null
      ) {
        if (!playerTargets.has(row.displayLabel)) {
          playerTargets.set(row.displayLabel, keyedRow);
        }
      }
    }
  }

  return Array.from(
    (playerTargets.size > 0 ? playerTargets : allTargets).values()
  ).slice(0, 8);
}

export function buildFallbackReviewTargetsFromPredictionMarketContext(
  rows: BoardAlertPredictionMarketRow[],
  preferredParticipantKey: string | null = null
): BoardAlertReviewTarget[] {
  const deduped = new Map<string, BoardAlertReviewTarget>();
  const normalizeParticipantKey = (value: string | null | undefined) =>
    value?.trim().replace(/\+/g, "-").replace(/\s+/g, "-").toLowerCase() ??
    null;
  const matchingParticipantRows =
    preferredParticipantKey == null
      ? []
      : rows.filter(
          (row) =>
            normalizeParticipantKey(row.participantKey) ===
            normalizeParticipantKey(preferredParticipantKey)
        );
  const rankedRows =
    matchingParticipantRows.length > 0 ? matchingParticipantRows : rows;
  const preferredRows = [
    ...rankedRows.filter((row) => row.kind === "trade"),
    ...rankedRows.filter((row) => row.kind !== "trade"),
  ];
  for (const row of preferredRows) {
    const key = `${row.source}:${row.displayLabel}`;
    if (deduped.has(key)) continue;
    deduped.set(key, {
      contribution: Number(
        Math.min(1, Math.max(row.signalStrength, row.volumeShare ?? 0)).toFixed(
          3
        )
      ),
      displayLabel: row.displayLabel,
      evidenceUnmapped: row.mappingStatus === "unmapped",
      family: row.family ?? null,
      observationId: row.observationId,
      participantKey: row.participantKey,
      reason:
        row.kind === "trade"
          ? row.volumeShare != null
            ? `${(row.volumeShare * 100).toFixed(1)}% share · canonical trade fallback`
            : "canonical trade fallback"
          : "canonical quote fallback",
      source: row.source,
      sourceAlertId: "prediction-market-context-fallback",
      sourceKind: "prediction-market",
    });
  }
  return Array.from(deduped.values()).slice(0, 8);
}

export function preferredFallbackParticipantKey(options: {
  alert: Pick<BoardAnomalyAlertDto, "primaryEntityKey"> | null;
  alertId: string | null;
}) {
  const normalizeParticipantKey = (value: string | null | undefined) =>
    value?.trim().replace(/\+/g, "-").replace(/\s+/g, "-").toLowerCase() ??
    null;
  if (options.alert?.primaryEntityKey) {
    return normalizeParticipantKey(options.alert.primaryEntityKey);
  }
  const alertId = options.alertId ?? "";
  const match = alertId.match(
    /^historic-participant:[^:]+:(.+):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)$/
  );
  if (!match) return null;
  return normalizeParticipantKey(match[1]);
}

export function describeReviewTargetReason(target: BoardAlertReviewTarget) {
  const reasons: string[] = [];
  const logitMatch = target.reason.match(/logit\s+([0-9.]+)/i);
  const logitValue = logitMatch ? Number(logitMatch[1]) : null;
  const liquidityStress = /liquidity stress/i.test(target.reason);
  const offPrice = /off-price/i.test(target.reason);
  const volumeShare = /vol(?:ume)?-share/i.test(target.reason);

  if (logitValue != null || target.contribution > 0) {
    reasons.push(priceShockLabel(logitValue ?? target.contribution));
  }
  if (liquidityStress) reasons.push("thin liquidity");
  if (offPrice) reasons.push("off-price print");
  if (volumeShare) reasons.push("heavy volume-share print");
  if (/no residual/i.test(target.reason)) reasons.push("calm quote");

  if (reasons.length > 0) {
    return reasons.join("; ");
  }

  return target.reason
    .replace(/after H0/gi, "vs baseline")
    .replace(/logit/gi, "price shock");
}

export function listNearbyIncidentRows(options: {
  anchorAlert: BoardAnomalyAlertDto | null;
  anchorAt: string;
  historicalIncidents: BoardIncidentDto[];
  liveAlerts?: BoardAnomalyAlertDto[];
  replayDeck?: BoardAnomalyAlertDto[];
}) {
  const {
    anchorAlert,
    anchorAt,
    historicalIncidents,
    liveAlerts = [],
    replayDeck = [],
  } = options;
  if (historicalIncidents.length > 0) {
    return historicalIncidents
      .filter((alert) => {
        if (alert.id === anchorAlert?.id) return false;
        return (
          sameBurstDeltaSeconds(anchorAlert, anchorAt, alert.firstPopAt) <=
          INCIDENT_BURST_WINDOW_SECONDS
        );
      })
      .sort((a, b) => {
        const focusDelta =
          Number(isPlayerFocusedAlert(b)) - Number(isPlayerFocusedAlert(a));
        if (focusDelta !== 0) return focusDelta;
        const aDelta = sameBurstDeltaSeconds(
          anchorAlert,
          anchorAt,
          a.firstPopAt
        );
        const bDelta = sameBurstDeltaSeconds(
          anchorAlert,
          anchorAt,
          b.firstPopAt
        );
        if (aDelta !== bDelta) return aDelta - bDelta;
        if (b.score !== a.score) return b.score - a.score;
        return Date.parse(a.firstPopAt) - Date.parse(b.firstPopAt);
      })
      .slice(0, 8);
  }

  if (liveAlerts.length > 0) {
    return liveAlerts
      .filter((alert) => {
        if (alert.id === anchorAlert?.id) return false;
        return (
          sameBurstDeltaSeconds(anchorAlert, anchorAt, alert.firstPopAt) <=
          INCIDENT_BURST_WINDOW_SECONDS
        );
      })
      .sort((a, b) => {
        const focusDelta =
          Number(isPlayerFocusedAlert(b)) - Number(isPlayerFocusedAlert(a));
        if (focusDelta !== 0) return focusDelta;
        const aDelta = sameBurstDeltaSeconds(
          anchorAlert,
          anchorAt,
          a.firstPopAt
        );
        const bDelta = sameBurstDeltaSeconds(
          anchorAlert,
          anchorAt,
          b.firstPopAt
        );
        if (aDelta !== bDelta) return aDelta - bDelta;
        if (b.score !== a.score) return b.score - a.score;
        return Date.parse(a.firstPopAt) - Date.parse(b.firstPopAt);
      })
      .slice(0, 8);
  }

  return replayDeck
    .filter((alert) => alert.id !== anchorAlert?.id)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(a.firstPopAt) - Date.parse(b.firstPopAt);
    })
    .slice(0, 8);
}
