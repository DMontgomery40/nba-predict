import { researchDivergenceQuerySchema } from "@signal-console/domain";

import { parseWithSchema } from "../lib/http";
import {
  getResearchCoveragePayload,
  getResearchDivergencePayload,
  getSignalMismatchesPayload,
} from "../services/research-service";

import type { FastifyInstance } from "fastify";

export async function registerResearchRoutes(app: FastifyInstance) {
  app.get("/api/v1/research/signal-mismatches", async (request) => {
    return getSignalMismatchesPayload({
      logger: request.log.child({ route: "research-signal-mismatches" }),
    });
  });

  app.get("/api/v1/research/mismatches", async (request) => {
    return getSignalMismatchesPayload({
      logger: request.log.child({ route: "research-mismatches" }),
    });
  });

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
}
