import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase, setReplaySelection } from "@signal-console/shared";

import { buildApiServer } from "../server";

let tempDir = "";

describe("api routes", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "signal-console-api-"));
    process.env.SIGNAL_CONSOLE_DB_PATH = join(tempDir, "signal-console.sqlite");
  });

  afterEach(() => {
    resetDatabase();
    delete process.env.SIGNAL_CONSOLE_DB_PATH;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns overview cards for demo mode", async () => {
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/overview?mode=demo",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeTruthy();
    const payload = response.json();
    expect(payload.data.cards.length).toBeGreaterThan(0);
    expect(payload.data.mode).toBe("demo");

    await app.close();
  });

  it("persists watchlist updates through the API", async () => {
    const app = buildApiServer();

    const saveResponse = await app.inject({
      method: "POST",
      url: "/api/v1/watchlist",
      payload: {
        eventId: "knicks-celtics",
        priority: 94,
        status: "queued",
        note: "Desk priority",
      },
    });
    expect(saveResponse.statusCode).toBe(200);

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/watchlist?mode=demo",
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data[0].eventId).toBe("knicks-celtics");

    await app.close();
  });

  it("returns a typed error envelope for invalid modes", async () => {
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/overview?mode=broken",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "INVALID_MODE",
        message: 'Mode "broken" is not supported.',
        requestId: expect.any(String),
      },
    });

    await app.close();
  });

  it("returns a typed not-found envelope for missing events", async () => {
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/events/missing-event?mode=demo",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: {
        code: "EVENT_NOT_FOUND",
        requestId: expect.any(String),
      },
    });

    await app.close();
  });

  it("reports readiness with real database and mode checks", async () => {
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "database", status: "ok" }),
        expect.objectContaining({ name: "mode-resolution", status: "ok" }),
      ]),
      status: "ok",
      summary: {
        database: {
          status: "ok",
        },
      },
    });

    await app.close();
  });

  it("fails readiness when replay selection is invalid even if replay can fall back", async () => {
    const app = buildApiServer();
    setReplaySelection("missing-storyline", 99);

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      checks: expect.arrayContaining([
        expect.objectContaining({
          name: "replay-selection",
          status: "error",
        }),
      ]),
      status: "error",
    });

    await app.close();
  });
});
