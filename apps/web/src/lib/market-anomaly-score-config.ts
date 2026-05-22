import type { MarketAnomalyScoreConfig } from "../data/api";

export const marketAnomalyScoreConfigQueryKey = [
  "market-anomaly-score-config",
] as const;

export function cloneMarketAnomalyScoreConfig(
  config?: MarketAnomalyScoreConfig | null
) {
  if (!config) {
    return null;
  }

  return {
    ...config,
    thresholds: { ...config.thresholds },
    toggles: { ...config.toggles },
    weights: { ...config.weights },
  };
}

export function getLiveMarketAnomalyQueueConfig(
  config?: MarketAnomalyScoreConfig | null
) {
  return {
    includeUnmapped: config?.toggles.includeUnmapped ?? true,
    minConfidence: config?.minConfidence ?? 0.45,
    minScore: config?.minScore ?? 45,
    requireBet365: config?.toggles.requireBet365 ?? false,
  };
}
