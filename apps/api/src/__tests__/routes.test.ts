import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordAdapterRun,
  recordGameStateObservation,
  recordMarketMicrostructureEvent,
  recordQuoteObservation,
  recordRawPayload,
  resetDatabase,
  resetRuntimeEnvForTests,
  upsertGame,
  upsertGameOutcome,
  upsertMarketInstrument,
  upsertSourceMarket,
  writeMarketAnomalyPlaybackFrame,
  writePlayerPropAlertPlaybackFrame,
} from "@signal-console/shared";

import { buildApiServer } from "../server";

let tempDir = "";

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
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-bet365-brunson-points",
    instrumentId: "brunson-over-29_5-points",
    mappingStatus: "auto",
    rawFamily: "player-prop",
    rawLabel: "Jalen Brunson (29.5)",
    rawMetadata: { market: "player-prop" },
    source: "bet365",
    sourceMarketKey: "b365-brunson-points",
    sourceSelectionKey: "over",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-kalshi-brunson-points",
    instrumentId: "brunson-over-29_5-points",
    mappingStatus: "auto",
    rawFamily: "player-prop",
    rawLabel: "Jalen Brunson: 30+ points",
    rawMetadata: { market: "player-prop" },
    source: "kalshi",
    sourceMarketKey: "kal-brunson-points",
    sourceSelectionKey: "over",
  });

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
    id: "nba-bos-nyk-prop-live-2026-04-21",
    league: "NBA",
    scheduledStart: "2026-04-21T23:30:00.000Z",
    sourceGameKeyNba: "0022600002",
    sport: "basketball",
  });
  recordGameStateObservation({
    awayScore: 88,
    capturedAt: "2026-04-21T23:55:00.000Z",
    clock: "03:12",
    finalAt: null,
    gameId: "nba-bos-nyk-prop-live-2026-04-21",
    homeScore: 91,
    isFinal: false,
    period: 4,
    startedAt: "2026-04-21T23:35:00.000Z",
    status: "in-play",
  });
  upsertMarketInstrument({
    displayLabel: "Jalen Brunson over 29.5 points",
    family: "player-prop",
    gameId: "nba-bos-nyk-prop-live-2026-04-21",
    id: "live-brunson-over-29_5-points",
    inPlay: true,
    line: 29.5,
    participantKey: "jalen-brunson",
    selection: "over",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-prop-live-2026-04-21",
    id: "sm-bet365-live-brunson-points",
    instrumentId: "live-brunson-over-29_5-points",
    mappingStatus: "auto",
    rawFamily: "player-prop",
    rawLabel: "Jalen Brunson (29.5)",
    rawMetadata: { market: "player-prop" },
    source: "bet365",
    sourceMarketKey: "b365-live-brunson-points",
    sourceSelectionKey: "over",
  });
  upsertSourceMarket({
    gameId: "nba-bos-nyk-prop-live-2026-04-21",
    id: "sm-kalshi-live-brunson-points",
    instrumentId: "live-brunson-over-29_5-points",
    mappingStatus: "auto",
    rawFamily: "player-prop",
    rawLabel: "Jalen Brunson: 30+ points",
    rawMetadata: { market: "player-prop" },
    source: "kalshi",
    sourceMarketKey: "kal-live-brunson-points",
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
  recordQuoteObservation({
    bestAsk: null,
    bestBid: null,
    capturedAt: "2026-04-21T23:55:16.000Z",
    depthScore: 88,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.64,
    lineRaw: 29.5,
    oddsRaw: "-178",
    priceRaw: null,
    sourceMarketId: "sm-bet365-brunson-points",
    volume: 100,
  });
  recordQuoteObservation({
    bestAsk: 0.36,
    bestBid: 0.35,
    capturedAt: "2026-04-21T23:55:18.000Z",
    depthScore: 42,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.35,
    lineRaw: 29.5,
    oddsRaw: null,
    priceRaw: 0.35,
    sourceMarketId: "sm-kalshi-brunson-points",
    volume: 17,
  });
  recordQuoteObservation({
    bestAsk: null,
    bestBid: null,
    capturedAt: "2026-04-21T23:55:16.000Z",
    depthScore: 88,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.64,
    lineRaw: 29.5,
    oddsRaw: "-178",
    priceRaw: null,
    sourceMarketId: "sm-bet365-live-brunson-points",
    volume: 100,
  });
  recordQuoteObservation({
    bestAsk: 0.36,
    bestBid: 0.35,
    capturedAt: "2026-04-21T23:55:18.000Z",
    depthScore: 42,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.35,
    lineRaw: 29.5,
    oddsRaw: null,
    priceRaw: 0.35,
    sourceMarketId: "sm-kalshi-live-brunson-points",
    volume: 17,
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

describe("api routes", () => {
  beforeEach(() => {
    resetRuntimeEnvForTests();
    process.env.NBA_SIDECAR_BASE_URL = "";
    process.env.ODDS_API_KEY = "";
    process.env.ODDS_API_IO_KEY = "";
    process.env.KALSHI_API_KEY = "";
    process.env.KALSHI_API_SECRET = "";
    process.env.BET365_SESSION_STATE_PATH = "";
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-api-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
    process.env.PLAYER_PROP_ALERT_PLAYBACK_DIR = join(tempDir, "playback");
    process.env.MARKET_ANOMALY_PLAYBACK_DIR = join(tempDir, "anomaly-playback");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    delete process.env.PLAYER_PROP_ALERT_PLAYBACK_DIR;
    delete process.env.MARKET_ANOMALY_PLAYBACK_DIR;
    delete process.env.NBA_SIDECAR_BASE_URL;
    delete process.env.ODDS_API_KEY;
    delete process.env.ODDS_API_IO_KEY;
    delete process.env.KALSHI_API_KEY;
    delete process.env.KALSHI_API_SECRET;
    delete process.env.BET365_SESSION_STATE_PATH;
    resetRuntimeEnvForTests();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("serves research game, market, timeline, and raw-source payloads from live history tables", async () => {
    seedResearchBackend();
    const app = buildApiServer();

    const gamesResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games?sport=basketball&league=NBA",
    });
    expect(gamesResponse.statusCode).toBe(200);
    expect(gamesResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          activeInstrumentCount: 3,
          coverage: expect.objectContaining({
            activeSourceCount: expect.any(Number),
          }),
          game: expect.objectContaining({
            id: "nba-bos-nyk-2026-04-21",
            league: "NBA",
            sport: "basketball",
          }),
        }),
      ]),
    });

    const limitedGamesResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games?limit=1",
    });
    expect(limitedGamesResponse.statusCode).toBe(200);
    expect(limitedGamesResponse.json().data).toHaveLength(1);

    const marketResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets",
    });
    expect(marketResponse.statusCode).toBe(200);
    expect(marketResponse.json()).toMatchObject({
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({
            comparableState: "line-mismatch",
            instrument: expect.objectContaining({
              id: "bos-spread-4_5",
            }),
            lineMismatch: true,
          }),
        ]),
      },
    });

    const instrumentResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline",
    });
    expect(instrumentResponse.statusCode).toBe(200);
    expect(instrumentResponse.json()).toMatchObject({
      data: {
        derivedComparison: expect.objectContaining({
          comparableState: "comparable",
        }),
        latestQuotesBySource: expect.arrayContaining([
          expect.objectContaining({
            impliedProbability: 0.61,
            source: "bet365",
          }),
        ]),
      },
    });

    const timelineResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/timeline",
    });
    expect(timelineResponse.statusCode).toBe(200);
    expect(timelineResponse.json()).toMatchObject({
      data: {
        gameStateSeries: expect.arrayContaining([
          expect.objectContaining({
            gameId: "nba-bos-nyk-2026-04-21",
            status: "in-play",
          }),
        ]),
        quoteSeriesBySource: {
          bet365: expect.arrayContaining([
            expect.objectContaining({
              impliedProbability: 0.61,
              source: "bet365",
            }),
          ]),
        },
      },
    });

    const rawResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/raw/bet365",
    });
    expect(rawResponse.statusCode).toBe(200);
    expect(rawResponse.json()).toMatchObject({
      data: {
        parserOutput: expect.objectContaining({
          impliedProbability: 0.61,
          odds: "-156",
        }),
        rawPayloads: expect.arrayContaining([
          expect.objectContaining({
            payloadJson: expect.objectContaining({
              source: "bet365",
            }),
            source: "bet365",
          }),
        ]),
      },
    });

    const exportResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/export.csv",
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.body).toContain('"record_type","game_id"');
    expect(exportResponse.body).toContain('"quote","nba-bos-nyk-2026-04-21"');

    const catalogResponse = await app.inject({
      method: "GET",
      url: "/api/v1/exports",
    });
    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json()).toMatchObject({
      data: {
        datasets: expect.arrayContaining([
          expect.objectContaining({
            id: "market-quotes",
            title: "Market quote ticks",
          }),
        ]),
      },
    });

    const fullPackageResponse = await app.inject({
      method: "GET",
      url: "/api/v1/exports/full-package.sqlite",
    });
    expect(fullPackageResponse.statusCode).toBe(200);
    expect(fullPackageResponse.headers["content-type"]).toContain(
      "application/vnd.sqlite3"
    );

    const datasetExportResponse = await app.inject({
      method: "GET",
      url: "/api/v1/exports/market-quotes.csv?source=bet365&family=moneyline",
    });
    expect(datasetExportResponse.statusCode).toBe(200);
    expect(datasetExportResponse.headers["content-type"]).toContain("text/csv");
    expect(datasetExportResponse.body).toContain('"quote_tick_id","source"');
    expect(datasetExportResponse.body).toContain('"sm-bet365-bos-moneyline"');

    const playerPropQuoteResponse = await app.inject({
      method: "GET",
      url: "/api/v1/exports/market-quotes.csv?family=player-prop",
    });
    expect(playerPropQuoteResponse.statusCode).toBe(200);
    expect(playerPropQuoteResponse.body).toContain('"sm-poly-brunson-points"');
    expect(playerPropQuoteResponse.body).toContain('"player-prop"');
    expect(playerPropQuoteResponse.body).toContain(
      '"Jalen Brunson over 29.5 points"'
    );

    const playerPropSourceMarketResponse = await app.inject({
      method: "GET",
      url: "/api/v1/exports/source-markets.csv?family=player-prop",
    });
    expect(playerPropSourceMarketResponse.statusCode).toBe(200);
    expect(playerPropSourceMarketResponse.body).toContain(
      '"sm-poly-brunson-points"'
    );
    expect(playerPropSourceMarketResponse.body).toContain('"unmapped"');

    await app.close();
  });

  it("returns instrument-first divergence, research coverage, and source/admin summaries", async () => {
    seedResearchBackend();
    recordQuoteObservation({
      bestAsk: 0.49,
      bestBid: 0.48,
      capturedAt: "2026-04-21T23:56:05.000Z",
      depthScore: 84,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.48,
      lineRaw: null,
      oddsRaw: null,
      priceRaw: 0.48,
      sourceMarketId: "sm-kalshi-bos-moneyline",
      volume: 60,
    });
    recordQuoteObservation({
      bestAsk: 0.47,
      bestBid: 0.46,
      capturedAt: "2026-04-21T23:56:08.000Z",
      depthScore: 75,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.46,
      lineRaw: null,
      oddsRaw: null,
      priceRaw: 0.46,
      sourceMarketId: "sm-polymarket-bos-moneyline",
      volume: 46,
    });
    recordMarketMicrostructureEvent({
      apiSurface: "data-api/trades",
      eventTimestamp: "2026-04-21T23:56:18.000Z",
      eventType: "trade",
      finalMarketVolume: 410.166918,
      gameId: "nba-bos-nyk-2026-04-21",
      instrumentId: "bos-moneyline",
      notional: 105.66,
      previousPrice: 0.51,
      rawMetadata: {
        transactionHash: "0xtrade",
        wallet: "0xwallet",
      },
      size: 106.7913,
      source: "polymarket",
      sourceMarketId: "sm-polymarket-bos-moneyline",
      tradePrice: 0.99,
      volumeShare: 0.26,
    });
    process.env.NBA_SIDECAR_BASE_URL = "http://127.0.0.1:9393";
    process.env.ODDS_API_KEY = "odds-key";
    const app = buildApiServer();

    const divergenceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/divergence?family=spread",
    });
    expect(divergenceResponse.statusCode).toBe(200);
    expect(divergenceResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          comparableState: "line-mismatch",
          family: "spread",
          instrumentId: "bos-spread-4_5",
          lineMismatch: true,
        }),
      ]),
    });

    const limitedDivergenceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/divergence?sort=signalPriority&limit=1",
    });
    expect(limitedDivergenceResponse.statusCode).toBe(200);
    expect(limitedDivergenceResponse.json().data).toHaveLength(1);

    const coverageResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/coverage",
    });
    expect(coverageResponse.statusCode).toBe(200);
    expect(coverageResponse.json().data.length).toBeGreaterThan(0);

    const mismatchResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/signal-mismatches",
    });
    expect(mismatchResponse.statusCode).toBe(200);
    expect(mismatchResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          displayLabel: "Boston moneyline",
          finalAwayScore: 110,
          finalHomeScore: 118,
          gameLabel: "Knicks at Celtics",
          gameStatus: "final",
        }),
      ]),
    });

    const dateMismatchResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/signal-mismatches?date=2026-04-22",
    });
    expect(dateMismatchResponse.statusCode).toBe(200);
    expect(dateMismatchResponse.json()).toMatchObject({ data: [] });

    const propAlertResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/player-prop-alerts?includeStale=true",
    });
    expect(propAlertResponse.statusCode).toBe(200);
    expect(propAlertResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          absoluteDelta: expect.closeTo(0.29, 6),
          action: "manual-review",
          bet365: expect.objectContaining({
            impliedProbability: 0.64,
            rawLabel: "Jalen Brunson (29.5)",
            source: "bet365",
          }),
          displayLabel: "Jalen Brunson over 29.5 points",
          predictionMarket: expect.objectContaining({
            impliedProbability: 0.35,
            rawLabel: "Jalen Brunson: 30+ points",
            source: "kalshi",
          }),
          freshness: expect.objectContaining({
            quoteTimeGapMs: expect.any(Number),
          }),
        }),
      ]),
    });

    const strictQuoteTimeResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/player-prop-alerts?includeStale=true&maxQuoteTimeGapMinutes=0.001",
    });
    expect(strictQuoteTimeResponse.statusCode).toBe(200);
    expect(strictQuoteTimeResponse.json()).toMatchObject({ data: [] });

    writePlayerPropAlertPlaybackFrame({
      alertCount: 1,
      alerts: [propAlertResponse.json().data[0]],
      capturedAt: "2026-04-21T23:55:30.000Z",
      notifiedAlertIds: [propAlertResponse.json().data[0].id],
      poll: {
        includeStale: true,
        limit: 25,
        maxQuoteTimeGapMinutes: 10,
        maxQuoteAgeMinutes: 10,
        minDelta: 0.15,
      },
      source: "player-prop-alert-watch",
    });

    const propPlaybackResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/player-prop-alert-playback?date=2026-04-21&limit=5",
    });
    expect(propPlaybackResponse.statusCode).toBe(200);
    expect(propPlaybackResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({
          alertCount: 1,
          alerts: [
            expect.objectContaining({
              displayLabel: "Jalen Brunson over 29.5 points",
            }),
          ],
          notifiedAlertIds: [expect.any(String)],
        }),
      ],
    });

    const anomalyResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/market-anomalies?includeHistorical=true&minScore=40&minConfidence=0.4",
    });
    expect(anomalyResponse.statusCode).toBe(200);
    expect(anomalyResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          apiSurface: "data-api/trades",
          displayLabel: "Boston moneyline",
          labels: expect.arrayContaining([
            "isolated off-price print",
            "volume-share anomaly",
          ]),
          metrics: expect.objectContaining({
            notional: 105.66,
            tradePrice: 0.99,
            volumeShare: expect.closeTo(0.26, 6),
          }),
          source: "polymarket",
        }),
      ]),
    });

    const fastAnomalyResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/market-anomalies?includeHistorical=true&skipQuoteAnomalies=true&minScore=40&minConfidence=0.4",
    });
    expect(fastAnomalyResponse.statusCode).toBe(200);
    expect(fastAnomalyResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          apiSurface: "data-api/trades",
          displayLabel: "Boston moneyline",
          source: "polymarket",
        }),
      ]),
    });

    const scoreConfigResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/market-anomaly-score-config",
    });
    expect(scoreConfigResponse.statusCode).toBe(200);
    expect(scoreConfigResponse.json()).toMatchObject({
      data: expect.objectContaining({
        minScore: 45,
        toggles: expect.objectContaining({
          includeUnmapped: true,
          requireBet365: false,
        }),
      }),
    });

    const updatedScoreConfig = {
      ...scoreConfigResponse.json().data,
      minScore: 70,
      toggles: {
        ...scoreConfigResponse.json().data.toggles,
        requireBet365: true,
      },
    };
    const updateScoreConfigResponse = await app.inject({
      method: "PUT",
      payload: updatedScoreConfig,
      url: "/api/v1/research/market-anomaly-score-config",
    });
    expect(updateScoreConfigResponse.statusCode).toBe(200);
    expect(updateScoreConfigResponse.json()).toMatchObject({
      data: expect.objectContaining({
        minScore: 70,
        toggles: expect.objectContaining({ requireBet365: true }),
      }),
    });

    writeMarketAnomalyPlaybackFrame({
      alertCount: 1,
      alerts: [anomalyResponse.json().data[0]],
      capturedAt: "2026-04-21T23:56:30.000Z",
      notifiedAlertIds: [anomalyResponse.json().data[0].id],
      poll: {
        includeHistorical: true,
        includeUnmapped: true,
        limit: 25,
        minConfidence: 0.4,
        minScore: 40,
        requireBet365: false,
      },
      source: "market-anomaly-watch",
    });

    const anomalyPlaybackResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/market-anomaly-playback?date=2026-04-21&limit=5",
    });
    expect(anomalyPlaybackResponse.statusCode).toBe(200);
    expect(anomalyPlaybackResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({
          alertCount: 1,
          alerts: [
            expect.objectContaining({
              displayLabel: "Boston moneyline",
            }),
          ],
          notifiedAlertIds: [expect.any(String)],
        }),
      ],
    });

    const boardAlertsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/board-alerts?now=2026-04-21T23:56:00.000Z&limit=3&contextWindowMinutes=60",
    });
    expect(boardAlertsResponse.statusCode).toBe(200);
    expect(boardAlertsResponse.json()).toMatchObject({
      data: expect.any(Array),
      meta: expect.objectContaining({
        now: "2026-04-21T23:56:00.000Z",
      }),
    });

    const boardVolatilityResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/board-volatility?now=2026-04-21T23:56:00.000Z&limit=3&contextWindowMinutes=60",
    });
    expect(boardVolatilityResponse.statusCode).toBe(200);
    expect(boardVolatilityResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          baseline: expect.objectContaining({
            expectedRange: expect.objectContaining({
              p50: expect.any(Number),
              p90: expect.any(Number),
            }),
            percentile: expect.any(Number),
            source: expect.stringMatching(/calibrated|fallback/),
          }),
          filter: expect.objectContaining({
            decayRegime: expect.any(String),
            stressLevel: expect.any(Number),
          }),
          gates: expect.objectContaining({
            criticalEligible: expect.any(Boolean),
          }),
          headlineScore: expect.any(Number),
          phase: expect.objectContaining({
            kind: expect.any(String),
          }),
          signals: expect.objectContaining({
            corePriceShock: expect.any(Number),
            persistenceSeconds: expect.any(Number),
          }),
        }),
      ]),
      meta: expect.objectContaining({
        now: "2026-04-21T23:56:00.000Z",
      }),
    });

    const boardIncidentsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/board-alerts/incidents?date=2026-04-21&limit=3",
    });
    expect(boardIncidentsResponse.statusCode).toBe(200);
    expect(boardIncidentsResponse.json()).toMatchObject({
      data: expect.any(Array),
      meta: expect.objectContaining({
        date: "2026-04-21",
      }),
    });
    expect(boardIncidentsResponse.json().data.length).toBeGreaterThan(0);
    expect(JSON.stringify(boardIncidentsResponse.json().data)).toContain(
      "Boston moneyline"
    );
    expect(JSON.stringify(boardIncidentsResponse.json().data)).toContain(
      "volume share"
    );

    const boardContextResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/board-alerts/event-context?gameId=nba-bos-nyk-2026-04-21&at=2026-04-21T23:56:00.000Z&windowSecondsBefore=60&windowSecondsAfter=60",
    });
    expect(boardContextResponse.statusCode).toBe(200);
    expect(boardContextResponse.json()).toMatchObject({
      data: expect.objectContaining({
        gameId: "nba-bos-nyk-2026-04-21",
        playByPlay: [],
      }),
      meta: expect.objectContaining({
        playByPlayHydration: expect.objectContaining({
          error: expect.any(String),
          hydrated: false,
        }),
      }),
    });

    process.env.NBA_SIDECAR_BASE_URL = "http://127.0.0.1:9393";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          headers: new Headers(),
          json: async () => ({
            data: {
              actions: [
                {
                  actionNumber: 1,
                  actionType: "made-shot",
                  clock: "00:02",
                  description: "Late shot",
                  period: 4,
                  teamTricode: "BOS",
                  timeActual: "2026-04-21T23:55:40.000Z",
                },
              ],
              gameId: "0022600001",
              generatedAt: "2026-04-21T23:55:45.000Z",
            },
          }),
          ok: true,
          status: 200,
          statusText: "OK",
        } satisfies Partial<Response> as Response;
      }) as unknown as typeof fetch
    );
    const hydratedBoardContextResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/board-alerts/event-context?gameId=nba-bos-nyk-2026-04-21&at=2026-04-21T23:56:00.000Z&windowSecondsBefore=60&windowSecondsAfter=60",
    });
    expect(hydratedBoardContextResponse.statusCode).toBe(200);
    expect(hydratedBoardContextResponse.json()).toMatchObject({
      data: expect.objectContaining({
        gameId: "nba-bos-nyk-2026-04-21",
        playByPlay: [
          expect.objectContaining({
            description: "Late shot",
            period: 4,
          }),
        ],
      }),
    });

    const boardReplayResponse = await app.inject({
      method: "GET",
      url: "/api/v1/research/board-alerts/replay?gameId=nba-bos-nyk-2026-04-21&windowStart=2026-04-21T23:50:00.000Z&windowEnd=2026-04-21T23:56:00.000Z&stepSeconds=60",
    });
    expect(boardReplayResponse.statusCode).toBe(200);
    expect(boardReplayResponse.json()).toMatchObject({
      data: expect.objectContaining({
        alertDeck: expect.any(Array),
        gameId: "nba-bos-nyk-2026-04-21",
      }),
    });

    const sourcesResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sources",
    });
    expect(sourcesResponse.statusCode).toBe(200);
    expect(sourcesResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          configured: true,
          source: "kalshi",
        }),
      ]),
    });

    process.env.ODDS_API_KEY = "test-secret-odds-key";
    const runtimeConfigResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/runtime-config",
    });
    expect(runtimeConfigResponse.statusCode).toBe(200);
    expect(runtimeConfigResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          configured: true,
          key: "ODDS_API_KEY",
          sensitive: true,
          valuePreview: "configured",
        }),
        expect.objectContaining({
          key: "PLAYER_PROP_ALERT_MIN_DELTA",
          defaultValue: "0.15",
        }),
      ]),
    });
    expect(JSON.stringify(runtimeConfigResponse.json())).not.toContain(
      "test-secret-odds-key"
    );

    const restartResponse = await app.inject({
      method: "POST",
      payload: { source: "bet365" },
      url: "/api/v1/admin/capture/restart",
    });
    expect(restartResponse.statusCode).toBe(202);

    const materializationResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/timeline-materializations/rebuild",
    });
    expect(materializationResponse.statusCode).toBe(202);

    const baselineRebuildResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/board-volatility-baselines/rebuild",
    });
    expect(baselineRebuildResponse.statusCode).toBe(202);

    await app.close();
  });

  it("surfaces unmapped markets and allows manual resolution", async () => {
    seedResearchBackend();
    const app = buildApiServer();

    const beforeResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/unmapped-markets",
    });
    expect(beforeResponse.statusCode).toBe(200);
    expect(beforeResponse.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          sourceMarket: expect.objectContaining({
            id: "sm-poly-brunson-points",
            mappingStatus: "unmapped",
          }),
        }),
      ]),
    });

    const resolveResponse = await app.inject({
      method: "POST",
      payload: {
        instrumentId: "brunson-over-29_5-points",
        reason: "manual player-prop mapping",
        sourceMarketId: "sm-poly-brunson-points",
      },
      url: "/api/v1/admin/mappings/resolve",
    });
    expect(resolveResponse.statusCode).toBe(200);

    const afterResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/unmapped-markets",
    });
    expect(afterResponse.statusCode).toBe(200);
    expect(afterResponse.json().data).toEqual([]);

    await app.close();
  });

  it("keeps existing instruments browsable even before any source market is attached", async () => {
    seedResearchBackend();
    upsertMarketInstrument({
      displayLabel: "Game total 221.5",
      family: "total",
      gameId: "nba-bos-nyk-2026-04-21",
      id: "game-total-221_5",
      inPlay: true,
      line: 221.5,
      participantKey: null,
      selection: "over",
    });

    const app = buildApiServer();

    const sourcesResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5/sources",
    });
    expect(sourcesResponse.statusCode).toBe(200);
    expect(sourcesResponse.json()).toMatchObject({
      data: [],
    });

    const missingResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games/nba-bos-nyk-2026-04-21/markets/missing/sources",
    });
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json()).toMatchObject({
      error: {
        code: "INSTRUMENT_NOT_FOUND",
      },
    });

    await app.close();
  });

  it("fails readiness until real sidecar/auth/session inputs and live data are present", async () => {
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "database", status: "ok" }),
        expect.objectContaining({
          details: expect.objectContaining({
            countAccuracy: "large-table-high-water-mark",
          }),
          name: "database",
        }),
        expect.objectContaining({ name: "nba-sidecar", status: "error" }),
        expect.objectContaining({ name: "bet365-capture", status: "error" }),
        expect.objectContaining({ name: "kalshi-capture", status: "error" }),
        expect.objectContaining({ name: "live-data", status: "error" }),
      ]),
      status: "error",
    });

    await app.close();
  });

  it("keeps readiness red when the NBA sidecar URL is configured but unreachable", async () => {
    process.env.NBA_SIDECAR_BASE_URL = "http://127.0.0.1:1";
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: "nba-sidecar",
          operatorHint:
            "Start the NBA sidecar or correct NBA_SIDECAR_BASE_URL before advertising live game-state readiness.",
          status: "error",
          summary: "NBA sidecar readiness check failed.",
        }),
      ]),
      status: "error",
    });

    await app.close();
  });

  it("marks kalshi capture ready when direct Kalshi API key is present", async () => {
    process.env.KALSHI_API_KEY = "kalshi-key";
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: "kalshi-capture",
          status: "ok",
          summary:
            "Kalshi capture is configured through the direct Kalshi API.",
        }),
      ]),
    });

    await app.close();
  });

  it("keeps bet365 readiness red when only a session export is present", async () => {
    const sessionPath = join(tempDir, "bet365-session.json");
    process.env.BET365_SESSION_STATE_PATH = sessionPath;
    writeFileSync(sessionPath, JSON.stringify({ cookies: [] }));
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: "bet365-capture",
          status: "error",
          summary:
            "A Bet365 session export is configured, but no active ingest path uses it yet.",
        }),
      ]),
    });

    await app.close();
  });

  it("parses boolean query flags explicitly instead of coercing all non-empty strings to true", async () => {
    seedResearchBackend();
    const app = buildApiServer();

    const gamesResponse = await app.inject({
      method: "GET",
      url: "/api/v1/games?hasUnmappedMarkets=false",
    });
    expect(gamesResponse.statusCode).toBe(200);
    expect(gamesResponse.json().data).toEqual([
      expect.objectContaining({
        game: expect.objectContaining({
          id: "nba-bos-nyk-prop-live-2026-04-21",
        }),
        hasUnmappedMarkets: false,
      }),
    ]);

    const divergenceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/divergence?inPlay=false",
    });
    expect(divergenceResponse.statusCode).toBe(200);
    expect(divergenceResponse.json().data).toEqual([]);

    await app.close();
  });
});
