import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import { createJob, simulateJob } from "../jobs.js";
import { requireMinRole } from "../rbac.js";
import type { ScenarioMethod, ScenarioSsp } from "../types.js";
import { ApiError, clamp, isoNow, ok, parsePageParams, paginate, safeJsonSnippet } from "../utils.js";

export function scenarioRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/scenarios", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const q = z
        .object({
          search: z.string().optional(),
          status: z.enum(["draft", "running", "ready", "failed"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const search = q.data.search?.toLowerCase().trim() ?? "";

      let items = db.data.scenarios.filter((s) => s.orgId === request.user.orgId);
      if (q.data.status) items = items.filter((s) => s.status === q.data.status);
      if (search) items = items.filter((s) => s.name.toLowerCase().includes(search));

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "lastRunAt") return ((a.lastRunAt ?? "") < (b.lastRunAt ?? "") ? -1 : 1) * sortDir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.post("/scenarios", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const body = z
        .object({
          name: z.string().min(2),
          ssp: z.enum(["SSP1-2.6", "SSP2-4.5", "SSP3-7.0", "SSP5-8.5"]) satisfies z.ZodType<ScenarioSsp>,
          horizonFromYear: z.coerce.number().int().min(2020).max(2100),
          horizonToYear: z.coerce.number().int().min(2020).max(2150),
          method: z.enum(["LARS-WG", "BiasCorrection"]) satisfies z.ZodType<ScenarioMethod>,
          plainIds: z.array(z.string()).min(1),
          runNow: z.boolean().optional().default(true),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      if (body.data.horizonToYear < body.data.horizonFromYear) {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid horizon range", statusCode: 400 });
      }

      const id = `sc_${nanoid(10)}`;
      const now = isoNow();
      db.data.scenarios.unshift({
        id,
        orgId: request.user.orgId,
        name: body.data.name,
        ssp: body.data.ssp,
        horizonFromYear: body.data.horizonFromYear,
        horizonToYear: body.data.horizonToYear,
        method: body.data.method,
        plainIds: body.data.plainIds,
        status: body.data.runNow ? "running" : "draft",
        createdAt: now,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "scenario.create",
        entity: "scenario",
        entityId: id,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      await db.persist();

      if (!body.data.runNow) return ok(reply, request, { scenarioId: id, job: null });

      const job = await createJob(db, {
        orgId: request.user.orgId,
        type: "scenario_run",
        steps: ["data_prep", "downscale", "aggregate", "publish"],
        result: { scenarioId: id },
      });

      simulateJob(db, job.id, {
        onSuccess: async () => {
          const sc = db.data.scenarios.find((s) => s.id === id);
          if (!sc) return;
          sc.status = "ready";
          sc.lastRunAt = isoNow();

          // Generate (or replace) scenario results for selected plains.
          db.data.scenarioResults = db.data.scenarioResults.filter((r) => r.scenarioId !== id);
          for (const plainId of sc.plainIds) {
            const annual = [];
            for (let y = sc.horizonFromYear; y <= Math.min(sc.horizonToYear, sc.horizonFromYear + 24); y++) {
              const tBase = 18.1 + (sc.ssp === "SSP5-8.5" ? 0.35 : 0.18) * (y - sc.horizonFromYear);
              const pBase = 410 - (sc.ssp === "SSP5-8.5" ? 3.3 : 1.2) * (y - sc.horizonFromYear);
              annual.push({
                year: y,
                tmean: Number((tBase + (Math.random() - 0.5) * 0.35).toFixed(2)),
                precip: Number((pBase + (Math.random() - 0.5) * 14).toFixed(1)),
              });
            }
            const monthlyDist = [];
            for (let m = 1; m <= 12; m++) {
              const t = 16 + Math.sin(((m - 1) / 12) * Math.PI * 2) * 10 + (sc.ssp === "SSP5-8.5" ? 1.4 : 0.6);
              const p = clamp((40 + Math.cos(((m - 1) / 12) * Math.PI * 2) * 18) * (sc.ssp === "SSP5-8.5" ? 0.8 : 0.92), 0, 140);
              monthlyDist.push({ month: m, tmean: Number(t.toFixed(1)), precip: Number(p.toFixed(1)) });
            }
            db.data.scenarioResults.unshift({
              id: `scr_${id}_${plainId}`,
              scenarioId: id,
              plainId,
              annual,
              monthlyDist,
              extremes: { max1DayPrecip: Number((60 + Math.random() * 30).toFixed(1)), heatDays: Math.round(18 + Math.random() * 28) },
            });
          }
          await db.persist();
        },
      });

      return ok(reply, request, { scenarioId: id, job });
    });

    app.get("/scenarios/:id/results", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const q = z.object({ plainId: z.string().optional() }).safeParse(request.query);
      if (!params.success || !q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const sc = db.data.scenarios.find((s) => s.id === params.data.id && s.orgId === request.user.orgId);
      if (!sc) throw new ApiError({ code: "NOT_FOUND", message: "Scenario not found", statusCode: 404 });

      const plainId = q.data.plainId ?? sc.plainIds[0];
      const res = db.data.scenarioResults.find((r) => r.scenarioId === sc.id && r.plainId === plainId);
      if (!res) throw new ApiError({ code: "NOT_FOUND", message: "Scenario results not found", statusCode: 404 });

      return ok(reply, request, {
        scenarioId: sc.id,
        plainId,
        annual: res.annual,
        monthlyDist: res.monthlyDist,
        extremes: res.extremes,
      });
    });
  };
}

