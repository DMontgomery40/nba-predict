import { parseWithSchema } from "../lib/http";
import {
  eventQuerySchema,
  getDiagnosticsPayload,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerDiagnosticsRoutes(app: FastifyInstance) {
  app.get("/api/v1/diagnostics", async (request) => {
    const query = parseWithSchema(eventQuerySchema, request.query);
    return getDiagnosticsPayload(query.mode, {
      logger: request.log.child({ route: "diagnostics" }),
    });
  });
}
