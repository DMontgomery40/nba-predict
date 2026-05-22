import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import Fastify from "fastify";

import {
  createAppLogger,
  defaultApiPort,
  loadRuntimeEnv,
  serializeErrorForLog,
} from "@signal-console/shared";

import { normalizeApiError } from "./lib/http";
import { registerAdminRoutes } from "./routes/admin";
import { registerDivergenceRoutes } from "./routes/divergence";
import { registerExportRoutes } from "./routes/exports";
import { registerGamesRoutes } from "./routes/games";
import { registerResearchRoutes } from "./routes/research";
import {
  buildLivenessPayload,
  buildBoundedReadinessPayload,
} from "./services/health-service";

export function buildApiServer() {
  loadRuntimeEnv();
  const logger = createAppLogger({ component: "api" });

  const app = Fastify({
    genReqId(request) {
      const incomingRequestId = request.headers["x-request-id"];
      if (Array.isArray(incomingRequestId)) {
        return incomingRequestId[0] ?? randomUUID();
      }

      return typeof incomingRequestId === "string" &&
        incomingRequestId.length > 0
        ? incomingRequestId
        : randomUUID();
    },
    loggerInstance: logger,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
  });

  app.register(cors, {
    exposedHeaders: ["x-request-id"],
    origin: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    request.log.debug(
      { method: request.method, url: request.url },
      "Handling request."
    );
  });

  app.setErrorHandler((error, request, reply) => {
    const { appError, body } = normalizeApiError(error, request.id);

    request.log.error(
      { error: serializeErrorForLog(appError) },
      "Request failed."
    );

    reply.status(appError.statusCode).send(body);
  });

  app.get("/health/live", async () => buildLivenessPayload());

  app.get("/health/ready", async (request, reply) => {
    const payload = await buildBoundedReadinessPayload({
      logger: request.log.child({ route: "health-ready" }),
    });

    reply.status(payload.status === "ok" ? 200 : 503).send(payload);
  });

  app.get("/health", async (request, reply) => {
    const live = buildLivenessPayload();
    const ready = await buildBoundedReadinessPayload({
      logger: request.log.child({ route: "health" }),
    });

    reply.status(ready.status === "ok" ? 200 : 503).send({
      ...live,
      endpoints: {
        live: "/health/live",
        ready: "/health/ready",
      },
      ready: {
        failingChecks: ready.checks
          .filter((check) => check.status !== "ok")
          .map((check) => check.name),
        status: ready.status,
      },
      status: ready.status,
    });
  });

  app.register(registerDivergenceRoutes);
  app.register(registerExportRoutes);
  app.register(registerGamesRoutes);
  app.register(registerResearchRoutes);
  app.register(registerAdminRoutes);

  return app;
}

async function start() {
  loadRuntimeEnv();
  const app = buildApiServer();
  const port = Number(process.env.PORT ?? defaultApiPort);
  await app.listen({ host: "0.0.0.0", port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    const logger = createAppLogger({ component: "api-bootstrap" });
    logger.fatal(
      { error: serializeErrorForLog(error) },
      "API failed to start."
    );
    process.exit(1);
  });
}
