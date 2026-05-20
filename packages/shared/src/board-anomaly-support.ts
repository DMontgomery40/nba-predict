import type { ResearchSourceId } from "@signal-console/domain";

export function parseTimestampMs(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function sourceKindFor(
  source: ResearchSourceId | string
): "sportsbook" | "prediction-market" {
  if (source === "kalshi" || source === "polymarket") {
    return "prediction-market";
  }
  return "sportsbook";
}
