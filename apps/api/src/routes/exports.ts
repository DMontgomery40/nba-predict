import { createReadStream } from "node:fs";
import { basename } from "node:path";

import {
  buildDatasetExport,
  createSqliteExportSnapshot,
  getExportCatalogPayload,
} from "../services/export-service";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function pickString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function registerExportRoutes(app: FastifyInstance) {
  app.get("/api/v1/exports", async () => getExportCatalogPayload());

  const sendSqliteSnapshot = async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const snapshot = await createSqliteExportSnapshot();
    const stream = createReadStream(snapshot.path);
    stream.once("close", snapshot.cleanup);
    stream.once("error", snapshot.cleanup);

    reply.header("content-type", "application/vnd.sqlite3");
    reply.header(
      "content-disposition",
      `attachment; filename="${basename(snapshot.filename)}"`
    );
    return reply.send(stream);
  };

  app.get("/api/v1/exports/sqlite", sendSqliteSnapshot);
  app.get("/api/v1/exports/full-package.sqlite", sendSqliteSnapshot);

  app.get(
    "/api/v1/exports/:dataset.:format",
    async (
      request: FastifyRequest<{
        Params: { dataset: string; format: string };
        Querystring: Record<string, unknown>;
      }>,
      reply
    ) => {
      const { dataset, format } = request.params;
      if (format !== "csv" && format !== "jsonl") {
        return reply.status(404).send({ error: "Unsupported export format." });
      }

      const exportResult = buildDatasetExport({
        dataset,
        format,
        query: {
          family: pickString(request.query.family),
          from: pickString(request.query.from),
          gameId: pickString(request.query.gameId),
          league: pickString(request.query.league),
          source: pickString(request.query.source),
          sport: pickString(request.query.sport),
          to: pickString(request.query.to),
        },
      });
      if (!exportResult) {
        return reply.status(404).send({ error: "Unknown export dataset." });
      }

      reply.header("content-type", exportResult.contentType);
      reply.header(
        "content-disposition",
        `attachment; filename="${exportResult.filename}"`
      );
      return reply.send(exportResult.body);
    }
  );
}
