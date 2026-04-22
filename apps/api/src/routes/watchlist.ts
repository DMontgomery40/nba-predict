import { parseWithSchema } from "../lib/http";
import {
  deleteWatchlistPayload,
  getWatchlistPayload,
  upsertWatchlistPayload,
  watchlistBodySchema,
  watchlistQuerySchema,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerWatchlistRoutes(app: FastifyInstance) {
  app.get("/api/v1/watchlist", async (request) => {
    const query = parseWithSchema(watchlistQuerySchema, request.query);
    return getWatchlistPayload(query, {
      logger: request.log.child({ route: "watchlist-list" }),
    });
  });

  app.post("/api/v1/watchlist", async (request) => {
    const body = parseWithSchema(watchlistBodySchema, request.body);
    return upsertWatchlistPayload(body, {
      logger: request.log.child({ route: "watchlist-upsert" }),
    });
  });

  app.delete("/api/v1/watchlist/:eventId", async (request) => {
    const params = request.params as { eventId: string };
    return deleteWatchlistPayload(params.eventId, {
      logger: request.log.child({ route: "watchlist-delete" }),
    });
  });
}
