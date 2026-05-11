import { afterEach, describe, expect, it, vi } from "vitest";

import { getGames } from "./api";

describe("web API client", () => {
  afterEach(() => {
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
});
