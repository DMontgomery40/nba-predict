import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
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

function createSettingsFetchImplementation(options?: {
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
      homeScore?: number | null;
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
  const games = options?.games ?? [];
  const unmappedMarkets = options?.unmappedMarkets ?? [];

  return async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "/api/v1/games") {
      return mockJsonResponse({
        data: games,
        meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
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
    if (url === "/api/v1/research/signal-mismatches") {
      return mockJsonResponse({
        data: [
          {
            bet365ImpliedProbability: 0.61,
            captureRecencyMs: 15000,
            comparableState: "comparable",
            directionalDisagreement: true,
            displayLabel: "Boston moneyline",
            family: "moneyline",
            gameId: "nba-bos-nyk-2026-04-21",
            impliedProbabilityGap: 0.12,
            instrumentId: "bos-moneyline",
            kalshiImpliedProbability: 0.49,
            lineMismatch: false,
            mappingStatus: "auto",
            polymarketImpliedProbability: 0.52,
            severity: "high",
            signalPriority: 91,
          },
        ],
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
  it("renders the tracked games landing page from live game payloads", async () => {
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
          ],
          meta: { generatedAt: "2026-04-22T06:00:00.000Z" },
        });
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Live NBA research slate" })
    ).toBeInTheDocument();
    expect(screen.getByText("Knicks at Celtics")).toBeInTheDocument();
    expect(
      screen.getByText("3 market sources + NBA state")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Market feeds: bet365, kalshi, polymarket")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open game workspace" })
    ).toHaveAttribute("href", "/games/nba-bos-nyk-2026-04-21");
    expect(
      screen.getByRole("link", { name: "Jump to top instrument" })
    ).toHaveAttribute(
      "href",
      "/games/nba-bos-nyk-2026-04-21/markets/bos-moneyline"
    );
  });

  it("offers history and export paths when no games are currently visible", async () => {
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
    expect(screen.getByText("1 market source + NBA state")).toBeInTheDocument();
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
                payloadJson: { source: "bet365" },
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
    expect(
      screen.getByText("Comparative signal is live on this market.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/kalshi is 67\.0% and bet365 is 61\.0%/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("n/a").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
    expect(
      screen
        .getAllByText("manual")
        .every((element) => element.className.includes("badge-warning"))
    ).toBe(true);
    expect(
      screen.getAllByRole("button", { name: "Open raw" }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Show diagnostics" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/latest raw payload #44/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show diagnostics" }));

    expect(await screen.findByText("Research plumbing")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading diagnostics…")
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/latest raw payload #44/i)).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Inspect raw source payloads" })
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
      expect(screen.getByText("kalshi")).toBeInTheDocument();
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
      expect(screen.getByText("market feeds bet365")).toBeInTheDocument();
      expect(screen.getByText("NBA state available")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Restart all capture" })
      ).toBeInTheDocument();
    });

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
        name: "Persisted market and ingest history",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Recent adapter activity")).toBeInTheDocument();
    expect(screen.getByText("Persisted source coverage")).toBeInTheDocument();
    expect(
      screen.getByText("Historical disagreement snapshot")
    ).toBeInTheDocument();
  });

  it("renders the exports page with dataset downloads even when games are empty", async () => {
    window.history.replaceState({}, "", "/exports");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Dataset and timeline exports",
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Download CSV" }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "No canonical games are visible right now. The dataset exports above still work, and history/settings remain available while capture or backfill repopulates game-level views."
      )
    ).toBeInTheDocument();
  });

  it("does not trigger g-d navigation while typing in settings inputs", async () => {
    window.history.replaceState({}, "", "/settings");

    fetchMock.mockImplementation(createSettingsFetchImplementation());

    render(<App />);

    const sourceInput = await screen.findByPlaceholderText("bet365");
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
      await screen.findByText(
        "No canonical game linked yet (nba-missing-link-2026-04-22) · bet365 · last quote 2026-04-22 06:05:00.000"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve mapping" })
    ).toBeDisabled();
  });
});
