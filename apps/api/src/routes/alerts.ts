import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import { requireMinRole } from "../rbac.js";
import type { AlertConditionType, AlertSeverity, AlertStatus, Well } from "../types.js";
import { ApiError, clamp, isoNow, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";

function resolveScopeWells(db: Db, scope: { plainIds: string[]; aquiferIds: string[]; wellIds: string[] }) {
  const ids = new Set<string>();
  for (const id of scope.wellIds) ids.add(id);
  for (const w of db.data.wells) {
    if (scope.plainIds.includes(w.plainId)) ids.add(w.id);
    if (scope.aquiferIds.includes(w.aquiferId)) ids.add(w.id);
  }
  return [...ids]
    .map((id) => db.data.wells.find((w) => w.id === id))
    .filter((w): w is Well => Boolean(w));
}

function evalAlert(db: Db, alert: { conditionType: AlertConditionType; params: Record<string, unknown>; scope: { plainIds: string[]; aquiferIds: string[]; wellIds: string[] } }) {
  const wells = resolveScopeWells(db, alert.scope);
  const affected = [];
  for (const w of wells) {
    const dropRate = clamp(0.15 + w.riskScore * 0.85, 0, 1.3);
    const probCross = clamp(0.15 + w.riskScore * 0.75, 0, 0.99);
    if (alert.conditionType === "gw_level_below") {
      const thresholdM = Number(alert.params.thresholdM ?? NaN);
      if (Number.isFinite(thresholdM) && w.latestGwLevelM !== null && w.latestGwLevelM < thresholdM) affected.push(w);
    } else if (alert.conditionType === "drop_rate_above") {
      const threshold = Number(alert.params.threshold ?? NaN);
      if (Number.isFinite(threshold) && dropRate > threshold) affected.push(w);
    } else if (alert.conditionType === "prob_cross_threshold_above") {
      const pct = Number(alert.params.thresholdPct ?? NaN);
      if (Number.isFinite(pct) && probCross > pct / 100) affected.push(w);
    } else if (alert.conditionType === "data_quality_below") {
      const minScore = Number(alert.params.minScore ?? NaN);
      if (Number.isFinite(minScore) && w.dataQualityScore < minScore) affected.push(w);
    }
  }
  return affected;
}

export function alertRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/alerts", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const q = z
        .object({
          search: z.string().optional(),
          status: z.enum(["enabled", "disabled"]).optional(),
          severity: z.enum(["info", "warning", "critical"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const search = q.data.search?.toLowerCase().trim() ?? "";

      let items = db.data.alerts.filter((a) => a.orgId === request.user.orgId);
      if (q.data.status) items = items.filter((a) => a.status === q.data.status);
      if (q.data.severity) items = items.filter((a) => a.severity === q.data.severity);
      if (search) items = items.filter((a) => a.name.toLowerCase().includes(search));

      const [sortField, sortDirRaw] = (sort ?? "updatedAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "lastTriggeredAt") return ((a.lastTriggeredAt ?? "") < (b.lastTriggeredAt ?? "") ? -1 : 1) * sortDir;
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortDir;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.post("/alerts", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const body = z
        .object({
          name: z.string().min(2),
          severity: z.enum(["info", "warning", "critical"]) satisfies z.ZodType<AlertSeverity>,
          status: z.enum(["enabled", "disabled"]).default("enabled"),
          scope: z.object({
            plainIds: z.array(z.string()).default([]),
            aquiferIds: z.array(z.string()).default([]),
            wellIds: z.array(z.string()).default([]),
          }),
          conditionType: z.enum(["gw_level_below", "drop_rate_above", "prob_cross_threshold_above", "data_quality_below"]) satisfies z.ZodType<AlertConditionType>,
          params: z.record(z.any()).default({}),
          channels: z.object({ inApp: z.boolean().default(true), email: z.boolean().default(false) }).default({ inApp: true, email: false }),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const id = `al_${nanoid(10)}`;
      const now = isoNow();
      db.data.alerts.unshift({
        id,
        orgId: request.user.orgId,
        name: body.data.name,
        severity: body.data.severity,
        status: body.data.status,
        scope: body.data.scope,
        conditionType: body.data.conditionType,
        params: body.data.params,
        channels: body.data.channels,
        createdAt: now,
        updatedAt: now,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "alert.create",
        entity: "alert",
        entityId: id,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      await db.persist();
      return ok(reply, request, { id });
    });

    app.patch("/alerts/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z
        .object({
          name: z.string().min(2).optional(),
          severity: z.enum(["info", "warning", "critical"]).optional(),
          status: z.enum(["enabled", "disabled"]).optional(),
          scope: z
            .object({
              plainIds: z.array(z.string()).optional(),
              aquiferIds: z.array(z.string()).optional(),
              wellIds: z.array(z.string()).optional(),
            })
            .optional(),
          conditionType: z.enum(["gw_level_below", "drop_rate_above", "prob_cross_threshold_above", "data_quality_below"]).optional(),
          params: z.record(z.any()).optional(),
          channels: z.object({ inApp: z.boolean().optional(), email: z.boolean().optional() }).optional(),
        })
        .safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const a = db.data.alerts.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!a) throw new ApiError({ code: "NOT_FOUND", message: "Alert not found", statusCode: 404 });
      Object.assign(a, body.data);
      if (body.data.scope) a.scope = { ...a.scope, ...body.data.scope };
      if (body.data.channels) a.channels = { ...a.channels, ...body.data.channels };
      a.updatedAt = isoNow();
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.post("/alerts/:id/test", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const a = db.data.alerts.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!a) throw new ApiError({ code: "NOT_FOUND", message: "Alert not found", statusCode: 404 });

      const affected = evalAlert(db, a);
      const now = isoNow();
      a.lastTriggeredAt = now;

      const historyId = `alh_${nanoid(10)}`;
      const summary = `${affected.length} چاه متاثر شدند (تست).`;
      db.data.alertHistory.unshift({ id: historyId, alertId: a.id, triggeredAt: now, wellsAffected: affected.map((w) => w.id), summary });

      if (a.channels.inApp && affected.length) {
        db.data.notifications.unshift({
          id: `nt_${nanoid(10)}`,
          orgId: request.user.orgId,
          userId: request.user.sub,
          title: "نتیجه تست هشدار",
          body: summary,
          severity: a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info",
          createdAt: now,
          related: { entity: "alert", entityId: a.id },
        });
      }

      await db.persist();
      return ok(reply, request, { affectedWells: affected.map((w) => ({ id: w.id, code: w.code, riskLevel: w.riskLevel })), historyId, summary });
    });

    app.get("/alerts/:id/history", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const items = db.data.alertHistory.filter((h) => h.alertId === params.data.id).sort((a, b) => (a.triggeredAt < b.triggeredAt ? 1 : -1));
      return ok(reply, request, { items });
    });

    app.post("/alerts/history/:id/ack", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const h = db.data.alertHistory.find((x) => x.id === params.data.id);
      if (!h) throw new ApiError({ code: "NOT_FOUND", message: "History not found", statusCode: 404 });
      h.acknowledgedAt = isoNow();
      h.acknowledgedByUserId = request.user.sub;
      await db.persist();
      return ok(reply, request, { success: true });
    });
  };
}
