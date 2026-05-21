import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

import { defaultBoardAnomalyDetectorConfig } from "../../packages/domain/src/board-anomaly.ts";
import {
  detectBoardAnomaliesForGame,
  replayBoardAnomaliesForGame,
} from "../../packages/shared/src/board-anomaly-game-runtime.ts";
import { resolveBoardAnomalyConfig } from "../../packages/shared/src/board-anomaly/config.ts";
import { computeH0Adjustment } from "../../packages/shared/src/board-anomaly/h0.ts";
import { materializeBoardObservations } from "../../packages/shared/src/board-anomaly-observations.ts";
import { scoreObservation } from "../../packages/shared/src/board-anomaly/residual.ts";
import { getDatabase } from "../../packages/shared/src/db-core.ts";

type AnchorSeed = {
  caseId: string;
  gameId: string;
  anchorAt: string;
  expectedPlayer: string;
  pairedPlayer: string | null;
  statFamily: string;
  sourceNote: string;
};

type AnchorTrustClass = "trusted" | "bad-input";

type PbpMatch = {
  matched: boolean;
  matchType: "exact-time" | "within-5s" | "no-match";
  deltaSeconds: number | null;
  description: string | null;
  period: number | null;
  clock: string | null;
  timeActual: string | null;
};

type PlayerStats = {
  contributionShare: number;
  derivativeFamilyCount: number;
  instrumentCount: number;
  maxOffPrice: number;
  maxVolumeShare: number;
  sourceMarketCount: number;
  statFamilyCount: number;
};

type AnchorContext = {
  anchor: AnchorSeed;
  coreFamilyCount: number;
  expectedKeys: Set<string>;
  hasExtremeObservation: boolean;
  inPlayObservationShare: number;
  observationsTotal: number;
  pairedKey: string | null;
  pbpMatch: PbpMatch;
  playerStats: Map<string, PlayerStats>;
  scheduledObservationShare: number;
  staleShare: number;
  topCandidateKey: string | null;
  trustClass: AnchorTrustClass;
};

type IterationRuleSet = {
  breadthBoard?: boolean;
  concentrationGate?: boolean;
  derivativeBoost?: boolean;
  entityFloor?: boolean;
  freshnessGate?: boolean;
  offPricePriority?: boolean;
  splitThresholds?: boolean;
  stateGate?: boolean;
};

type IterationDef = {
  id: string;
  label: string;
  rules: IterationRuleSet;
};

type AdjustedAlert = {
  confidence: number;
  detectedAt: string;
  firstPopAt: string;
  primaryEntityKey: string | null;
  reason: string;
  score: number;
  shockKind: string;
};

type IterationRow = {
  boardLeadSec: number | null;
  caseId: string;
  entityLeadSec: number | null;
  expectedInTop5: boolean;
  notes: string;
  result:
    | "bad-input-board-only"
    | "bad-input-entity-fire"
    | "bad-input-silent"
    | "board-only"
    | "hit"
    | "late"
    | "miss"
    | "noisy";
  top5: string;
  trustClass: AnchorTrustClass;
};

type LeaderboardRow = {
  badInputEntityFires: number;
  iteration: string;
  medianBoardLead: number | null;
  medianEntityLead: number | null;
  noisyCalls: number;
  rank: number;
  trustedBoardMisses: number;
  trustedMisses: number;
};

type RunSummary = {
  anchors: AnchorContext[];
  expanded: boolean;
  finalVerdict: "not trustworthy yet" | "safe board-only" | "safe player-specific";
  iterationRows: Map<string, IterationRow[]>;
  leaderboard: LeaderboardRow[];
  winner: LeaderboardRow;
};

const OUTPUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_XLSX = path.join(OUTPUT_DIR, "nba-math-backtest.xlsx");
const OUTPUT_JSON = path.join(OUTPUT_DIR, "nba-math-backtest-results.json");
const OUTPUT_CSV = path.join(OUTPUT_DIR, "leaderboard.csv");

const CONFIG = resolveBoardAnomalyConfig(defaultBoardAnomalyDetectorConfig);
const CONTEXT_WINDOW_MINUTES = 30;
const ANCHOR_WINDOW_MS = 5 * 60_000;
const REPLAY_LOOKBACK_MS = 10 * 60_000;
const REPLAY_LOOKAHEAD_MS = 2 * 60_000;

const ANCHOR_POOL: AnchorSeed[] = [
  {
    caseId: "case01_sam_merrill_team_oreb",
    gameId: "nba-0042500207",
    anchorAt: "2026-05-18T02:00:53.400Z",
    expectedPlayer: "Sam Merrill",
    pairedPlayer: null,
    statFamily: "rebounds",
    sourceNote:
      "Public anchor: Twstalker @nba_elise, 3Q 4:45 TEAM offensive REBOUND missing Sam Merrill rebound.",
  },
  {
    caseId: "case02_d_jenkins_to_c_levert_3pt",
    gameId: "nba-0042500207",
    anchorAt: "2026-05-18T01:54:46.800Z",
    expectedPlayer: "Daniss Jenkins",
    pairedPlayer: "Caris LeVert",
    statFamily: "assists",
    sourceNote:
      "Trusted exact PBP anchor: C. LeVert 26' 3PT running pullup (10 PTS) (D. Jenkins 3 AST).",
  },
  {
    caseId: "case03_m_sasser_rebound",
    gameId: "nba-0042500207",
    anchorAt: "2026-05-18T02:03:12.200Z",
    expectedPlayer: "Marcus Sasser",
    pairedPlayer: null,
    statFamily: "rebounds",
    sourceNote:
      "Trusted exact PBP anchor: M. Sasser REBOUND (Off:1 Def:0).",
  },
  {
    caseId: "case04_sam_merrill_layup",
    gameId: "nba-0042500207",
    anchorAt: "2026-05-18T02:14:58.700Z",
    expectedPlayer: "Sam Merrill",
    pairedPlayer: null,
    statFamily: "points",
    sourceNote:
      "Trusted exact PBP anchor: S. Merrill running Layup (23 PTS).",
  },
  {
    caseId: "case05_bad_cade_block_public",
    gameId: "nba-0042500205",
    anchorAt: "2026-05-14T01:42:34.934Z",
    expectedPlayer: "Cade Cunningham",
    pairedPlayer: null,
    statFamily: "blocks",
    sourceNote:
      "Bad-input public anchor: Twstalker @nba_elise C. Cunningham BLOCK tweet; no persisted exact PBP match within +/-5s and window classifies as scheduled.",
  },
  {
    caseId: "case06_bad_dean_wade_three",
    gameId: "nba-0042500206",
    anchorAt: "2026-05-16T00:08:06.400Z",
    expectedPlayer: "Dean Wade",
    pairedPlayer: "James Harden",
    statFamily: "points",
    sourceNote:
      "Bad-input exact PBP anchor: D. Wade 3PT (3 PTS) (J. Harden 2 AST), but observation window still classifies as scheduled.",
  },
  {
    caseId: "case07_d_jenkins_floater",
    gameId: "nba-0042500207",
    anchorAt: "2026-05-18T01:44:53.600Z",
    expectedPlayer: "Daniss Jenkins",
    pairedPlayer: "Jalen Duren",
    statFamily: "points",
    sourceNote:
      "Expansion trusted exact PBP anchor: D. Jenkins 13' driving floating Jump Shot (8 PTS) (J. Duren 2 AST).",
  },
  {
    caseId: "case08_t_smith_layup_d_jenkins_ast",
    gameId: "nba-0042500207",
    anchorAt: "2026-05-18T02:45:28.100Z",
    expectedPlayer: "Daniss Jenkins",
    pairedPlayer: "T. Smith",
    statFamily: "assists",
    sourceNote:
      "Expansion trusted exact PBP anchor: T. Smith driving Layup (4 PTS) (D. Jenkins 5 AST).",
  },
  {
    caseId: "case09_bad_sasser_public",
    gameId: "nba-0042500205",
    anchorAt: "2026-05-14T01:15:24.962Z",
    expectedPlayer: "Marcus Sasser",
    pairedPlayer: null,
    statFamily: "rebounds",
    sourceNote:
      "Expansion bad-input public anchor: Twstalker @nba_elise M. Sasser REBOUND tweet; no persisted exact PBP match within +/-5s.",
  },
  {
    caseId: "case10_bad_jalen_duren_turnaround",
    gameId: "nba-0042500206",
    anchorAt: "2026-05-16T01:18:26.200Z",
    expectedPlayer: "Jalen Duren",
    pairedPlayer: null,
    statFamily: "points",
    sourceNote:
      "Expansion bad-input exact PBP anchor: J. Duren turnaround Jump Shot (11 PTS), but observation window still classifies as scheduled.",
  },
];

const INITIAL_CASE_IDS = new Set([
  "case01_sam_merrill_team_oreb",
  "case02_d_jenkins_to_c_levert_3pt",
  "case03_m_sasser_rebound",
  "case04_sam_merrill_layup",
  "case05_bad_cade_block_public",
  "case06_bad_dean_wade_three",
]);

const ITERATIONS: IterationDef[] = [
  { id: "Iter01", label: "Baseline", rules: {} },
  { id: "Iter02", label: "StateGate", rules: { stateGate: true } },
  {
    id: "Iter03",
    label: "FreshnessGate",
    rules: { freshnessGate: true, stateGate: true },
  },
  {
    id: "Iter04",
    label: "EntityFloor",
    rules: { entityFloor: true, freshnessGate: true, stateGate: true },
  },
  {
    id: "Iter05",
    label: "BreadthBoard",
    rules: {
      breadthBoard: true,
      entityFloor: true,
      freshnessGate: true,
      stateGate: true,
    },
  },
  {
    id: "Iter06",
    label: "ConcentrationGate",
    rules: {
      breadthBoard: true,
      concentrationGate: true,
      entityFloor: true,
      freshnessGate: true,
      stateGate: true,
    },
  },
  {
    id: "Iter07",
    label: "DerivativeBoost",
    rules: {
      breadthBoard: true,
      concentrationGate: true,
      derivativeBoost: true,
      entityFloor: true,
      freshnessGate: true,
      stateGate: true,
    },
  },
  {
    id: "Iter08",
    label: "OffPricePriority",
    rules: {
      breadthBoard: true,
      concentrationGate: true,
      derivativeBoost: true,
      entityFloor: true,
      freshnessGate: true,
      offPricePriority: true,
      stateGate: true,
    },
  },
  {
    id: "Iter09",
    label: "SplitThresholds",
    rules: {
      breadthBoard: true,
      concentrationGate: true,
      derivativeBoost: true,
      entityFloor: true,
      freshnessGate: true,
      offPricePriority: true,
      splitThresholds: true,
      stateGate: true,
    },
  },
  {
    id: "Iter10",
    label: "HybridWinner",
    rules: {
      concentrationGate: true,
      entityFloor: true,
      freshnessGate: true,
      offPricePriority: true,
      splitThresholds: true,
      stateGate: true,
    },
  },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compareAlerts(left: AdjustedAlert, right: AdjustedAlert) {
  if (right.score !== left.score) return right.score - left.score;
  if (right.confidence !== left.confidence) {
    return right.confidence - left.confidence;
  }
  return left.detectedAt.localeCompare(right.detectedAt);
}

function formatLead(value: number | null) {
  if (value == null) return "";
  return `${value}`;
}

function isoOffset(iso: string, offsetMs: number) {
  return new Date(Date.parse(iso) + offsetMs).toISOString();
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankedTopEntities(alerts: AdjustedAlert[]) {
  return alerts
    .filter((alert) => alert.primaryEntityKey)
    .sort(compareAlerts)
    .slice(0, 5)
    .map((alert) => `${alert.primaryEntityKey} (${alert.score})`);
}

function summarizeExpectedInTop5(top5: string[], expectedKeys: Set<string>) {
  return top5.some((entry) => {
    const label = entry.replace(/\s+\(\d+\)$/, "");
    return expectedKeys.has(normalizeKey(label));
  });
}

function fetchNearestPbp(seed: AnchorSeed): PbpMatch {
  const db = getDatabase();
  const anchorMs = Date.parse(seed.anchorAt);
  const rows = db
    .prepare(
      `SELECT
         time_actual AS timeActual,
         period,
         clock,
         description
       FROM nba_play_by_play_actions
       WHERE game_id = ?
         AND time_actual BETWEEN ? AND ?
       ORDER BY ABS(strftime('%s', time_actual) - strftime('%s', ?)) ASC,
         time_actual ASC
       LIMIT 1`
    )
    .all(
      seed.gameId,
      isoOffset(seed.anchorAt, -5_000),
      isoOffset(seed.anchorAt, 5_000),
      seed.anchorAt
    ) as Array<{
    clock: string | null;
    description: string | null;
    period: number | null;
    timeActual: string | null;
  }>;

  const match = rows[0];
  if (!match?.timeActual) {
    return {
      matched: false,
      matchType: "no-match",
      deltaSeconds: null,
      description: null,
      period: null,
      clock: null,
      timeActual: null,
    };
  }

  const deltaSeconds = Math.round((Date.parse(match.timeActual) - anchorMs) / 1000);
  return {
    matched: true,
    matchType: deltaSeconds === 0 ? "exact-time" : "within-5s",
    deltaSeconds,
    description: match.description,
    period: match.period,
    clock: match.clock,
    timeActual: match.timeActual,
  };
}

function buildAnchorContext(seed: AnchorSeed): AnchorContext {
  const windowStart = isoOffset(seed.anchorAt, -ANCHOR_WINDOW_MS);
  const materialized = materializeBoardObservations({
    gameId: seed.gameId,
    windowStart,
    windowEnd: seed.anchorAt,
  });
  const observations = materialized?.observations ?? [];
  const scored = observations.map((observation) =>
    scoreObservation(observation, computeH0Adjustment(observation, CONFIG), CONFIG)
  );

  const inPlayCount = observations.filter(
    (observation) => observation.gameState.status === "in-play"
  ).length;
  const scheduledCount = observations.filter(
    (observation) => observation.gameState.status === "scheduled"
  ).length;
  const staleCount = observations.filter((observation) => observation.flags.isStale)
    .length;
  const totalObservations = observations.length;
  const inPlayObservationShare =
    totalObservations > 0 ? inPlayCount / totalObservations : 0;
  const scheduledObservationShare =
    totalObservations > 0 ? scheduledCount / totalObservations : 0;
  const staleShare = totalObservations > 0 ? staleCount / totalObservations : 0;

  const trustClass: AnchorTrustClass =
    totalObservations >= 20 && inPlayObservationShare >= 0.8
      ? "trusted"
      : scheduledObservationShare >= 0.5 || totalObservations < 20
        ? "bad-input"
        : "bad-input";

  const contributionByPlayer = new Map<
    string,
    {
      contributionSum: number;
      derivativeFamilies: Set<string>;
      instrumentIds: Set<string>;
      maxOffPrice: number;
      maxVolumeShare: number;
      sourceMarketIds: Set<string>;
      statFamilies: Set<string>;
    }
  >();

  let totalPlayerContribution = 0;
  let hasExtremeObservation = false;
  for (const entry of scored) {
    const key = normalizeKey(
      entry.observation.participantKey ??
        entry.observation.labels.participantHints[0] ??
        null
    );
    if (!key) continue;
    const current =
      contributionByPlayer.get(key) ??
      {
        contributionSum: 0,
        derivativeFamilies: new Set<string>(),
        instrumentIds: new Set<string>(),
        maxOffPrice: 0,
        maxVolumeShare: 0,
        sourceMarketIds: new Set<string>(),
        statFamilies: new Set<string>(),
      };

    current.contributionSum += entry.contribution;
    totalPlayerContribution += entry.contribution;
    if (entry.observation.instrumentId) {
      current.instrumentIds.add(entry.observation.instrumentId);
    }
    current.sourceMarketIds.add(entry.observation.sourceMarketId);
    for (const statFamily of entry.observation.labels.statFamilyHints) {
      current.statFamilies.add(statFamily);
      current.derivativeFamilies.add(statFamily);
    }
    if (entry.observation.family && entry.observation.family !== "player-prop") {
      current.derivativeFamilies.add(entry.observation.family);
    }
    current.maxOffPrice = Math.max(
      current.maxOffPrice,
      entry.microstructure.offPrice
    );
    current.maxVolumeShare = Math.max(
      current.maxVolumeShare,
      entry.observation.volumeShare ?? 0
    );
    hasExtremeObservation =
      hasExtremeObservation ||
      entry.microstructure.offPrice >= 0.5 ||
      (entry.observation.volumeShare ?? 0) >= 0.5;
    contributionByPlayer.set(key, current);
  }

  let topCandidateKey: string | null = null;
  let topContribution = -1;
  const playerStats = new Map<string, PlayerStats>();
  for (const [key, value] of contributionByPlayer.entries()) {
    if (value.contributionSum > topContribution) {
      topContribution = value.contributionSum;
      topCandidateKey = key;
    }
    playerStats.set(key, {
      contributionShare:
        totalPlayerContribution > 0
          ? value.contributionSum / totalPlayerContribution
          : 0,
      derivativeFamilyCount: value.derivativeFamilies.size,
      instrumentCount: value.instrumentIds.size,
      maxOffPrice: value.maxOffPrice,
      maxVolumeShare: value.maxVolumeShare,
      sourceMarketCount: value.sourceMarketIds.size,
      statFamilyCount: value.statFamilies.size,
    });
  }

  const coreFamilyCount = new Set(
    observations
      .filter((observation) => observation.sourceKind === "prediction-market")
      .map((observation) => observation.family)
      .filter(
        (family): family is string =>
          family === "moneyline" ||
          family === "spread" ||
          family === "total" ||
          family === "team-prop"
      )
  ).size;

  const expectedKey = normalizeKey(seed.expectedPlayer);
  const pairedKey = normalizeKey(seed.pairedPlayer);
  return {
    anchor: seed,
    coreFamilyCount,
    expectedKeys: new Set([expectedKey, pairedKey].filter(Boolean)),
    hasExtremeObservation,
    inPlayObservationShare,
    observationsTotal: totalObservations,
    pairedKey: pairedKey || null,
    pbpMatch: fetchNearestPbp(seed),
    playerStats,
    scheduledObservationShare,
    staleShare,
    topCandidateKey,
    trustClass,
  };
}

function isBoardAlert(alert: {
  primaryEntityKey: string | null;
  shockKind: string;
}) {
  return alert.shockKind === "game-state-volatility" || alert.primaryEntityKey == null;
}

function adjustAlert(
  alert: {
    confidence: number;
    detectedAt: string;
    firstPopAt: string;
    primaryEntityKey: string | null;
    reason: string;
    score: number;
    shockKind: string;
  },
  context: AnchorContext,
  iteration: IterationDef
): AdjustedAlert | null {
  const board = isBoardAlert(alert);
  const key = normalizeKey(alert.primaryEntityKey);
  const player = key ? context.playerStats.get(key) : undefined;
  let score = alert.score;

  if (iteration.rules.stateGate && context.trustClass !== "trusted" && !board) {
    return null;
  }

  if (iteration.rules.freshnessGate && context.staleShare > 0.25 && !board) {
    return null;
  }

  if (iteration.rules.entityFloor && !board) {
    if (
      !player ||
      player.instrumentCount < 2 ||
      player.sourceMarketCount < 2
    ) {
      return null;
    }
  }

  if (iteration.rules.breadthBoard) {
    if (board) {
      score = clampScore(score + 5 * Math.max(0, context.coreFamilyCount - 2));
    } else if ((player?.statFamilyCount ?? 0) === 1) {
      score = clampScore(score - 10);
    }
  }

  if (iteration.rules.concentrationGate && !board) {
    if ((player?.contributionShare ?? 0) < 0.35) {
      return null;
    }
  }

  if (iteration.rules.derivativeBoost && !board) {
    if ((player?.derivativeFamilyCount ?? 0) >= 2) {
      score = clampScore(score + 10);
    } else {
      score = clampScore(score - 10);
    }
  }

  if (iteration.rules.offPricePriority) {
    if (board && context.hasExtremeObservation) {
      score = clampScore(score + 10);
    } else if (!board && context.hasExtremeObservation) {
      const allowed = new Set(
        [...context.expectedKeys, context.topCandidateKey ?? ""].filter(Boolean)
      );
      if (!allowed.has(key)) {
        return null;
      }
    }
  }

  if (iteration.rules.splitThresholds) {
    if (board) {
      if (score < 50 || alert.confidence < 0.55) return null;
    } else if (score < 70 || alert.confidence < 0.7) {
      return null;
    }
  }

  return {
    confidence: alert.confidence,
    detectedAt: alert.detectedAt,
    firstPopAt: alert.firstPopAt,
    primaryEntityKey: alert.primaryEntityKey,
    reason: alert.reason,
    score,
    shockKind: alert.shockKind,
  };
}

function relevantReplayAlerts(
  replayAlerts: Array<{
    confidence: number;
    detectedAt: string;
    firstPopAt: string;
    primaryEntityKey: string | null;
    reason: string;
    score: number;
    shockKind: string;
  }>,
  anchorAt: string
) {
  const minDetected = Date.parse(anchorAt) - REPLAY_LOOKBACK_MS;
  const maxDetected = Date.parse(anchorAt) + REPLAY_LOOKAHEAD_MS;
  return replayAlerts.filter((alert) => {
    const detectedAtMs = Date.parse(alert.detectedAt);
    return (
      Number.isFinite(detectedAtMs) &&
      detectedAtMs >= minDetected &&
      detectedAtMs <= maxDetected
    );
  });
}

function selectLeadSeconds(
  alerts: AdjustedAlert[],
  anchorAt: string,
  predicate: (alert: AdjustedAlert) => boolean
) {
  const anchorMs = Date.parse(anchorAt);
  const before = alerts
    .filter((alert) => predicate(alert) && Date.parse(alert.detectedAt) <= anchorMs)
    .sort((left, right) => Date.parse(left.detectedAt) - Date.parse(right.detectedAt));
  if (before.length > 0) {
    return Math.round(
      (anchorMs - Date.parse(before[0]!.detectedAt)) / 1000
    );
  }

  const after = alerts
    .filter((alert) => predicate(alert) && Date.parse(alert.detectedAt) > anchorMs)
    .sort((left, right) => Date.parse(left.detectedAt) - Date.parse(right.detectedAt));
  if (after.length > 0) {
    return -Math.round(
      (Date.parse(after[0]!.detectedAt) - anchorMs) / 1000
    );
  }

  return null;
}

function classifyResult(
  context: AnchorContext,
  boardLeadSec: number | null,
  entityLeadSec: number | null,
  expectedInTop5: boolean,
  top5Count: number
): IterationRow["result"] {
  if (context.trustClass === "bad-input") {
    if (top5Count > 0) return "bad-input-entity-fire";
    if (boardLeadSec != null) return "bad-input-board-only";
    return "bad-input-silent";
  }

  if (expectedInTop5 && entityLeadSec != null && entityLeadSec >= 0) {
    return "hit";
  }
  if (expectedInTop5 && entityLeadSec != null && entityLeadSec < 0) {
    return "late";
  }
  if (boardLeadSec != null && boardLeadSec >= 0 && top5Count > 0) {
    return "noisy";
  }
  if (boardLeadSec != null && boardLeadSec >= 0) {
    return "board-only";
  }
  return "miss";
}

function evaluateIterationForAnchor(
  context: AnchorContext,
  iteration: IterationDef
): IterationRow {
  const liveAlerts = detectBoardAnomaliesForGame({
    gameId: context.anchor.gameId,
    now: context.anchor.anchorAt,
    contextWindowMinutes: CONTEXT_WINDOW_MINUTES,
  })
    .map((alert) =>
      adjustAlert(
        {
          confidence: alert.confidence,
          detectedAt: alert.detectedAt,
          firstPopAt: alert.firstPopAt,
          primaryEntityKey: alert.primaryEntityKey,
          reason: alert.reason,
          score: alert.score,
          shockKind: alert.shockKind,
        },
        context,
        iteration
      )
    )
    .filter((alert): alert is AdjustedAlert => alert != null)
    .sort(compareAlerts);

  const replayAlerts =
    replayBoardAnomaliesForGame({
      gameId: context.anchor.gameId,
      ingestionLatencyBufferSeconds: 0,
      stepSeconds: 30,
      windowStart: isoOffset(context.anchor.anchorAt, -REPLAY_LOOKBACK_MS),
      windowEnd: isoOffset(context.anchor.anchorAt, REPLAY_LOOKAHEAD_MS),
    })?.alertDeck ?? [];

  const adjustedReplay = relevantReplayAlerts(
    replayAlerts.map((alert) => ({
      confidence: alert.confidence,
      detectedAt: alert.detectedAt,
      firstPopAt: alert.firstPopAt,
      primaryEntityKey: alert.primaryEntityKey,
      reason: alert.reason,
      score: alert.score,
      shockKind: alert.shockKind,
    })),
    context.anchor.anchorAt
  )
    .map((alert) => adjustAlert(alert, context, iteration))
    .filter((alert): alert is AdjustedAlert => alert != null)
    .sort(compareAlerts);

  const boardLeadSec = selectLeadSeconds(adjustedReplay, context.anchor.anchorAt, (alert) =>
    isBoardAlert(alert)
  );
  const entityLeadSec = selectLeadSeconds(
    adjustedReplay,
    context.anchor.anchorAt,
    (alert) =>
      !isBoardAlert(alert) &&
      context.expectedKeys.has(normalizeKey(alert.primaryEntityKey))
  );

  const top5List = rankedTopEntities(liveAlerts);
  const expectedInTop5 = summarizeExpectedInTop5(top5List, context.expectedKeys);
  const result = classifyResult(
    context,
    boardLeadSec,
    entityLeadSec,
    expectedInTop5,
    top5List.length
  );

  const noteParts = [
    `trust=${context.trustClass}`,
    `obs=${context.observationsTotal}`,
    `inPlay=${context.inPlayObservationShare.toFixed(2)}`,
    `scheduled=${context.scheduledObservationShare.toFixed(2)}`,
    `stale=${context.staleShare.toFixed(2)}`,
    `pbp=${context.pbpMatch.matchType}`,
  ];
  if (context.pbpMatch.description) {
    noteParts.push(context.pbpMatch.description);
  }

  return {
    boardLeadSec,
    caseId: context.anchor.caseId,
    entityLeadSec,
    expectedInTop5,
    notes: noteParts.join(" | "),
    result,
    top5: top5List.join(" | "),
    trustClass: context.trustClass,
  };
}

function buildLeaderboard(
  iterationRows: Map<string, IterationRow[]>
): LeaderboardRow[] {
  const rows = ITERATIONS.map((iteration) => {
    const currentRows = iterationRows.get(iteration.id) ?? [];
    const trustedRows = currentRows.filter((row) => row.trustClass === "trusted");
    const badRows = currentRows.filter((row) => row.trustClass === "bad-input");
    const trustedMisses = trustedRows.filter((row) =>
      row.result === "board-only" ||
      row.result === "late" ||
      row.result === "miss"
    ).length;
    const trustedBoardMisses = trustedRows.filter(
      (row) => row.boardLeadSec == null || row.boardLeadSec < 0
    ).length;
    const badInputEntityFires = badRows.filter(
      (row) => row.result === "bad-input-entity-fire"
    ).length;
    const noisyCalls = trustedRows.filter((row) => row.result === "noisy").length;
    const medianBoardLead = median(
      trustedRows
        .map((row) => row.boardLeadSec)
        .filter((value): value is number => value != null)
    );
    const medianEntityLead = median(
      trustedRows
        .map((row) => row.entityLeadSec)
        .filter((value): value is number => value != null)
    );

    return {
      badInputEntityFires,
      iteration: iteration.id,
      medianBoardLead,
      medianEntityLead,
      noisyCalls,
      rank: 0,
      trustedBoardMisses,
      trustedMisses,
    };
  }).sort((left, right) => {
    if (left.trustedMisses !== right.trustedMisses) {
      return left.trustedMisses - right.trustedMisses;
    }
    if (left.badInputEntityFires !== right.badInputEntityFires) {
      return left.badInputEntityFires - right.badInputEntityFires;
    }
    if (left.noisyCalls !== right.noisyCalls) {
      return left.noisyCalls - right.noisyCalls;
    }
    if ((right.medianBoardLead ?? -Infinity) !== (left.medianBoardLead ?? -Infinity)) {
      return (right.medianBoardLead ?? -Infinity) - (left.medianBoardLead ?? -Infinity);
    }
    return (right.medianEntityLead ?? -Infinity) - (left.medianEntityLead ?? -Infinity);
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}

function shouldExpand(leaderboard: LeaderboardRow[]) {
  if (leaderboard.length < 2) return false;
  const [best, second] = leaderboard;
  return (
    Math.abs(best!.trustedMisses - second!.trustedMisses) <= 1 ||
    Math.abs(best!.noisyCalls - second!.noisyCalls) <= 1
  );
}

function chooseVerdict(winner: LeaderboardRow) {
  if (
    winner.trustedMisses === 0 &&
    winner.badInputEntityFires === 0 &&
    winner.noisyCalls === 0
  ) {
    return "safe player-specific" as const;
  }
  if (winner.trustedBoardMisses === 0 && winner.badInputEntityFires === 0) {
    return "safe board-only" as const;
  }
  return "not trustworthy yet" as const;
}

function toCsv(rows: LeaderboardRow[]) {
  const headers = [
    "iteration",
    "trustedMisses",
    "badInputEntityFires",
    "noisyCalls",
    "medianBoardLead",
    "medianEntityLead",
    "trustedBoardMisses",
    "rank",
  ];
  const data = rows.map((row) =>
    [
      row.iteration,
      row.trustedMisses,
      row.badInputEntityFires,
      row.noisyCalls,
      row.medianBoardLead ?? "",
      row.medianEntityLead ?? "",
      row.trustedBoardMisses,
      row.rank,
    ].join(",")
  );
  return [headers.join(","), ...data].join("\n");
}

async function buildWorkbook(summary: RunSummary) {
  const workbook = Workbook.create();
  const anchorsSheet = workbook.worksheets.add("Anchors");
  const anchorRows = [
    [
      "caseId",
      "gameId",
      "anchorAt",
      "trustClass",
      "expectedPlayer",
      "pairedPlayer",
      "statFamily",
      "sourceNote",
      "pbpMatch",
      "pbpDeltaSec",
      "pbpDescription",
      "observations",
      "inPlayShare",
      "scheduledShare",
      "staleShare",
    ],
    ...summary.anchors.map((context) => [
      context.anchor.caseId,
      context.anchor.gameId,
      context.anchor.anchorAt,
      context.trustClass,
      context.anchor.expectedPlayer,
      context.anchor.pairedPlayer ?? "",
      context.anchor.statFamily,
      context.anchor.sourceNote,
      context.pbpMatch.matchType,
      context.pbpMatch.deltaSeconds ?? "",
      context.pbpMatch.description ?? "",
      context.observationsTotal,
      Number(context.inPlayObservationShare.toFixed(3)),
      Number(context.scheduledObservationShare.toFixed(3)),
      Number(context.staleShare.toFixed(3)),
    ]),
  ];
  anchorsSheet.getRange(`A1:O${anchorRows.length}`).values = anchorRows;

  for (const iteration of ITERATIONS) {
    const sheet = workbook.worksheets.add(iteration.id);
    const rows = summary.iterationRows.get(iteration.id) ?? [];
    const matrix = [
      [
        "caseId",
        "boardLeadSec",
        "entityLeadSec",
        "top5",
        "expectedInTop5",
        "result",
        "notes",
      ],
      ...rows.map((row) => [
        row.caseId,
        row.boardLeadSec ?? "",
        row.entityLeadSec ?? "",
        row.top5,
        row.expectedInTop5 ? "yes" : "no",
        row.result,
        row.notes,
      ]),
    ];
    sheet.getRange(`A1:G${matrix.length}`).values = matrix;
  }

  const leaderboardSheet = workbook.worksheets.add("Leaderboard");
  const leaderboardRows = [
    [
      "iteration",
      "trustedMisses",
      "badInputEntityFires",
      "noisyCalls",
      "medianBoardLead",
      "medianEntityLead",
      "trustedBoardMisses",
      "rank",
    ],
    ...summary.leaderboard.map((row) => [
      row.iteration,
      row.trustedMisses,
      row.badInputEntityFires,
      row.noisyCalls,
      row.medianBoardLead ?? "",
      row.medianEntityLead ?? "",
      row.trustedBoardMisses,
      row.rank,
    ]),
  ];
  leaderboardSheet.getRange(`A1:H${leaderboardRows.length}`).values =
    leaderboardRows;
  leaderboardSheet.getRange("J1:K5").values = [
    ["Winner", summary.winner.iteration],
    ["Verdict", summary.finalVerdict],
    ["Expanded", summary.expanded ? "yes" : "no"],
    ["Trusted anchors", summary.anchors.filter((anchor) => anchor.trustClass === "trusted").length],
    ["Bad-input anchors", summary.anchors.filter((anchor) => anchor.trustClass === "bad-input").length],
  ];

  await workbook.inspect({
    kind: "table",
    range: `Leaderboard!A1:K${leaderboardRows.length + 5}`,
    include: "values",
    tableMaxCols: 11,
    tableMaxRows: leaderboardRows.length + 5,
  });
  await workbook.inspect({
    kind: "table",
    range: `Anchors!A1:O${anchorRows.length}`,
    include: "values",
    tableMaxCols: 15,
    tableMaxRows: anchorRows.length,
  });
  await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { maxResults: 50, useRegex: true },
    summary: "formula scan",
  });
  await workbook.render({ sheetName: "Leaderboard", range: "A1:K15", scale: 2 });
  await workbook.render({ sheetName: "Anchors", range: "A1:O12", scale: 2 });

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(OUTPUT_XLSX);
}

async function run(): Promise<RunSummary> {
  const initialAnchors = ANCHOR_POOL.filter((anchor) =>
    INITIAL_CASE_IDS.has(anchor.caseId)
  ).map(buildAnchorContext);

  let iterationRows = new Map<string, IterationRow[]>();
  for (const iteration of ITERATIONS) {
    iterationRows.set(
      iteration.id,
      initialAnchors.map((anchor) => evaluateIterationForAnchor(anchor, iteration))
    );
  }

  let leaderboard = buildLeaderboard(iterationRows);
  let anchors = initialAnchors;
  const expanded = shouldExpand(leaderboard);

  if (expanded) {
    anchors = ANCHOR_POOL.map(buildAnchorContext);
    iterationRows = new Map<string, IterationRow[]>();
    for (const iteration of ITERATIONS) {
      iterationRows.set(
        iteration.id,
        anchors.map((anchor) => evaluateIterationForAnchor(anchor, iteration))
      );
    }
    leaderboard = buildLeaderboard(iterationRows);
  }

  const winner = leaderboard[0]!;
  const finalVerdict = chooseVerdict(winner);
  return {
    anchors,
    expanded,
    finalVerdict,
    iterationRows,
    leaderboard,
    winner,
  };
}

async function main() {
  const summary = await run();
  await fs.writeFile(
    OUTPUT_JSON,
    JSON.stringify(
      {
        anchors: summary.anchors.map((anchor) => ({
          anchorAt: anchor.anchor.anchorAt,
          caseId: anchor.anchor.caseId,
          expectedPlayer: anchor.anchor.expectedPlayer,
          gameId: anchor.anchor.gameId,
          inPlayObservationShare: anchor.inPlayObservationShare,
          observationsTotal: anchor.observationsTotal,
          pairedPlayer: anchor.anchor.pairedPlayer,
          pbpMatch: anchor.pbpMatch,
          scheduledObservationShare: anchor.scheduledObservationShare,
          sourceNote: anchor.anchor.sourceNote,
          staleShare: anchor.staleShare,
          statFamily: anchor.anchor.statFamily,
          trustClass: anchor.trustClass,
        })),
        expanded: summary.expanded,
        finalVerdict: summary.finalVerdict,
        iterationRows: Object.fromEntries(summary.iterationRows.entries()),
        leaderboard: summary.leaderboard,
        winner: summary.winner,
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(OUTPUT_CSV, toCsv(summary.leaderboard), "utf8");
  await buildWorkbook(summary);

  console.log(
    JSON.stringify(
      {
        expanded: summary.expanded,
        finalVerdict: summary.finalVerdict,
        leaderboard: summary.leaderboard,
        winner: summary.winner,
        xlsx: OUTPUT_XLSX,
      },
      null,
      2
    )
  );
}

void main();
