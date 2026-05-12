import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getInstrumentComparison,
  getInstrumentRawSource,
  getResearchCoverage,
  getStorageCoverage,
  getInstrumentTimeline,
  listAdminSources,
  listGameMarkets,
  listResearchGames,
  listPlayerPropDisagreementAlerts,
  listResearchDivergence,
  listSignalMismatches,
  recordGameStateObservation,
  recordQuoteObservation,
  recordRawPayload,
  resetDatabase,
  upsertGame,
  upsertGameOutcome,
  upsertMarketInstrument,
  upsertSourceMarket,
} from "../db";

let tempDir = "";

function seedLiveRepositoryGame() {
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
    awayScore: 99,
    capturedAt: "2026-04-21T23:40:00.000Z",
    clock: "02:14",
    finalAt: null,
    gameId: "nba-bos-nyk-2026-04-21",
    homeScore: 104,
    isFinal: false,
    period: 4,
    startedAt: "2026-04-21T23:05:00.000Z",
    status: "in-play",
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

  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-bet365-bos-moneyline",
    instrumentId: "bos-moneyline",
    mappingStatus: "auto",
    rawFamily: "moneyline",
    rawLabel: "Boston Celtics",
    rawMetadata: { source: "bet365" },
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
    rawMetadata: { source: "kalshi" },
    source: "kalshi",
    sourceMarketKey: "kal-bos-ml",
    sourceSelectionKey: "bos",
  });

  upsertSourceMarket({
    gameId: "nba-bos-nyk-2026-04-21",
    id: "sm-bet365-bos-spread",
    instrumentId: "bos-spread-4_5",
    mappingStatus: "auto",
    rawFamily: "spread",
    rawLabel: "Boston -4.5",
    rawMetadata: { source: "bet365" },
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
    rawMetadata: { source: "kalshi" },
    source: "kalshi",
    sourceMarketKey: "kal-bos-spread",
    sourceSelectionKey: "bos",
  });

  recordQuoteObservation({
    bestAsk: null,
    bestBid: null,
    capturedAt: "2026-04-21T23:40:00.000Z",
    depthScore: 97,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.61,
    lineRaw: null,
    oddsRaw: "-156",
    priceRaw: null,
    sourceMarketId: "sm-bet365-bos-moneyline",
    volume: 100,
  });

  recordQuoteObservation({
    bestAsk: 0.69,
    bestBid: 0.68,
    capturedAt: "2026-04-21T23:40:05.000Z",
    depthScore: 78,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.68,
    lineRaw: null,
    oddsRaw: null,
    priceRaw: 0.68,
    sourceMarketId: "sm-kalshi-bos-moneyline",
    volume: 42,
  });

  recordQuoteObservation({
    bestAsk: null,
    bestBid: null,
    capturedAt: "2026-04-21T23:40:10.000Z",
    depthScore: 95,
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
    capturedAt: "2026-04-21T23:40:12.000Z",
    depthScore: 65,
    heartbeatAfterMs: 60_000,
    impliedProbability: 0.56,
    lineRaw: -5.5,
    oddsRaw: null,
    priceRaw: 0.56,
    sourceMarketId: "sm-kalshi-bos-spread",
    volume: 28,
  });
}

describe("live repository", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-live-db-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("dedupes unchanged quote captures and writes explicit heartbeats", () => {
    seedLiveRepositoryGame();

    const deduped = recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:40:30.000Z",
      depthScore: 97,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.61,
      lineRaw: null,
      oddsRaw: "-156",
      priceRaw: null,
      sourceMarketId: "sm-bet365-bos-moneyline",
      volume: 100,
    });

    const heartbeat = recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:42:10.000Z",
      depthScore: 97,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.61,
      lineRaw: null,
      oddsRaw: "-156",
      priceRaw: null,
      sourceMarketId: "sm-bet365-bos-moneyline",
      volume: 100,
    });

    const changed = recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:43:10.000Z",
      depthScore: 98,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.64,
      lineRaw: null,
      oddsRaw: "-178",
      priceRaw: null,
      sourceMarketId: "sm-bet365-bos-moneyline",
      volume: 100,
    });

    expect(deduped).toMatchObject({
      reason: "deduped",
      wrote: false,
    });
    expect(heartbeat).toMatchObject({
      reason: "heartbeat",
      tick: {
        isHeartbeat: true,
      },
      wrote: true,
    });
    expect(changed).toMatchObject({
      reason: "changed",
      tick: {
        impliedProbability: 0.64,
        isHeartbeat: false,
      },
      wrote: true,
    });

    const timeline = getInstrumentTimeline(
      "nba-bos-nyk-2026-04-21",
      "bos-moneyline"
    );

    expect(timeline?.quoteSeriesBySource.bet365).toHaveLength(3);
    expect(timeline?.quoteSeriesBySource.bet365).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isHeartbeat: true }),
        expect.objectContaining({
          impliedProbability: 0.64,
          isHeartbeat: false,
        }),
      ])
    );
  });

  it("orders the default games list by live/current slate before old persisted history", () => {
    const liveSlateStart = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    const currentSlateStart = new Date(Date.now() + 45 * 60_000).toISOString();

    upsertGame({
      awayParticipant: {
        key: "old-away",
        name: "Old Away",
        shortName: "Old Away",
        side: "away",
      },
      homeParticipant: {
        key: "old-home",
        name: "Old Home",
        shortName: "Old Home",
        side: "home",
      },
      id: "nba-old-history-game",
      league: "NBA",
      scheduledStart: "2025-10-25T00:00:00.000Z",
      sport: "basketball",
    });

    upsertGame({
      awayParticipant: {
        key: "live-away",
        name: "Live Away",
        shortName: "Live Away",
        side: "away",
      },
      homeParticipant: {
        key: "live-home",
        name: "Live Home",
        shortName: "Live Home",
        side: "home",
      },
      id: "nba-live-slate-game",
      league: "NBA",
      scheduledStart: liveSlateStart,
      sport: "basketball",
    });

    recordGameStateObservation({
      awayScore: 88,
      capturedAt: new Date().toISOString(),
      clock: "04:12",
      finalAt: null,
      gameId: "nba-live-slate-game",
      homeScore: 91,
      isFinal: false,
      period: 4,
      startedAt: liveSlateStart,
      status: "in-play",
    });

    recordGameStateObservation({
      awayScore: 1,
      capturedAt: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
      clock: "12:00",
      finalAt: null,
      gameId: "nba-live-slate-game",
      homeScore: 1,
      isFinal: false,
      period: 1,
      startedAt: liveSlateStart,
      status: "in-play",
    });

    upsertGame({
      awayParticipant: {
        key: "slate-away",
        name: "Slate Away",
        shortName: "Slate Away",
        side: "away",
      },
      homeParticipant: {
        key: "slate-home",
        name: "Slate Home",
        shortName: "Slate Home",
        side: "home",
      },
      id: "nba-current-slate-game",
      league: "NBA",
      scheduledStart: currentSlateStart,
      sport: "basketball",
    });

    expect(listResearchGames({ limit: 1 })[0]?.game.id).toBe(
      "nba-live-slate-game"
    );
    expect(listResearchGames({ limit: 1 })[0]?.gameState).toMatchObject({
      awayScore: 88,
      homeScore: 91,
    });
    expect(listResearchGames({ limit: 2 }).map((card) => card.game.id)).toEqual(
      ["nba-live-slate-game", "nba-current-slate-game"]
    );
    expect(
      listResearchGames({ date: "2025-10-25", limit: 1 })[0]?.game.id
    ).toBe("nba-old-history-game");
  });

  it("counts storage coverage without multiplying quote ticks by raw payloads", () => {
    seedLiveRepositoryGame();

    recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:41:00.000Z",
      depthScore: 98,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.63,
      lineRaw: null,
      oddsRaw: "-170",
      priceRaw: null,
      sourceMarketId: "sm-bet365-bos-moneyline",
      volume: 101,
    });
    recordRawPayload({
      capturedAt: "2026-04-21T23:40:00.000Z",
      contentHash: "raw-bet365-moneyline-1",
      entityId: "sm-bet365-bos-moneyline",
      entityType: "source_market",
      payloadJson: { price: "-156" },
      source: "bet365",
    });
    recordRawPayload({
      capturedAt: "2026-04-21T23:41:00.000Z",
      contentHash: "raw-bet365-moneyline-2",
      entityId: "sm-bet365-bos-moneyline",
      entityType: "source_market",
      payloadJson: { price: "-170" },
      source: "bet365",
    });

    expect(
      getStorageCoverage().find(
        (row) =>
          row.source === "bet365" &&
          row.gameId === "nba-bos-nyk-2026-04-21" &&
          row.family === "moneyline"
      )
    ).toMatchObject({
      quoteTickCount: 2,
      rawPayloadCount: 2,
      sourceMarketCount: 1,
    });
  });

  it("classifies spread line mismatches separately from like-for-like comparable markets", () => {
    seedLiveRepositoryGame();

    const markets = listGameMarkets("nba-bos-nyk-2026-04-21");
    const moneyline = markets.find(
      (market) => market.instrument.id === "bos-moneyline"
    );
    const spread = markets.find(
      (market) => market.instrument.id === "bos-spread-4_5"
    );

    expect(moneyline).toMatchObject({
      comparableState: "comparable",
      lineMismatch: false,
    });
    expect(spread).toMatchObject({
      comparableState: "line-mismatch",
      lineMismatch: true,
    });
  });

  it("dedupes duplicate source markets down to one latest source view and raw source selection", () => {
    seedLiveRepositoryGame();

    upsertSourceMarket({
      gameId: "nba-bos-nyk-2026-04-21",
      id: "sm-bet365-bos-moneyline-alt",
      instrumentId: "bos-moneyline",
      mappingStatus: "auto",
      rawFamily: "Alternative Moneyline",
      rawLabel: "Boston Celtics",
      rawMetadata: { source: "bet365" },
      source: "bet365",
      sourceMarketKey: "b365-bos-ml-alt",
      sourceSelectionKey: "bos",
    });

    recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:41:30.000Z",
      depthScore: 99,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.64,
      lineRaw: null,
      oddsRaw: "-178",
      priceRaw: null,
      sourceMarketId: "sm-bet365-bos-moneyline-alt",
      volume: 104,
    });

    const comparison = getInstrumentComparison(
      "nba-bos-nyk-2026-04-21",
      "bos-moneyline"
    );

    expect(
      comparison?.latestQuotesBySource.filter(
        (quote) => quote.source === "bet365"
      )
    ).toHaveLength(1);
    expect(comparison?.latestQuotesBySource).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          impliedProbability: 0.64,
          source: "bet365",
          sourceMarketId: "sm-bet365-bos-moneyline-alt",
        }),
        expect.objectContaining({
          impliedProbability: 0.68,
          source: "kalshi",
        }),
      ])
    );

    expect(
      getInstrumentRawSource(
        "nba-bos-nyk-2026-04-21",
        "bos-moneyline",
        "bet365"
      )
    ).toMatchObject({
      parserOutput: {
        impliedProbability: 0.64,
        odds: "-178",
      },
      sourceMarket: {
        id: "sm-bet365-bos-moneyline-alt",
      },
    });
  });

  it("surfaces unmapped orphan source markets in research coverage", () => {
    seedLiveRepositoryGame();

    upsertSourceMarket({
      gameId: "nba-bos-nyk-2026-04-21",
      id: "sm-poly-brunson-points",
      instrumentId: null,
      mappingStatus: "unmapped",
      rawFamily: "player-prop",
      rawLabel: "Jalen Brunson over 29.5 points",
      rawMetadata: { source: "polymarket" },
      source: "polymarket",
      sourceMarketKey: "poly-brunson-points",
      sourceSelectionKey: "over",
    });

    const coverage = getResearchCoverage().filter(
      (row) => row.gameId === "nba-bos-nyk-2026-04-21"
    );

    expect(
      coverage.find((row) => row.instrumentId == null && row.family == null)
    ).toMatchObject({
      unmappedSources: ["polymarket"],
    });
    expect(
      coverage.find(
        (row) => row.instrumentId == null && row.family === "player-prop"
      )
    ).toMatchObject({
      availableSources: ["polymarket"],
      missingSources: ["bet365", "kalshi"],
      unmappedSources: ["polymarket"],
    });
  });

  it("builds historical signal mismatches with game context from latest source views", () => {
    seedLiveRepositoryGame();

    upsertGameOutcome({
      capturedAt: "2026-04-22T00:05:00.000Z",
      finalAwayScore: 110,
      finalHomeScore: 118,
      gameId: "nba-bos-nyk-2026-04-21",
      winnerKey: "bos",
    });

    upsertSourceMarket({
      gameId: "nba-bos-nyk-2026-04-21",
      id: "sm-polymarket-bos-moneyline",
      instrumentId: "bos-moneyline",
      mappingStatus: "auto",
      rawFamily: "moneyline",
      rawLabel: "Boston wins",
      rawMetadata: { source: "polymarket" },
      source: "polymarket",
      sourceMarketKey: "poly-bos-ml",
      sourceSelectionKey: "bos",
    });

    recordQuoteObservation({
      bestAsk: 0.5,
      bestBid: 0.49,
      capturedAt: "2026-04-21T23:40:20.000Z",
      depthScore: 70,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.48,
      lineRaw: null,
      oddsRaw: null,
      priceRaw: 0.48,
      sourceMarketId: "sm-polymarket-bos-moneyline",
      volume: 31,
    });

    recordQuoteObservation({
      bestAsk: 0.5,
      bestBid: 0.49,
      capturedAt: "2026-04-21T23:40:25.000Z",
      depthScore: 81,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.49,
      lineRaw: null,
      oddsRaw: null,
      priceRaw: 0.49,
      sourceMarketId: "sm-kalshi-bos-moneyline",
      volume: 40,
    });

    expect(listSignalMismatches()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bet365ImpliedProbability: 0.61,
          directionalDisagreement: true,
          displayLabel: "Boston moneyline",
          finalAwayScore: 110,
          finalHomeScore: 118,
          gameLabel: "Knicks at Celtics",
          gameStatus: "final",
          kalshiImpliedProbability: 0.49,
          polymarketImpliedProbability: 0.48,
          scheduledStart: "2026-04-21T23:00:00.000Z",
        }),
      ])
    );
    expect(listSignalMismatches({ date: "2026-04-21" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayLabel: "Boston moneyline",
          scheduledStart: "2026-04-21T23:00:00.000Z",
        }),
      ])
    );
    expect(listSignalMismatches({ date: "2026-04-22" })).toEqual([]);
  });

  it("applies signal mismatch limits after filtering non-mismatches", () => {
    seedLiveRepositoryGame();

    recordQuoteObservation({
      bestAsk: 0.5,
      bestBid: 0.49,
      capturedAt: "2026-04-21T23:40:30.000Z",
      depthScore: 66,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.49,
      lineRaw: -5.5,
      oddsRaw: null,
      priceRaw: 0.49,
      sourceMarketId: "sm-kalshi-bos-spread",
      volume: 29,
    });

    expect(listSignalMismatches({ limit: 1 })).toEqual([
      expect.objectContaining({
        directionalDisagreement: true,
        displayLabel: "Boston -4.5",
      }),
    ]);
  });

  it("surfaces fresh player-prop attribution alerts without using stale or non-prop mismatches", () => {
    seedLiveRepositoryGame();

    upsertMarketInstrument({
      displayLabel: "Jalen Brunson points over 29.5",
      family: "player-prop",
      gameId: "nba-bos-nyk-2026-04-21",
      id: "brunson-points-over-29_5",
      inPlay: true,
      line: 29.5,
      participantKey: "jalen-brunson",
      selection: "over",
    });

    upsertSourceMarket({
      gameId: "nba-bos-nyk-2026-04-21",
      id: "sm-bet365-brunson-points",
      instrumentId: "brunson-points-over-29_5",
      mappingStatus: "auto",
      rawFamily: "player-prop",
      rawLabel: "Jalen Brunson (29.5)",
      rawMetadata: { source: "bet365" },
      source: "bet365",
      sourceMarketKey: "b365-brunson-points",
      sourceSelectionKey: "over",
    });

    upsertSourceMarket({
      gameId: "nba-bos-nyk-2026-04-21",
      id: "sm-poly-brunson-points",
      instrumentId: "brunson-points-over-29_5",
      mappingStatus: "auto",
      rawFamily: "player-prop",
      rawLabel: "Jalen Brunson: Points O/U 29.5",
      rawMetadata: { source: "polymarket" },
      source: "polymarket",
      sourceMarketKey: "poly-brunson-points",
      sourceSelectionKey: "over",
    });

    upsertMarketInstrument({
      displayLabel: "Tyrese Maxey points over 27.5",
      family: "player-prop",
      gameId: "nba-bos-nyk-2026-04-21",
      id: "maxey-points-over-27_5",
      inPlay: true,
      line: 27.5,
      participantKey: "tyrese-maxey",
      selection: "over",
    });

    upsertSourceMarket({
      gameId: "nba-bos-nyk-2026-04-21",
      id: "sm-bet365-maxey-points",
      instrumentId: "maxey-points-over-27_5",
      mappingStatus: "auto",
      rawFamily: "player-prop",
      rawLabel: "Tyrese Maxey (27.5)",
      rawMetadata: { source: "bet365" },
      source: "bet365",
      sourceMarketKey: "b365-maxey-points",
      sourceSelectionKey: "over",
    });

    recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:40:15.000Z",
      depthScore: 91,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.68,
      lineRaw: 29.5,
      oddsRaw: "-213",
      priceRaw: null,
      sourceMarketId: "sm-bet365-brunson-points",
      volume: 100,
    });

    recordQuoteObservation({
      bestAsk: 0.43,
      bestBid: 0.42,
      capturedAt: "2026-04-21T23:40:20.000Z",
      depthScore: 44,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.42,
      lineRaw: 29.5,
      oddsRaw: null,
      priceRaw: 0.42,
      sourceMarketId: "sm-poly-brunson-points",
      volume: 19,
    });

    recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:40:30.000Z",
      depthScore: 88,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.61,
      lineRaw: 27.5,
      oddsRaw: "-156",
      priceRaw: null,
      sourceMarketId: "sm-bet365-maxey-points",
      volume: 100,
    });

    const initialAlerts = listPlayerPropDisagreementAlerts({
      now: "2026-04-21T23:41:00.000Z",
    });
    const playerPropDivergence = listResearchDivergence({
      family: "player-prop",
      limit: 10,
      sort: "divergence",
    });
    expect(playerPropDivergence).toEqual([
      expect.objectContaining({
        displayLabel: "Jalen Brunson points over 29.5",
        family: "player-prop",
        impliedProbabilityGap: expect.closeTo(0.26, 6),
        sources: ["bet365", "polymarket"],
      }),
    ]);
    expect(playerPropDivergence).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayLabel: "Tyrese Maxey points over 27.5",
        }),
      ])
    );
    expect(initialAlerts).toEqual([
      expect.objectContaining({
        absoluteDelta: expect.closeTo(0.26, 6),
        action: "manual-review",
        bet365: expect.objectContaining({
          rawLabel: "Jalen Brunson (29.5)",
          source: "bet365",
        }),
        displayLabel: "Jalen Brunson points over 29.5",
        direction: "bet365-higher",
        predictionMarket: expect.objectContaining({
          rawLabel: "Jalen Brunson: Points O/U 29.5",
          source: "polymarket",
        }),
      }),
    ]);

    const initialAlertId = initialAlerts[0]?.id;

    recordQuoteObservation({
      bestAsk: null,
      bestBid: null,
      capturedAt: "2026-04-21T23:42:15.000Z",
      depthScore: 91,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.68,
      lineRaw: 29.5,
      oddsRaw: "-213",
      priceRaw: null,
      sourceMarketId: "sm-bet365-brunson-points",
      volume: 100,
    });

    recordQuoteObservation({
      bestAsk: 0.43,
      bestBid: 0.42,
      capturedAt: "2026-04-21T23:42:20.000Z",
      depthScore: 44,
      heartbeatAfterMs: 60_000,
      impliedProbability: 0.42,
      lineRaw: 29.5,
      oddsRaw: null,
      priceRaw: 0.42,
      sourceMarketId: "sm-poly-brunson-points",
      volume: 19,
    });

    const refreshedAlerts = listPlayerPropDisagreementAlerts({
      now: "2026-04-21T23:42:30.000Z",
    });
    expect(refreshedAlerts[0]).toMatchObject({
      detectedAt: "2026-04-21T23:42:20.000Z",
      id: initialAlertId,
    });

    expect(
      listPlayerPropDisagreementAlerts({
        minDelta: 0.3,
        now: "2026-04-21T23:41:00.000Z",
      })
    ).toEqual([]);

    expect(
      listPlayerPropDisagreementAlerts({
        now: "2026-04-22T00:30:00.000Z",
      })
    ).toEqual([]);

    expect(
      listPlayerPropDisagreementAlerts({
        includeStale: true,
        now: "2026-04-22T00:30:00.000Z",
      })
    ).toHaveLength(1);
  });

  it("marks bet365 session exports invalid until the configured file exists", () => {
    const sessionStatePath = join(tempDir, "bet365-session-state.json");
    process.env.BET365_SESSION_STATE_PATH = sessionStatePath;

    expect(
      listAdminSources().find((source) => source.source === "bet365")
    ).toMatchObject({
      authState: "invalid",
      bootstrapState: "invalid",
      configured: false,
      status: "error",
    });

    writeFileSync(sessionStatePath, JSON.stringify({ cookies: [] }));

    expect(
      listAdminSources().find((source) => source.source === "bet365")
    ).toMatchObject({
      authState: "configured",
      bootstrapState: "ready",
      configured: true,
      status: "ok",
    });

    delete process.env.BET365_SESSION_STATE_PATH;
  });
});
