import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildApiServer } from "../../api/src/server";
import {
  recordAdapterRun,
  recordGameStateObservation,
  recordQuoteObservation,
  recordRawPayload,
  removeDatabaseArtifacts,
  upsertGame,
  upsertGameOutcome,
  upsertMarketInstrument,
  upsertSourceMarket,
} from "../../../packages/shared/src/index";

const dbPath =
  process.env.SIGNAL_CONSOLE_DB_PATH ??
  resolve(process.cwd(), "../../data/signal-console.e2e.sqlite");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "8787");

function seedResearchBackend() {
  upsertGame({
    awayParticipant: {
      abbreviation: "NYK",
      key: "nyk",
      name: "New York Knicks",
      shortName: "Knicks",
      side: "away",
    },
    homeParticipant: {
      abbreviation: "BOS",
      key: "bos",
      name: "Boston Celtics",
      shortName: "Celtics",
      side: "home",
    },
    id: "nba-bos-nyk-2026-04-21",
    league: "NBA",
    scheduledStart: "2026-04-21T23:00:00.000Z",
    sourceGameKeyNba: "0022600001",
    sport: "basketball",
  });

  recordGameStateObservation({
    awayScore: 108,
    capturedAt: "2026-04-21T23:55:00.000Z",
    clock: "00:42",
    finalAt: null,
    gameId: "nba-bos-nyk-2026-04-21",
    homeScore: 112,
    isFinal: false,
    period: 4,
    startedAt: "2026-04-21T23:05:00.000Z",
    status: "in-play",
  });

  upsertGameOutcome({
    capturedAt: "2026-04-22T00:05:00.000Z",
    finalAwayScore: 110,
    finalHomeScore: 118,
    gameId: "nba-bos-nyk-2026-04-21",
    winnerKey: "bos",
  });

  upsertMarketInstrument({
    displayLabel: "Boston moneyline",
    family: "moneyline",
    gameId: "nba-bos-nyk-2026-04-21",
    id: "bos-moneyline",
    inPlay: true,
    line: null,
    participantKey: "bos",
    selection: "bos",
  });
  upsertMarketInstrument({
    displayLabel: "Boston -4.5",
    family: "spread",
    gameId: "nba-bos-nyk-2026-04-21",
    id: "bos-spread-4_5",
    inPlay: true,
    line: -4.5,
    participantKey: "bos",
    selection: "bos",
  });
  upsertMarketInstrument({
    displayLabel: "Jalen Brunson over 29.5 points",
    family: "player-prop",
    gameId: "nba-bos-nyk-2026-04-21",
    id: "brunson-over-29_5-points",
    inPlay: true,
    line: 29.5,
    participantKey: "jalen-brunson",
    selection: "over",
  });

  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-bet365-bos-moneyline",
    instrumentId: "bos-moneyline",
    mappingStatus: "auto",
    rawFamily: "moneyline",
    rawLabel: "Boston Celtics",
    rawMetadata: { market: "moneyline" },
    source: "bet365",
    sourceMarketKey: "b365-bos-ml",
    sourceSelectionKey: "bos",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-kalshi-bos-moneyline",
    instrumentId: "bos-moneyline",
    mappingStatus: "auto",
    rawFamily: "moneyline",
    rawLabel: "BOS win",
    rawMetadata: { market: "moneyline" },
    source: "kalshi",
    sourceMarketKey: "kal-bos-ml",
    sourceSelectionKey: "bos",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-polymarket-bos-moneyline",
    instrumentId: "bos-moneyline",
    mappingStatus: "auto",
    rawFamily: "moneyline",
    rawLabel: "Boston wins",
    rawMetadata: { market: "moneyline" },
    source: "polymarket",
    sourceMarketKey: "poly-bos-ml",
    sourceSelectionKey: "bos",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-bet365-bos-spread",
    instrumentId: "bos-spread-4_5",
    mappingStatus: "auto",
    rawFamily: "spread",
    rawLabel: "Boston -4.5",
    rawMetadata: { market: "spread" },
    source: "bet365",
    sourceMarketKey: "b365-bos-spread",
    sourceSelectionKey: "bos",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-kalshi-bos-spread",
    instrumentId: "bos-spread-4_5",
    mappingStatus: "auto",
    rawFamily: "spread",
    rawLabel: "Boston -5.5",
    rawMetadata: { market: "spread" },
    source: "kalshi",
    sourceMarketKey: "kal-bos-spread",
    sourceSelectionKey: "bos",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-poly-brunson-points",
    instrumentId: null,
    mappingStatus: "unmapped",
    rawFamily: "player-prop",
    rawLabel: "Jalen Brunson over 29.5 points",
    rawMetadata: { market: "player-prop" },
    source: "polymarket",
    sourceMarketKey: "poly-brunson-points",
    sourceSelectionKey: "over",
  });

  recordQuoteObservation({
    bestAsk: null,
    bestBid: null,
    capturedAt: "2026-04-21T23:55:00.000Z",
    depthScore: 96,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.61,
    lineRaw: null,
    oddsRaw: "-156",
    priceRaw: null,
    sourceMarketId: "sm-bet365-bos-moneyline",
    volume: 100,
  });
  recordQuoteObservation({
    bestAsk: 0.68,
    bestBid: 0.67,
    capturedAt: "2026-04-21T23:55:05.000Z",
    depthScore: 82,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.67,
    lineRaw: null,
    oddsRaw: null,
    priceRaw: 0.67,
    sourceMarketId: "sm-kalshi-bos-moneyline",
    volume: 58,
  });
  recordQuoteObservation({
    bestAsk: 0.66,
    bestBid: 0.65,
    capturedAt: "2026-04-21T23:55:08.000Z",
    depthScore: 74,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.65,
    lineRaw: null,
    oddsRaw: null,
    priceRaw: 0.65,
    sourceMarketId: "sm-polymarket-bos-moneyline",
    volume: 44,
  });
  recordQuoteObservation({
    bestAsk: null,
    bestBid: null,
    capturedAt: "2026-04-21T23:55:10.000Z",
    depthScore: 94,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.54,
    lineRaw: -4.5,
    oddsRaw: "-118",
    priceRaw: null,
    sourceMarketId: "sm-bet365-bos-spread",
    volume: 100,
  });
  recordQuoteObservation({
    bestAsk: 0.57,
    bestBid: 0.56,
    capturedAt: "2026-04-21T23:55:12.000Z",
    depthScore: 61,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.56,
    lineRaw: -5.5,
    oddsRaw: null,
    priceRaw: 0.56,
    sourceMarketId: "sm-kalshi-bos-spread",
    volume: 31,
  });
  recordQuoteObservation({
    bestAsk: 0.59,
    bestBid: 0.58,
    capturedAt: "2026-04-21T23:55:15.000Z",
    depthScore: 49,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.58,
    lineRaw: 29.5,
    oddsRaw: null,
    priceRaw: 0.58,
    sourceMarketId: "sm-poly-brunson-points",
    volume: 12,
  });

  recordRawPayload({
    capturedAt: "2026-04-21T23:55:00.000Z",
    contentHash: "hash-bet365-bos-moneyline",
    entityId: "sm-bet365-bos-moneyline",
    entityType: "source_market",
    payloadJson: {
      label: "Boston Celtics",
      odds: "-156",
      source: "bet365",
    },
    source: "bet365",
  });

  recordAdapterRun({
    finishedAt: "2026-04-21T23:55:20.000Z",
    recordsSeen: 14,
    recordsWritten: 14,
    source: "bet365",
    startedAt: "2026-04-21T23:55:00.000Z",
    status: "ok",
  });
  recordAdapterRun({
    finishedAt: "2026-04-21T23:55:22.000Z",
    recordsSeen: 8,
    recordsWritten: 8,
    source: "kalshi",
    startedAt: "2026-04-21T23:55:05.000Z",
    status: "ok",
  });
  recordAdapterRun({
    finishedAt: "2026-04-21T23:55:24.000Z",
    recordsSeen: 6,
    recordsWritten: 6,
    source: "polymarket",
    startedAt: "2026-04-21T23:55:08.000Z",
    status: "ok",
  });
  recordAdapterRun({
    finishedAt: "2026-04-21T23:55:18.000Z",
    recordsSeen: 4,
    recordsWritten: 4,
    source: "nba",
    startedAt: "2026-04-21T23:55:00.000Z",
    status: "ok",
  });
}

removeDatabaseArtifacts(dbPath);
mkdirSync(dirname(dbPath), { recursive: true });
seedResearchBackend();

const app = buildApiServer();
await app.listen({ host, port });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
