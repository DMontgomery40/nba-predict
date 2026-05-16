import {
  marketAnomalyScoreConfigSchema,
  researchDivergenceQuerySchema,
} from "@signal-console/domain";

import { parseWithSchema } from "../lib/http";
import {
  getBoardAnomalyAlertsPayload,
  getBoardAnomalyEventContextPayload,
  getBoardAnomalyIncidentsPayload,
  getBoardAnomalyReplayPayload,
  getClosedGameSummariesPayload,
  getInstrumentDeltaSeriesPayload,
  getInstrumentLeadLagPayload,
  getInstrumentLeadLagSeriesPayload,
  getMarketAnomalyAlertsPayload,
  getMarketAnomalyPlaybackPayload,
  getMarketAnomalyScoreConfigPayload,
  getPlayerPropAlertPlaybackPayload,
  getPlayerPropDisagreementAlertsPayload,
  getResearchCoveragePayload,
  getResearchDivergencePayload,
  getSignalMismatchesPayload,
  getSignalQualityReportPayload,
  updateMarketAnomalyScoreConfigPayload,
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

function parseFamilyParam(value: unknown) {
  if (
    value === "moneyline" ||
    value === "spread" ||
    value === "total" ||
    value === "player-prop" ||
    value === "team-prop" ||
    value === "other"
  ) {
    return value;
  }
  return undefined;
}

function parseMarketSourceParam(value: unknown) {
  if (value === "bet365" || value === "kalshi" || value === "polymarket") {
    return value;
  }
  return undefined;
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

  app.get(
    "/api/v1/research/market-anomalies",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getMarketAnomalyAlertsPayload(
        {
          date: parseDateParam(query.date),
          family: parseFamilyParam(query.family),
          includeHistorical: parseBooleanParam(query.includeHistorical),
          includeUnmapped: parseBooleanParam(query.includeUnmapped),
          limit: parseIntegerParam(query.limit, 25),
          minConfidence: parseNumberParam(query.minConfidence),
          minScore: parseNumberParam(query.minScore),
          profileId: query.profileId,
          requireBet365: parseBooleanParam(query.requireBet365),
          source: parseMarketSourceParam(query.source),
        },
        {
          logger: request.log.child({ route: "research-market-anomalies" }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/board-alerts",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getBoardAnomalyAlertsPayload(
        {
          now: typeof query.now === "string" ? query.now : undefined,
          limit: parseIntegerParam(query.limit, 10),
          contextWindowMinutes: parseIntegerParam(
            query.contextWindowMinutes,
            30
          ),
        },
        {
          logger: request.log.child({ route: "research-board-alerts" }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/board-alerts/incidents",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      const date = parseDateParam(query.date);
      if (!date) {
        return {
          data: [],
          meta: {
            generatedAt: new Date().toISOString(),
            error: "date (YYYY-MM-DD) is required",
          },
        };
      }
      return getBoardAnomalyIncidentsPayload(
        {
          date,
          minGap: parseNumberParam(query.minGap, 0.15),
          limit: parseIntegerParam(query.limit, 10),
        },
        {
          logger: request.log.child({
            route: "research-board-alert-incidents",
          }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/board-alerts/event-context",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      if (typeof query.gameId !== "string" || typeof query.at !== "string") {
        return {
          data: null,
          meta: {
            generatedAt: new Date().toISOString(),
            error: "gameId and at (ISO timestamp) are required",
          },
        };
      }
      return getBoardAnomalyEventContextPayload(
        {
          gameId: query.gameId,
          anchorAt: query.at,
          windowSecondsBefore: parseIntegerParam(
            query.windowSecondsBefore,
            7200
          ),
          windowSecondsAfter: parseIntegerParam(query.windowSecondsAfter, 3600),
        },
        {
          logger: request.log.child({
            route: "research-board-alerts-event-context",
          }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/board-alerts/replay",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      if (
        typeof query.gameId !== "string" ||
        typeof query.windowStart !== "string" ||
        typeof query.windowEnd !== "string"
      ) {
        return {
          data: null,
          meta: {
            error: "gameId, windowStart, and windowEnd are required",
            generatedAt: new Date().toISOString(),
          },
        };
      }
      return getBoardAnomalyReplayPayload(
        {
          gameId: query.gameId,
          windowStart: query.windowStart,
          windowEnd: query.windowEnd,
          stepSeconds: parseIntegerParam(query.stepSeconds, 30),
        },
        {
          logger: request.log.child({ route: "research-board-alerts-replay" }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/market-anomaly-playback",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      const query = request.query ?? {};
      return getMarketAnomalyPlaybackPayload(
        {
          date: parseDateParam(query.date),
          limit: parseIntegerParam(query.limit, 250),
        },
        {
          logger: request.log.child({
            route: "research-market-anomaly-playback",
          }),
        }
      );
    }
  );

  app.get(
    "/api/v1/research/market-anomaly-score-config",
    async (
      request: FastifyRequest<{ Querystring: Record<string, string> }>
    ) => {
      return getMarketAnomalyScoreConfigPayload(
        request.query?.profileId ?? "default",
        {
          logger: request.log.child({
            route: "research-market-anomaly-score-config",
          }),
        }
      );
    }
  );

  app.put(
    "/api/v1/research/market-anomaly-score-config",
    async (
      request: FastifyRequest<{
        Body: unknown;
      }>
    ) => {
      const body = parseWithSchema(
        marketAnomalyScoreConfigSchema.partial({
          updatedAt: true,
          updatedBy: true,
        }),
        request.body
      );
      return updateMarketAnomalyScoreConfigPayload(body, {
        logger: request.log.child({
          route: "research-market-anomaly-score-config-update",
        }),
      });
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
