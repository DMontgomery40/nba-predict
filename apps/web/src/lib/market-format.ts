export function formatProbabilityPercent(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function formatGapPoints(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(1)} pp`;
}

export function formatSignedGapPoints(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

export function formatWholeGapThreshold(value: number) {
  return `${(value * 100).toFixed(0)} pp`;
}

export function formatMarketMatchLabel(state: string) {
  switch (state) {
    case "comparable":
      return "matched";
    case "line-mismatch":
      return "line mismatch";
    case "selection-mismatch":
      return "selection mismatch";
    case "unmapped":
      return "unmapped";
    default:
      return state;
  }
}
