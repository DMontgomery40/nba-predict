import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGames,
  getReadyHealth,
  putMarketAnomalyScoreConfig,
  resetApiRequestLaneForTests,
  resolveApiRequestPath,
} from "./api";

describe("web API client", () => {
  afterEach(() => {
    resetApiRequestLaneForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fails hung requests instead of leaving live views in loading state", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Fetch signal was not configured."));
            return;
          }

          signal.addEventListener(
            "abort",
            () => reject(new Error("The operation was aborted.")),
            { once: true }
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = expect(getGames({ limit: 25 })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      operatorHint:
        "Confirm the API server is running and reachable from the research console.",
      status: 0,
    });

    await vi.advanceTimersByTimeAsync(10_000);

    await response;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/games?limit=25",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("prefers a configured API target before falling back to the local dev API port", () => {
    expect(
      resolveApiRequestPath("/api/v1/games", {
        apiBaseUrl: "http://127.0.0.1:8787",
        isDev: true,
        mode: "development",
      })
    ).toBe("http://127.0.0.1:8787/api/v1/games");

    expect(
      resolveApiRequestPath("/api/v1/games", {
        apiBaseUrl: "",
        isDev: true,
        mode: "development",
      })
    ).toBe("http://127.0.0.1:8788/api/v1/games");

    expect(
      resolveApiRequestPath("/api/v1/games", {
        apiBaseUrl: "",
        isDev: true,
        mode: "test",
      })
    ).toBe("/api/v1/games");
  });

  it("omits the JSON content-type header on bodiless GET requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      json: async () => ({
        data: [],
        meta: { generatedAt: "2026-05-22T00:00:00.000Z" },
      }),
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await getGames({ limit: 25 });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).has("Content-Type")).toBe(false);
  });

  it("still sends JSON content-type on mutation requests with a body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      json: async () => ({
        data: {
          contextWindowMinutes: 10,
          families: ["moneyline"],
          minConfidence: 0.5,
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
        },
        meta: { generatedAt: "2026-05-22T00:00:00.000Z" },
      }),
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await putMarketAnomalyScoreConfig({
      contextWindowMinutes: 10,
      families: ["moneyline"],
      minConfidence: 0.5,
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
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe(
      "application/json"
    );
  });

  it("queues excess API requests until an in-flight lane frees up", async () => {
    const resolvers: Array<{
      reject: (error: unknown) => void;
      resolve: (value: Response) => void;
    }> = [];
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((resolve, reject) => {
        resolvers.push({ reject, resolve });
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("The operation was aborted.")),
          { once: true }
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const requests = Array.from({ length: 5 }, (_, index) =>
      getGames({ limit: index + 1 })
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(4);

    resolvers[0]?.resolve({
      json: async () => ({
        data: [],
        meta: { generatedAt: "2026-05-22T00:00:00.000Z" },
      }),
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
    } as Response);

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(5);

    for (const resolver of resolvers.slice(1)) {
      resolver.resolve({
        json: async () => ({
          data: [],
          meta: { generatedAt: "2026-05-22T00:00:00.000Z" },
        }),
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
      } as Response);
    }

    await Promise.allSettled(requests);
  });

  it("times out queued requests at their declared deadline instead of waiting behind long-running work", async () => {
    vi.useFakeTimers();

    const resolvers: Array<{
      reject: (error: unknown) => void;
      resolve: (value: Response) => void;
    }> = [];
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((resolve, reject) => {
        resolvers.push({ reject, resolve });
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("The operation was aborted.")),
          { once: true }
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const blockingWrites = Array.from({ length: 4 }, () =>
      putMarketAnomalyScoreConfig({
        contextWindowMinutes: 10,
        families: ["moneyline"],
        minConfidence: 0.5,
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
      })
    );
    const blockingWriteSettles = Promise.allSettled(blockingWrites);
    const queuedRead = expect(getReadyHealth()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(5_000);

    await queuedRead;
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(5_000);
    await blockingWriteSettles;
  });
});
