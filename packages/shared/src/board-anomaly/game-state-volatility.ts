import type {
  BoardAnomalyAlert,
  BoardAnomalyDetectorConfig,
  BoardGameStateVolatility,
  BoardGameStateVolatilityBand,
  BoardObservationScored,
} from "@signal-console/domain";

import { firstPopAtFromScored } from "./alert-metrics";
import { parseTimestampMs } from "../board-anomaly-support";
import {
  buildBoardVolatilityBaselineLookupInput,
  buildBoardVolatilityFeatureSnapshot,
  runBoardStressKalmanFilter,
} from "./board-volatility-model";
import {
  resolveFallbackBoardVolatilityBaseline,
  resolveBoardVolatilityBaseline,
  type BoardVolatilityBaselineResolved,
} from "../board-volatility-baselines";
import { deriveBoardVolatilityPhase } from "./board-volatility-phase";
import { scoreToSeverity } from "./config";

import type { GameStateRow } from "../board-anomaly-observation-context";

type BuildGameStateVolatilityAlertInput = {
  baselineResolver?: (
    input: Parameters<typeof resolveBoardVolatilityBaseline>[0]
  ) => BoardVolatilityBaselineResolved;
  bucketSeconds?: number;
  config: BoardAnomalyDetectorConfig;
  detectedAtIso: string;
  gameId: string;
  gameLabel: string;
  gameStates?: GameStateRow[];
  nowMs: number;
  scheduledStart?: string;
  scored: BoardObservationScored[];
  shockWindowMs: number;
};

type GameStateVolatilityCalculation = {
  firstPopAt: string;
  measurement: BoardGameStateVolatility;
};

function formatPhaseKind(kind: string) {
  return kind.replace(/-/g, " ");
}

function currentObservationGameState(
  scored: BoardObservationScored[],
  nowMs: number
) {
  const current = scored
    .slice()
    .sort((left, right) => {
      const leftTs =
        parseTimestampMs(left.observation.eventTimestamp) ??
        parseTimestampMs(left.observation.capturedAt) ??
        0;
      const rightTs =
        parseTimestampMs(right.observation.eventTimestamp) ??
        parseTimestampMs(right.observation.capturedAt) ??
        0;
      return rightTs - leftTs;
    })
    .find((row) => {
      const ts =
        parseTimestampMs(row.observation.eventTimestamp) ??
        parseTimestampMs(row.observation.capturedAt);
      return ts != null && ts <= nowMs;
    });
  return current?.observation.gameState ?? null;
}

function buildFilterObservations(input: {
  baseline: BoardVolatilityBaselineResolved;
  bucketSeconds: number;
  config: BoardAnomalyDetectorConfig;
  nowMs: number;
  scored: BoardObservationScored[];
  shockWindowMs: number;
}) {
  const seriesWindowMs = 5 * 60_000;
  const bucketMs = input.bucketSeconds * 1000;
  const startMs = Math.max(0, input.nowMs - seriesWindowMs);
  const observations: Array<{
    alertReady: boolean;
    calibratedAbnormality: number;
  }> = [];

  for (
    let bucketEndMs = startMs + bucketMs;
    bucketEndMs < input.nowMs;
    bucketEndMs += bucketMs
  ) {
    const bucketRows = input.scored.filter((row) => {
      const ts =
        parseTimestampMs(row.observation.eventTimestamp) ??
        parseTimestampMs(row.observation.capturedAt);
      return ts != null && ts <= bucketEndMs && ts >= bucketEndMs - 60_000;
    });
    if (bucketRows.length < 2) continue;

    const representative = buildBoardVolatilityFeatureSnapshot({
      baseline: input.baseline,
      config: input.config,
      persistenceSeconds: 0,
      phaseKind: input.baseline.phaseKind,
      scored: bucketRows,
      shockWindowMs: input.shockWindowMs,
      topEvidenceRows: Math.min(
        4,
        input.config.gameStateVolatility.topEvidenceRows
      ),
      transitionBoost: 0,
    });
    observations.push({
      alertReady: representative.alertReady,
      calibratedAbnormality: representative.calibratedAbnormality,
    });
  }

  return observations;
}

function trailingPersistenceSeconds(
  alertReadySeries: boolean[],
  bucketSeconds: number
) {
  let consecutive = 0;
  for (let index = alertReadySeries.length - 1; index >= 0; index -= 1) {
    if (!alertReadySeries[index]) break;
    consecutive += 1;
  }
  return consecutive * bucketSeconds;
}

function bandForMeasurement(options: {
  criticalEligible: boolean;
  headlineScore: number;
  percentile: number;
  ready: boolean;
}): BoardGameStateVolatilityBand {
  if (!options.ready) return "insufficient-data";
  if (
    options.criticalEligible &&
    options.percentile >= 0.99 &&
    options.headlineScore >= 85
  ) {
    return "critical";
  }
  if (options.percentile >= 0.9 && options.headlineScore >= 55) {
    return "alert";
  }
  if (options.percentile >= 0.75 || options.headlineScore >= 40) {
    return "elevated";
  }
  return "normal";
}

function calculateGameStateVolatility(
  input: BuildGameStateVolatilityAlertInput
): GameStateVolatilityCalculation | null {
  const currentGameState = currentObservationGameState(
    input.scored,
    input.nowMs
  );
  const phase = deriveBoardVolatilityPhase({
    clock: currentGameState?.clock,
    minutesToTip: currentGameState?.minutesToTip,
    nowIso: input.detectedAtIso,
    period: currentGameState?.period,
    scheduledStart: input.scheduledStart,
    scoreMargin: currentGameState?.scoreMargin,
    status: currentGameState?.status ?? "scheduled",
    timeline: input.gameStates,
  });

  const resolveBaseline =
    input.baselineResolver ??
    (input.scheduledStart
      ? resolveBoardVolatilityBaseline
      : resolveFallbackBoardVolatilityBaseline);

  const lookupInput = buildBoardVolatilityBaselineLookupInput({
    coreFamilyCount: 0,
    margin: currentGameState?.scoreMargin ?? null,
    period: currentGameState?.period ?? null,
    phaseKind: phase.kind,
    secondsFromTip: phase.secondsFromTip,
    sourceCount: 0,
  });
  let baseline = resolveBaseline(lookupInput);

  const transitionBoost =
    phase.kind === "tip-burst" || phase.kind === "restart-burst" ? 0.1 : 0;

  let snapshot = buildBoardVolatilityFeatureSnapshot({
    baseline,
    config: input.config,
    persistenceSeconds: 0,
    phaseKind: phase.kind,
    scored: input.scored,
    shockWindowMs: input.shockWindowMs,
    topEvidenceRows: input.config.gameStateVolatility.topEvidenceRows,
    transitionBoost,
  });

  baseline = resolveBaseline(
    buildBoardVolatilityBaselineLookupInput({
      coreFamilyCount: snapshot.coreFamilies.length,
      margin: currentGameState?.scoreMargin ?? null,
      period: currentGameState?.period ?? null,
      phaseKind: phase.kind,
      secondsFromTip: phase.secondsFromTip,
      sourceCount: snapshot.distinctCoreSources.length,
    })
  );

  snapshot = buildBoardVolatilityFeatureSnapshot({
    baseline,
    config: input.config,
    persistenceSeconds: 0,
    phaseKind: phase.kind,
    scored: input.scored,
    shockWindowMs: input.shockWindowMs,
    topEvidenceRows: input.config.gameStateVolatility.topEvidenceRows,
    transitionBoost,
  });

  const filterSeries = buildFilterObservations({
    baseline,
    bucketSeconds: input.bucketSeconds ?? 15,
    config: input.config,
    nowMs: input.nowMs,
    scored: input.scored,
    shockWindowMs: input.shockWindowMs,
  });
  const filterState = runBoardStressKalmanFilter({
    bucketSeconds: input.bucketSeconds ?? 15,
    observations: filterSeries
      .map((entry) => entry.calibratedAbnormality)
      .concat(snapshot.calibratedAbnormality),
    phaseKind: phase.kind,
  });

  const persistenceSeconds = trailingPersistenceSeconds(
    filterSeries.map((entry) => entry.alertReady).concat(snapshot.alertReady),
    input.bucketSeconds ?? 15
  );
  snapshot = buildBoardVolatilityFeatureSnapshot({
    baseline,
    config: input.config,
    persistenceSeconds,
    phaseKind: phase.kind,
    scored: input.scored,
    shockWindowMs: input.shockWindowMs,
    topEvidenceRows: input.config.gameStateVolatility.topEvidenceRows,
    transitionBoost,
  });

  const rawHeadlineScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (snapshot.calibratedAbnormality * 0.4 + filterState.stressLevel * 0.6) *
          100
      )
    )
  );
  const ready =
    snapshot.predictionMarketRows >=
      input.config.gameStateVolatility.minPredictionMarketRows &&
    snapshot.sourceMarketCount >=
      input.config.gameStateVolatility.minPredictionMarketRows &&
    snapshot.coreFamilies.length >=
      input.config.gameStateVolatility.minCoreFamilies;
  const headlineScore = ready ? rawHeadlineScore : 0;
  const band = bandForMeasurement({
    criticalEligible: snapshot.gates.criticalEligible,
    headlineScore,
    percentile: snapshot.percentile,
    ready,
  });
  const confidence = Math.max(
    0,
    Math.min(
      1,
      0.4 +
        snapshot.signals.crossSourceConfirmation * 0.2 +
        snapshot.signals.coreBreadth * 0.15 +
        snapshot.percentile * 0.15 +
        Math.min(0.1, persistenceSeconds / 300)
    )
  );
  const firstPopAt =
    snapshot.coreRepresentativeRows.length > 0
      ? firstPopAtFromScored(
          snapshot.coreRepresentativeRows,
          input.detectedAtIso
        )
      : input.detectedAtIso;
  const alertId =
    band === "alert" || band === "critical"
      ? [
          "board-alert",
          input.gameId,
          "game-state-volatility",
          "no-entity",
          firstPopAt,
        ].join(":")
      : null;

  const measurement: BoardGameStateVolatility = {
    alertId,
    band,
    baseline: {
      ...baseline,
      percentile: Number(snapshot.percentile.toFixed(3)),
    },
    components: {
      coherence: Number(snapshot.signals.coreBreadth.toFixed(3)),
      coverage: Number(snapshot.signals.coveragePenalty.toFixed(3)),
      microstructure: Number(snapshot.signals.coreLiquidityStress.toFixed(3)),
      residual: Number(snapshot.signals.corePriceShock.toFixed(3)),
    },
    confidence: Number(confidence.toFixed(3)),
    diagnostics: {
      coreFamilies: snapshot.coreFamilies,
      families: snapshot.families,
      predictionMarketRows: snapshot.predictionMarketRows,
      ready,
      shockRows: snapshot.shockRows,
      sourceMarketCount: snapshot.sourceMarketCount,
      sources: snapshot.sources,
    },
    drivers: snapshot.drivers,
    evidence: snapshot.evidence,
    filter: filterState,
    gameId: input.gameId,
    gameLabel: input.gameLabel,
    gates: snapshot.gates,
    h0Adjustments: snapshot.h0Adjustments,
    headlineScore,
    inspect: snapshot.inspect,
    measuredAt: input.detectedAtIso,
    missingDataNotes: snapshot.missingDataNotes,
    phase,
    sample: {
      coreFamilies: snapshot.coreFamilies,
      families: snapshot.families,
      predictionMarketRows: snapshot.predictionMarketRows,
      ready,
      shockRows: snapshot.shockRows,
      sourceMarketCount: snapshot.sourceMarketCount,
      sources: snapshot.sources,
    },
    score: headlineScore,
    signals: {
      ...snapshot.signals,
      calibratedAbnormality: Number(snapshot.calibratedAbnormality.toFixed(3)),
      persistenceSeconds,
    },
    state: band,
    thresholds: {
      alertMinScore: input.config.minScore,
      criticalMinScore: 85,
      elevatedMinScore: 40,
      normalMaxScore: 39,
    },
  };

  return { firstPopAt, measurement };
}

export function measureGameStateVolatility(
  input: BuildGameStateVolatilityAlertInput
): BoardGameStateVolatility | null {
  return calculateGameStateVolatility(input)?.measurement ?? null;
}

export function buildGameStateVolatilityAlert(
  input: BuildGameStateVolatilityAlertInput
): BoardAnomalyAlert | null {
  const calculation = calculateGameStateVolatility(input);
  if (!calculation) return null;
  const { measurement, firstPopAt } = calculation;

  if (measurement.state !== "alert" && measurement.state !== "critical") {
    return null;
  }

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
    score: measurement.headlineScore,
    confidence: measurement.confidence,
    severity: scoreToSeverity(measurement.headlineScore),
    reason: `${formatPhaseKind(measurement.phase.kind)} board stress across ${measurement.diagnostics.coreFamilies.join(", ")}; percentile ${(measurement.baseline.percentile * 100).toFixed(0)}; persistence ${measurement.signals.persistenceSeconds}s`,
    primaryEntityKey: null,
    primaryFamily: null,
    components: measurement.components,
    h0Adjustments: measurement.h0Adjustments,
    evidence: measurement.evidence,
    missingDataNotes: measurement.missingDataNotes,
    inspect: measurement.inspect,
  };
}
