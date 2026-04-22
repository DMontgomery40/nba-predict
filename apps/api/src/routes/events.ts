import { parseWithSchema } from "../lib/http";
import { eventQuerySchema, getEventPayload } from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerEventRoutes(app: FastifyInstance) {
  app.get("/api/v1/events/:eventId", async (request) => {
    const query = parseWithSchema(eventQuerySchema, request.query);
    const params = request.params as { eventId: string };
    return getEventPayload(params.eventId, query, {
      logger: request.log.child({ route: "event-detail" }),
    });
  });
}
