import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import { createJob, simulateJob } from "../jobs.js";
import { requireMinRole } from "../rbac.js";
import type { ModelFamily } from "../types.js";
import { ApiError, clamp, isoNow, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";

export function modelRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/models", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const q = z
        .object({
          search: z.string().optional(),
          status: z.enum(["draft", "active", "archived"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const search = q.data.search?.toLowerCase().trim() ?? "";

      let items = db.data.models.filter((m) => m.orgId === request.user.orgId);
      if (q.data.status) items = items.filter((m) => m.status === q.data.status);
      if (search) items = items.filter((m) => m.name.toLowerCase().includes(search));

      const [sortField, sortDirRaw] = (sort ?? "trainedAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "trainedAt") return ((a.trainedAt ?? "") < (b.trainedAt ?? "") ? -1 : 1) * sortDir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.post("/models/train", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const body = z
        .object({
          datasetIds: z.array(z.string()).min(1),
          target: z.string().default("gwLevel"),
          family: z.enum(["RF", "XGB", "LSTM"]) satisfies z.ZodType<ModelFamily>,
          includePrecipTemp: z.boolean().optional().default(true),
          includeLagFeatures: z.boolean().optional().default(true),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const modelId = `m_${nanoid(10)}`;
      const now = isoNow();
      const name = `${body.data.family}_demo_${modelId.slice(-4)}`;
      db.data.models.unshift({
        id: modelId,
        orgId: request.user.orgId,
        name,
        family: body.data.family,
        version: "0.1.0",
        status: "draft",
        createdAt: now,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "model.train.requested",
        entity: "model",
        entityId: modelId,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      await db.persist();

      const job = await createJob(db, {
        orgId: request.user.orgId,
        type: "model_train",
        steps: ["data_prep", "train", "validation", "package_artifacts"],
        result: { modelId },
      });

      simulateJob(db, job.id, {
        onSuccess: async () => {
          const model = db.data.models.find((m) => m.id === modelId);
          if (!model) return;
          model.trainedAt = isoNow();
          model.metricsBadge = `RMSE ${(1.6 + Math.random() * 1.2).toFixed(2)}`;

          const rmse = clamp(1.6 + Math.random() * 1.6, 0.7, 5);
          const mae = clamp(1.0 + Math.random() * 1.3, 0.4, 4);
          const r2 = clamp(0.72 + Math.random() * 0.22, 0, 0.99);
          const nse = clamp(0.55 + Math.random() * 0.3, -1, 0.95);

          db.data.modelMetrics = db.data.modelMetrics.filter((mm) => mm.modelId !== modelId);
          db.data.modelMetrics.unshift({
            id: `mm_${nanoid(10)}`,
            modelId,
            metrics: { rmse: Number(rmse.toFixed(2)), mae: Number(mae.toFixed(2)), r2: Number(r2.toFixed(2)), nse: Number(nse.toFixed(2)) },
            residuals: Array.from({ length: 160 }).map(() => {
              const actual = 1100 + (Math.random() - 0.5) * 25;
              const res = (Math.random() - 0.5) * 3.6;
              return { actual: Number(actual.toFixed(2)), pred: Number((actual - res).toFixed(2)), res: Number(res.toFixed(2)) };
            }),
            featureImportance:
              body.data.family === "LSTM"
                ? [
                    { feature: "gwLevel_lag_1", importance: 0.24 },
                    { feature: "precip_lag_2", importance: 0.14 },
                    { feature: "tmean", importance: 0.1 },
                  ]
                : [
                    { feature: "gwLevel_lag_1", importance: 0.22 },
                    { feature: "precip_lag_2", importance: 0.18 },
                    { feature: "tmean", importance: 0.12 },
                    { feature: "seasonality", importance: 0.08 },
                  ],
          });
          await db.persist();
        },
      });

      return ok(reply, request, { job, modelId });
    });

    app.get("/models/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const m = db.data.models.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!m) throw new ApiError({ code: "NOT_FOUND", message: "Model not found", statusCode: 404 });
      return ok(reply, request, m);
    });

    app.get("/models/:id/metrics", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const m = db.data.models.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!m) throw new ApiError({ code: "NOT_FOUND", message: "Model not found", statusCode: 404 });
      const mm = db.data.modelMetrics.find((x) => x.modelId === m.id);
      if (!mm) throw new ApiError({ code: "NOT_FOUND", message: "Metrics not found", statusCode: 404 });
      return ok(reply, request, { modelId: m.id, metrics: mm.metrics, residuals: mm.residuals, featureImportance: mm.featureImportance });
    });

    app.post("/models/:id/activate", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const m = db.data.models.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!m) throw new ApiError({ code: "NOT_FOUND", message: "Model not found", statusCode: 404 });

      for (const other of db.data.models.filter((x) => x.orgId === request.user.orgId)) {
        if (other.id === m.id) continue;
        if (other.status === "active") other.status = "archived";
      }
      m.status = "active";
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.post("/models/:id/rollback", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z.object({ toModelId: z.string() }).safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const current = db.data.models.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      const target = db.data.models.find((x) => x.id === body.data.toModelId && x.orgId === request.user.orgId);
      if (!current || !target) throw new ApiError({ code: "NOT_FOUND", message: "Model not found", statusCode: 404 });

      for (const other of db.data.models.filter((x) => x.orgId === request.user.orgId)) {
        if (other.status === "active") other.status = "archived";
      }
      target.status = "active";
      await db.persist();
      return ok(reply, request, { success: true, activeModelId: target.id });
    });
  };
}

