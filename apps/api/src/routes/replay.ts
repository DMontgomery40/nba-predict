import { parseWithSchema } from "../lib/http";
import {
  postReplaySelectionPayload,
  replaySelectBodySchema,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

export async function registerReplayRoutes(app: FastifyInstance) {
  app.post("/api/v1/replay/select", async (request) => {
    const body = parseWithSchema(replaySelectBodySchema, request.body);
    return postReplaySelectionPayload(body, {
      logger: request.log.child({ route: "replay-select" }),
    });
  });
}
