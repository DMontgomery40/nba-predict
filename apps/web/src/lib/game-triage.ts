import type { GamesPayload } from "../data/api";

export type GameRow = GamesPayload["data"][number];

export function getMarketSources(row: GameRow) {
  return row.coverage.availableSources.filter((source) => source !== "nba");
}

export function isPlaceholderGame(row: GameRow) {
  const away = row.game.awayParticipant;
  const home = row.game.homeParticipant;
  return (
    away.shortName.toLowerCase() === "away" ||
    home.shortName.toLowerCase() === "home" ||
    away.name.toLowerCase() === "away" ||
    home.name.toLowerCase() === "home"
  );
}

export function hasMarketSignal(row: GameRow) {
  return (
    row.activeInstrumentCount > 0 ||
    row.topDivergences.length > 0 ||
    getMarketSources(row).length > 0 ||
    row.hasUnmappedMarkets
  );
}

export function isActionableGame(row: GameRow) {
  return hasMarketSignal(row) && !isPlaceholderGame(row);
}

function compareBySlatePriority(left: GameRow, right: GameRow) {
  const leftTop = left.topDivergences[0]?.impliedProbabilityGap ?? -1;
  const rightTop = right.topDivergences[0]?.impliedProbabilityGap ?? -1;
  if (rightTop !== leftTop) return rightTop - leftTop;

  const rightSources = getMarketSources(right).length;
  const leftSources = getMarketSources(left).length;
  if (rightSources !== leftSources) return rightSources - leftSources;

  if (right.activeInstrumentCount !== left.activeInstrumentCount) {
    return right.activeInstrumentCount - left.activeInstrumentCount;
  }

  return left.game.scheduledStart.localeCompare(right.game.scheduledStart);
}

export function buildGameTriage(rows: GameRow[]) {
  const placeholderRows = rows.filter(isPlaceholderGame);
  const actionableRows = rows
    .filter(isActionableGame)
    .sort(compareBySlatePriority);
  const nbaStateOnlyRows = rows.filter(
    (row) =>
      !isPlaceholderGame(row) &&
      !hasMarketSignal(row) &&
      row.coverage.availableSources.includes("nba")
  );
  const noMarketRows = rows.filter(
    (row) =>
      !isPlaceholderGame(row) &&
      !hasMarketSignal(row) &&
      !row.coverage.availableSources.includes("nba")
  );

  return {
    actionableRows,
    noMarketRows,
    nbaStateOnlyRows,
    placeholderRows,
    suppressedRows: rows.length - actionableRows.length,
    totalRows: rows.length,
  };
}
