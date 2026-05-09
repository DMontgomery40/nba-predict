import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  recordAdapterRun,
  recordGameStateObservation,
  recordQuoteObservation,
  recordRawPayload,
  resetDatabase,
  upsertGame,
  upsertGameOutcome,
  upsertMarketInstrument,
  upsertSourceMarket,
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

describe("api routes", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-api-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    delete process.env.NBA_SIDECAR_BASE_URL;
    delete process.env.ODDS_API_KEY;
    delete process.env.ODDS_API_IO_KEY;
    delete process.env.KALSHI_API_KEY;
    delete process.env.KALSHI_API_SECRET;
    delete process.env.BET365_SESSION_STATE_PATH;
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
      data: [
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
      ],
    });

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
        expect.objectContaining({ name: "nba-sidecar", status: "error" }),
        expect.objectContaining({ name: "bet365-capture", status: "error" }),
        expect.objectContaining({ name: "kalshi-capture", status: "error" }),
        expect.objectContaining({ name: "live-data", status: "error" }),
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
    expect(gamesResponse.json().data).toEqual([]);

    const divergenceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/divergence?inPlay=false",
    });
    expect(divergenceResponse.statusCode).toBe(200);
    expect(divergenceResponse.json().data).toEqual([]);

    await app.close();
  });
});
