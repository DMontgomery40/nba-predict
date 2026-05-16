import type {
  BoardAnomalyAlert,
  BoardAnomalyDetectorConfig,
  BoardAnomalyDetectorInput,
  BoardObservation,
  BoardObservationScored,
  BoardShockEvidence,
  BoardShockMissingNote,
} from "@signal-console/domain";

import { classifyShock } from "./classifier";
import { clamp01, resolveBoardAnomalyConfig, scoreToSeverity } from "./config";
import { buildCoherenceClusters, type CoherenceCluster } from "./fanout";
import { computeH0Adjustment } from "./h0";
import { scoreObservation } from "./residual";

function withinShockWindow(
  observation: BoardObservation,
  nowMs: number,
  windowMs: number
): boolean {
  const ts = Date.parse(observation.eventTimestamp || observation.capturedAt);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= windowMs && ts <= nowMs;
}

function aggregateContribution(cluster: CoherenceCluster): number {
  if (cluster.participants.length === 0) return 0;
  const sum = cluster.participants.reduce(
    (total, item) => total + item.contribution,
    0
  );
  return sum / cluster.participants.length;
}

function clusterToAlert(
  cluster: CoherenceCluster,
  config: BoardAnomalyDetectorConfig,
  gameId: string,
  gameLabel: string,
  detectedAtIso: string
): BoardAnomalyAlert | null {
  if (cluster.participants.length < 2) return null;

  const classification = classifyShock(cluster, config);
  const baseContribution = aggregateContribution(cluster);
  const nParticipants = cluster.participants.length;
  const nPairs = Math.max(1, (nParticipants * (nParticipants - 1)) / 2);
  const coherence = clamp01(cluster.coherenceScore / nPairs);

  const microstructureAverage =
    cluster.participants.reduce((sum, participant) => {
      const components = [
        participant.microstructure.crossVenue,
        participant.microstructure.liquidity,
        participant.microstructure.offPrice,
        participant.microstructure.volatility,
        participant.microstructure.volumeShare,
      ];
      const active = components.filter((value) => value > 0).length;
      if (active === 0) return sum;
      const componentSum = components.reduce((a, b) => a + b, 0);
      return sum + componentSum / active;
    }, 0) / cluster.participants.length;

  const coverage = clamp01(
    cluster.participants.filter(
      (participant) =>
        participant.observation.flags.isStale ||
        participant.observation.missing.impliedProbability ||
        participant.observation.mappingStatus === "unmapped"
    ).length / cluster.participants.length
  );

  const sportsbookPredictionBoost =
    cluster.sportsbookContribution > 0 &&
    cluster.predictionMarketContribution > 0
      ? config.fanout.sportsbookPredictionDisagreementBoost
      : 0;

  const weightedScore =
    baseContribution * config.weights.residual +
    microstructureAverage * config.weights.microstructure +
    coherence * config.weights.coherence +
    sportsbookPredictionBoost * 0.1;

  const score = Math.round(clamp01(weightedScore) * 100);

  const evidenceUnmappedRatio =
    cluster.participants.filter(
      (participant) =>
        participant.observation.mappingStatus === "unmapped" ||
        participant.observation.flags.isUnmapped
    ).length / cluster.participants.length;
  const confidenceBase = Math.min(
    0.95,
    0.55 + coherence * 0.25 + Math.min(0.15, cluster.participants.length * 0.03)
  );
  const confidence = Math.max(
    0,
    confidenceBase - evidenceUnmappedRatio * 0.2 - coverage * 0.3
  );

  if (score < config.minScore || confidence < config.minConfidence) {
    return null;
  }

  const sortedParticipants = [...cluster.participants].sort((a, b) => {
    const aTs = Date.parse(
      a.observation.eventTimestamp || a.observation.capturedAt
    );
    const bTs = Date.parse(
      b.observation.eventTimestamp || b.observation.capturedAt
    );
    return aTs - bTs;
  });
  const firstPopAt =
    sortedParticipants[0]?.observation.eventTimestamp ??
    sortedParticipants[0]?.observation.capturedAt ??
    detectedAtIso;

  const evidence: BoardShockEvidence[] = cluster.participants
    .slice()
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 8)
    .map((participant) => ({
      observationId: participant.observation.observationId,
      source: participant.observation.source,
      sourceKind: participant.observation.sourceKind,
      family: participant.observation.family,
      participantKey: participant.observation.participantKey,
      displayLabel: participant.observation.displayLabel,
      contribution: Number(participant.contribution.toFixed(3)),
      reason: participant.reason,
      evidenceUnmapped:
        participant.observation.mappingStatus === "unmapped" ||
        participant.observation.flags.isUnmapped,
    }));

  const missingDataNotes: BoardShockMissingNote[] = [];
  const seenMissing = new Set<string>();
  for (const participant of cluster.participants) {
    const reasons: string[] = [];
    if (participant.observation.flags.isStale) reasons.push("stale quote");
    if (participant.observation.missing.impliedProbability)
      reasons.push("missing implied probability");
    if (participant.observation.missing.volume) reasons.push("missing volume");
    if (
      participant.observation.missing.bestBid ||
      participant.observation.missing.bestAsk
    )
      reasons.push("missing bid/ask");
    if (participant.observation.mappingStatus === "unmapped")
      reasons.push("unmapped market");
    if (reasons.length === 0) continue;
    const key = `${participant.observation.source}:${reasons.join("|")}`;
    if (seenMissing.has(key)) continue;
    seenMissing.add(key);
    missingDataNotes.push({
      source: participant.observation.source,
      reason: reasons.join("; "),
    });
  }

  const driverReasons = Array.from(
    new Set(
      cluster.participants
        .map((participant) => participant.h0Adjustment.reason)
        .filter((value) => value && value !== "H0 baseline")
    )
  );
  const appliedSuppression =
    cluster.participants.reduce(
      (sum, participant) => sum + participant.h0Suppressed,
      0
    ) / cluster.participants.length;

  const instrumentIds = Array.from(
    new Set(
      cluster.participants
        .map((participant) => participant.observation.instrumentId ?? null)
        .filter((value): value is string => typeof value === "string")
    )
  );
  const sourceMarketIds = Array.from(
    new Set(
      cluster.participants.map(
        (participant) => participant.observation.sourceMarketId
      )
    )
  );

  return {
    id: [
      "board-alert",
      gameId,
      classification.kind,
      classification.primaryEntityKey ?? "no-entity",
      firstPopAt,
    ].join(":"),
    gameId,
    gameLabel,
    shockKind: classification.kind,
    firstPopAt,
    detectedAt: detectedAtIso,
    score,
    confidence: Number(confidence.toFixed(3)),
    severity: scoreToSeverity(score),
    reason: classification.reason,
    primaryEntityKey: classification.primaryEntityKey,
    primaryFamily:
      cluster.participants.find((participant) => participant.observation.family)
        ?.observation.family ?? null,
    components: {
      residual: Number(baseContribution.toFixed(3)),
      microstructure: Number(microstructureAverage.toFixed(3)),
      coherence: Number(coherence.toFixed(3)),
      coverage: Number(coverage.toFixed(3)),
    },
    h0Adjustments: {
      appliedSuppression: Number(appliedSuppression.toFixed(3)),
      drivers: driverReasons,
    },
    evidence,
    missingDataNotes,
    inspect: {
      payloadVersion: 1,
      instrumentIds,
      sourceMarketIds,
      relationFamilies: cluster.relationFamilies,
    },
  };
}

export function detectBoardAnomalies(
  input: BoardAnomalyDetectorInput
): BoardAnomalyAlert[] {
  const config = resolveBoardAnomalyConfig(input.config);
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) {
    throw new Error(`Invalid "now" timestamp: ${input.now}`);
  }

  const shockWindowMs = config.shockWindowSeconds * 1000;
  const contextWindowMs = config.contextWindowMinutes * 60 * 1000;

  const inWindow = input.observations.filter((observation) => {
    const ts = Date.parse(observation.eventTimestamp || observation.capturedAt);
    if (!Number.isFinite(ts)) return false;
    if (ts > nowMs) return false;
    return nowMs - ts <= contextWindowMs;
  });

  if (inWindow.length === 0) return [];

  const scored: BoardObservationScored[] = inWindow.map((observation) =>
    scoreObservation(
      observation,
      computeH0Adjustment(observation, config),
      config
    )
  );

  const shockSet = scored.filter(
    (item) =>
      withinShockWindow(item.observation, nowMs, shockWindowMs) ||
      item.contribution > 0 ||
      item.observation.flags.isStale ||
      item.observation.missing.impliedProbability
  );

  if (shockSet.length < 2) {
    return [];
  }

  const clusters = buildCoherenceClusters(shockSet, config);
  const alerts: BoardAnomalyAlert[] = [];
  for (const cluster of clusters) {
    const alert = clusterToAlert(
      cluster,
      config,
      input.gameId,
      input.gameLabel,
      input.now
    );
    if (alert) {
      alerts.push(alert);
    }
  }

  const dedupedByKind = new Map<string, BoardAnomalyAlert>();
  for (const alert of alerts) {
    const key = `${alert.shockKind}::${alert.primaryEntityKey ?? "no-entity"}`;
    const previous = dedupedByKind.get(key);
    if (!previous || alert.score > previous.score) {
      dedupedByKind.set(key, alert);
    }
  }
  const result = Array.from(dedupedByKind.values());
  result.sort((a, b) => b.score - a.score);
  return result;
}
