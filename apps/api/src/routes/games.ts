import {
  gameMarketsQuerySchema,
  gamesQuerySchema,
  instrumentTimelineQuerySchema,
} from "@signal-console/domain";

import { parseWithSchema } from "../lib/http";
import {
  getGameMarketsPayload,
  getGamePayload,
  getGamesPayload,
  getInstrumentPayload,
  getInstrumentRawPayload,
  getInstrumentSourcesPayload,
  getInstrumentTimelineCsvExport,
  getInstrumentTimelinePayload,
} from "../services/research-service";

import type { FastifyInstance } from "fastify";

export async function registerGamesRoutes(app: FastifyInstance) {
  app.get("/api/v1/games", async (request) => {
    const query = parseWithSchema(gamesQuerySchema, request.query);
    return getGamesPayload(query, {
      logger: request.log.child({ route: "games-list" }),
    });
  });

  app.get("/api/v1/games/:gameId", async (request) => {
    const params = request.params as { gameId: string };
    return getGamePayload(params.gameId, {
      logger: request.log.child({ route: "game-detail" }),
    });
  });

  app.get("/api/v1/games/:gameId/markets", async (request) => {
    const query = parseWithSchema(gameMarketsQuerySchema, request.query);
    const params = request.params as { gameId: string };
    return getGameMarketsPayload(params.gameId, query, {
      logger: request.log.child({ route: "game-markets" }),
    });
  });

  app.get("/api/v1/games/:gameId/markets/:instrumentId", async (request) => {
    const params = request.params as { gameId: string; instrumentId: string };
    return getInstrumentPayload(params.gameId, params.instrumentId, {
      logger: request.log.child({ route: "instrument-detail" }),
    });
  });

  app.get(
    "/api/v1/games/:gameId/markets/:instrumentId/timeline",
    async (request) => {
      const params = request.params as { gameId: string; instrumentId: string };
      const rawQuery = request.query as Record<string, unknown>;
      const normalizedQuery = {
        ...rawQuery,
        source:
          typeof rawQuery.source === "string"
            ? [rawQuery.source]
            : rawQuery.source,
      };
      const query = parseWithSchema(
        instrumentTimelineQuerySchema,
        normalizedQuery
      );
      return getInstrumentTimelinePayload(
        params.gameId,
        params.instrumentId,
        query,
        {
          logger: request.log.child({ route: "instrument-timeline" }),
        }
      );
    }
  );

  app.get(
    "/api/v1/games/:gameId/markets/:instrumentId/sources",
    async (request) => {
      const params = request.params as { gameId: string; instrumentId: string };
      return getInstrumentSourcesPayload(params.gameId, params.instrumentId, {
        logger: request.log.child({ route: "instrument-sources" }),
      });
    }
  );

  app.get(
    "/api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId",
    async (request) => {
      const params = request.params as {
        gameId: string;
        instrumentId: string;
        sourceId: string;
      };
      return getInstrumentRawPayload(
        params.gameId,
        params.instrumentId,
        params.sourceId,
        {
          logger: request.log.child({ route: "instrument-raw-source" }),
        }
      );
    }
  );

  app.get(
    "/api/v1/games/:gameId/markets/:instrumentId/export.csv",
    async (request, reply) => {
      const params = request.params as {
        gameId: string;
        instrumentId: string;
      };
      const exportResult = getInstrumentTimelineCsvExport(
        params.gameId,
        params.instrumentId,
        {
          logger: request.log.child({ route: "instrument-export-csv" }),
        }
      );

      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header(
        "content-disposition",
        `attachment; filename="${exportResult.filename}"`
      );

      return exportResult.body;
    }
  );
}
