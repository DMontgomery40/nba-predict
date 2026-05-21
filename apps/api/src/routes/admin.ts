import {
  backfillGamesBodySchema,
  backfillMarketsBodySchema,
  captureRestartBodySchema,
  mappingResolveBodySchema,
} from "@signal-console/domain";

import { parseWithSchema } from "../lib/http";
import {
  getAdminCaptureRunsPayload,
  getAdminRuntimeConfigPayload,
  getAdminSourcesPayload,
  getAdminUnmappedMarketsPayload,
  getStorageCoveragePayload,
  postBackfillGamesPayload,
  postBackfillMarketsPayload,
  postCaptureRestartPayload,
  postBoardVolatilityBaselineRebuildPayload,
  postMappingsResolvePayload,
  postTimelineMaterializationRebuildPayload,
} from "../services/research-service";

import type { FastifyInstance } from "fastify";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/api/v1/admin/sources", async (request) => {
    return getAdminSourcesPayload({
      logger: request.log.child({ route: "admin-sources" }),
    });
  });

  app.get("/api/v1/admin/capture/runs", async (request) => {
    return getAdminCaptureRunsPayload({
      logger: request.log.child({ route: "admin-capture-runs" }),
    });
  });

  app.get("/api/v1/admin/runtime-config", async (request) => {
    return getAdminRuntimeConfigPayload({
      logger: request.log.child({ route: "admin-runtime-config" }),
    });
  });

  app.post("/api/v1/admin/capture/restart", async (request, reply) => {
    const body = parseWithSchema(captureRestartBodySchema, request.body);
    reply.code(202);
    return postCaptureRestartPayload(body, {
      logger: request.log.child({ route: "admin-capture-restart" }),
    });
  });

  app.post("/api/v1/admin/backfill/games", async (request, reply) => {
    const body = parseWithSchema(backfillGamesBodySchema, request.body);
    reply.code(202);
    return postBackfillGamesPayload(body, {
      logger: request.log.child({ route: "admin-backfill-games" }),
    });
  });

  app.post("/api/v1/admin/backfill/markets", async (request, reply) => {
    const body = parseWithSchema(backfillMarketsBodySchema, request.body);
    reply.code(202);
    return postBackfillMarketsPayload(body, {
      logger: request.log.child({ route: "admin-backfill-markets" }),
    });
  });

  app.get("/api/v1/admin/unmapped-markets", async (request) => {
    return getAdminUnmappedMarketsPayload({
      logger: request.log.child({ route: "admin-unmapped-markets" }),
    });
  });

  app.post("/api/v1/admin/mappings/resolve", async (request) => {
    const body = parseWithSchema(mappingResolveBodySchema, request.body);
    return postMappingsResolvePayload(body, {
      logger: request.log.child({ route: "admin-mappings-resolve" }),
    });
  });

  app.post(
    "/api/v1/admin/board-volatility-baselines/rebuild",
    async (request, reply) => {
      reply.code(202);
      return postBoardVolatilityBaselineRebuildPayload({
        logger: request.log.child({
          route: "admin-board-volatility-baselines-rebuild",
        }),
      });
    }
  );

  app.post(
    "/api/v1/admin/timeline-materializations/rebuild",
    async (request, reply) => {
      reply.code(202);
      return postTimelineMaterializationRebuildPayload({
        logger: request.log.child({
          route: "admin-timeline-materializations-rebuild",
        }),
      });
    }
  );

  app.get("/api/v1/admin/storage/coverage", async (request) => {
    return getStorageCoveragePayload({
      logger: request.log.child({ route: "admin-storage-coverage" }),
    });
  });
}
