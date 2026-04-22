import { parseWithSchema } from "../lib/http";
import {
  eventQuerySchema,
  getTimelinePayload,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerTimelineRoutes(app: FastifyInstance) {
  app.get("/api/v1/events/:eventId/timeline", async (request) => {
    const query = parseWithSchema(eventQuerySchema, request.query);
    const params = request.params as { eventId: string };
    return getTimelinePayload(params.eventId, query, {
      logger: request.log.child({ route: "event-timeline" }),
    });
  });
}
