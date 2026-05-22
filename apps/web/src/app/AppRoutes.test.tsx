import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import {
  queryClient,
  type BoardAnomalyAlertDto,
  type BoardIncidentDto,
  type BoardGameStateVolatilityDto,
  type MarketAnomaliesPayload,
  type MarketAnomalyPlaybackPayload,
  type MarketAnomalyScoreConfigPayload,
  type PlayerPropAlertPlaybackPayload,
  type PlayerPropAlertsPayload,
} from "../data/api";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  queryClient.clear();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockJsonResponse(payload: unknown) {
  return Promise.resolve({
    json: async () => payload,
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
  } satisfies Partial<Response> as Response);
}

function mockErrorResponse({
  message = "Test API failure.",
  status = 400,
}: {
  message?: string;
  status?: number;
}) {
  return Promise.resolve({
    json: async () => ({
      error: {
        code: "TEST_API_FAILURE",
        message,
        operatorHint: "Test operator hint.",
      },
    }),
    ok: false,
    status,
    statusText: "Bad Request",
    headers: new Headers(),
  } satisfies Partial<Response> as Response);
}

function createSettingsFetchImplementation(options?: {
  boardAlertRows?: BoardAnomalyAlertDto[];
  boardVolatilityRows?: BoardGameStateVolatilityDto[];
  divergenceRows?: Array<{
    captureRecencyMs?: number | null;
    comparableState: string;
    comparisonSummary?: {
      aboveThresholdDurationMs: number;
      comparisonCount: number;
      latestGap?: number | null;
      latestSourceProbabilities?: Record<string, number | null>;
      maxGap?: number | null;
      maxGapSourceProbabilities?: Record<string, number | null>;
      threshold: number;
    } | null;
    displayLabel: string;
    family: string;
    gameId: string;
    gameStatus?: string;
    impliedProbabilityGap?: number | null;
    inPlay: boolean;
    instrumentId: string;
    lineMismatch: boolean;
    mappingStatus: string;
    severity: string;
    signalPriority: number;
    sources?: string[];
  }>;
  signalMismatchRows?: Array<{
    bet365ImpliedProbability?: number | null;
    captureRecencyMs?: number | null;
    comparableState: string;
    directionalDisagreement: boolean;
    displayLabel: string;
    family: string;
    finalAwayScore?: number | null;
    finalHomeScore?: number | null;
    gameLabel: string;
    gameId: string;
    gameStatus: string;
    impliedProbabilityGap?: number | null;
    instrumentId: string;
    kalshiImpliedProbability?: number | null;
    lineMismatch: boolean;
    mappingStatus: string;
    polymarketImpliedProbability?: number | null;
    scheduledStart: string;
    severity: string;
    signalPriority: number;
  }>;
  playerPropPlaybackRows?: PlayerPropAlertPlaybackPayload["data"];
  playerPropAlertRows?: PlayerPropAlertsPayload["data"];
  marketAnomalyRows?: MarketAnomaliesPayload["data"];
  marketAnomalyPlaybackRows?: MarketAnomalyPlaybackPayload["data"];
  marketAnomalyScoreConfig?: MarketAnomalyScoreConfigPayload["data"];
  games?: Array<{
    activeInstrumentCount: number;
    coverage: {
      activeSourceCount: number;
      availableSources: string[];
      missingSources: string[];
      unmappedSourceMarketCount: number;
    };
    game: {
      awayParticipant: { key: string; name: string; shortName: string };
      homeParticipant: { key: string; name: string; shortName: string };
      id: string;
      league: string;
      scheduledStart: string;
      sport: string;
    };
    gameState?: {
      awayScore?: number | null;
      capturedAt?: string | null;
      clock?: string | null;
      homeScore?: number | null;
      isFinal?: boolean | null;
      period?: number | null;
      status: string;
    } | null;
    hasUnmappedMarkets: boolean;
    topDivergences: Array<{
      displayLabel: string;
      family: string;
      impliedProbabilityGap: number;
      instrumentId: string;
      lineMismatch: boolean;
      severity: string;
    }>;
  }>;
  unmappedMarkets?: Array<{
    game?: {
      awayParticipant: { key: string; name: string; shortName: string };
      homeParticipant: { key: string; name: string; shortName: string };
      id: string;
      league: string;
      scheduledStart: string;
      sport: string;
    } | null;
    latestQuote?: {
      capturedAt?: string | null;
      impliedProbability?: number | null;
      lineRaw?: number | null;
    } | null;
    sourceMarket: {
      gameId: string;
      id: string;
      mappingStatus: string;
      rawFamily?: string | null;
      rawLabel?: string | null;
      source: string;
      sourceMarketKey: string;
    };
  }>;
}) {
  const boardAlertRows = options?.boardAlertRows ?? [];
  const boardVolatilityRows = options?.boardVolatilityRows ?? [
    {
      alertId:
        "board-alert:nba-bos-nyk-2026-04-21:game-state-volatility:no-entity:2026-04-22T06:00:00.000Z",
      band: "alert",
      baseline: {
        cohortKey: "settled-live|p4|tip-10m-60m|margin-4-8|src-1|core-3",
        expectedRange: {
          p50: 0.18,
          p75: 0.28,
          p90: 0.41,
          p99: 0.63,
        },
        percentile: 0.92,
        sampleSize: 42,
        source: "calibrated",
      },
      components: {
        coherence: 0.8,
        coverage: 0,
        microstructure: 0.7,
        residual: 0.9,
      },
      confidence: 0.88,
      diagnostics: {
        coreFamilies: ["moneyline", "spread", "total"],
        families: ["moneyline", "spread", "total"],
        predictionMarketRows: 7,
        ready: true,
        shockRows: 4,
        sourceMarketCount: 7,
        sources: ["kalshi"],
      },
      drivers: {
        coreMarkets: [
          {
            contribution: 1,
            displayLabel: "Boston moneyline",
            evidenceUnmapped: false,
            family: "moneyline",
            observationId: "quote-1",
            participantKey: "bos",
            reason:
              "prediction-market game-state implied volatility across moneyline/spread/total; sources kalshi",
            source: "kalshi",
            sourceKind: "prediction-market",
          },
        ],
        supportingMarkets: [],
      },
      evidence: [
        {
          contribution: 1,
          displayLabel: "Boston moneyline",
          evidenceUnmapped: false,
          family: "moneyline",
          observationId: "quote-1",
          participantKey: "bos",
          reason:
            "prediction-market game-state implied volatility across moneyline/spread/total; sources kalshi",
          source: "kalshi",
          sourceKind: "prediction-market",
        },
      ],
      filter: {
        bucketSeconds: 15,
        decayRegime: "settled-live",
        innovation: 0.08,
        observationCount: 8,
        stressLevel: 0.7,
        stressVelocity: 0.04,
      },
      gameId: "nba-bos-nyk-2026-04-21",
      gameLabel: "Celtics @ Knicks",
      headlineScore: 72,
      h0Adjustments: { appliedSuppression: 0, drivers: ["in-play baseline"] },
      inspect: {
        instrumentIds: ["bos-moneyline"],
        payloadVersion: 1,
        relationFamilies: [
          "game-state-volatility",
          "moneyline",
          "spread",
          "total",
        ],
        sourceMarketIds: ["sm-kalshi-bos-moneyline"],
      },
      measuredAt: "2026-04-22T06:00:00.000Z",
      missingDataNotes: [],
      phase: {
        clock: "PT07M18.00S",
        kind: "settled-live",
        period: 4,
        secondsFromTip: 3318,
        secondsSinceLastScoreChange: 45,
      },
      sample: {
        coreFamilies: ["moneyline", "spread", "total"],
        families: ["moneyline", "spread", "total"],
        predictionMarketRows: 7,
        ready: true,
        shockRows: 4,
        sourceMarketCount: 7,
        sources: ["kalshi"],
      },
      score: 72,
      signals: {
        calibratedAbnormality: 0.71,
        coreBreadth: 0.75,
        coreLiquidityStress: 0.7,
        corePriceShock: 0.9,
        coveragePenalty: 0,
        crossSourceConfirmation: 0.35,
        persistenceSeconds: 45,
        phaseTransitionBonus: 0,
        supportPropShock: 0.1,
      },
      state: "alert",
      thresholds: {
        alertMinScore: 55,
        criticalMinScore: 85,
        elevatedMinScore: 40,
        normalMaxScore: 39,
      },
    },
  ];
  const games = options?.games ?? [];
  const divergenceRows = options?.divergenceRows ?? [
    {
      captureRecencyMs: 15000,
      comparableState: "comparable",
      comparisonSummary: {
        aboveThresholdDurationMs: 0,
        comparisonCount: 1,
        latestGap: 0.12,
        latestSourceProbabilities: {
          bet365: 0.61,
          kalshi: 0.49,
          polymarket: null,
        },
        maxGap: 0.12,
        maxGapSourceProbabilities: {
          bet365: 0.61,
          kalshi: 0.49,
          polymarket: null,
        },
        threshold: 0.15,
      },
      displayLabel: "Boston moneyline",
      family: "moneyline",
      gameId: "nba-bos-nyk-2026-04-21",
      gameStatus: "in-play",
      impliedProbabilityGap: 0.12,
      inPlay: true,
      instrumentId: "bos-moneyline",
      lineMismatch: false,
      mappingStatus: "auto",
      severity: "high",
      signalPriority: 91,
      sources: ["bet365", "kalshi"],
    },
  ];
  const signalMismatchRows = options?.signalMismatchRows ?? [
    {
      bet365ImpliedProbability: 0.61,
      captureRecencyMs: 15000,
      comparableState: "comparable",
      directionalDisagreement: true,
      displayLabel: "Boston moneyline",
      family: "moneyline",
      finalAwayScore: 110,
      finalHomeScore: 118,
      gameLabel: "Knicks at Celtics",
      gameId: "nba-bos-nyk-2026-04-21",
      gameStatus: "final",
      impliedProbabilityGap: 0.12,
      instrumentId: "bos-moneyline",
      kalshiImpliedProbability: 0.49,
      lineMismatch: false,
      mappingStatus: "auto",
      polymarketImpliedProbability: 0.52,
      scheduledStart: "2026-04-21T23:00:00.000Z",
      severity: "high",
      signalPriority: 91,
    },
  ];
  const playerPropAlertRows = options?.playerPropAlertRows ?? [
    {
      absoluteDelta: 0.29,
      action: "manual-review" as const,
      bet365: {
        capturedAt: "2026-04-22T06:00:00.000Z",
        impliedProbability: 0.64,
        lineRaw: 29.5,
        mappingStatus: "auto",
        oddsRaw: "-178",
        rawLabel: "Jalen Brunson (29.5)",
        source: "bet365" as const,
        sourceMarketId: "sm-bet365-brunson-points",
        sourceMarketKey: "b365-brunson-points",
        sourceSelectionKey: "over",
      },
      detectedAt: "2026-04-22T06:00:04.000Z",
      direction: "bet365-higher" as const,
      displayLabel: "Jalen Brunson points over 29.5",
      freshness: {
        bet365AgeMs: 6000,
        predictionMarketAgeMs: 2000,
        quoteTimeGapMs: 4000,
      },
      gameId: "nba-bos-nyk-2026-04-21",
      gameLabel: "Knicks at Celtics",
      id: "prop-alert-1",
      inPlay: true,
      instrumentId: "brunson-points-over-29_5",
      league: "NBA",
      line: 29.5,
      lineMismatch: false,
      participantKey: "jalen-brunson",
      predictionMarket: {
        bestAsk: 0.36,
        bestBid: 0.35,
        capturedAt: "2026-04-22T06:00:04.000Z",
        impliedProbability: 0.35,
        lineRaw: 29.5,
        mappingStatus: "auto",
        priceRaw: 0.35,
        rawLabel: "Jalen Brunson: 30+ points",
        source: "kalshi" as const,
        sourceMarketId: "sm-kalshi-brunson-points",
        sourceMarketKey: "kal-brunson-points",
        sourceSelectionKey: "over",
      },
      riskScore: 327,
      scheduledStart: "2026-04-22T23:00:00.000Z",
      selection: "over",
      severity: "critical",
      signedDelta: -0.29,
      sport: "basketball",
    },
  ];
  const playerPropPlaybackRows = options?.playerPropPlaybackRows ?? [
    {
      alertCount: playerPropAlertRows.length,
      alerts: playerPropAlertRows,
      capturedAt: "2026-04-22T06:00:05.000Z",
      notifiedAlertIds: playerPropAlertRows.map((row) => row.id),
      poll: {
        includeStale: false,
        limit: 25,
        maxQuoteTimeGapMinutes: 10,
        maxQuoteAgeMinutes: 10,
        minDelta: 0.15,
      },
      source: "player-prop-alert-watch" as const,
    },
  ];
  const marketAnomalyRows = options?.marketAnomalyRows ?? [
    {
      action: "manual-review" as const,
      apiSurface: "data-api/trades",
      components: {
        crossVenue: 0,
        liquidity: 0,
        offPrice: 1,
        volatility: 0,
        volumeShare: 1,
      },
      confidence: 0.95,
      detectedAt: "2026-04-22T06:00:18.000Z",
      displayLabel: "Boston moneyline",
      eventTimestamp: "2026-04-22T06:00:18.000Z",
      eventType: "trade",
      family: "moneyline",
      gameId: "nba-bos-nyk-2026-04-21",
      gameLabel: "Knicks at Celtics",
      id: "market-anomaly-1",
      instrumentId: "bos-moneyline",
      labels: ["isolated off-price print", "volume-share anomaly"],
      league: "NBA",
      mappingStatus: "auto",
      metrics: {
        bestAsk: 0.51,
        bestBid: 0.49,
        finalMarketVolume: 410.166918,
        notional: 105.66,
        price: 0.51,
        referencePrice: 0.51,
        size: 106.7913,
        tradeDistance: 0.48,
        tradePrice: 0.99,
        volumeShare: 0.26,
      },
      rawLabel: "Boston wins",
      score: 64,
      severity: "high",
      source: "polymarket" as const,
      sourceMarketId: "sm-polymarket-bos-moneyline",
      sourceMarketKey: "poly-bos-moneyline",
      sourceSelectionKey: "bos",
      sport: "basketball",
    },
  ];
  const marketAnomalyPlaybackRows = options?.marketAnomalyPlaybackRows ?? [
    {
      alertCount: marketAnomalyRows.length,
      alerts: marketAnomalyRows,
      capturedAt: "2026-04-22T06:00:20.000Z",
      notifiedAlertIds: marketAnomalyRows.map((row) => row.id),
      poll: {
        includeHistorical: false,
        includeUnmapped: true,
        limit: 25,
        minConfidence: 0.45,
        minScore: 45,
        requireBet365: false,
      },
      source: "market-anomaly-watch" as const,
    },
  ];
  const marketAnomalyScoreConfig = options?.marketAnomalyScoreConfig ?? {
    contextWindowMinutes: 10,
    families: [
      "moneyline",
      "spread",
      "total",
      "player-prop",
      "team-prop",
      "other",
    ],
    minConfidence: 0.45,
    minScore: 45,
    profileId: "default",
    shockWindowSeconds: 60,
    thresholds: {
      depthScoreDrop: 30,
      maxQuoteAgeMinutes: 10,
      priceJump: 0.18,
      spread: 0.08,
      tradeDistance: 0.25,
      volumeShare: 0.1,
    },
    toggles: {
      includeHistorical: false,
      includeUnmapped: true,
      requireBet365: false,
    },
    updatedAt: null,
    updatedBy: null,
    weights: {
      crossVenue: 0.1,
      liquidity: 0.1,
      offPrice: 0.35,
      volatility: 0.2,
      volumeShare: 0.25,
    },
  };
  const unmappedMarkets = options?.unmappedMarkets ?? [];

  return async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "/api/v1/games" || url.startsWith("/api/v1/games?")) {
      return mockJsonResponse({
        data: games,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/exports") {
      return mockJsonResponse({
        data: {
          datasets: [
            {
              formats: ["csv", "jsonl"],
              id: "market-quotes",
              rowCount: 8,
              title: "Market quote ticks",
            },
            {
              formats: ["csv", "jsonl"],
              id: "source-markets",
              rowCount: 2,
              title: "Source markets",
            },
            {
              formats: ["sqlite"],
              id: "sqlite",
              rowCount: null,
              title: "SQLite database snapshot",
            },
          ],
          filters: {},
        },
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/divergence")) {
      return mockJsonResponse({
        data: divergenceRows,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/board-alerts/incidents")) {
      return mockJsonResponse({
        data: [],
        meta: {
          date: "2026-04-22",
          generatedAt: "2026-04-22T06:00:00.000Z",
        },
      });
    }
    if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
      return mockJsonResponse({
        data: null,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/board-alerts/replay")) {
      return mockJsonResponse({
        data: null,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/board-volatility")) {
      return mockJsonResponse({
        data: boardVolatilityRows,
        meta: {
          generatedAt: "2026-04-22T06:00:00.000Z",
          now: "2026-04-22T06:00:00.000Z",
        },
      });
    }
    if (url.startsWith("/api/v1/research/board-alerts")) {
      return mockJsonResponse({
        data: boardAlertRows,
        meta: {
          generatedAt: "2026-04-22T06:00:00.000Z",
          now: "2026-04-22T06:00:00.000Z",
        },
      });
    }
    if (url === "/api/v1/admin/sources") {
      return mockJsonResponse({
        data: [
          {
            authState: "configured",
            configured: true,
            source: "kalshi",
            status: "ok",
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/admin/runtime-audit") {
      return mockJsonResponse({
        data: {
          database: {
            basename: "signal-console.sqlite",
            path: "/tmp/test-live.sqlite",
            schemaVersion: 3,
            wal: {
              mainExists: true,
              shmExists: true,
              walExists: true,
            },
          },
          generatedAt: "2026-04-22T06:00:00.000Z",
          productReadiness: {
            checklist: [
              {
                detail: "Test fixture has enough persisted quote history.",
                id: "persisted-live-data",
                label: "Persisted live data",
                status: "pass",
              },
              {
                detail: "Bet365 is represented in source coverage.",
                id: "book-leg",
                label: "Book leg",
                status: "warn",
              },
            ],
            dataState: "persisted-live",
            status: "usable-with-warnings",
            warnings: ["Runtime audit is using test fixture counts."],
          },
          sourceBreakdown: [
            {
              captureModes: ["historical"],
              gameCount: 1,
              latestQuoteAgeMs: 10_000,
              latestQuoteAt: "2026-04-22T06:00:00.000Z",
              latestRawPayloadAgeMs: 10_000,
              latestRawPayloadAt: "2026-04-22T06:00:00.000Z",
              latestRun: {
                captureMode: "historical",
                finishedAt: "2026-04-22T06:00:05.000Z",
                recordsSeen: 8,
                recordsWritten: 8,
                startedAt: "2026-04-22T06:00:00.000Z",
                status: "ok",
              },
              quoteTickCount: 8,
              rawPayloadCount: 8,
              source: "polymarket",
              sourceMarketCount: 2,
            },
          ],
          tableCounts: {
            adapterRunCount: 1,
            adminActionCount: 0,
            gameCount: 1,
            gameStateCount: 1,
            marketInstrumentCount: 1,
            outcomeCount: 1,
            quoteTickCount: 8,
            rawPayloadCount: 8,
            sourceMarketCount: 2,
          },
        },
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/admin/capture/runs") {
      return mockJsonResponse({
        data: [
          {
            finishedAt: "2026-04-22T06:00:05.000Z",
            id: 1,
            recordsSeen: 8,
            recordsWritten: 8,
            source: "polymarket",
            startedAt: "2026-04-22T06:00:00.000Z",
            status: "ok",
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/admin/runtime-config") {
      return mockJsonResponse({
        data: [
          {
            category: "Runtime",
            configured: true,
            description: "SQLite database file used by the live repository.",
            inputType: "path",
            key: "SIGNAL_CONSOLE_DB_PATH",
            label: "SQLite database path",
            restartRequired: true,
            sensitive: false,
            source: "env",
            valuePreview: "/tmp/test-live.sqlite",
          },
          {
            category: "Bet365",
            configured: true,
            description: "Odds-API.io key for the current Bet365 path.",
            inputType: "password",
            key: "ODDS_API_KEY",
            label: "Odds API key",
            restartRequired: true,
            sensitive: true,
            source: "env",
            valuePreview: "configured",
          },
          {
            category: "Player prop alerts",
            configured: false,
            defaultValue: "0.15",
            description: "Minimum Bet365-vs-exchange prop delta.",
            inputType: "number",
            key: "PLAYER_PROP_ALERT_MIN_DELTA",
            label: "Minimum prop delta",
            restartRequired: true,
            sensitive: false,
            source: "env",
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/admin/storage/coverage") {
      return mockJsonResponse({
        data: [
          {
            family: "moneyline",
            gameId: "nba-bos-nyk-2026-04-21",
            league: "NBA",
            quoteTickCount: 8,
            rawPayloadCount: 8,
            source: "polymarket",
            sourceMarketCount: 2,
            sport: "basketball",
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/admin/unmapped-markets") {
      return mockJsonResponse({
        data: unmappedMarkets,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/api/v1/research/coverage") {
      return mockJsonResponse({
        data: [
          {
            availableSources: ["bet365", "nba"],
            gameId: "nba-bos-nyk-2026-04-21",
            missingSources: ["kalshi"],
            unmappedSources: [],
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/signal-mismatches")) {
      return mockJsonResponse({
        data: signalMismatchRows,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/player-prop-alerts")) {
      return mockJsonResponse({
        data: playerPropAlertRows,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/player-prop-alert-playback")) {
      return mockJsonResponse({
        data: playerPropPlaybackRows,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/market-anomalies")) {
      return mockJsonResponse({
        data: marketAnomalyRows,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/market-anomaly-playback")) {
      return mockJsonResponse({
        data: marketAnomalyPlaybackRows,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/market-anomaly-score-config")) {
      return mockJsonResponse({
        data: marketAnomalyScoreConfig,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/signal-quality")) {
      return mockJsonResponse({
        data: {
          perSource: [
            {
              brier: 0.152,
              closingWinnerAccuracy: 0.71,
              logLoss: 0.48,
              sampleCount: 28,
              source: "bet365",
            },
            {
              brier: 0.146,
              closingWinnerAccuracy: 0.74,
              logLoss: 0.45,
              sampleCount: 28,
              source: "kalshi",
            },
            {
              brier: 0.158,
              closingWinnerAccuracy: 0.68,
              logLoss: 0.51,
              sampleCount: 28,
              source: "polymarket",
            },
          ],
          sampleCount: 84,
        },
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.startsWith("/api/v1/research/closed-games")) {
      return mockJsonResponse({
        data: [
          {
            awayParticipantKey: "nyk",
            finalAt: "2026-04-22T02:15:00.000Z",
            finalAwayScore: 110,
            finalHomeScore: 118,
            gameId: "nba-bos-nyk-2026-04-21",
            homeParticipantKey: "bos",
            league: "NBA",
            matchup: "Knicks @ Celtics",
            moneylineByParticipant: [
              {
                displayLabel: "Boston moneyline",
                family: "moneyline",
                finalAt: "2026-04-22T02:15:00.000Z",
                gameId: "nba-bos-nyk-2026-04-21",
                instrumentId: "bos-moneyline",
                outcome: {
                  winnerKey: "bos",
                  winnerProbability: 1,
                },
                participantKey: "bos",
                selection: "bos",
                sources: [
                  {
                    capturedAt: "2026-04-21T23:55:00.000Z",
                    freshnessMs: 8_400_000,
                    impliedProbability: 0.61,
                    source: "bet365",
                  },
                  {
                    capturedAt: "2026-04-21T23:55:05.000Z",
                    freshnessMs: 8_395_000,
                    impliedProbability: 0.67,
                    source: "kalshi",
                  },
                ],
              },
            ],
            scheduledStart: "2026-04-21T23:00:00.000Z",
            sport: "basketball",
            winnerKey: "bos",
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.endsWith("/timeline")) {
      return mockJsonResponse({
        data: {
          annotations: [],
          gameStateSeries: [
            {
              awayScore: 110,
              capturedAt: "2026-04-22T02:15:00.000Z",
              clock: "00:00",
              homeScore: 118,
              period: 4,
              status: "final",
            },
          ],
          lineMismatchWindows: [],
          quoteSeriesBySource: {
            bet365: [
              {
                capturedAt: "2026-04-21T23:00:00.000Z",
                impliedProbability: 0.61,
                isHeartbeat: false,
                source: "bet365",
              },
            ],
            kalshi: [
              {
                capturedAt: "2026-04-21T23:00:05.000Z",
                impliedProbability: 0.49,
                isHeartbeat: false,
                source: "kalshi",
              },
            ],
            polymarket: [
              {
                capturedAt: "2026-04-21T23:00:10.000Z",
                impliedProbability: 0.52,
                isHeartbeat: false,
                source: "polymarket",
              },
            ],
          },
        },
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.includes("/delta-series")) {
      return mockJsonResponse({
        data: [
          {
            absoluteDelta: 0.12,
            bet365Probability: 0.61,
            bucketAt: "2026-04-21T23:00:00.000Z",
            externalAverage: 0.505,
            perSource: {
              bet365: 0.61,
              kalshi: 0.49,
              polymarket: 0.52,
            },
            signedDelta: 0.105,
          },
        ],
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url.includes("/lead-lag")) {
      return mockJsonResponse({
        data: {
          bucketSeconds: 60,
          insufficientData: false,
          pairs: [
            {
              bestCorrelation: 0.83,
              bestLagBuckets: 1,
              lagSource: "bet365",
              leadSource: "kalshi",
              pair: ["kalshi", "bet365"],
              sampleCount: 18,
            },
          ],
        },
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
      });
    }
    if (url === "/health/live") {
      return mockJsonResponse({
        checks: [
          {
            name: "process",
            status: "ok",
            summary: "Fastify process is accepting requests.",
          },
        ],
        generatedAt: "2026-04-22T06:00:00.000Z",
        status: "ok",
        uptimeMs: 1200,
        version: "0.1.0",
      });
    }
    if (url === "/health/ready") {
      return Promise.resolve({
        json: async () => ({
          checks: [
            {
              name: "nba-sidecar",
              status: "error",
              summary: "NBA sidecar base URL is missing.",
            },
          ],
          generatedAt: "2026-04-22T06:00:00.000Z",
          status: "error",
          summary: {
            database: {
              appStateKeys: [],
              counts: {
                adminActionCount: 0,
                gameCount: 0,
                quoteTickCount: 0,
                rawPayloadCount: 0,
                sourceMarketCount: 0,
                watchlistCount: 0,
              },
              path: "/tmp/test.sqlite",
              schemaVersion: 3,
              status: "ok",
            },
            ingest: {
              games: 0,
              quoteTicks: 0,
              sourceMarkets: 0,
            },
          },
          uptimeMs: 1200,
          version: "0.1.0",
        }),
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers(),
      } satisfies Partial<Response> as Response);
    }
    if (url === "/api/v1/admin/capture/restart") {
      return mockJsonResponse({
        data: {
          actionType: "capture-restart",
          id: 19,
          requestedAt: "2026-04-22T06:01:00.000Z",
          status: "queued",
        },
        meta: { generatedAt: "2026-04-22T06:01:00.000Z" },
      });
    }

    throw new Error(`Unhandled request: ${url}`);
  };
}

describe("App routes", () => {
  it("renders the trader desk from persisted research surfaces", async () => {
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation({
      games: [
        {
          activeInstrumentCount: 7,
          coverage: {
            activeSourceCount: 4,
            availableSources: ["bet365", "kalshi", "polymarket", "nba"],
            missingSources: [],
            unmappedSourceMarketCount: 0,
          },
          game: {
            awayParticipant: {
              key: "nyk",
              name: "New York Knicks",
              shortName: "Knicks",
            },
            homeParticipant: {
              key: "bos",
              name: "Boston Celtics",
              shortName: "Celtics",
            },
            id: "nba-bos-nyk-2026-04-21",
            league: "NBA",
            scheduledStart: "2026-04-21T23:00:00.000Z",
            sport: "basketball",
          },
          gameState: {
            awayScore: 108,
            capturedAt: new Date().toISOString(),
            clock: "PT07M18.00S",
            homeScore: 112,
            isFinal: false,
            period: 4,
            status: "in-play",
          },
          hasUnmappedMarkets: false,
          topDivergences: [],
        },
      ],
    });
    fetchMock.mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Which source has been safest at close",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trust" })).toBeInTheDocument();
    expect(screen.getByText("Persisted source depth")).toBeInTheDocument();
    expect(
      screen.getByText("Most recent moneyline calls by source")
    ).toBeInTheDocument();
    expect(screen.getByText("Prediction-market weirdness")).toBeInTheDocument();
    const trustHeading = screen.getByRole("heading", {
      level: 2,
      name: "Which source has been safest at close",
    });
    const trustPanel = trustHeading.closest(".ops-panel");
    expect(trustPanel).not.toBeNull();
    expect(
      await within(trustPanel as HTMLElement).findByText("Best at close")
    ).toBeInTheDocument();
    const trustTable = within(trustPanel as HTMLElement).getByRole("table");
    const trustRows = within(trustTable).getAllByRole("row");
    expect(trustRows[1]).toHaveTextContent(/#1\s*kalshi/i);
    expect(trustRows[2]).toHaveTextContent(/#2\s*bet365/i);
    expect(trustRows[3]).toHaveTextContent(/#3\s*polymarket/i);
    expect(
      within(trustPanel as HTMLElement).getByText("Best to final horn")
    ).toBeInTheDocument();
    expect(
      within(trustPanel as HTMLElement).getByText("Deepest sample")
    ).toBeInTheDocument();
    expect((await screen.findAllByText(/72\/100/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Q4 7:18/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/108-112/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/settled live/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/p92/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/range p50 18 · p90 41 · p99 63/i)
    ).toBeInTheDocument();
    expect(
      (
        await screen.findAllByText(
          /prediction-market game-state implied volatility/i
        )
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Review now" })).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
    expect(screen.getAllByText("Boston moneyline").length).toBeGreaterThan(0);
    expect((await screen.findAllByText("b365 61.0%")).length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByRole("link", { name: "Open" })[0]).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
    expect(requestedUrls).toContain("/api/v1/games?limit=25");
    expect(requestedUrls).toContain(
      "/api/v1/divergence?sort=signalPriority&limit=25"
    );
    const liveAnomalyUrl = requestedUrls.find((url) =>
      url.startsWith("/api/v1/research/market-anomalies")
    );
    expect(liveAnomalyUrl).toBeDefined();
    expect(
      new URL(liveAnomalyUrl!, "http://signal-console.test").searchParams.get(
        "skipQuoteAnomalies"
      )
    ).toBeNull();
  });

  it("stages low-priority desk support feeds after the ranked queue is live", async () => {
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      requestedUrls.push(url);
      if (
        url.startsWith("/api/v1/research/signal-quality") ||
        url.startsWith("/api/v1/research/closed-games") ||
        url === "/api/v1/admin/sources" ||
        url === "/api/v1/admin/capture/runs" ||
        url === "/api/v1/admin/storage/coverage" ||
        url === "/health/ready"
      ) {
        return new Promise<Response>(() => {});
      }

      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText(/supporting desk feed/i)).not.toBeInTheDocument();
    expect(
      requestedUrls.some((url) =>
        url.startsWith("/api/v1/research/signal-quality")
      )
    ).toBe(false);
    expect(requestedUrls).not.toContain("/api/v1/admin/capture/runs");
    expect(
      requestedUrls.some((url) =>
        url.startsWith("/api/v1/research/signal-mismatches")
      )
    ).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 2300));

    await waitFor(() => {
      expect(
        requestedUrls.some((url) =>
          url.startsWith("/api/v1/research/signal-quality")
        )
      ).toBe(true);
      expect(requestedUrls).toContain("/api/v1/admin/capture/runs");
    });
    expect(screen.queryByText(/supporting desk feed/i)).not.toBeInTheDocument();
  }, 9000);

  it("prefers a ready final/live board-volatility row over a higher-scored insufficient-data row", async () => {
    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        boardVolatilityRows: [
          {
            alertId: null,
            band: "insufficient-data",
            baseline: {
              cohortKey: "pregame|p1|tip-gt-30m-pre|margin-0-3|src-1|core-1",
              expectedRange: {
                p50: 0.24,
                p75: 0.57,
                p90: 0.65,
                p99: 0.65,
              },
              percentile: 1,
              sampleSize: 14,
              source: "calibrated",
            },
            components: {
              coherence: 0.25,
              coverage: 0,
              microstructure: 1,
              residual: 1,
            },
            confidence: 0.66,
            diagnostics: {
              coreFamilies: ["moneyline"],
              families: ["moneyline"],
              predictionMarketRows: 20,
              ready: false,
              shockRows: 12,
              sourceMarketCount: 1,
              sources: ["polymarket"],
            },
            drivers: {
              coreMarkets: [],
              supportingMarkets: [],
            },
            evidence: [],
            filter: {
              bucketSeconds: 15,
              decayRegime: "pregame",
              innovation: 0.02,
              observationCount: 8,
              stressLevel: 0.9,
              stressVelocity: 0.01,
            },
            gates: {
              criticalEligible: false,
              hasCoreBreadth: false,
              hasPersistence: false,
              hasSourceConfirmation: false,
            },
            gameId: "nba-0042500313",
            gameLabel: "Thunder @ Spurs",
            headlineScore: 0,
            h0Adjustments: { appliedSuppression: 0, drivers: [] },
            inspect: {
              instrumentIds: [],
              payloadVersion: 1,
              relationFamilies: ["game-state-volatility", "moneyline"],
              sourceMarketIds: [],
            },
            measuredAt: "2026-05-21T03:19:44.372Z",
            missingDataNotes: [],
            phase: {
              clock: null,
              kind: "pregame",
              period: 0,
              secondsFromTip: -162616,
              secondsSinceLastScoreChange: null,
            },
            sample: {
              coreFamilies: ["moneyline"],
              families: ["moneyline"],
              predictionMarketRows: 20,
              ready: false,
              shockRows: 12,
              sourceMarketCount: 1,
              sources: ["polymarket"],
            },
            score: 0,
            signals: {
              calibratedAbnormality: 0.89,
              coreBreadth: 0.25,
              coreLiquidityStress: 1,
              corePriceShock: 1,
              coveragePenalty: 0,
              crossSourceConfirmation: 0.35,
              persistenceSeconds: 0,
              phaseTransitionBonus: 0,
              supportPropShock: 0,
            },
            state: "insufficient-data",
            thresholds: {
              alertMinScore: 55,
              criticalMinScore: 85,
              elevatedMinScore: 40,
              normalMaxScore: 39,
            },
          },
          {
            alertId: null,
            band: "elevated",
            baseline: {
              cohortKey: "final|p4|tip-gt-60m|margin-4-8|src-2|core-4plus",
              expectedRange: {
                p50: 0.3,
                p75: 0.42,
                p90: 0.55,
                p99: 0.7,
              },
              percentile: 0.88,
              sampleSize: 20,
              source: "calibrated",
            },
            components: {
              coherence: 0.8,
              coverage: 0,
              microstructure: 0.65,
              residual: 0.72,
            },
            confidence: 0.74,
            diagnostics: {
              coreFamilies: ["moneyline", "spread", "total", "team-prop"],
              families: ["moneyline", "spread", "total", "team-prop"],
              predictionMarketRows: 18,
              ready: true,
              shockRows: 3,
              sourceMarketCount: 18,
              sources: ["kalshi", "polymarket"],
            },
            drivers: {
              coreMarkets: [],
              supportingMarkets: [],
            },
            evidence: [],
            filter: {
              bucketSeconds: 15,
              decayRegime: "final",
              innovation: 0.05,
              observationCount: 12,
              stressLevel: 0.56,
              stressVelocity: 0.03,
            },
            gates: {
              criticalEligible: false,
              hasCoreBreadth: true,
              hasPersistence: false,
              hasSourceConfirmation: true,
            },
            gameId: "nba-0042500312",
            gameLabel: "Spurs @ Thunder",
            headlineScore: 59,
            h0Adjustments: { appliedSuppression: 0, drivers: [] },
            inspect: {
              instrumentIds: [],
              payloadVersion: 1,
              relationFamilies: ["game-state-volatility"],
              sourceMarketIds: [],
            },
            measuredAt: "2026-05-21T03:18:28.042974+00:00",
            missingDataNotes: [],
            phase: {
              clock: null,
              kind: "final",
              period: 4,
              secondsFromTip: 8305,
              secondsSinceLastScoreChange: 2,
            },
            sample: {
              coreFamilies: ["moneyline", "spread", "total", "team-prop"],
              families: ["moneyline", "spread", "total", "team-prop"],
              predictionMarketRows: 18,
              ready: true,
              shockRows: 3,
              sourceMarketCount: 18,
              sources: ["kalshi", "polymarket"],
            },
            score: 59,
            signals: {
              calibratedAbnormality: 0.61,
              coreBreadth: 1,
              coreLiquidityStress: 0.65,
              corePriceShock: 0.72,
              coveragePenalty: 0,
              crossSourceConfirmation: 0.8,
              persistenceSeconds: 15,
              phaseTransitionBonus: 0,
              supportPropShock: 0.2,
            },
            state: "elevated",
            thresholds: {
              alertMinScore: 55,
              criticalMinScore: 85,
              elevatedMinScore: 40,
              normalMaxScore: 39,
            },
          },
        ],
        divergenceRows: [
          {
            captureRecencyMs: 15000,
            comparableState: "comparable",
            displayLabel: "Thunder moneyline",
            family: "moneyline",
            gameId: "nba-0042500312",
            gameStatus: "final",
            impliedProbabilityGap: 0.12,
            inPlay: false,
            instrumentId: "okc-moneyline",
            lineMismatch: false,
            mappingStatus: "auto",
            severity: "high",
            signalPriority: 91,
            sources: ["bet365", "kalshi"],
          },
        ],
        games: [
          {
            activeInstrumentCount: 1510,
            coverage: {
              activeSourceCount: 4,
              availableSources: ["bet365", "kalshi", "polymarket", "nba"],
              missingSources: ["fanduel", "draftkings"],
              unmappedSourceMarketCount: 6,
            },
            game: {
              awayParticipant: {
                key: "sas",
                name: "San Antonio Spurs",
                shortName: "Spurs",
              },
              homeParticipant: {
                key: "okc",
                name: "Oklahoma City Thunder",
                shortName: "Thunder",
              },
              id: "nba-0042500312",
              league: "NBA",
              scheduledStart: "2026-05-21T00:30:00Z",
              sport: "basketball",
            },
            gameState: {
              awayScore: 113,
              capturedAt: "2026-05-21T03:18:28.042974+00:00",
              clock: "None",
              homeScore: 122,
              isFinal: true,
              period: 4,
              status: "final",
            },
            hasUnmappedMarkets: true,
            topDivergences: [],
          },
          {
            activeInstrumentCount: 33,
            coverage: {
              activeSourceCount: 3,
              availableSources: ["kalshi", "polymarket", "nba"],
              missingSources: ["bet365", "fanduel", "draftkings"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "okc",
                name: "Oklahoma City Thunder",
                shortName: "Thunder",
              },
              homeParticipant: {
                key: "sas",
                name: "San Antonio Spurs",
                shortName: "Spurs",
              },
              id: "nba-0042500313",
              league: "NBA",
              scheduledStart: "2026-05-23T00:30:00Z",
              sport: "basketball",
            },
            gameState: {
              awayScore: 0,
              capturedAt: "2026-05-19T12:40:11.401100+00:00",
              clock: "None",
              homeScore: 0,
              isFinal: false,
              period: 0,
              status: "scheduled",
            },
            hasUnmappedMarkets: false,
            topDivergences: [],
          },
        ],
      })
    );

    render(<App />);

    expect(
      await screen.findByText(/Spurs @ Thunder · 113-122 final · elevated/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^final$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Q4$/)).not.toBeInTheDocument();
  });

  it("keeps live desk primary surfaces polling after initial render", async () => {
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();

    const initialGameRequests = requestedUrls.filter((url) =>
      url.startsWith("/api/v1/games?limit=25")
    ).length;
    const initialDivergenceRequests = requestedUrls.filter((url) =>
      url.startsWith("/api/v1/divergence?sort=signalPriority&limit=25")
    ).length;

    await waitFor(
      () => {
        expect(
          requestedUrls.filter((url) =>
            url.startsWith("/api/v1/games?limit=25")
          ).length
        ).toBeGreaterThan(initialGameRequests);
        expect(
          requestedUrls.filter((url) =>
            url.startsWith("/api/v1/divergence?sort=signalPriority&limit=25")
          ).length
        ).toBeGreaterThan(initialDivergenceRequests);
      },
      { timeout: 6_500 }
    );
  }, 8_000);

  it("keeps the trader desk off the failure screen when a primary request retries successfully", async () => {
    const baseFetch = createSettingsFetchImplementation();
    let divergenceAttempts = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/divergence")) {
        divergenceAttempts += 1;
        if (divergenceAttempts === 1) {
          return mockErrorResponse({
            message: "Ranked divergence queue flaked.",
            status: 500,
          });
        }
      }

      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Trader desk failed to load",
      })
    ).not.toBeInTheDocument();
  });

  it("keeps cached primary data visible when a later primary refresh fails", async () => {
    const baseFetch = createSettingsFetchImplementation();
    const cachedGames = await (
      await baseFetch("/api/v1/games?limit=25")
    ).json();
    const cachedDivergence = await (
      await baseFetch("/api/v1/divergence?sort=signalPriority&limit=25")
    ).json();

    queryClient.setQueryData(["games", { limit: 25 }], cachedGames, {
      updatedAt: 0,
    });
    queryClient.setQueryData(
      ["divergence", { limit: 25, sort: "signalPriority" }],
      cachedDivergence,
      { updatedAt: 0 }
    );

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (
        url === "/api/v1/games" ||
        url.startsWith("/api/v1/games?") ||
        url.startsWith("/api/v1/divergence")
      ) {
        return mockErrorResponse({
          message: "Primary refresh failed.",
          status: 500,
        });
      }

      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Showing last trusted persisted data.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Primary refresh failed/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Trader desk failed to load",
      })
    ).not.toBeInTheDocument();
  });

  it("keeps the primary trader queue visible when the market-anomalies feed fails", async () => {
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/market-anomalies")) {
        return mockErrorResponse({
          message: "Market anomaly feed timed out.",
          status: 500,
        });
      }

      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();
    expect(await screen.findByText(/supporting desk feed/)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Trader desk failed to load",
      })
    ).not.toBeInTheDocument();
  });

  it("fails the trader desk honestly when primary research surfaces cannot load", async () => {
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (
        url === "/api/v1/games" ||
        url.startsWith("/api/v1/games?") ||
        url.startsWith("/api/v1/divergence")
      ) {
        return mockErrorResponse({
          message: "Primary persisted research data is unavailable.",
        });
      }

      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Trader desk failed to load",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Primary persisted research data is unavailable.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No ranked market pressure is persisted yet/i)
    ).not.toBeInTheDocument();
  });

  it("does not crash the board alerts history view while a date is invalid", async () => {
    window.history.replaceState({}, "", "/board-alerts");
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/incidents")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-17T19:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-17T19:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "NBA trader incidents" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Historic" }));
    fireEvent.change(screen.getByLabelText("Research date (UTC)"), {
      target: { value: "" },
    });

    expect(
      screen.getByText("Choose a valid research date.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Console shell crashed")).not.toBeInTheDocument();
  });

  it("shows the live board-alert empty state instead of hanging on loading when no incidents are returned", async () => {
    window.history.replaceState({}, "", "/board-alerts");
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-17T19:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "NBA trader incidents" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No active trader incidents.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading desk…")).not.toBeInTheDocument();
  });

  it("keeps multiple same-game historic incidents visible on the requested research date", async () => {
    window.history.replaceState({}, "", "/board-alerts?date=2026-05-16");
    const common = {
      components: {
        coherence: 0.8,
        coverage: 0,
        microstructure: 0.7,
        residual: 0.8,
      },
      confidence: 0.9,
      detectedAt: "2026-05-16T02:10:00.000Z",
      firstPopAt: "2026-05-16T02:01:48.000Z",
      gameId: "nba-0042500206",
      gameLabel: "Pistons at Cavaliers",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      severity: "high" as const,
    };
    const cadeIncident: BoardAnomalyAlertDto = {
      ...common,
      evidence: [
        {
          contribution: 0.62,
          displayLabel: "Cade Cunningham over 8.5 assists",
          evidenceUnmapped: false,
          family: "player-prop",
          observationId: "cade-assists",
          participantKey: "cade cunningham",
          reason: "62.0% share · $80 @ $0.55",
          source: "polymarket",
          sourceKind: "prediction-market",
        },
      ],
      id: "incident-cade",
      primaryEntityKey: "cade cunningham",
      primaryFamily: "player-prop",
      reason:
        "Movement is concentrated around Cade Cunningham's assists and rebounds within 10m.",
      score: 92,
      shockKind: "attribution-shaped",
    };
    const evanIncident: BoardAnomalyAlertDto = {
      ...common,
      detectedAt: "2026-05-16T01:44:07.000Z",
      evidence: [
        {
          contribution: 0.98,
          displayLabel: "Evan Mobley rebounds under 8.5",
          evidenceUnmapped: false,
          family: "player-prop",
          observationId: "evan-rebounds",
          participantKey: "evan mobley",
          reason: "98.0% score · off-price print",
          source: "polymarket",
          sourceKind: "prediction-market",
        },
      ],
      firstPopAt: "2026-05-16T01:44:07.000Z",
      id: "incident-evan",
      primaryEntityKey: "evan mobley",
      primaryFamily: "player-prop",
      reason:
        "Evan Mobley rebounds market printed off-price during the same incident window.",
      score: 80,
      shockKind: "market-structure",
    };
    const baseFetch = createSettingsFetchImplementation();
    const incidentUrls: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/incidents")) {
        incidentUrls.push(url);
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-16"
        )
      ) {
        return mockJsonResponse({
          data: [cadeIncident, evanIncident],
          meta: { date: "2026-05-16", generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "NBA trader incidents" })
    ).toBeInTheDocument();

    expect(screen.getByDisplayValue("2026-05-16")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Cade Cunningham" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evan Mobley" })
    ).toBeInTheDocument();
    expect(incidentUrls).toEqual([
      "/api/v1/research/board-alerts/incidents?date=2026-05-16&limit=50",
    ]);

    const cadeHeading = screen.getByRole("heading", {
      name: "Cade Cunningham",
    });
    const cadeCard = cadeHeading.closest("article");
    expect(cadeCard).not.toBeNull();
    expect(
      within(cadeCard as HTMLElement)
        .getByRole("link", { name: "Inspect →" })
        .getAttribute("href")
    ).toContain("date=2026-05-16");
  });

  it("keeps the more specific prop shock visible when whole-game volatility is also present", async () => {
    window.history.replaceState({}, "", "/board-alerts");
    const common = {
      components: {
        coherence: 0.9,
        coverage: 0,
        microstructure: 0.8,
        residual: 0.9,
      },
      confidence: 0.9,
      detectedAt: "2026-05-17T23:00:30.000Z",
      firstPopAt: "2026-05-17T23:00:00.000Z",
      gameId: "nba-cle-det-2026-05-17",
      gameLabel: "Cavaliers @ Pistons",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      severity: "high" as const,
    };
    const rows: BoardAnomalyAlertDto[] = [
      {
        ...common,
        evidence: [
          {
            contribution: 1,
            displayLabel: "Cade Cunningham Over 24.5 Points",
            evidenceUnmapped: false,
            family: "player-prop",
            observationId: "prop-1",
            participantKey: "cade-cunningham",
            reason: "logit 1.00 after H0",
            source: "kalshi",
            sourceKind: "prediction-market",
          },
        ],
        id: "board-alert-prop",
        primaryEntityKey: "cade-cunningham",
        primaryFamily: "player-prop",
        reason: "attribution-shaped fanout on cade-cunningham",
        score: 99,
        shockKind: "attribution-shaped",
      },
      {
        ...common,
        evidence: [
          {
            contribution: 1,
            displayLabel: "Cavaliers win",
            evidenceUnmapped: false,
            family: "moneyline",
            observationId: "game-1",
            participantKey: null,
            reason: "logit 1.00 after H0",
            source: "kalshi",
            sourceKind: "prediction-market",
          },
        ],
        id: "board-alert-game-state",
        primaryEntityKey: null,
        primaryFamily: null,
        reason:
          "prediction-market game-state implied volatility across moneyline, spread, total",
        score: 61,
        shockKind: "game-state-volatility",
      },
    ];
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: rows,
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Cade Cunningham",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/attribution-shaped fanout on cade-cunningham/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Full game-state volatility/)
    ).not.toBeInTheDocument();
  });

  it("keeps the clicked prop shock visible on the inspect route", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-cle-det-2026-05-17?at=2026-05-17T23:00:00.000Z&label=Cavaliers%20%40%20Pistons&alertId=board-alert-prop&date=2026-05-16"
    );
    const common = {
      components: {
        coherence: 0.9,
        coverage: 0,
        microstructure: 0.8,
        residual: 0.9,
      },
      confidence: 0.9,
      detectedAt: "2026-05-17T23:00:30.000Z",
      firstPopAt: "2026-05-17T23:00:00.000Z",
      gameId: "nba-cle-det-2026-05-17",
      gameLabel: "Cavaliers @ Pistons",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      severity: "high" as const,
    };
    const propRow: BoardAnomalyAlertDto = {
      ...common,
      evidence: [
        {
          contribution: 1,
          displayLabel: "Cade Cunningham Over 24.5 Points",
          evidenceUnmapped: false,
          family: "player-prop",
          observationId: "prop-1",
          participantKey: "cade-cunningham",
          reason: "logit 1.00 after H0",
          source: "kalshi",
          sourceKind: "prediction-market",
        },
      ],
      id: "board-alert-prop",
      primaryEntityKey: "cade-cunningham",
      primaryFamily: "player-prop",
      reason: "attribution-shaped fanout on cade-cunningham",
      score: 99,
      shockKind: "attribution-shaped",
    };
    const propIncident: BoardIncidentDto = {
      ...propRow,
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-17T22:55:00.000Z",
        lastActionAt: "2026-05-18T00:45:00.000Z",
        nearestAfter: null,
        nearestBefore: {
          actionNumber: 14,
          actionType: "made-shot",
          clock: "4:16",
          description: "Cade Cunningham makes 3-pt jump shot",
          offsetSeconds: -4,
          period: 3,
          teamTricode: "DET",
          timeActual: "2026-05-17T22:59:56.000Z",
        },
        totalActions: 1,
      },
      vigAdjusted: null,
    };
    const gameStateRow: BoardAnomalyAlertDto = {
      ...common,
      evidence: [
        {
          contribution: 1,
          displayLabel: "Cavaliers win",
          evidenceUnmapped: false,
          family: "moneyline",
          observationId: "game-1",
          participantKey: null,
          reason: "logit 1.00 after H0",
          source: "kalshi",
          sourceKind: "prediction-market",
        },
      ],
      id: "board-alert-game-state",
      primaryEntityKey: null,
      primaryFamily: null,
      reason:
        "prediction-market game-state implied volatility across moneyline, spread, total",
      score: 61,
      shockKind: "game-state-volatility",
    };
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-17T23:00:00.000Z",
            gameId: "nba-cle-det-2026-05-17",
            gameLabel: "Cavaliers @ Pistons",
            playByPlay: [],
            predictionMarketContext: { bySource: [], rows: [] },
            windowEnd: "2026-05-17T23:30:00.000Z",
            windowStart: "2026-05-17T22:30:00.000Z",
          },
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        return mockJsonResponse({
          data: {
            alertDeck: [propRow],
            gameId: "nba-cle-det-2026-05-17",
            gameLabel: "Cavaliers @ Pistons",
            windowEnd: "2026-05-17T23:30:00.000Z",
            windowStart: "2026-05-17T22:30:00.000Z",
          },
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-16"
        )
      ) {
        return mockJsonResponse({
          data: [propIncident],
          meta: { date: "2026-05-16", generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [propRow, gameStateRow],
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    const anchor = await screen.findByRole("region", {
      name: "Trader read",
    });
    expect(within(anchor).getByText("Cade Cunningham")).toBeInTheDocument();
    expect(
      within(anchor).getByText(
        /review or suspend cade cunningham player prop markets first/i
      )
    ).toBeInTheDocument();
    expect(
      within(anchor).getByText(/q3 4:16/i, { selector: "strong" })
    ).toBeInTheDocument();
    expect(
      within(anchor).getByText(/cade cunningham makes 3-pt jump shot/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to desk" })).toHaveAttribute(
      "href",
      "/board-alerts?date=2026-05-16"
    );
  });

  it("does not present a many-hours-away NBA row as nearby context on the inspect route", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-0042500206?at=2026-05-15T17:18:26.000Z&label=Pistons%20at%20Cavaliers&alertId=incident-pregame&date=2026-05-15"
    );
    const incident: BoardIncidentDto = {
      components: {
        coherence: 0.8,
        coverage: 0,
        microstructure: 0.7,
        residual: 0.8,
      },
      confidence: 0.9,
      detectedAt: "2026-05-15T17:18:26.000Z",
      evidence: [],
      firstPopAt: "2026-05-15T17:18:26.000Z",
      gameId: "nba-0042500206",
      gameLabel: "Pistons at Cavaliers",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      id: "incident-pregame",
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-15T23:12:09.500Z",
        lastActionAt: "2026-05-16T01:58:38.500Z",
        nearestAfter: null,
        nearestBefore: null,
        totalActions: 200,
      },
      primaryEntityKey: null,
      primaryFamily: "player-prop",
      reason: "Pregame availability tripwire.",
      score: 74,
      severity: "high",
      shockKind: "pregame-availability",
      vigAdjusted: null,
    };
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-15T17:18:26.000Z",
            gameId: "nba-0042500206",
            gameLabel: "Pistons @ Cavaliers",
            playByPlay: [],
            predictionMarketContext: { bySource: [], rows: [] },
            windowEnd: "2026-05-15T17:48:26.000Z",
            windowStart: "2026-05-15T16:48:26.000Z",
          },
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        return mockJsonResponse({
          data: {
            alertDeck: [],
            gameId: "nba-0042500206",
            gameLabel: "Pistons @ Cavaliers",
            windowEnd: "2026-05-15T17:48:26.000Z",
            windowStart: "2026-05-15T16:48:26.000Z",
          },
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-15"
        )
      ) {
        return mockJsonResponse({
          data: [incident],
          meta: { date: "2026-05-15", generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    const traderRead = await screen.findByRole("region", {
      name: "Trader read",
    });
    expect(
      within(traderRead).getByText(/pregame \/ no game clock yet/i)
    ).toBeInTheDocument();
    expect(within(traderRead).queryByText(/Nearest NBA feed row:/i)).toBeNull();
    expect(within(traderRead).queryByText(/PT12M00/i)).toBeNull();
    expect(
      screen.queryByText(/Persisted NBA play-by-play is missing here/i)
    ).toBeNull();
  });

  it("does not block a historical inspect route on replay data that it does not need", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-0042500206?at=2026-05-15T17:18:26.000Z&label=Pistons%20at%20Cavaliers&alertId=incident-pregame&date=2026-05-15"
    );
    let replayCalled = false;
    const incident: BoardIncidentDto = {
      components: {
        coherence: 0.8,
        coverage: 0,
        microstructure: 0.7,
        residual: 0.8,
      },
      confidence: 0.9,
      detectedAt: "2026-05-15T17:18:26.000Z",
      evidence: [],
      firstPopAt: "2026-05-15T17:18:26.000Z",
      gameId: "nba-0042500206",
      gameLabel: "Pistons at Cavaliers",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      id: "incident-pregame",
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-15T23:12:09.500Z",
        lastActionAt: "2026-05-16T01:58:38.500Z",
        nearestAfter: null,
        nearestBefore: null,
        totalActions: 200,
      },
      primaryEntityKey: null,
      primaryFamily: "player-prop",
      reason: "Pregame availability tripwire.",
      score: 74,
      severity: "high",
      shockKind: "pregame-availability",
      vigAdjusted: null,
    };
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-15T17:18:26.000Z",
            gameId: "nba-0042500206",
            gameLabel: "Pistons @ Cavaliers",
            playByPlay: [],
            predictionMarketContext: { bySource: [], rows: [] },
            windowEnd: "2026-05-15T17:48:26.000Z",
            windowStart: "2026-05-15T16:48:26.000Z",
          },
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        replayCalled = true;
        return mockJsonResponse({
          data: null,
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-15"
        )
      ) {
        return mockJsonResponse({
          data: [incident],
          meta: { date: "2026-05-15", generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("region", { name: "Trader read" })
    ).toBeInTheDocument();
    expect(replayCalled).toBe(false);
  });

  it("shows the exact historical participant incident from real event-context data while the broad incidents list is still unresolved", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-0042500301?at=2026-05-20T00:17:30.000Z&label=Cavaliers%20at%20Knicks&alertId=historic-participant%3Anba-0042500301%3Adean+wade%3A2026-05-20T00%3A17%3A30.000Z&date=2026-05-20"
    );
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-20T00:17:30.000Z",
            gameId: "nba-0042500301",
            gameLabel: "Cavaliers @ Knicks",
            resolvedIncident: {
              components: {
                coherence: 0.5,
                coverage: 0,
                microstructure: 1,
                residual: 1,
              },
              confidence: 0.97,
              detectedAt: "2026-05-20T00:17:30.000Z",
              evidence: [
                {
                  contribution: 0.9,
                  displayLabel: "Dean Wade rebounds over 1.5",
                  evidenceUnmapped: false,
                  family: "rebounds",
                  observationId:
                    "historic-participant:sm-dean-wade-rebounds:2026-05-20T00:17:30.000Z",
                  participantKey: "dean-wade",
                  reason: "68.0% share · $119 @ $0.99",
                  source: "polymarket",
                  sourceKind: "prediction-market",
                },
                {
                  contribution: 0.6,
                  displayLabel: "Dean Wade assists over 0.5",
                  evidenceUnmapped: false,
                  family: "assists",
                  observationId:
                    "historic-participant:sm-dean-wade-assists:2026-05-20T00:17:48.000Z",
                  participantKey: "dean-wade",
                  reason: "13.0% share · $52 @ $0.99",
                  source: "polymarket",
                  sourceKind: "prediction-market",
                },
              ],
              firstPopAt: "2026-05-20T00:17:30.000Z",
              gameId: "nba-0042500301",
              gameLabel: "Cavaliers @ Knicks",
              h0Adjustments: {
                appliedSuppression: 0,
                drivers: [
                  "2 prediction-market observations (2 trades) across 2 stat families",
                  "play-by-play context available",
                ],
              },
              id: "historic-participant:nba-0042500301:dean-wade:2026-05-20T00:17:30.000Z",
              inspect: {
                instrumentIds: [
                  "nba-0042500301-player-prop-rebounds-dean-wade-over-1-5",
                  "nba-0042500301-player-prop-assists-dean-wade-over-0-5",
                ],
                payloadVersion: 1,
                relationFamilies: ["rebounds", "assists"],
                sourceMarketIds: [
                  "sm-dean-wade-rebounds",
                  "sm-dean-wade-assists",
                ],
              },
              missingDataNotes: [],
              playByPlay: {
                available: true,
                firstActionAt: "2026-05-20T00:13:43.700Z",
                lastActionAt: "2026-05-20T02:59:58.000Z",
                nearestAfter: {
                  actionNumber: 29,
                  actionType: "3pt",
                  clock: "PT09M24.00S",
                  description:
                    "D. Mitchell 25' 3PT pullup (3 PTS) (D. Wade 2 AST)",
                  offsetSeconds: -8,
                  period: 1,
                  teamTricode: "CLE",
                  timeActual: "2026-05-20T00:17:37.800Z",
                },
                nearestBefore: {
                  actionNumber: 28,
                  actionType: "rebound",
                  clock: "PT09M38.00S",
                  description: "D. Wade REBOUND (Off:1 Def:1)",
                  offsetSeconds: 6,
                  period: 1,
                  teamTricode: "CLE",
                  timeActual: "2026-05-20T00:17:24.200Z",
                },
                totalActions: 634,
              },
              primaryEntityKey: "dean-wade",
              primaryFamily: "rebounds",
              reason:
                "Movement is concentrated around Dean Wade's assists, rebounds markets within 1m. Pattern is consistent with a player-specific stat event affecting related props.",
              score: 100,
              severity: "critical",
              shockKind: "attribution-shaped",
              vigAdjusted: null,
            },
            playByPlay: [
              {
                actionNumber: 1,
                clock: "PT09M38.00S",
                description: "D. Wade REBOUND (Off:1 Def:1)",
                offsetSeconds: -6,
                period: 1,
                teamTricode: "CLE",
                timeActual: "2026-05-20T00:17:24.000Z",
              },
            ],
            predictionMarketContext: {
              bySource: [
                {
                  families: ["rebounds", "assists"],
                  nearestOffsetSeconds: 0,
                  nearestTimestamp: "2026-05-20T00:17:30.000Z",
                  observationCount: 2,
                  participantKeys: ["dean-wade"],
                  quoteCount: 0,
                  source: "polymarket",
                  topRows: [
                    {
                      bestAsk: null,
                      bestBid: null,
                      capturedAt: "2026-05-20T00:17:30.000Z",
                      depthScore: null,
                      displayLabel: "Dean Wade rebounds over 1.5",
                      eventTimestamp: "2026-05-20T00:17:30.000Z",
                      family: "rebounds",
                      finalMarketVolume: null,
                      impliedProbability: 0.99,
                      kind: "trade",
                      mappingStatus: "auto",
                      notional: 118.79,
                      observationId: "microstructure:1",
                      offsetSeconds: 0,
                      participantKey: "dean-wade",
                      previousImpliedProbability: 0.31,
                      signalStrength: 0.9,
                      source: "polymarket",
                      sourceMarketId: "sm-dean-wade-rebounds",
                      spread: null,
                      tradePrice: 0.99,
                      tradeSize: 119.99,
                      volume: null,
                      volumeShare: 0.68,
                    },
                    {
                      bestAsk: null,
                      bestBid: null,
                      capturedAt: "2026-05-20T00:17:48.000Z",
                      depthScore: null,
                      displayLabel: "Dean Wade assists over 0.5",
                      eventTimestamp: "2026-05-20T00:17:48.000Z",
                      family: "assists",
                      finalMarketVolume: null,
                      impliedProbability: 0.99,
                      kind: "trade",
                      mappingStatus: "auto",
                      notional: 52,
                      observationId: "microstructure:2",
                      offsetSeconds: 18,
                      participantKey: "dean-wade",
                      previousImpliedProbability: 0.43,
                      signalStrength: 0.6,
                      source: "polymarket",
                      sourceMarketId: "sm-dean-wade-assists",
                      spread: null,
                      tradePrice: 0.99,
                      tradeSize: 52.53,
                      volume: null,
                      volumeShare: 0.13,
                    },
                  ],
                  tradeCount: 2,
                },
              ],
              rows: [
                {
                  bestAsk: null,
                  bestBid: null,
                  capturedAt: "2026-05-20T00:17:30.000Z",
                  depthScore: null,
                  displayLabel: "Dean Wade rebounds over 1.5",
                  eventTimestamp: "2026-05-20T00:17:30.000Z",
                  family: "rebounds",
                  finalMarketVolume: null,
                  impliedProbability: 0.99,
                  kind: "trade",
                  mappingStatus: "auto",
                  notional: 118.79,
                  observationId: "microstructure:1",
                  offsetSeconds: 0,
                  participantKey: "dean-wade",
                  previousImpliedProbability: 0.31,
                  signalStrength: 0.9,
                  source: "polymarket",
                  sourceMarketId: "sm-dean-wade-rebounds",
                  spread: null,
                  tradePrice: 0.99,
                  tradeSize: 119.99,
                  volume: null,
                  volumeShare: 0.68,
                },
                {
                  bestAsk: null,
                  bestBid: null,
                  capturedAt: "2026-05-20T00:17:48.000Z",
                  depthScore: null,
                  displayLabel: "Dean Wade assists over 0.5",
                  eventTimestamp: "2026-05-20T00:17:48.000Z",
                  family: "assists",
                  finalMarketVolume: null,
                  impliedProbability: 0.99,
                  kind: "trade",
                  mappingStatus: "auto",
                  notional: 52,
                  observationId: "microstructure:2",
                  offsetSeconds: 18,
                  participantKey: "dean-wade",
                  previousImpliedProbability: 0.43,
                  signalStrength: 0.6,
                  source: "polymarket",
                  sourceMarketId: "sm-dean-wade-assists",
                  spread: null,
                  tradePrice: 0.99,
                  tradeSize: 52.53,
                  volume: null,
                  volumeShare: 0.13,
                },
              ],
            },
            windowEnd: "2026-05-20T00:47:30.000Z",
            windowStart: "2026-05-19T23:47:30.000Z",
          },
          meta: { generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-20"
        )
      ) {
        return mockJsonResponse({
          data: [],
          meta: { date: "2026-05-20", generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        return mockJsonResponse({
          data: null,
          meta: { generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /dean wade incident review/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/persisted incident read still resolving/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /review or suspend dean wade rebounds, assists markets first/i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("Dean Wade rebounds over 1.5").length).toBe(2);
    expect(screen.getAllByText("Dean Wade assists over 0.5").length).toBe(2);
  });

  it("shows fallback context instead of a hard empty-state when no alert reconstructs but market evidence exists", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-0042500312?at=2026-05-21T00:15:29.000Z&label=Spurs%20%40%20Thunder&alertId=live-fallback"
    );
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-21T00:15:29.000Z",
            gameId: "nba-0042500312",
            gameLabel: "Spurs @ Thunder",
            playByPlay: [],
            predictionMarketContext: {
              bySource: [
                {
                  families: ["totals"],
                  nearestOffsetSeconds: 0,
                  nearestTimestamp: "2026-05-21T00:15:29.000Z",
                  observationCount: 1,
                  participantKeys: [],
                  quoteCount: 0,
                  source: "polymarket",
                  topRows: [],
                  tradeCount: 1,
                },
              ],
              rows: [
                {
                  bestAsk: null,
                  bestBid: null,
                  capturedAt: "2026-05-21T00:15:29.000Z",
                  depthScore: null,
                  displayLabel: "Over 207.5 total",
                  eventTimestamp: "2026-05-21T00:15:29.000Z",
                  family: "totals",
                  finalMarketVolume: null,
                  impliedProbability: 0.9,
                  kind: "trade",
                  mappingStatus: "auto",
                  notional: 205.16,
                  observationId: "fallback-trade-1",
                  offsetSeconds: 0,
                  participantKey: null,
                  previousImpliedProbability: 0.45,
                  signalStrength: 0.9,
                  source: "polymarket",
                  sourceMarketId: "pm-total-over-207_5",
                  spread: null,
                  tradePrice: 0.46,
                  tradeSize: 446,
                  volume: null,
                  volumeShare: 0.001,
                },
              ],
            },
            windowEnd: "2026-05-21T00:45:29.000Z",
            windowStart: "2026-05-20T23:45:29.000Z",
          },
          meta: { generatedAt: "2026-05-21T00:20:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        return mockJsonResponse({
          data: {
            alertDeck: [],
            gameId: "nba-0042500312",
            gameLabel: "Spurs @ Thunder",
            windowEnd: "2026-05-21T00:45:29.000Z",
            windowStart: "2026-05-20T23:45:29.000Z",
          },
          meta: { generatedAt: "2026-05-21T00:20:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-21T00:20:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByText(
        /showing persisted prediction-market context and fallback review targets from this window/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no incident reconstructs at this anchor timestamp/i)
    ).toBeNull();
    expect(screen.getByText("Over 207.5 total")).toBeInTheDocument();
  });

  it("keeps fallback review targets pinned to the selected participant on a historical participant inspect page", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-0042500301?at=2026-05-20T00:17:30.000Z&label=Cavaliers%20at%20Knicks&alertId=historic-participant%3Anba-0042500301%3Adean+wade%3A2026-05-20T00%3A17%3A30.000Z&date=2026-05-20"
    );
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-20T00:17:30.000Z",
            gameId: "nba-0042500301",
            gameLabel: "Cavaliers @ Knicks",
            resolvedIncident: {
              components: {
                coherence: 0.5,
                coverage: 0,
                microstructure: 1,
                residual: 1,
              },
              confidence: 0.97,
              detectedAt: "2026-05-20T00:17:30.000Z",
              evidence: [],
              firstPopAt: "2026-05-20T00:17:30.000Z",
              gameId: "nba-0042500301",
              gameLabel: "Cavaliers @ Knicks",
              h0Adjustments: {
                appliedSuppression: 0,
                drivers: [],
              },
              id: "historic-participant:nba-0042500301:dean-wade:2026-05-20T00:17:30.000Z",
              inspect: {
                instrumentIds: [],
                payloadVersion: 1,
                relationFamilies: ["rebounds"],
                sourceMarketIds: [],
              },
              missingDataNotes: [],
              playByPlay: {
                available: true,
                firstActionAt: "2026-05-20T00:13:43.700Z",
                lastActionAt: "2026-05-20T02:59:58.000Z",
                nearestAfter: null,
                nearestBefore: {
                  actionNumber: 28,
                  actionType: "rebound",
                  clock: "PT09M38.00S",
                  description: "D. Wade REBOUND (Off:1 Def:1)",
                  offsetSeconds: 6,
                  period: 1,
                  teamTricode: "CLE",
                  timeActual: "2026-05-20T00:17:24.200Z",
                },
                totalActions: 634,
              },
              primaryEntityKey: "dean-wade",
              primaryFamily: "rebounds",
              reason: "Dean Wade incident.",
              score: 100,
              severity: "critical",
              shockKind: "attribution-shaped",
              vigAdjusted: null,
            },
            playByPlay: [],
            predictionMarketContext: {
              bySource: [
                {
                  families: ["points", "rebounds"],
                  nearestOffsetSeconds: 0,
                  nearestTimestamp: "2026-05-20T00:17:30.000Z",
                  observationCount: 2,
                  participantKeys: ["dean-wade", "other-player"],
                  quoteCount: 0,
                  source: "polymarket",
                  topRows: [
                    {
                      bestAsk: null,
                      bestBid: null,
                      capturedAt: "2026-05-20T00:17:30.000Z",
                      depthScore: null,
                      displayLabel: "Other Player points over 10.5",
                      eventTimestamp: "2026-05-20T00:17:30.000Z",
                      family: "points",
                      finalMarketVolume: null,
                      impliedProbability: 0.99,
                      kind: "trade",
                      mappingStatus: "auto",
                      notional: 300,
                      observationId: "microstructure:other",
                      offsetSeconds: 0,
                      participantKey: "other-player",
                      previousImpliedProbability: 0.12,
                      signalStrength: 1,
                      source: "polymarket",
                      sourceMarketId: "sm-other-player-points",
                      spread: null,
                      tradePrice: 0.99,
                      tradeSize: 300,
                      volume: null,
                      volumeShare: 0.5,
                    },
                    {
                      bestAsk: null,
                      bestBid: null,
                      capturedAt: "2026-05-20T00:17:31.000Z",
                      depthScore: null,
                      displayLabel: "Dean Wade rebounds over 1.5",
                      eventTimestamp: "2026-05-20T00:17:31.000Z",
                      family: "rebounds",
                      finalMarketVolume: null,
                      impliedProbability: 0.75,
                      kind: "trade",
                      mappingStatus: "auto",
                      notional: 25,
                      observationId: "microstructure:dean",
                      offsetSeconds: 1,
                      participantKey: "dean-wade",
                      previousImpliedProbability: 0.4,
                      signalStrength: 0.35,
                      source: "polymarket",
                      sourceMarketId: "sm-dean-wade-rebounds",
                      spread: null,
                      tradePrice: 0.75,
                      tradeSize: 33,
                      volume: null,
                      volumeShare: 0.08,
                    },
                  ],
                  tradeCount: 2,
                },
              ],
              rows: [
                {
                  bestAsk: null,
                  bestBid: null,
                  capturedAt: "2026-05-20T00:17:30.000Z",
                  depthScore: null,
                  displayLabel: "Other Player points over 10.5",
                  eventTimestamp: "2026-05-20T00:17:30.000Z",
                  family: "points",
                  finalMarketVolume: null,
                  impliedProbability: 0.99,
                  kind: "trade",
                  mappingStatus: "auto",
                  notional: 300,
                  observationId: "microstructure:other",
                  offsetSeconds: 0,
                  participantKey: "other-player",
                  previousImpliedProbability: 0.12,
                  signalStrength: 1,
                  source: "polymarket",
                  sourceMarketId: "sm-other-player-points",
                  spread: null,
                  tradePrice: 0.99,
                  tradeSize: 300,
                  volume: null,
                  volumeShare: 0.5,
                },
                {
                  bestAsk: null,
                  bestBid: null,
                  capturedAt: "2026-05-20T00:17:31.000Z",
                  depthScore: null,
                  displayLabel: "Dean Wade rebounds over 1.5",
                  eventTimestamp: "2026-05-20T00:17:31.000Z",
                  family: "rebounds",
                  finalMarketVolume: null,
                  impliedProbability: 0.75,
                  kind: "trade",
                  mappingStatus: "auto",
                  notional: 25,
                  observationId: "microstructure:dean",
                  offsetSeconds: 1,
                  participantKey: "dean-wade",
                  previousImpliedProbability: 0.4,
                  signalStrength: 0.35,
                  source: "polymarket",
                  sourceMarketId: "sm-dean-wade-rebounds",
                  spread: null,
                  tradePrice: 0.75,
                  tradeSize: 33,
                  volume: null,
                  volumeShare: 0.08,
                },
              ],
            },
            windowEnd: "2026-05-20T00:47:30.000Z",
            windowStart: "2026-05-19T23:47:30.000Z",
          },
          meta: { generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-20"
        )
      ) {
        return mockJsonResponse({
          data: [],
          meta: { date: "2026-05-20", generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        return mockJsonResponse({
          data: null,
          meta: { generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-20T04:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    const reviewTargets = await screen.findByRole("region", {
      name: "Review targets",
    });
    expect(
      within(reviewTargets).getByText("Dean Wade rebounds over 1.5")
    ).toBeInTheDocument();
    expect(
      within(reviewTargets).queryByText("Other Player points over 10.5")
    ).not.toBeInTheDocument();
  });

  it("filters same-game historical follow-up down to the same incident burst", async () => {
    window.history.replaceState(
      {},
      "",
      "/board-alerts/nba-cle-det-2026-05-17?at=2026-05-17T23:00:00.000Z&label=Cavaliers%20%40%20Pistons&alertId=board-alert-broad&date=2026-05-16"
    );
    const common = {
      components: {
        coherence: 0.9,
        coverage: 0,
        microstructure: 0.8,
        residual: 0.9,
      },
      confidence: 0.9,
      gameId: "nba-cle-det-2026-05-17",
      gameLabel: "Cavaliers @ Pistons",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      severity: "high" as const,
    };
    const broadIncident: BoardIncidentDto = {
      ...common,
      detectedAt: "2026-05-17T23:00:00.000Z",
      firstPopAt: "2026-05-17T23:00:00.000Z",
      id: "board-alert-broad",
      evidence: [
        {
          contribution: 1,
          displayLabel: "Over 203.5 total",
          evidenceUnmapped: false,
          family: "total",
          observationId: "broad-1",
          participantKey: null,
          reason: "100.0% share · $133 @ $0.99",
          source: "polymarket",
          sourceKind: "prediction-market",
        },
      ],
      playByPlay: {
        available: false,
        firstActionAt: null,
        lastActionAt: null,
        nearestAfter: null,
        nearestBefore: null,
        totalActions: 0,
      },
      primaryEntityKey: null,
      primaryFamily: "total",
      reason: "Broad total tripwire.",
      score: 80,
      shockKind: "market-structure",
      vigAdjusted: null,
    };
    const nearIncident: BoardIncidentDto = {
      ...common,
      detectedAt: "2026-05-17T22:59:10.000Z",
      firstPopAt: "2026-05-17T22:59:10.000Z",
      id: "board-alert-near",
      evidence: [
        {
          contribution: 1,
          displayLabel: "Cade Cunningham rebounds under 5.5",
          evidenceUnmapped: false,
          family: "player-prop",
          observationId: "near-1",
          participantKey: "cade-cunningham",
          reason: "12.0% share · $29 @ $0.77",
          source: "polymarket",
          sourceKind: "prediction-market",
        },
      ],
      playByPlay: {
        available: false,
        firstActionAt: null,
        lastActionAt: null,
        nearestAfter: null,
        nearestBefore: null,
        totalActions: 0,
      },
      primaryEntityKey: "cade-cunningham",
      primaryFamily: "player-prop",
      reason: "Cade follow-up.",
      score: 72,
      shockKind: "attribution-shaped",
      vigAdjusted: null,
    };
    const farIncident: BoardIncidentDto = {
      ...common,
      detectedAt: "2026-05-17T21:30:00.000Z",
      firstPopAt: "2026-05-17T21:30:00.000Z",
      id: "board-alert-far",
      evidence: [
        {
          contribution: 1,
          displayLabel: "Dean Wade points over 0.5",
          evidenceUnmapped: false,
          family: "player-prop",
          observationId: "far-1",
          participantKey: "dean-wade",
          reason: "60.0% share · $99 @ $0.99",
          source: "polymarket",
          sourceKind: "prediction-market",
        },
      ],
      playByPlay: {
        available: false,
        firstActionAt: null,
        lastActionAt: null,
        nearestAfter: null,
        nearestBefore: null,
        totalActions: 0,
      },
      primaryEntityKey: "dean-wade",
      primaryFamily: "player-prop",
      reason: "Dean far-away incident.",
      score: 95,
      shockKind: "attribution-shaped",
      vigAdjusted: null,
    };
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/board-alerts/event-context")) {
        return mockJsonResponse({
          data: {
            anchorAt: "2026-05-17T23:00:00.000Z",
            gameId: "nba-cle-det-2026-05-17",
            gameLabel: "Cavaliers @ Pistons",
            playByPlay: [],
            predictionMarketContext: { bySource: [], rows: [] },
            windowEnd: "2026-05-17T23:30:00.000Z",
            windowStart: "2026-05-17T22:30:00.000Z",
          },
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts/replay")) {
        return mockJsonResponse({
          data: {
            alertDeck: [],
            gameId: "nba-cle-det-2026-05-17",
            gameLabel: "Cavaliers @ Pistons",
            windowEnd: "2026-05-17T23:30:00.000Z",
            windowStart: "2026-05-17T22:30:00.000Z",
          },
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-16"
        )
      ) {
        return mockJsonResponse({
          data: [broadIncident, nearIncident, farIncident],
          meta: { date: "2026-05-16", generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-17T23:00:30.000Z" },
        });
      }
      return baseFetch(input);
    });

    render(<App />);

    const followUp = await screen.findByRole("region", {
      name: "Nearby incidents",
    });
    const traderRead = screen.getByRole("region", {
      name: "Trader read",
    });
    expect(
      within(followUp).getByText(/same-burst follow-up/i)
    ).toBeInTheDocument();
    expect(within(followUp).getByText(/cade cunningham/i)).toBeInTheDocument();
    expect(within(followUp).queryByText(/dean wade/i)).not.toBeInTheDocument();
    expect(
      within(traderRead).getByText(
        /persisted nba row missing|no nearby nba row/i
      )
    ).toBeInTheDocument();
    expect(
      within(traderRead).queryByText(/^Unavailable$/i)
    ).not.toBeInTheDocument();
  });

  it("keeps historic same-game cards in time order and surfaces trader-usable timing labels", async () => {
    window.history.replaceState({}, "", "/board-alerts?date=2026-05-16");
    const common = {
      components: {
        coherence: 0.8,
        coverage: 0,
        microstructure: 0.7,
        residual: 0.8,
      },
      confidence: 0.9,
      gameId: "nba-0042500206",
      gameLabel: "Pistons at Cavaliers",
      h0Adjustments: { appliedSuppression: 0, drivers: [] },
      inspect: {
        instrumentIds: [],
        payloadVersion: 1 as const,
        relationFamilies: [],
        sourceMarketIds: [],
      },
      missingDataNotes: [],
      severity: "high" as const,
      vigAdjusted: null,
    };
    const pregameIncident: BoardIncidentDto = {
      ...common,
      detectedAt: "2026-05-16T17:18:26.000Z",
      evidence: [],
      firstPopAt: "2026-05-16T17:18:26.000Z",
      id: "incident-pregame",
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-16T23:12:09.500Z",
        lastActionAt: "2026-05-17T01:58:38.500Z",
        nearestAfter: null,
        nearestBefore: null,
        totalActions: 200,
      },
      primaryEntityKey: null,
      primaryFamily: "player-prop",
      reason: "Pregame availability tripwire.",
      score: 95,
      shockKind: "pregame-availability",
    };
    const inGameIncident: BoardIncidentDto = {
      ...common,
      detectedAt: "2026-05-16T23:16:04.000Z",
      evidence: [],
      firstPopAt: "2026-05-16T23:16:04.000Z",
      id: "incident-ingame",
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-16T23:12:09.500Z",
        lastActionAt: "2026-05-17T01:58:38.500Z",
        nearestAfter: null,
        nearestBefore: {
          actionNumber: 39,
          actionType: "2pt",
          clock: "PT08M43.00S",
          description: "A. Thompson running Layup",
          offsetSeconds: 0,
          period: 1,
          teamTricode: "DET",
          timeActual: "2026-05-16T23:16:04.500Z",
        },
        totalActions: 200,
      },
      primaryEntityKey: "ausar thompson",
      primaryFamily: "player-prop",
      reason: "In-game player follow-up.",
      score: 70,
      shockKind: "attribution-shaped",
    };
    const lateIncident: BoardIncidentDto = {
      ...common,
      detectedAt: "2026-05-16T23:36:27.000Z",
      evidence: [],
      firstPopAt: "2026-05-16T23:36:27.000Z",
      id: "incident-late",
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-16T23:12:09.500Z",
        lastActionAt: "2026-05-17T01:58:38.500Z",
        nearestAfter: null,
        nearestBefore: {
          actionNumber: 136,
          actionType: "turnover",
          clock: "PT00M56.80S",
          description: "C. Cunningham offensive foul turnover",
          offsetSeconds: 8,
          period: 1,
          teamTricode: "DET",
          timeActual: "2026-05-16T23:36:19.400Z",
        },
        totalActions: 200,
      },
      primaryEntityKey: "ausar thompson",
      primaryFamily: "player-prop",
      reason: "Late in-game market structure alert.",
      score: 99,
      shockKind: "market-structure",
    };
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (
        url.startsWith(
          "/api/v1/research/board-alerts/incidents?date=2026-05-16"
        )
      ) {
        return mockJsonResponse({
          data: [lateIncident, pregameIncident, inGameIncident],
          meta: { date: "2026-05-16", generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      if (url.startsWith("/api/v1/research/board-alerts")) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-19T20:00:00.000Z" },
        });
      }
      return baseFetch(input);
    });

    const { container } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "NBA trader incidents" })
    ).toBeInTheDocument();
    expect(
      await screen.findAllByRole("link", { name: "Inspect →" })
    ).toHaveLength(3);

    const whenLabels = Array.from(
      container.querySelectorAll(".trader-incident-card-when")
    ).map((node) => node.textContent ?? "");
    expect(whenLabels).toHaveLength(3);
    expect(whenLabels[0]).toMatch(/Pregame .*before tip/i);
    expect(whenLabels[1]).toMatch(/Q1 8:43/i);
    expect(whenLabels[2]).toMatch(/Q1 0:56/i);
  });

  it("does not report zero player props while the family-filtered divergence request is loading", async () => {
    window.history.replaceState(
      {},
      "",
      "/divergence?date=2026-04-21&family=player-prop&sort=divergence"
    );
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/divergence")) {
        return new Promise<Response>(() => undefined);
      }

      return createSettingsFetchImplementation()(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Instrument-first disagreement",
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("family")).toHaveDisplayValue("Player props");
    expect(screen.getByLabelText("slate date")).toHaveValue("2026-04-21");
    expect(screen.getByText("Loading comparisons")).toBeInTheDocument();
    expect(screen.queryByText("0 comparisons")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Loading persisted comparisons/)
    ).toBeInTheDocument();
  });

  it("renders divergence as a readable table and clears stale constraints for player props", async () => {
    window.history.replaceState(
      {},
      "",
      "/divergence?date=2026-04-21&family=player-prop&severity=high&mappedState=line-mismatch&sort=lineMismatch"
    );
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation({
      divergenceRows: [
        {
          captureRecencyMs: 15000,
          comparableState: "comparable",
          displayLabel: "Jalen Brunson points over 29.5",
          family: "player-prop",
          gameId: "nba-bos-nyk-2026-04-21",
          impliedProbabilityGap: 0.29,
          inPlay: true,
          instrumentId: "brunson-points-over-29_5",
          lineMismatch: false,
          mappingStatus: "auto",
          severity: "critical",
          signalPriority: 327,
          sources: ["bet365", "polymarket"],
        },
        {
          captureRecencyMs: 25000,
          comparableState: "comparable",
          displayLabel: "Boston moneyline",
          family: "moneyline",
          gameId: "nba-bos-nyk-2026-04-21",
          impliedProbabilityGap: 0.12,
          inPlay: true,
          instrumentId: "bos-moneyline",
          lineMismatch: false,
          mappingStatus: "auto",
          severity: "high",
          signalPriority: 91,
          sources: ["bet365", "kalshi"],
        },
      ],
    });
    fetchMock.mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Instrument-first disagreement",
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "Instrument" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("market match")).toHaveValue("line-mismatch");
    expect(screen.getAllByText("Bet365")).toHaveLength(2);
    expect(screen.getByText("Polymarket")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Jalen Brunson points over 29.5" })
    ).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/brunson-points-over-29_5"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Player prop comparisons" })
    );

    await waitFor(() => {
      expect(requestedUrls).toContain(
        "/api/v1/divergence?date=2026-04-21&family=player-prop&sort=divergence"
      );
    });
    expect(screen.getByLabelText("slate date")).toHaveValue("2026-04-21");
    expect(screen.getByLabelText("market match")).toHaveValue("");
    expect(screen.getByLabelText("severity")).toHaveValue("");
  });

  it("warns when a divergence slate has no comparisons updated in the last hour", async () => {
    window.history.replaceState({}, "", "/divergence?date=2026-05-21");
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation({
      divergenceRows: [
        {
          captureRecencyMs: 76_000_000,
          comparableState: "comparable",
          comparisonSummary: {
            aboveThresholdDurationMs: 3_712_000,
            comparisonCount: 60,
            firstAboveThresholdAt: "2026-05-20T16:03:49.000Z",
            firstComparisonAt: "2026-05-20T16:03:49.000Z",
            latestComparisonAt: "2026-05-21T00:14:43.000Z",
            latestGap: 0.06488372093023259,
            latestSignedGap: 0.06488372093023259,
            latestSourceProbabilities: {
              bet365: 0.46511627906976744,
              polymarket: 0.53,
            },
            maxGap: 0.22988372093023252,
            maxGapAt: "2026-05-20T17:01:39.000Z",
            maxGapSourceProbabilities: {
              bet365: 0.46511627906976744,
              polymarket: 0.695,
            },
            minGap: 0.03511627906976744,
            threshold: 0.15,
          },
          displayLabel: "Luguentz Dort assists under 0.5",
          family: "player-prop",
          gameId: "nba-0042500312",
          gameStatus: "final",
          impliedProbabilityGap: 0.22988372093023252,
          inPlay: false,
          instrumentId:
            "nba-0042500312-player-prop-assists-luguentz-dort-under-0-5",
          lineMismatch: false,
          mappingStatus: "auto",
          scheduledStart: "2026-05-21T00:30:00Z",
          severity: "critical",
          signalPriority: 240,
          sources: ["bet365", "polymarket"],
        },
      ],
    });
    fetchMock.mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByText("0 updated in last hour")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No persisted comparisons updated in the last hour/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Showing older persisted comparisons from the 2026-05-21 UTC slate below/i
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show live comparisons" })
    );

    await waitFor(() => {
      expect(requestedUrls).toContain("/api/v1/divergence?sort=divergence");
    });
    expect(screen.getByLabelText("slate date")).toHaveValue("");
  });

  it("renders the player prop alert monitor and saved checks", async () => {
    window.history.replaceState({}, "", "/prop-alerts");
    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Player prop alert monitor",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Current review queue")).toBeInTheDocument();
    expect(screen.getByText("Saved alert checks")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Jalen Brunson points over 29.5")).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("1 notified")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open" })[0]).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/brunson-points-over-29_5"
    );
  });

  it("renders the market anomaly queue with scoring controls", async () => {
    window.history.replaceState({}, "", "/market-anomalies");
    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Market anomaly queue",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Go look now")).toBeInTheDocument();
    expect(await screen.findByText("Score profile")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("Boston moneyline")).length
    ).toBeGreaterThan(0);
    expect(await screen.findByText("data-api/trades")).toBeInTheDocument();
    expect(await screen.findByText("$105.66")).toBeInTheDocument();
    expect(await screen.findByText(/26.0%/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open" })[0]).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
  });

  it("keeps the saved-check date in the URL and data requests", async () => {
    window.history.replaceState({}, "", "/prop-alerts?date=2026-05-10");
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Player prop alert monitor",
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-05-10");

    await waitFor(() => {
      expect(requestedUrls).toContain(
        "/api/v1/research/player-prop-alert-playback?date=2026-05-10&limit=300"
      );
      expect(requestedUrls).toContain(
        "/api/v1/divergence?date=2026-05-10&family=player-prop&sort=signalPriority&limit=500"
      );
    });
  });

  it("collapses zero-alert player prop playback into a useful tracked-props summary", async () => {
    window.history.replaceState({}, "", "/prop-alerts");
    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        divergenceRows: [
          {
            captureRecencyMs: 15000,
            comparableState: "comparable",
            displayLabel: "Jalen Brunson points over 29.5",
            family: "player-prop",
            gameId: "nba-bos-nyk-2026-04-21",
            impliedProbabilityGap: 0.58,
            inPlay: true,
            instrumentId: "brunson-points-over-29_5",
            lineMismatch: false,
            mappingStatus: "auto",
            severity: "critical",
            signalPriority: 120,
          },
          {
            captureRecencyMs: 20000,
            comparableState: "comparable",
            displayLabel: "Jayson Tatum rebounds over 8.5",
            family: "player-prop",
            gameId: "nba-bos-nyk-2026-04-21",
            impliedProbabilityGap: 0.07,
            inPlay: true,
            instrumentId: "tatum-rebounds-over-8_5",
            lineMismatch: false,
            mappingStatus: "auto",
            severity: "low",
            signalPriority: 70,
          },
        ],
        playerPropAlertRows: [],
        playerPropPlaybackRows: [0, 1, 2].map((index) => ({
          alertCount: 0,
          alerts: [],
          capturedAt: `2026-05-11T03:1${index}:20.238Z`,
          notifiedAlertIds: [],
          poll: {
            includeStale: false,
            limit: 25,
            maxQuoteTimeGapMinutes: 10,
            maxQuoteAgeMinutes: 10,
            minDelta: 0.15,
          },
          source: "player-prop-alert-watch" as const,
        })),
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Player prop alert monitor",
      })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-05-10" },
    });

    expect(
      await screen.findByText("2 tracked player props")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 watcher checks had no current alert/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 persisted comparison reached 15 pp on this date; alert notifications also require quote age and same-time quote rules at each check/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/None reached the notification threshold/i)
    ).not.toBeInTheDocument();
    expect(screen.queryAllByText("No active prop alert.")).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "See tracked props in History" })
    ).toHaveAttribute("href", "/history?date=2026-05-10&family=player-prop");
    expect(
      screen.getByText("Jayson Tatum rebounds over 8.5")
    ).toBeInTheDocument();
  });

  it("summarizes saved alert divergences even when tracked comparison rows are below threshold", async () => {
    window.history.replaceState({}, "", "/prop-alerts");
    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        divergenceRows: [
          {
            captureRecencyMs: 15000,
            comparableState: "comparable",
            displayLabel: "Jalen Brunson points over 29.5",
            family: "player-prop",
            gameId: "nba-bos-nyk-2026-04-21",
            impliedProbabilityGap: 0.02,
            inPlay: true,
            instrumentId: "brunson-points-over-29_5",
            lineMismatch: false,
            mappingStatus: "auto",
            severity: "low",
            signalPriority: 20,
          },
        ],
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Player prop alert monitor",
      })
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/1 saved alert reached 15 pp/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/saved alert divergence ranged from 29 pp to 29 pp/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No persisted comparison is at the 15 pp threshold/i)
    ).not.toBeInTheDocument();
  });

  it("shows player prop monitor API failures instead of healthy empty states", async () => {
    window.history.replaceState({}, "", "/prop-alerts");
    const baseFetch = createSettingsFetchImplementation();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/player-prop-alerts")) {
        return mockErrorResponse({
          message: "Player prop alert feed is unavailable.",
        });
      }
      if (url.startsWith("/api/v1/research/player-prop-alert-playback")) {
        return mockErrorResponse({
          message: "Player prop alert history is unavailable.",
        });
      }

      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByText(
        "Current alert feed failed; player-prop risk is unverified."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Player prop alert feed failed to load. Current queue is not verified./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Player prop alert history failed to load. Saved checks are not verified./i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No current player-prop disagreement alert.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No alert checks have been written for this date.")
    ).not.toBeInTheDocument();
  });

  it("demotes external-only pressure when Bet365 has not populated", async () => {
    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        divergenceRows: [
          {
            captureRecencyMs: 15000,
            comparableState: "comparable",
            comparisonSummary: {
              aboveThresholdDurationMs: 0,
              comparisonCount: 1,
              latestGap: 0.03,
              latestSourceProbabilities: {
                bet365: null,
                kalshi: 0.49,
                polymarket: 0.52,
              },
              maxGap: 0.03,
              maxGapSourceProbabilities: {
                bet365: null,
                kalshi: 0.49,
                polymarket: 0.52,
              },
              threshold: 0.15,
            },
            displayLabel: "Boston moneyline",
            family: "moneyline",
            gameId: "nba-bos-nyk-2026-04-21",
            gameStatus: "final",
            impliedProbabilityGap: 0.03,
            inPlay: false,
            instrumentId: "bos-moneyline",
            lineMismatch: false,
            mappingStatus: "auto",
            severity: "medium",
            signalPriority: 91,
            sources: ["kalshi", "polymarket"],
          },
        ],
        signalMismatchRows: [
          {
            bet365ImpliedProbability: null,
            captureRecencyMs: 15000,
            comparableState: "comparable",
            directionalDisagreement: true,
            displayLabel: "Boston moneyline",
            family: "moneyline",
            finalAwayScore: 110,
            finalHomeScore: 118,
            gameLabel: "Knicks at Celtics",
            gameId: "nba-bos-nyk-2026-04-21",
            gameStatus: "final",
            impliedProbabilityGap: 0.12,
            instrumentId: "bos-moneyline",
            kalshiImpliedProbability: 0.49,
            lineMismatch: false,
            mappingStatus: "auto",
            polymarketImpliedProbability: 0.52,
            scheduledStart: "2026-04-21T23:00:00.000Z",
            severity: "high",
            signalPriority: 91,
          },
        ],
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Review: Boston moneyline",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("not Bet365-vs-exchange")).toBeInTheDocument();
    expect((await screen.findAllByText("b365 n/a")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open market" })).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
  });

  it("demotes past Bet365-backed rows instead of calling them live action", async () => {
    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        divergenceRows: [
          {
            captureRecencyMs: 45 * 60 * 60_000,
            comparableState: "comparable",
            comparisonSummary: {
              aboveThresholdDurationMs: 0,
              comparisonCount: 1,
              latestGap: 0.12,
              latestSourceProbabilities: {
                bet365: 0.61,
                kalshi: 0.49,
                polymarket: 0.52,
              },
              maxGap: 0.12,
              maxGapSourceProbabilities: {
                bet365: 0.61,
                kalshi: 0.49,
                polymarket: 0.52,
              },
              threshold: 0.15,
            },
            displayLabel: "Boston moneyline",
            family: "moneyline",
            gameId: "nba-bos-nyk-2026-04-21",
            gameStatus: "final",
            impliedProbabilityGap: 0.12,
            inPlay: false,
            instrumentId: "bos-moneyline",
            lineMismatch: false,
            mappingStatus: "auto",
            severity: "high",
            signalPriority: 91,
            sources: ["bet365", "kalshi", "polymarket"],
          },
        ],
        signalMismatchRows: [
          {
            bet365ImpliedProbability: 0.61,
            captureRecencyMs: 45 * 60 * 60_000,
            comparableState: "comparable",
            directionalDisagreement: true,
            displayLabel: "Boston moneyline",
            family: "moneyline",
            finalAwayScore: 110,
            finalHomeScore: 118,
            gameLabel: "Knicks at Celtics",
            gameId: "nba-bos-nyk-2026-04-21",
            gameStatus: "final",
            impliedProbabilityGap: 0.12,
            instrumentId: "bos-moneyline",
            kalshiImpliedProbability: 0.49,
            lineMismatch: false,
            mappingStatus: "auto",
            polymarketImpliedProbability: 0.52,
            scheduledStart: "2026-04-21T23:00:00.000Z",
            severity: "high",
            signalPriority: 91,
          },
        ],
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Past comparison: Boston moneyline",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("past Bet365-vs-exchange comparison")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Bet365-vs-exchange read-first/i)
    ).not.toBeInTheDocument();
  });

  it("renders the tracked games landing page from live game payloads", async () => {
    window.history.replaceState({}, "", "/games");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/games") {
        return mockJsonResponse({
          data: [
            {
              activeInstrumentCount: 3,
              coverage: {
                activeSourceCount: 4,
                availableSources: ["bet365", "kalshi", "polymarket", "nba"],
                missingSources: [],
                unmappedSourceMarketCount: 1,
              },
              game: {
                awayParticipant: {
                  key: "nyk",
                  name: "New York Knicks",
                  shortName: "Knicks",
                },
                homeParticipant: {
                  key: "bos",
                  name: "Boston Celtics",
                  shortName: "Celtics",
                },
                id: "nba-bos-nyk-2026-04-21",
                league: "NBA",
                scheduledStart: "2026-04-21T23:00:00.000Z",
                sport: "basketball",
              },
              gameState: {
                awayScore: 108,
                homeScore: 112,
                status: "in-play",
              },
              hasUnmappedMarkets: true,
              outcome: {
                capturedAt: "2026-04-22T02:20:00.000Z",
                finalAwayScore: 108,
                finalHomeScore: 112,
                winnerKey: "bos",
              },
              topDivergences: [
                {
                  displayLabel: "Boston moneyline",
                  family: "moneyline",
                  impliedProbabilityGap: 0.07,
                  instrumentId: "bos-moneyline",
                  lineMismatch: false,
                  severity: "high",
                },
              ],
            },
            {
              activeInstrumentCount: 0,
              coverage: {
                activeSourceCount: 1,
                availableSources: ["nba"],
                missingSources: ["bet365", "kalshi", "polymarket"],
                unmappedSourceMarketCount: 0,
              },
              game: {
                awayParticipant: {
                  key: "lal",
                  name: "Los Angeles Lakers",
                  shortName: "Lakers",
                },
                homeParticipant: {
                  key: "den",
                  name: "Denver Nuggets",
                  shortName: "Nuggets",
                },
                id: "nba-den-lal-2026-04-21",
                league: "NBA",
                scheduledStart: "2026-04-21T01:30:00.000Z",
                sport: "basketball",
              },
              gameState: {
                status: "scheduled",
              },
              hasUnmappedMarkets: false,
              topDivergences: [],
            },
            {
              activeInstrumentCount: 0,
              coverage: {
                activeSourceCount: 1,
                availableSources: ["nba"],
                missingSources: ["bet365", "kalshi", "polymarket"],
                unmappedSourceMarketCount: 0,
              },
              game: {
                awayParticipant: {
                  key: "away",
                  name: "Away",
                  shortName: "Away",
                },
                homeParticipant: {
                  key: "home",
                  name: "Home",
                  shortName: "Home",
                },
                id: "nba-placeholder-2026-04-21",
                league: "NBA",
                scheduledStart: "2026-04-21T02:00:00.000Z",
                sport: "basketball",
              },
              gameState: {
                status: "scheduled",
              },
              hasUnmappedMarkets: false,
              topDivergences: [],
            },
          ],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "NBA market work slate" })
    ).toBeInTheDocument();
    expect(screen.getByText("Market work boards")).toBeInTheDocument();
    expect(screen.getByText("Scoreboard only")).toBeInTheDocument();
    expect(screen.getByText("Placeholder names")).toBeInTheDocument();
    expect(screen.getByText("Boards with market work")).toBeInTheDocument();
    expect(screen.getAllByText("Knicks at Celtics").length).toBeGreaterThan(0);
    const slateTable = screen.getByRole("table");
    expect(within(slateTable).getByText("108-112 final")).toBeInTheDocument();
    expect(
      within(slateTable).queryByText("108-112 in-play")
    ).not.toBeInTheDocument();
    expect(
      within(slateTable).queryByText("Lakers at Nuggets")
    ).not.toBeInTheDocument();
    expect(
      within(slateTable).queryByText("Away at Home")
    ).not.toBeInTheDocument();
    expect(screen.getByText("bet365, kalshi, polymarket")).toBeInTheDocument();
    expect(within(slateTable).getAllByText("available").length).toBeGreaterThan(
      0
    );
    expect(screen.getByText("Boston moneyline")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
  });

  it("does not promote coverage-only or scoreboard-only schedule rows as command-palette boards", async () => {
    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        games: [
          {
            activeInstrumentCount: 2,
            coverage: {
              activeSourceCount: 3,
              availableSources: ["bet365", "kalshi", "nba"],
              missingSources: ["polymarket"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "nyk",
                name: "New York Knicks",
                shortName: "Knicks",
              },
              homeParticipant: {
                key: "bos",
                name: "Boston Celtics",
                shortName: "Celtics",
              },
              id: "nba-bos-nyk-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T23:00:00.000Z",
              sport: "basketball",
            },
            gameState: {
              status: "in-play",
            },
            hasUnmappedMarkets: false,
            topDivergences: [
              {
                displayLabel: "Boston moneyline",
                family: "moneyline",
                impliedProbabilityGap: 0.07,
                instrumentId: "bos-moneyline",
                lineMismatch: false,
                severity: "high",
              },
            ],
          },
          {
            activeInstrumentCount: 0,
            coverage: {
              activeSourceCount: 3,
              availableSources: ["bet365", "kalshi", "nba"],
              missingSources: ["polymarket"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "lal",
                name: "Los Angeles Lakers",
                shortName: "Lakers",
              },
              homeParticipant: {
                key: "den",
                name: "Denver Nuggets",
                shortName: "Nuggets",
              },
              id: "nba-den-lal-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T01:30:00.000Z",
              sport: "basketball",
            },
            gameState: {
              status: "scheduled",
            },
            hasUnmappedMarkets: false,
            topDivergences: [],
          },
          {
            activeInstrumentCount: 0,
            coverage: {
              activeSourceCount: 1,
              availableSources: ["nba"],
              missingSources: ["bet365", "kalshi", "polymarket"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "okc",
                name: "Oklahoma City Thunder",
                shortName: "Thunder",
              },
              homeParticipant: {
                key: "phx",
                name: "Phoenix Suns",
                shortName: "Suns",
              },
              id: "nba-phx-okc-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T03:00:00.000Z",
              sport: "basketball",
            },
            gameState: {
              status: "scheduled",
            },
            hasUnmappedMarkets: false,
            topDivergences: [],
          },
        ],
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Volatility now",
      })
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { ctrlKey: true, key: "k" });

    const commandInput = await screen.findByPlaceholderText(
      "Search routes and market boards"
    );
    fireEvent.change(commandInput, { target: { value: "Knicks" } });
    expect(
      await screen.findByRole("button", { name: "Open Knicks at Celtics" })
    ).toBeInTheDocument();

    fireEvent.change(commandInput, { target: { value: "Lakers" } });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Open Lakers at Nuggets" })
      ).not.toBeInTheDocument();
    });
    fireEvent.change(commandInput, { target: { value: "Thunder" } });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Open Thunder at Suns" })
      ).not.toBeInTheDocument();
    });
    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("renders the research page from closed-game signal-quality payloads", async () => {
    window.history.replaceState({}, "", "/research");
    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "How much signal is in exchange prices vs bet365?",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Per-source signal quality")).toBeInTheDocument();
    expect(await screen.findByText("Knicks @ Celtics")).toBeInTheDocument();
    expect(screen.getByText("84 predictions graded")).toBeInTheDocument();
  });

  it("offers history and export paths when no games are currently visible", async () => {
    window.history.replaceState({}, "", "/games");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "No canonical games are visible right now",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open history" })).toHaveAttribute(
      "href",
      "/history"
    );
    expect(screen.getByRole("link", { name: "Open exports" })).toHaveAttribute(
      "href",
      "/exports"
    );
  });

  it("renders the game workspace from grouped live market payloads", async () => {
    window.history.replaceState({}, "", "/games/nba-bos-nyk-2026-04-21");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/games") {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (url === "/api/v1/games/nba-bos-nyk-2026-04-21") {
        return mockJsonResponse({
          data: {
            coverageSummary: {
              activeSourceCount: 3,
              availableSources: ["polymarket", "nba"],
              missingSources: ["bet365", "kalshi"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "nyk",
                name: "New York Knicks",
                shortName: "Knicks",
              },
              homeParticipant: {
                key: "bos",
                name: "Boston Celtics",
                shortName: "Celtics",
              },
              id: "nba-bos-nyk-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T23:00:00.000Z",
              sport: "basketball",
            },
            gameState: { awayScore: 108, homeScore: 112, status: "in-play" },
            marketFamilyCounts: [
              { family: "moneyline", count: 2 },
              { family: "spread", count: 2 },
            ],
            outcome: null,
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (url === "/api/v1/games/nba-bos-nyk-2026-04-21/markets") {
        return mockJsonResponse({
          data: {
            game: {
              awayParticipant: {
                key: "nyk",
                name: "New York Knicks",
                shortName: "Knicks",
              },
              homeParticipant: {
                key: "bos",
                name: "Boston Celtics",
                shortName: "Celtics",
              },
              id: "nba-bos-nyk-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T23:00:00.000Z",
              sport: "basketball",
            },
            gameState: { awayScore: 108, homeScore: 112, status: "in-play" },
            groups: {
              moneyline: [
                {
                  comparableState: "comparable",
                  impliedProbabilityGap: 0.08,
                  instrument: {
                    displayLabel: "Boston moneyline",
                    family: "moneyline",
                    id: "bos-moneyline",
                    inPlay: true,
                    line: null,
                    selection: "bos",
                  },
                  lineMismatch: false,
                  mappingStatus: "auto",
                  signalPriority: 81,
                  sources: [
                    {
                      capturedAt: "2026-04-22T06:00:00.000Z",
                      impliedProbability: 0.61,
                      mappingStatus: "auto",
                      raw: { label: "Boston Celtics", line: null },
                      source: "polymarket",
                      sourceMarketId: "sm-poly-bos-ml",
                    },
                  ],
                },
              ],
            },
            items: [
              {
                comparableState: "comparable",
                impliedProbabilityGap: 0.08,
                instrument: {
                  displayLabel: "Boston moneyline",
                  family: "moneyline",
                  id: "bos-moneyline",
                  inPlay: true,
                  line: null,
                  selection: "bos",
                },
                lineMismatch: false,
                mappingStatus: "auto",
                signalPriority: 81,
                sources: [
                  {
                    capturedAt: "2026-04-22T06:00:00.000Z",
                    impliedProbability: 0.61,
                    mappingStatus: "auto",
                    raw: { label: "Boston Celtics", line: null },
                    source: "polymarket",
                    sourceMarketId: "sm-poly-bos-ml",
                  },
                ],
              },
            ],
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Knicks at Celtics",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("1 market source")).toBeInTheDocument();
    expect(screen.getAllByText("NBA state").length).toBeGreaterThan(0);
    expect(screen.getByText("Available market feeds")).toBeInTheDocument();
    expect(screen.getByText("NBA game state")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open top instrument" })
    ).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
    expect(screen.getByText("Boston moneyline")).toBeInTheDocument();
  });

  it("renders the instrument workspace from live instrument and timeline payloads", async () => {
    window.history.replaceState(
      {},
      "",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/games") {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (url === "/api/v1/games/nba-bos-nyk-2026-04-21") {
        return mockJsonResponse({
          data: {
            coverageSummary: {
              activeSourceCount: 4,
              availableSources: ["bet365", "kalshi", "polymarket", "nba"],
              missingSources: [],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "nyk",
                name: "New York Knicks",
                shortName: "Knicks",
              },
              homeParticipant: {
                key: "bos",
                name: "Boston Celtics",
                shortName: "Celtics",
              },
              id: "nba-bos-nyk-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T23:00:00.000Z",
              sport: "basketball",
            },
            gameState: { awayScore: 108, homeScore: 112, status: "in-play" },
            marketFamilyCounts: [{ family: "moneyline", count: 1 }],
            outcome: null,
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url === "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
      ) {
        return mockJsonResponse({
          data: {
            derivedComparison: {
              comparableState: "comparable",
              impliedProbabilityGap: 0.07,
              lineMismatch: false,
              sourceCount: 3,
            },
            gameState: { awayScore: 108, homeScore: 112, status: "in-play" },
            instrument: {
              displayLabel: "Boston moneyline",
              family: "moneyline",
              id: "bos-moneyline",
              inPlay: true,
              line: null,
              selection: "bos",
            },
            latestQuotesBySource: [
              {
                capturedAt: "2026-04-22T05:55:00.000Z",
                freshnessMs: 20000,
                impliedProbability: 0.61,
                mappingStatus: "auto",
                raw: { label: "Boston Celtics", line: null },
                source: "bet365",
                sourceMarketId: "sm-bet365-bos-moneyline",
              },
              {
                capturedAt: "2026-04-22T05:55:05.000Z",
                freshnessMs: 25000,
                impliedProbability: 0.67,
                mappingStatus: "manual",
                raw: { label: "BOS win", line: null },
                source: "kalshi",
                sourceMarketId: "sm-kalshi-bos-moneyline",
              },
              {
                capturedAt: null,
                freshnessMs: null,
                impliedProbability: null,
                mappingStatus: "auto",
                raw: { label: "Boston yes", line: null },
                source: "polymarket",
                sourceMarketId: "sm-polymarket-bos-moneyline",
              },
            ],
            latestRawReferences: [],
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/timeline"
      ) {
        return mockJsonResponse({
          data: {
            annotations: [],
            gameStateSeries: [
              {
                awayScore: 108,
                capturedAt: "2026-04-22T05:55:00.000Z",
                homeScore: 112,
                status: "in-play",
              },
            ],
            lineMismatchWindows: [],
            quoteSeriesBySource: {
              bet365: [
                {
                  capturedAt: "2026-04-22T05:55:00.000Z",
                  impliedProbability: 0.61,
                  isHeartbeat: false,
                  source: "bet365",
                },
                {
                  capturedAt: "2026-04-22T05:55:30.000Z",
                  impliedProbability: 0.62,
                  isHeartbeat: false,
                  source: "bet365",
                },
              ],
              kalshi: [
                {
                  capturedAt: "2026-04-22T05:55:05.000Z",
                  impliedProbability: 0.67,
                  isHeartbeat: false,
                  source: "kalshi",
                },
              ],
              polymarket: [
                {
                  capturedAt: "2026-04-23T05:55:00.000Z",
                  impliedProbability: 0.58,
                  isHeartbeat: false,
                  source: "polymarket",
                },
              ],
            },
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/delta-series?bucketSeconds=60"
      ) {
        return mockJsonResponse({
          data: [
            {
              absoluteDelta: 0.06,
              bet365Probability: 0.61,
              bucketAt: "2026-04-22T05:55:00.000Z",
              externalAverage: 0.67,
              perSource: {
                bet365: 0.61,
                kalshi: 0.67,
                polymarket: null,
              },
              signedDelta: -0.06,
            },
          ],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/lead-lag?bucketSeconds=60&maxLagBuckets=20"
      ) {
        return mockJsonResponse({
          data: {
            bucketSeconds: 60,
            insufficientData: false,
            pairs: [
              {
                bestCorrelation: 0.72,
                bestLagBuckets: 0,
                lagSource: "kalshi",
                leadSource: "bet365",
                pair: ["bet365", "kalshi"],
                sampleCount: 8,
              },
            ],
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/sources"
      ) {
        return mockJsonResponse({
          data: [
            {
              diagnostics: {
                captureLagMs: 30000,
                lineMismatch: false,
                mappingStatus: "auto",
              },
              freshnessMs: 25000,
              latestQuote: {
                capturedAt: "2026-04-22T05:55:00.000Z",
                impliedProbability: 0.61,
                priceRaw: 0.61,
              },
              latestRawPayload: {
                capturedAt: "2026-04-22T05:55:00.000Z",
                id: 44,
                payloadJson: { source: "bet365" },
                source: "bet365",
              },
              source: "bet365",
              sourceMarket: {
                id: "sm-bet365-bos-moneyline",
                mappingStatus: "auto",
                rawFamily: "moneyline",
                rawLabel: "Boston Celtics",
                source: "bet365",
                sourceMarketKey: "b365-bos-ml",
              },
            },
          ],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/raw/bet365"
      ) {
        return mockJsonResponse({
          data: {
            captureDiagnostics: {
              freshnessBand: "fresh",
              lastQuoteCapturedAt: "2026-04-22T05:55:00.000Z",
              mappingStatus: "auto",
            },
            latestQuote: null,
            parserOutput: {
              impliedProbability: 0.61,
              odds: "-156",
            },
            rawPayloads: [
              {
                capturedAt: "2026-04-22T05:55:00.000Z",
                id: 1,
                payloadJson: { market: "moneyline", source: "bet365" },
                source: "bet365",
              },
            ],
            sourceMarket: {
              id: "sm-bet365-bos-moneyline",
              mappingStatus: "auto",
              rawLabel: "Boston Celtics",
              source: "bet365",
              sourceMarketKey: "b365-bos-ml",
            },
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Boston moneyline",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Export timeline CSV" })
    ).toHaveAttribute(
      "href",
      "/api/v1/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline/export.csv"
    );
    expect(screen.getByText("Celtics to win outright")).toBeInTheDocument();
    expect(await screen.findByText("peak divergence")).toBeInTheDocument();
    expect(screen.getByText("same minute")).toBeInTheDocument();
    expect(screen.queryByText(/\(lockstep\)/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Actionable now").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Comparative signal is live on this market.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/bet365 62\.0% · kalshi 67\.0% · divergence 5\.0 pp/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("n/a").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show source records" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/last source record #44/i)
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show source records" })
    );

    expect(
      (await screen.findAllByText("Source records")).length
    ).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.queryByText("Loading diagnostics…")
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/last source record #44/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Source records" }));

    const sourceRecord = await screen.findByRole("dialog", {
      name: "Source record",
    });
    expect(
      await within(sourceRecord).findByText("Normalized quote")
    ).toBeInTheDocument();
    expect(within(sourceRecord).getByText("Market record")).toBeInTheDocument();
    expect(
      within(sourceRecord).getByText("Latest raw payload")
    ).toBeInTheDocument();
    expect(sourceRecord).toHaveTextContent(/"source":\s*"bet365"/);
    expect(sourceRecord).toHaveTextContent(/"market":\s*"moneyline"/);
    expect(
      within(sourceRecord).queryByText("Raw Source Inspection")
    ).not.toBeInTheDocument();
  });

  it("does not compare final player prop quotes captured outside the same-time window", async () => {
    window.history.replaceState(
      {},
      "",
      "/games/nba-0042500234/markets/nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5"
    );

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/games") {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-12T07:35:00.000Z" },
        });
      }
      if (url === "/api/v1/games/nba-0042500234") {
        return mockJsonResponse({
          data: {
            coverageSummary: {
              activeSourceCount: 3,
              availableSources: ["bet365", "kalshi", "nba"],
              missingSources: ["polymarket"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "min",
                name: "Minnesota Timberwolves",
                shortName: "Timberwolves",
              },
              homeParticipant: {
                key: "sas",
                name: "San Antonio Spurs",
                shortName: "Spurs",
              },
              id: "nba-0042500234",
              league: "NBA",
              scheduledStart: "2026-05-10T23:30:00.000Z",
              sport: "basketball",
            },
            gameState: {
              awayScore: 109,
              capturedAt: "2026-05-11T09:18:28.182Z",
              homeScore: 114,
              isFinal: true,
              status: "final",
            },
            marketFamilyCounts: [{ family: "player-prop", count: 1 }],
            outcome: {
              finalAwayScore: 109,
              finalHomeScore: 114,
              winnerKey: "sas",
            },
          },
          meta: { generatedAt: "2026-05-12T07:35:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-0042500234/markets/nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5"
      ) {
        return mockJsonResponse({
          data: {
            derivedComparison: {
              comparableState: "comparable",
              comparisonSummary: {
                aboveThresholdDurationMs: 0,
                comparisonCount: 12,
                firstComparisonAt: "2026-05-10T23:09:26.021Z",
                latestComparisonAt: "2026-05-10T23:09:26.021Z",
                latestGap: 0.015714,
                latestSignedGap: -0.015714,
                latestSourceProbabilities: {
                  bet365: 0.714286,
                  kalshi: 0.73,
                  polymarket: null,
                },
                maxGap: 0.015714,
                maxGapAt: "2026-05-10T23:09:26.021Z",
                maxGapSourceProbabilities: {
                  bet365: 0.714286,
                  kalshi: 0.73,
                  polymarket: null,
                },
                minGap: 0.015714,
                threshold: 0.15,
              },
              impliedProbabilityGap: 0.684,
              lineMismatch: false,
              sourceCount: 2,
            },
            gameState: {
              awayScore: 109,
              capturedAt: "2026-05-11T09:18:28.182Z",
              homeScore: 114,
              isFinal: true,
              status: "final",
            },
            instrument: {
              displayLabel: "Victor Wembanyama over 0.5 steals",
              family: "player-prop",
              id: "nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5",
              inPlay: false,
              line: 0.5,
              selection: "over",
            },
            latestQuotesBySource: [
              {
                capturedAt: "2026-05-10T23:09:15.934Z",
                freshnessMs: 116_744_066,
                impliedProbability: 0.714,
                mappingStatus: "auto",
                raw: {
                  label: "Victor Wembanyama (1) (0.5)",
                  line: 0.5,
                  odds: "1.40",
                  price: 1.4,
                  selectionKey: "victor-wembanyama-over",
                },
                source: "bet365",
                sourceMarketId: "sm-bet365-wemby-steals",
              },
              {
                capturedAt: "2026-05-12T07:30:23.373Z",
                freshnessMs: 276_627,
                impliedProbability: 0.03,
                mappingStatus: "auto",
                raw: {
                  label: "Victor Wembanyama: 1+ steals",
                  line: 0.5,
                  price: 0.03,
                  selectionKey: "over",
                },
                source: "kalshi",
                sourceMarketId: "sm-kalshi-wemby-steals",
              },
            ],
            latestRawReferences: [],
          },
          meta: { generatedAt: "2026-05-12T07:35:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-0042500234/markets/nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5/timeline"
      ) {
        return mockJsonResponse({
          data: {
            annotations: [],
            gameStateSeries: [],
            lineMismatchWindows: [],
            quoteSeriesBySource: {
              bet365: [
                {
                  capturedAt: "2026-05-10T23:09:15.934Z",
                  impliedProbability: 0.714,
                  isHeartbeat: false,
                  source: "bet365",
                },
              ],
              kalshi: [
                {
                  capturedAt: "2026-05-10T23:09:26.021Z",
                  impliedProbability: 0.73,
                  isHeartbeat: false,
                  source: "kalshi",
                },
                {
                  capturedAt: "2026-05-12T07:30:23.373Z",
                  impliedProbability: 0.03,
                  isHeartbeat: false,
                  source: "kalshi",
                },
              ],
              polymarket: [],
            },
          },
          meta: { generatedAt: "2026-05-12T07:35:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-0042500234/markets/nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5/delta-series?bucketSeconds=60"
      ) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-05-12T07:35:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-0042500234/markets/nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5/lead-lag?bucketSeconds=60&maxLagBuckets=20"
      ) {
        return mockJsonResponse({
          data: {
            bucketSeconds: 60,
            insufficientData: true,
            pairs: [],
          },
          meta: { generatedAt: "2026-05-12T07:35:00.000Z" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Victor Wembanyama over 0.5 steals",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("1.6 pp peak divergence")).toBeInTheDocument();
    expect(screen.getByText("Latest measured")).toBeInTheDocument();
    const sampleCell = screen
      .getByText("same-time samples")
      .closest(".sq-cell");
    expect(sampleCell).not.toBeNull();
    expect(
      within(sampleCell as HTMLElement).getByText("12")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/bet365 is 71\.4% and kalshi is 3\.0%/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText("73.0%")).toBeInTheDocument();
    expect(
      screen.queryByText("Victor Wembanyama (1) (0.5)")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("selection victor-wembanyama-over")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/unpaired/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /Latest measured divergence 1\.6 pp, range 1\.6 pp to 1\.6 pp/i,
      })
    ).toBeInTheDocument();
  });

  it("renders an honest empty state when an instrument has no attached source markets yet", async () => {
    window.history.replaceState(
      {},
      "",
      "/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5"
    );

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/games") {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (url === "/api/v1/games/nba-bos-nyk-2026-04-21") {
        return mockJsonResponse({
          data: {
            coverageSummary: {
              activeSourceCount: 1,
              availableSources: ["nba"],
              missingSources: ["bet365", "kalshi", "polymarket"],
              unmappedSourceMarketCount: 0,
            },
            game: {
              awayParticipant: {
                key: "nyk",
                name: "New York Knicks",
                shortName: "Knicks",
              },
              homeParticipant: {
                key: "bos",
                name: "Boston Celtics",
                shortName: "Celtics",
              },
              id: "nba-bos-nyk-2026-04-21",
              league: "NBA",
              scheduledStart: "2026-04-21T23:00:00.000Z",
              sport: "basketball",
            },
            gameState: { awayScore: 108, homeScore: 112, status: "in-play" },
            marketFamilyCounts: [{ family: "total", count: 1 }],
            outcome: null,
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url === "/api/v1/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5"
      ) {
        return mockJsonResponse({
          data: {
            derivedComparison: {
              comparableState: "unmapped",
              impliedProbabilityGap: null,
              lineMismatch: false,
              sourceCount: 0,
            },
            gameState: { awayScore: 108, homeScore: 112, status: "in-play" },
            instrument: {
              displayLabel: "Game total 221.5",
              family: "total",
              id: "game-total-221_5",
              inPlay: true,
              line: 221.5,
              selection: "over",
            },
            latestQuotesBySource: [],
            latestRawReferences: [],
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5/timeline"
      ) {
        return mockJsonResponse({
          data: {
            annotations: [],
            gameStateSeries: [],
            lineMismatchWindows: [],
            quoteSeriesBySource: {},
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5/delta-series?bucketSeconds=60"
      ) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5/lead-lag?bucketSeconds=60&maxLagBuckets=20"
      ) {
        return mockJsonResponse({
          data: {
            bucketSeconds: 60,
            insufficientData: true,
            pairs: [],
          },
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }
      if (
        url ===
        "/api/v1/games/nba-bos-nyk-2026-04-21/markets/game-total-221_5/sources"
      ) {
        return mockJsonResponse({
          data: [],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Game total 221.5",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No source quotes have been captured for this instrument yet."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Source records" })
    ).toBeDisabled();
  });

  it("renders the operations page from health and source payloads", async () => {
    window.history.replaceState({}, "", "/settings");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Source and readiness status",
      })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("kalshi").length).toBeGreaterThan(0);
      expect(screen.getAllByText("polymarket").length).toBeGreaterThan(0);
      expect(
        screen.getByText(
          "Readiness is currently failing. Inspect the checks below before trusting operator traffic."
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Directional disagreement and probability splits",
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Prediction-market anomaly scoring",
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Restart all capture" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/market feeds\s+bet365/i)).toBeInTheDocument();
    expect(screen.getByText("NBA state available")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Restart all capture" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Restart queued for all sources")
      ).toBeInTheDocument();
      expect(screen.getByText(/capture-restart queued/)).toBeInTheDocument();
    });
  });

  it("renders the history page from persisted capture and research surfaces", async () => {
    window.history.replaceState({}, "", "/history");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Persisted market history",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Largest persisted divergences")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Review date")).toBeInTheDocument();
    expect(await screen.findByText("Peak divergence")).toBeInTheDocument();
    expect(screen.getByText("Recent adapter activity")).toBeInTheDocument();
    expect(screen.getByText("Persisted source coverage")).toBeInTheDocument();
    expect(screen.getByText("Past disagreement snapshot")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Review date"), {
      target: { value: "2026-04-21" },
    });
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input]) =>
            String(input) ===
            "/api/v1/research/signal-mismatches?date=2026-04-21"
        )
      ).toBe(true);
    });
  });

  it("prefills history to tracked player props from the alert monitor link", async () => {
    window.history.replaceState(
      {},
      "",
      "/history?date=2026-04-21&family=player-prop"
    );
    const requestedUrls: string[] = [];
    const baseFetch = createSettingsFetchImplementation({
      divergenceRows: [
        {
          captureRecencyMs: 15000,
          comparableState: "comparable",
          displayLabel: "Jalen Brunson points over 29.5",
          family: "player-prop",
          gameId: "nba-bos-nyk-2026-04-21",
          impliedProbabilityGap: 0.12,
          inPlay: true,
          instrumentId: "brunson-points-over-29_5",
          lineMismatch: false,
          mappingStatus: "auto",
          severity: "medium",
          signalPriority: 120,
        },
      ],
    });
    fetchMock.mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return baseFetch(input);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Persisted market history",
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Family")).toHaveValue("player-prop");
    expect(
      await screen.findByText("1 player prop tracked")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Jalen Brunson points over 29.5")
    ).toBeInTheDocument();
    expect(requestedUrls).toContain(
      "/api/v1/research/signal-mismatches?date=2026-04-21&family=player-prop"
    );
    expect(requestedUrls).toContain(
      "/api/v1/divergence?date=2026-04-21&family=player-prop&sort=signalPriority&limit=500"
    );
  });

  it("shows date-scoped history mismatches before secondary history panels finish", async () => {
    window.history.replaceState({}, "", "/history");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/api/v1/research/signal-mismatches")) {
        return mockJsonResponse({
          data: [
            {
              bet365ImpliedProbability: 0.71,
              captureRecencyMs: 50000,
              comparableState: "comparable",
              directionalDisagreement: true,
              displayLabel: "Victor Wembanyama over 0.5 steals",
              family: "player-prop",
              finalAwayScore: 109,
              finalHomeScore: 114,
              gameLabel: "Spurs at Timberwolves",
              gameId: "nba-0042500234",
              gameStatus: "final",
              impliedProbabilityGap: 0.7,
              instrumentId:
                "nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5",
              kalshiImpliedProbability: 0.01,
              lineMismatch: false,
              mappingStatus: "auto",
              polymarketImpliedProbability: null,
              scheduledStart: "2026-05-10T23:30:00Z",
              severity: "critical",
              signalPriority: 714,
            },
          ],
          meta: { generatedAt: "2026-05-11T15:00:00.000Z" },
        });
      }
      if (
        url.startsWith(
          "/api/v1/games/nba-0042500234/markets/nba-0042500234-player-prop-steals-victor-wembanyama-over-0-5/timeline"
        )
      ) {
        return mockJsonResponse({
          data: {
            annotations: [],
            gameStateSeries: [],
            quoteSeriesBySource: {
              bet365: [],
              kalshi: [],
              nba: [],
              polymarket: [],
            },
          },
          meta: { generatedAt: "2026-05-11T15:00:00.000Z" },
        });
      }
      if (
        url === "/api/v1/admin/capture/runs" ||
        url === "/api/v1/admin/storage/coverage" ||
        url === "/api/v1/research/coverage"
      ) {
        return new Promise<Response>(() => {});
      }
      return mockJsonResponse({ data: [], meta: { generatedAt: "test" } });
    });

    render(<App />);

    await screen.findByText("Largest persisted divergences");
    expect(
      screen.getAllByText("Victor Wembanyama over 0.5 steals").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Loading capture runs...")).toBeInTheDocument();
  });

  it("renders the exports page with dataset downloads even when games are empty", async () => {
    window.history.replaceState({}, "", "/exports");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Data engineering export package",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Quote export builder")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Download full package" })
    ).toHaveAttribute("href", "/api/v1/exports/full-package.sqlite");
    expect(screen.getAllByRole("link", { name: "CSV" }).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getByRole("link", { name: "Download SQLite" })
    ).toHaveAttribute("href", "/api/v1/exports/sqlite");

    fireEvent.change(screen.getByLabelText("Provider"), {
      target: { value: "kalshi" },
    });
    fireEvent.change(screen.getByLabelText("Market family"), {
      target: { value: "player-prop" },
    });

    expect(
      screen.getByRole("link", { name: "Download filtered CSV" })
    ).toHaveAttribute("href", expect.stringContaining("family=player-prop"));
    expect(
      screen.getByRole("link", { name: "Download filtered CSV" })
    ).toHaveAttribute("href", expect.stringContaining("source=kalshi"));
  });

  it("does not trigger g-d navigation while typing in settings inputs", async () => {
    window.history.replaceState({}, "", "/settings");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    const sourceInput = await screen.findByPlaceholderText("nba-0042500173");
    sourceInput.focus();

    fireEvent.keyDown(sourceInput, { key: "g" });
    fireEvent.keyDown(sourceInput, { key: "d" });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/settings");
      expect(
        screen.getByRole("heading", { name: "Source and readiness status" })
      ).toBeInTheDocument();
    });
  });

  it("renders unmapped markets even when no canonical game has been linked yet", async () => {
    window.history.replaceState({}, "", "/settings");

    fetchMock.mockImplementation(
      createSettingsFetchImplementation({
        unmappedMarkets: [
          {
            game: null,
            latestQuote: {
              capturedAt: "2026-04-22T06:05:00.000Z",
              impliedProbability: 0.58,
              lineRaw: null,
            },
            sourceMarket: {
              gameId: "nba-missing-link-2026-04-22",
              id: "sm-bet365-missing",
              mappingStatus: "unmapped",
              rawFamily: "moneyline",
              rawLabel: "Boston Celtics",
              source: "bet365",
              sourceMarketKey: "bet365-missing-link",
            },
          },
        ],
      })
    );

    render(<App />);

    expect(
      await screen.findByText((content) =>
        content.startsWith(
          "No canonical game linked yet (nba-missing-link-2026-04-22) · bet365 · last quote Apr 22, 2026"
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve mapping" })
    ).toBeDisabled();
  });
});
