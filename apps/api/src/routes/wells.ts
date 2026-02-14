import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { Db } from "../db.js";
import { ApiError, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";
import { isoNow } from "../utils.js";
import { requireMinRole } from "../rbac.js";
import type { RiskLevel } from "../types.js";

function riskOrder(level: RiskLevel) {
  switch (level) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

export function wellRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/wells", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          search: z.string().optional(),
          plainId: z.string().optional(),
          aquiferId: z.string().optional(),
          riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
          minQuality: z.coerce.number().int().min(0).max(100).optional(),
          status: z.enum(["active", "inactive"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const search = q.data.search?.toLowerCase().trim() ?? "";

      let items = db.data.wells.filter((w) => w && w.id);
      if (q.data.plainId) items = items.filter((w) => w.plainId === q.data.plainId);
      if (q.data.aquiferId) items = items.filter((w) => w.aquiferId === q.data.aquiferId);
      if (q.data.riskLevel) items = items.filter((w) => w.riskLevel === q.data.riskLevel);
      if (q.data.minQuality !== undefined) items = items.filter((w) => w.dataQualityScore >= q.data.minQuality!);
      if (q.data.status) items = items.filter((w) => w.status === q.data.status);
      if (search) items = items.filter((w) => w.code.toLowerCase().includes(search) || w.name.toLowerCase().includes(search));

      const [sortField, sortDirRaw] = (sort ?? "lastUpdate:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "riskLevel") return (riskOrder(a.riskLevel) - riskOrder(b.riskLevel)) * sortDir;
        if (sortField === "dataQualityScore") return (a.dataQualityScore - b.dataQualityScore) * sortDir;
        if (sortField === "lastUpdate") return (new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime()) * sortDir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
      });

      const paged = paginate(items, page, pageSize);
      const plainsById = new Map(db.data.plains.map((p) => [p.id, p]));
      const aquifersById = new Map(db.data.aquifers.map((a) => [a.id, a]));

      return ok(reply, request, {
        ...paged,
        sort,
        items: paged.items.map((w) => ({
          id: w.id,
          wellCode: w.code,
          name: w.name,
          plainId: w.plainId,
          plainName: plainsById.get(w.plainId)?.nameFa ?? w.plainId,
          aquiferId: w.aquiferId,
          aquiferName: aquifersById.get(w.aquiferId)?.nameFa ?? w.aquiferId,
          latestGwLevel: w.latestGwLevelM,
          change30d: w.change30dM,
          riskLevel: w.riskLevel,
          dataQualityScore: w.dataQualityScore,
          tags: w.tags ?? [],
          status: w.status,
          lastUpdate: w.lastUpdate,
        })),
      });
    });

    app.post("/wells", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const body = z
        .object({
          code: z.string().min(3),
          name: z.string().min(1),
          plainId: z.string(),
          aquiferId: z.string(),
          status: z.enum(["active", "inactive"]).default("active"),
          depthM: z.coerce.number().min(1).max(1000),
          lat: z.coerce.number().min(-90).max(90),
          lon: z.coerce.number().min(-180).max(180),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const exists = db.data.wells.some((w) => w.code.toLowerCase() === body.data.code.toLowerCase());
      if (exists) throw new ApiError({ code: "DUPLICATE", message: "Well code already exists", statusCode: 409 });

      const id = `well_new_${nanoid(8)}`;
      const now = isoNow();
      db.data.wells.unshift({
        id,
        code: body.data.code,
        name: body.data.name,
        plainId: body.data.plainId,
        aquiferId: body.data.aquiferId,
        status: body.data.status,
        depthM: body.data.depthM,
        lat: body.data.lat,
        lon: body.data.lon,
        monitoringFrequency: "monthly",
        latestGwLevelM: null,
        change30dM: null,
        dataQualityScore: 0,
        riskScore: 0,
        riskLevel: "low",
        lastUpdate: now,
        createdAt: now,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "well.create",
        entity: "well",
        entityId: id,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      await db.persist();
      return ok(reply, request, { id });
    });

    app.get("/wells/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const w = db.data.wells.find((x) => x.id === params.data.id);
      if (!w) throw new ApiError({ code: "NOT_FOUND", message: "Well not found", statusCode: 404 });

      const plain = db.data.plains.find((p) => p.id === w.plainId);
      const aquifer = db.data.aquifers.find((a) => a.id === w.aquiferId);
      const anomalies = db.data.wellTimeseries.filter((p) => p.wellId === w.id && p.flags.anomaly).length;

      return ok(reply, request, {
        ...w,
        plainName: plain?.nameFa ?? null,
        aquiferName: aquifer?.nameFa ?? null,
        miniKpi: {
          latestLevel: w.latestGwLevelM,
          trendSlopePerYear: Number((-(0.2 + w.riskScore * 0.6) * 12).toFixed(2)),
          anomaliesCount: anomalies,
        },
      });
    });

    app.patch("/wells/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z
        .object({
          name: z.string().min(1).optional(),
          status: z.enum(["active", "inactive"]).optional(),
          pinned: z.boolean().optional(),
          tags: z.array(z.string().min(1).max(24)).max(12).optional(),
        })
        .safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const w = db.data.wells.find((x) => x.id === params.data.id);
      if (!w) throw new ApiError({ code: "NOT_FOUND", message: "Well not found", statusCode: 404 });

      Object.assign(w, body.data);
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.delete("/wells/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const before = db.data.wells.length;
      db.data.wells = db.data.wells.filter((w) => w.id !== params.data.id);
      db.data.wellTimeseries = db.data.wellTimeseries.filter((p) => p.wellId !== params.data.id);
      if (db.data.wells.length === before) throw new ApiError({ code: "NOT_FOUND", message: "Well not found", statusCode: 404 });
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.get("/wells/:id/timeseries", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const q = z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: z.enum(["month", "day"]).optional(),
          smoothing: z.coerce.boolean().optional(),
          showAnomalies: z.coerce.boolean().optional(),
        })
        .safeParse(request.query);
      if (!params.success || !q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const w = db.data.wells.find((x) => x.id === params.data.id);
      if (!w) throw new ApiError({ code: "NOT_FOUND", message: "Well not found", statusCode: 404 });

      const from = q.data.from ? new Date(q.data.from) : null;
      const to = q.data.to ? new Date(q.data.to) : null;
      let series = db.data.wellTimeseries
        .filter((p) => p.wellId === w.id)
        .filter((p) => {
          const d = new Date(p.date);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        })
        .map((p) => ({
          date: p.date.slice(0, 10),
          gwLevelM: p.gwLevelM,
          precipMm: p.precipMm,
          tmeanC: p.tmeanC,
          flags: p.flags,
        }));

      if (q.data.showAnomalies === false) {
        series = series.map((p) => (p.flags.anomaly ? { ...p, gwLevelM: null } : p));
      }

      // Naive smoothing: 3-point moving average on gwLevel
      if (q.data.smoothing) {
        const smoothed = series.map((p, idx) => {
          const w = [idx - 1, idx, idx + 1]
            .map((j) => series[j]?.gwLevelM)
            .filter((v) => typeof v === "number") as number[];
          if (!w.length) return p;
          const avg = w.reduce((a, v) => a + v, 0) / w.length;
          return { ...p, gwLevelM: Number(avg.toFixed(2)) };
        });
        series = smoothed;
      }

      return ok(reply, request, {
        meta: { wellId: w.id, unit: "m", granularity: q.data.granularity ?? "month" },
        series,
      });
    });

    app.get("/wells/:id/quality", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const w = db.data.wells.find((x) => x.id === params.data.id);
      if (!w) throw new ApiError({ code: "NOT_FOUND", message: "Well not found", statusCode: 404 });

      const pts = db.data.wellTimeseries.filter((p) => p.wellId === w.id);
      const total = pts.length;
      const missing = pts.filter((p) => p.gwLevelM === null).length;
      const completeness = total ? (total - missing) / total : 0;
      const outliers = pts.filter((p) => p.flags.anomaly).map((p) => ({ date: p.date.slice(0, 10), value: p.gwLevelM }));

      // Missing periods (contiguous)
      const missingPeriods: Array<{ from: string; to: string; months: number }> = [];
      let runStart: string | null = null;
      let runLen = 0;
      for (const p of pts) {
        const isMissing = p.gwLevelM === null;
        if (isMissing && !runStart) {
          runStart = p.date;
          runLen = 1;
        } else if (isMissing && runStart) {
          runLen += 1;
        } else if (!isMissing && runStart) {
          const fromIso = runStart.slice(0, 10);
          const toIso = pts[pts.indexOf(p) - 1]?.date?.slice(0, 10) ?? runStart.slice(0, 10);
          missingPeriods.push({ from: fromIso, to: toIso, months: runLen });
          runStart = null;
          runLen = 0;
        }
      }
      if (runStart) {
        const last = pts[pts.length - 1];
        missingPeriods.push({ from: runStart.slice(0, 10), to: last.date.slice(0, 10), months: runLen });
      }

      return ok(reply, request, {
        wellId: w.id,
        completeness: Number(completeness.toFixed(3)),
        score: w.dataQualityScore,
        missingPeriods,
        outliers,
      });
    });

    app.get("/wells/:id/forecasts", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const wellId = params.data.id;
      const items = db.data.forecasts
        .filter((f) => f.wellIds.includes(wellId))
        .map((f) => ({
          id: f.id,
          scenarioId: f.scenarioId,
          modelId: f.modelId,
          horizonMonths: f.horizonMonths,
          createdAt: f.createdAt,
          status: f.status,
          confidence: f.confidence,
        }));
      return ok(reply, request, { items });
    });

    app.get("/wells/:id/notes", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const items = db.data.wellNotes.filter((n) => n.wellId === params.data.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return ok(reply, request, { items });
    });

    app.post("/wells/:id/notes", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z.object({ body: z.string().min(1).max(2000) }).safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const noteId = `note_${nanoid(10)}`;
      db.data.wellNotes.unshift({
        id: noteId,
        wellId: params.data.id,
        authorUserId: request.user.sub,
        body: body.data.body,
        createdAt: isoNow(),
      });
      await db.persist();
      return ok(reply, request, { id: noteId });
    });

    app.post("/wells/:id/pin", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const w = db.data.wells.find((x) => x.id === params.data.id);
      if (!w) throw new ApiError({ code: "NOT_FOUND", message: "Well not found", statusCode: 404 });
      w.pinned = !w.pinned;
      await db.persist();
      return ok(reply, request, { pinned: w.pinned });
    });
  };
}
