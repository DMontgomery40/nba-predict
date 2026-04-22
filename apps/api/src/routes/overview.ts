import { parseWithSchema } from "../lib/http";
import {
  getOverviewPayload,
  overviewQuerySchema,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerOverviewRoutes(app: FastifyInstance) {
  app.get("/api/v1/overview", async (request) => {
    const query = parseWithSchema(overviewQuerySchema, request.query);
    return getOverviewPayload(query, {
      logger: request.log.child({ route: "overview" }),
    });
  });
}
