import { parseWithSchema } from "../lib/http";
import {
  divergenceQuerySchema,
  getDivergencePayload,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerDivergenceRoutes(app: FastifyInstance) {
  app.get("/api/v1/divergence", async (request) => {
    const query = parseWithSchema(divergenceQuerySchema, request.query);
    return getDivergencePayload(query, {
      logger: request.log.child({ route: "divergence" }),
    });
  });
}
