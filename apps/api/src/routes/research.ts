import { researchDivergenceQuerySchema } from "@signal-console/domain";

import { parseWithSchema } from "../lib/http";
import {
  getClosedGameSummariesPayload,
  getInstrumentDeltaSeriesPayload,
  getInstrumentLeadLagPayload,
  getInstrumentLeadLagSeriesPayload,
  getPlayerPropAlertPlaybackPayload,
  getPlayerPropDisagreementAlertsPayload,
  getResearchCoveragePayload,
  getResearchDivergencePayload,
  getSignalMismatchesPayload,
  getSignalQualityReportPayload,
} from "../services/research-service";

import type { FastifyInstance, FastifyRequest } from "fastify";

type ClosingCutoff = "live-final" | "pregame";

function parseClosingCutoff(value: unknown): ClosingCutoff | undefined {
  if (value === "live-final" || value === "pregame") return value;
  return undefined;
}

function parseIntegerParam(
  value: unknown,
  defaultValue?: number
): number | undefined {
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

function parseNumberParam(
  value: unknown,
  defaultValue?: number
): number | undefined {
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

function parseBooleanParam(value: unknown, defaultValue?: boolean) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return defaultValue;
}

function parseDateParam(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export async function registerResearchRoutes(app: FastifyInstance) {
  app.get("/api/v1/research/signal-mismatches", async (request) => {
    const query = parseWithSchema(researchDivergenceQuerySchema, request.query);
    return getSignalMismatchesPayload(query, {
      logger: request.log.child({ route: "research-signal-mismatches" }),
    });
  });

  app.get("/api/v1/research/mismatches", async (request) => {
    const query = parseWithSchema(researchDivergenceQuerySchema, request.query);
    return getSignalMismatchesPayload(query, {
      logger: request.log.child({ route: "research-mismatches" }),
    });
  });

  app.get(
    "/api/v1/research/player-prop-alerts",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getPlayerPropDisagreementAlertsPayload(
        {
          includeStale: parseBooleanParam(query.includeStale),
          limit: parseIntegerParam(query.limit, 25),
          maxQuoteTimeGapMinutes: parseNumberParam(
            query.maxQuoteTimeGapMinutes,
            10
          ),
          maxQuoteAgeMinutes: parseNumberParam(query.maxQuoteAgeMinutes, 10),
          minDelta: parseNumberParam(query.minDelta, 0.15),
        },
        {
          logger: request.log.child({
            route: "research-player-prop-alerts",
          }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/player-prop-alert-playback",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getPlayerPropAlertPlaybackPayload(
        {
          date: parseDateParam(query.date),
          limit: parseIntegerParam(query.limit, 250),
        },
        {
          logger: request.log.child({
            route: "research-player-prop-alert-playback",
          }),
        }
      );
    }
  );

  app.get("/api/v1/research/coverage", async (request) => {
    return getResearchCoveragePayload({
      logger: request.log.child({ route: "research-coverage" }),
    });
  });

  app.get("/api/v1/research/divergence", async (request) => {
    const query = parseWithSchema(researchDivergenceQuerySchema, request.query);
    return getResearchDivergencePayload(query, {
      logger: request.log.child({ route: "research-divergence" }),
    });
  });

  app.get(
    "/api/v1/research/signal-quality",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getSignalQualityReportPayload(
        {
          closingCutoff: parseClosingCutoff(query.closingCutoff),
          league: query.league,
          since: query.since,
          until: query.until,
        },
        { logger: request.log.child({ route: "research-signal-quality" }) }
      );
    }
  );

  app.get(
    "/api/v1/research/closed-games",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getClosedGameSummariesPayload(
        {
          closingCutoff: parseClosingCutoff(query.closingCutoff),
          league: query.league,
          limit: parseIntegerParam(query.limit, 100),
          since: query.since,
          until: query.until,
        },
        { logger: request.log.child({ route: "research-closed-games" }) }
      );
    }
  );

  app.get<{
    Params: { gameId: string; instrumentId: string };
    Querystring: Record<string, string>;
  }>(
    "/api/v1/games/:gameId/markets/:instrumentId/delta-series",
    async (request) => {
      const { gameId, instrumentId } = request.params;
      return getInstrumentDeltaSeriesPayload(
        gameId,
        instrumentId,
        {
          bucketSeconds: parseIntegerParam(request.query?.bucketSeconds, 60),
        },
        { logger: request.log.child({ route: "instrument-delta-series" }) }
      );
    }
  );

  app.get<{
    Params: { gameId: string; instrumentId: string };
    Querystring: Record<string, string>;
  }>(
    "/api/v1/games/:gameId/markets/:instrumentId/lead-lag",
    async (request) => {
      const { gameId, instrumentId } = request.params;
      return getInstrumentLeadLagPayload(
        gameId,
        instrumentId,
        {
          bucketSeconds: parseIntegerParam(request.query?.bucketSeconds, 60),
          maxLagBuckets: parseIntegerParam(request.query?.maxLagBuckets, 20),
        },
        { logger: request.log.child({ route: "instrument-lead-lag" }) }
      );
    }
  );

  app.get<{
    Params: { gameId: string; instrumentId: string };
    Querystring: Record<string, string>;
  }>(
    "/api/v1/games/:gameId/markets/:instrumentId/lead-lag-series",
    async (request) => {
      const { gameId, instrumentId } = request.params;
      return getInstrumentLeadLagSeriesPayload(
        gameId,
        instrumentId,
        {
          bucketSeconds: parseIntegerParam(request.query?.bucketSeconds, 60),
          maxLagBuckets: parseIntegerParam(request.query?.maxLagBuckets, 20),
          windowBuckets: parseIntegerParam(request.query?.windowBuckets, 10),
        },
        { logger: request.log.child({ route: "instrument-lead-lag-series" }) }
      );
    }
  );
}
