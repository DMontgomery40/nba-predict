function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function titleCase(text: string): string {
  return text
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function participantKeyFromDisplayLabel(
  displayLabel: string | null | undefined
): string | null {
  if (!displayLabel) return null;
  return (
    displayLabel
      .toLowerCase()
      .match(/^([a-z]+\s[a-z'.-]+(?:\s[ji]r\.?)?)\b/)?.[1] ?? null
  );
}

function statFamilyFromLabel(label: string | null | undefined): string {
  if (!label) return "other";
  const lower = label.toLowerCase();
  if (lower.includes("assist") && lower.includes("rebound")) return "ra";
  if (
    lower.includes("points") &&
    lower.includes("assist") &&
    lower.includes("rebound")
  ) {
    return "pra";
  }
  if (lower.includes("points") && lower.includes("rebound")) return "pr";
  if (lower.includes("points") && lower.includes("assist")) return "pa";
  if (lower.includes("rebound")) return "rebounds";
  if (lower.includes("assist")) return "assists";
  if (lower.includes("steal")) return "steals";
  if (lower.includes("block")) return "blocks";
  if (
    lower.includes("three") ||
    lower.includes("3pt") ||
    lower.includes("3s")
  ) {
    return "threes";
  }
  if (lower.includes("points") || lower.includes("pts")) return "points";
  if (lower.includes("double-double") || lower.includes("double double")) {
    return "double-double";
  }
  if (lower.includes("triple-double") || lower.includes("triple double")) {
    return "triple-double";
  }
  return "other";
}

export {
  formatNumber,
  participantKeyFromDisplayLabel,
  statFamilyFromLabel,
  titleCase,
};
