import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";
import { ApiError, ok } from "../utils.js";

export function lookupRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/lookups/plains", { preHandler: [app.authenticate] }, async (request, reply) => {
      return ok(reply, request, db.data.plains);
    });

    app.get("/lookups/aquifers", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z.object({ plainId: z.string().optional() }).safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const items = q.data.plainId ? db.data.aquifers.filter((a) => a.plainId === q.data.plainId) : db.data.aquifers;
      return ok(reply, request, items);
    });

    app.get("/lookups/scenarios", { preHandler: [app.authenticate] }, async (request, reply) => {
      const items = db.data.scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        ssp: s.ssp,
        horizonFromYear: s.horizonFromYear,
        horizonToYear: s.horizonToYear,
        status: s.status,
        lastRunAt: s.lastRunAt ?? null,
      }));
      return ok(reply, request, items);
    });

    app.get("/lookups/models", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z.object({ status: z.string().optional() }).safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      let items = db.data.models;
      if (q.data.status === "active") items = items.filter((m) => m.status === "active");
      return ok(reply, request, items.map((m) => ({ id: m.id, name: m.name, family: m.family, version: m.version, status: m.status })));
    });

    app.get("/lookups/wells", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          plainId: z.string().optional(),
          aquiferId: z.string().optional(),
          search: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const limit = q.data.limit ?? 50;
      const search = q.data.search?.toLowerCase().trim() ?? "";
      let items = db.data.wells;
      if (q.data.plainId) items = items.filter((w) => w.plainId === q.data.plainId);
      if (q.data.aquiferId) items = items.filter((w) => w.aquiferId === q.data.aquiferId);
      if (search) items = items.filter((w) => w.code.toLowerCase().includes(search) || w.name.toLowerCase().includes(search));
      items = items.slice(0, limit);
      return ok(reply, request, items.map((w) => ({ id: w.id, code: w.code, name: w.name, riskLevel: w.riskLevel, dataQualityScore: w.dataQualityScore })));
    });
  };
}

