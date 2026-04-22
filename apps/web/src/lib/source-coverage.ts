const NBA_SOURCE_ID = "nba";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function getMarketSources(sourceIds: string[]) {
  return sourceIds.filter((sourceId) => sourceId !== NBA_SOURCE_ID);
}

export function hasNbaStateSource(sourceIds: string[]) {
  return sourceIds.includes(NBA_SOURCE_ID);
}

export function formatMarketSourceSummary(sourceIds: string[]) {
  const marketSources = getMarketSources(sourceIds);
  const hasNbaState = hasNbaStateSource(sourceIds);

  if (marketSources.length === 0 && hasNbaState) {
    return "NBA state only";
  }

  if (marketSources.length === 0) {
    return "No market sources";
  }

  const marketSourceLabel = `${marketSources.length} ${pluralize(
    marketSources.length,
    "market source",
    "market sources"
  )}`;

  return hasNbaState ? `${marketSourceLabel} + NBA state` : marketSourceLabel;
}

export function formatMarketSourceList(sourceIds: string[]) {
  const marketSources = getMarketSources(sourceIds);

  return marketSources.length === 0 ? "none" : marketSources.join(", ");
}
