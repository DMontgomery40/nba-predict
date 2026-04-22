import { researchDivergenceQuerySchema } from "@signal-console/domain";

import { parseWithSchema } from "../lib/http";
import { getResearchDivergencePayload } from "../services/research-service";

import type { FastifyInstance } from "fastify";

export async function registerDivergenceRoutes(app: FastifyInstance) {
  app.get("/api/v1/divergence", async (request) => {
    const query = parseWithSchema(researchDivergenceQuerySchema, request.query);
    return getResearchDivergencePayload(query, {
      logger: request.log.child({ route: "divergence" }),
    });
  });
}
