import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import { createJob, simulateJob } from "../jobs.js";
import { requireMinRole } from "../rbac.js";
import type { Forecast, ForecastSeriesPoint, ForecastWellResult, RiskLevel } from "../types.js";
import { ApiError, clamp, isoNow, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";

function addMonths(dateIso: string, months: number) {
  const d = new Date(dateIso);
  d.setUTCMonth(d.getUTCMonth() + months, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score < 0.25) return "low";
  if (score < 0.5) return "medium";
  if (score < 0.75) return "high";
  return "critical";
}

export function forecastRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/forecasts", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      let items = db.data.forecasts.filter((f) => f.orgId === request.user.orgId);

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
        return 0;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.post("/forecasts/run", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const body = z
        .object({
          scenarioId: z.string().nullable().optional(),
          modelId: z.string(),
          wellIds: z.array(z.string()).min(1),
          horizonMonths: z.coerce.number().int().min(3).max(120),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const model = db.data.models.find((m) => m.id === body.data.modelId);
      if (!model) throw new ApiError({ code: "NOT_FOUND", message: "Model not found", statusCode: 404 });

      const wells = db.data.wells.filter((w) => body.data.wellIds.includes(w.id));
      if (!wells.length) throw new ApiError({ code: "NOT_FOUND", message: "No wells selected", statusCode: 404 });

      const forecastId = `fc_${nanoid(10)}`;
      const now = isoNow();
      const avgQuality = wells.reduce((a, w) => a + w.dataQualityScore, 0) / wells.length;
      const confidence = avgQuality >= 82 ? "high" : avgQuality >= 65 ? "medium" : "low";

      const forecast: Forecast = {
        id: forecastId,
        orgId: request.user.orgId,
        scenarioId: body.data.scenarioId ?? null,
        modelId: model.id,
        wellIds: wells.map((w) => w.id),
        horizonMonths: body.data.horizonMonths,
        status: "running",
        createdAt: now,
        createdByUserId: request.user.sub,
        confidence,
      };
      db.data.forecasts.unshift(forecast);
      await db.persist();

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "forecast.run.requested",
        entity: "forecast",
        entityId: forecastId,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      const job = await createJob(db, { orgId: request.user.orgId, type: "forecast_run", steps: ["validate", "generate_series", "compute_risk", "publish"], result: { forecastId } });

      simulateJob(db, job.id, {
        onSuccess: async () => {
          const fc = db.data.forecasts.find((f) => f.id === forecastId);
          if (!fc) return;
          fc.status = "ready";

          // Replace any existing series for id.
          db.data.forecastSeries = db.data.forecastSeries.filter((s) => s.forecastId !== forecastId);
          db.data.forecastWellResults = db.data.forecastWellResults.filter((r) => r.forecastId !== forecastId);

          const start = "2026-01-01T00:00:00.000Z";
          for (const w of wells) {
            const lastObs = w.latestGwLevelM ?? 1100;
            const baseDrop = clamp(0.18 + w.riskScore * 0.55, 0.08, 0.95);

            for (let m = 0; m < fc.horizonMonths; m++) {
              const date = addMonths(start, m);
              const seasonal = Math.sin((m / 12) * Math.PI * 2) * 0.25;
              const p50 = lastObs - baseDrop * (m + 1) + seasonal;
              const sigma = 0.55 + (m / fc.horizonMonths) * 1.2;
              const p10 = p50 - sigma * 1.1;
              const p90 = p50 + sigma * 1.1;
              const s: ForecastSeriesPoint = {
                id: `fcs_${forecastId}_${w.id}_${m}`,
                forecastId,
                wellId: w.id,
                date,
                p10: Number(p10.toFixed(2)),
                p50: Number(p50.toFixed(2)),
                p90: Number(p90.toFixed(2)),
              };
              db.data.forecastSeries.push(s);
            }

            const series = db.data.forecastSeries.filter((s) => s.forecastId === forecastId && s.wellId === w.id);
            const final = series[series.length - 1];
            const expectedDropRate = Number(baseDrop.toFixed(2));
            const probCross = clamp(0.12 + w.riskScore * 0.75 + (fc.horizonMonths / 120) * 0.1, 0, 0.99);
            const riskScore = clamp(probCross * 0.7 + (expectedDropRate / 0.9) * 0.3, 0, 1);
            const r: ForecastWellResult = {
              forecastId,
              wellId: w.id,
              wellCode: w.code,
              p50FinalLevel: final.p50,
              probCrossThreshold: Number(probCross.toFixed(2)),
              expectedDropRate,
              riskLevel: riskLevelFromScore(riskScore),
            };
            db.data.forecastWellResults.push(r);

            if (r.riskLevel === "critical" || r.riskLevel === "high") {
              db.data.notifications.unshift({
                id: `nt_${nanoid(10)}`,
                orgId: request.user.orgId,
                userId: request.user.sub,
                title: r.riskLevel === "critical" ? "هشدار بحرانی پیش‌بینی" : "هشدار پیش‌بینی",
                body: `${w.code}: احتمال عبور از آستانه ${(r.probCrossThreshold * 100).toFixed(0)}٪ (دمو)`,
                severity: r.riskLevel === "critical" ? "critical" : "warning",
                createdAt: isoNow(),
                related: { entity: "forecast", entityId: forecastId },
              });
            }
          }

          await db.persist();
        },
      });

      return ok(reply, request, { forecastId, job });
    });

    app.get("/forecasts/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const fc = db.data.forecasts.find((f) => f.id === params.data.id && f.orgId === request.user.orgId);
      if (!fc) throw new ApiError({ code: "NOT_FOUND", message: "Forecast not found", statusCode: 404 });
      return ok(reply, request, fc);
    });

    app.get("/forecasts/:id/series", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const q = z.object({ wellId: z.string(), granularity: z.enum(["month"]).optional() }).safeParse(request.query);
      if (!params.success || !q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const fc = db.data.forecasts.find((f) => f.id === params.data.id && f.orgId === request.user.orgId);
      if (!fc) throw new ApiError({ code: "NOT_FOUND", message: "Forecast not found", statusCode: 404 });
      const wellId = q.data.wellId;
      if (!fc.wellIds.includes(wellId)) throw new ApiError({ code: "NOT_FOUND", message: "Well not in forecast", statusCode: 404 });

      const series = db.data.forecastSeries
        .filter((s) => s.forecastId === fc.id && s.wellId === wellId)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((p) => ({ date: p.date.slice(0, 10), p10: p.p10, p50: p.p50, p90: p.p90 }));

      const modelMetrics = db.data.modelMetrics.find((mm) => mm.modelId === fc.modelId)?.metrics ?? { rmse: 2.0, mae: 1.4, r2: 0.78, nse: 0.62 };

      return ok(reply, request, {
        meta: {
          forecastId: fc.id,
          wellId,
          scenario: fc.scenarioId ?? "baseline",
          model: db.data.models.find((m) => m.id === fc.modelId)?.name ?? fc.modelId,
          unit: "m",
        },
        series,
        metrics: modelMetrics,
        confidence: fc.confidence,
      });
    });

    app.get("/forecasts/:id/results", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const fc = db.data.forecasts.find((f) => f.id === params.data.id && f.orgId === request.user.orgId);
      if (!fc) throw new ApiError({ code: "NOT_FOUND", message: "Forecast not found", statusCode: 404 });

      const items = db.data.forecastWellResults
        .filter((r) => r.forecastId === fc.id)
        .map((r) => ({ ...r, probCrossThreshold: r.probCrossThreshold }));

      return ok(reply, request, { items });
    });
  };
}

