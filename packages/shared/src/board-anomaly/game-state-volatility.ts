import type {
  BoardAnomalyAlert,
  BoardAnomalyDetectorConfig,
  BoardGameStateVolatility,
  BoardGameStateVolatilityBand,
  BoardObservationScored,
  MarketFamily,
} from "@signal-console/domain";

import {
  averageContribution,
  averageH0Suppression,
  averageMicrostructure,
  coverageRatio,
  evidenceFromScored,
  firstPopAtFromScored,
  h0DriversFromScored,
  instrumentIdsFromScored,
  missingDataNotesFromScored,
  sourceMarketIdsFromScored,
  unmappedRatio,
  withinShockWindow,
} from "./alert-metrics";
import { clamp01, scoreToSeverity } from "./config";

const FAMILY_ORDER: MarketFamily[] = [
  "moneyline",
  "spread",
  "total",
  "team-prop",
  "player-prop",
  "other",
];

const CORE_GAME_STATE_FAMILIES = new Set<MarketFamily>([
  "moneyline",
  "spread",
  "total",
  "team-prop",
]);

type BuildGameStateVolatilityAlertInput = {
  scored: BoardObservationScored[];
  config: BoardAnomalyDetectorConfig;
  gameId: string;
  gameLabel: string;
  detectedAtIso: string;
  nowMs: number;
  shockWindowMs: number;
};

type GameStateVolatilityCalculation = {
  candidates: BoardObservationScored[];
  coreFamilies: Set<MarketFamily>;
  families: Set<MarketFamily>;
  firstPopAt: string;
  measurement: BoardGameStateVolatility;
  orderedFamilies: MarketFamily[];
  sourceMarketIds: string[];
  sources: BoardGameStateVolatility["sample"]["sources"];
  topRows: BoardObservationScored[];
};

function familySet(scored: BoardObservationScored[]): Set<MarketFamily> {
  return new Set(
    scored
      .map((item) => item.observation.family)
      .filter((family): family is MarketFamily => family != null)
  );
}

function sortFamilies(families: Set<MarketFamily>): MarketFamily[] {
  return FAMILY_ORDER.filter((family) => families.has(family));
}

function formatFamily(family: MarketFamily): string {
  return family.replace(/-/g, " ");
}

function freshPredictionMarketRow(item: BoardObservationScored): boolean {
  const observation = item.observation;
  return (
    observation.sourceKind === "prediction-market" &&
    !observation.flags.isHeartbeat &&
    !observation.flags.isStale &&
    !observation.missing.impliedProbability
  );
}

function bandForScore(
  score: number,
  config: BoardAnomalyDetectorConfig
): BoardGameStateVolatilityBand {
  if (score >= 85) return "critical";
  if (score >= config.minScore) return "alert";
  if (score >= 40) return "elevated";
  return "normal";
}

function calculateGameStateVolatility({
  scored,
  config,
  gameId,
  gameLabel,
  detectedAtIso,
  nowMs,
  shockWindowMs,
}: BuildGameStateVolatilityAlertInput): GameStateVolatilityCalculation | null {
  const sampleRows = scored.filter(freshPredictionMarketRow);
  const candidates = sampleRows.filter((item) => item.contribution > 0);
  const sourceMarketIds = sourceMarketIdsFromScored(sampleRows);
  const shockRows = candidates.filter((item) =>
    withinShockWindow(item.observation, nowMs, shockWindowMs)
  );
  const families = familySet(sampleRows);
  const coreFamilies = new Set(
    Array.from(families).filter((family) =>
      CORE_GAME_STATE_FAMILIES.has(family)
    )
  );
  const topRows = sampleRows
    .slice()
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, config.gameStateVolatility.topEvidenceRows);

  const baseContribution = averageContribution(topRows);
  const microstructureAverage = averageMicrostructure(topRows);
  const familyBreadth = clamp01(
    families.size / Math.max(1, config.gameStateVolatility.minFamilies)
  );
  const coreBreadth = clamp01(
    coreFamilies.size /
      Math.max(1, config.gameStateVolatility.minCoreFamilies + 1)
  );
  const sources = Array.from(
    new Set(sampleRows.map((item) => item.observation.source))
  ).sort();
  const sourceBreadth = clamp01(sources.length / 2);
  const freshShockRatio =
    sampleRows.length === 0 ? 0 : clamp01(shockRows.length / sampleRows.length);
  const coherence = clamp01(
    familyBreadth * 0.45 +
      coreBreadth * 0.3 +
      sourceBreadth * 0.15 +
      freshShockRatio * 0.1
  );
  const coverage = clamp01(coverageRatio(candidates));

  const weightedScore =
    baseContribution * 0.5 +
    microstructureAverage * 0.2 +
    coherence * 0.3 -
    coverage * 0.1;
  const score = Math.round(clamp01(weightedScore) * 100);
  const confidence = clamp01(
    0.5 +
      coherence * 0.35 +
      Math.min(0.1, topRows.length * 0.02) -
      coverage * 0.3 -
      unmappedRatio(candidates) * 0.15
  );
  const orderedFamilies = sortFamilies(families);
  const ready =
    sampleRows.length >= config.gameStateVolatility.minPredictionMarketRows &&
    sourceMarketIds.length >=
      config.gameStateVolatility.minPredictionMarketRows &&
    families.size >= config.gameStateVolatility.minFamilies &&
    coreFamilies.size >= config.gameStateVolatility.minCoreFamilies &&
    (config.gameStateVolatility.minShockRows <= 0 ||
      shockRows.length >= config.gameStateVolatility.minShockRows);
  const band: BoardGameStateVolatilityBand = ready
    ? bandForScore(score, config)
    : "insufficient-data";
  const impactfulRows = topRows.filter((item) => item.contribution > 0);
  const firstPopAt =
    impactfulRows.length > 0
      ? firstPopAtFromScored(impactfulRows, detectedAtIso)
      : detectedAtIso;
  const measurement: BoardGameStateVolatility = {
    alertId:
      ready && score >= config.minScore && confidence >= config.minConfidence
        ? [
            "board-alert",
            gameId,
            "game-state-volatility",
            "no-entity",
            firstPopAt,
          ].join(":")
        : null,
    band,
    components: {
      residual: Number(baseContribution.toFixed(3)),
      microstructure: Number(microstructureAverage.toFixed(3)),
      coherence: Number(coherence.toFixed(3)),
      coverage: Number(coverage.toFixed(3)),
    },
    confidence: Number(confidence.toFixed(3)),
    evidence: evidenceFromScored(
      topRows,
      config.gameStateVolatility.topEvidenceRows
    ),
    gameId,
    gameLabel,
    h0Adjustments: {
      appliedSuppression: Number(averageH0Suppression(candidates).toFixed(3)),
      drivers: h0DriversFromScored(candidates),
    },
    measuredAt: detectedAtIso,
    missingDataNotes: missingDataNotesFromScored(candidates),
    sample: {
      coreFamilies: sortFamilies(coreFamilies),
      families: orderedFamilies,
      predictionMarketRows: sampleRows.length,
      ready,
      shockRows: shockRows.length,
      sourceMarketCount: sourceMarketIds.length,
      sources,
    },
    score,
    thresholds: {
      alertMinScore: config.minScore,
      criticalMinScore: 85,
      elevatedMinScore: 40,
      normalMaxScore: 39,
    },
  };

  return {
    candidates,
    coreFamilies,
    families,
    firstPopAt,
    measurement,
    orderedFamilies,
    sourceMarketIds,
    sources,
    topRows,
  };
}

export function measureGameStateVolatility(
  input: BuildGameStateVolatilityAlertInput
): BoardGameStateVolatility | null {
  return calculateGameStateVolatility(input)?.measurement ?? null;
}

export function buildGameStateVolatilityAlert(
  input: BuildGameStateVolatilityAlertInput
): BoardAnomalyAlert | null {
  const { config } = input;
  const calculation = calculateGameStateVolatility(input);
  if (!calculation) {
    return null;
  }
  const {
    candidates,
    families,
    firstPopAt,
    measurement,
    orderedFamilies,
    sourceMarketIds,
    sources,
  } = calculation;

  if (!measurement.sample.ready) {
    return null;
  }

  if (
    measurement.score < config.minScore ||
    measurement.confidence < config.minConfidence
  ) {
    return null;
  }

  const familyText = orderedFamilies.map(formatFamily).join(", ");
  const propContext = families.has("player-prop")
    ? "; player props retained as supporting evidence"
    : "";

  return {
    id:
      measurement.alertId ??
      [
        "board-alert",
        input.gameId,
        "game-state-volatility",
        "no-entity",
        firstPopAt,
      ].join(":"),
    gameId: input.gameId,
    gameLabel: input.gameLabel,
    shockKind: "game-state-volatility",
    firstPopAt,
    detectedAt: input.detectedAtIso,
    score: measurement.score,
    confidence: measurement.confidence,
    severity: scoreToSeverity(measurement.score),
    reason: `prediction-market game-state implied volatility across ${familyText}; sources ${sources.join("/")}${propContext}`,
    primaryEntityKey: null,
    primaryFamily: null,
    components: measurement.components,
    h0Adjustments: measurement.h0Adjustments,
    evidence: measurement.evidence,
    missingDataNotes: measurement.missingDataNotes,
    inspect: {
      payloadVersion: 1,
      instrumentIds: instrumentIdsFromScored(candidates),
      sourceMarketIds,
      relationFamilies: [
        "game-state-volatility",
        ...orderedFamilies.map(formatFamily),
      ],
    },
  };
}
