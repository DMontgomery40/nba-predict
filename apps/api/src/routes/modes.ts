import { z } from "zod";

import { parseWithSchema } from "../lib/http";
import {
  getModesPayload,
  postDemoStorylinePayload,
} from "../services/console-service";

import type { FastifyInstance } from "fastify";

const demoStorylineBodySchema = z.object({
  storylineId: z.string().min(1),
});

export async function registerModesRoutes(app: FastifyInstance) {
  app.get("/api/v1/modes", async (request) => {
    const query = parseWithSchema(
      z.object({ mode: z.string().optional() }),
      request.query
    );
    return getModesPayload(query.mode, {
      logger: request.log.child({ route: "modes" }),
    });
  });

  app.post("/api/v1/demo/storyline", async (request) => {
    const body = parseWithSchema(demoStorylineBodySchema, request.body);
    return postDemoStorylinePayload(body.storylineId, {
      logger: request.log.child({ route: "demo-storyline-select" }),
    });
  });
}
