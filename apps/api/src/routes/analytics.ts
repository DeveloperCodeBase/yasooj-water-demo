import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";
import { ApiError, clamp, isoNow, ok } from "../utils.js";
import type { RiskLevel } from "../types.js";

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function toDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function listMonths(fromIso: string, toIso: string) {
  const from = toDate(fromIso);
  const to = toDate(toIso);
  if (!from || !to) return [];

  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const out: string[] = [];
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

function linearTrend(values: Array<{ x: number; y: number }>) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0]?.y ?? 0 };
  const sumX = values.reduce((a, v) => a + v.x, 0);
  const sumY = values.reduce((a, v) => a + v.y, 0);
  const sumXY = values.reduce((a, v) => a + v.x * v.y, 0);
  const sumXX = values.reduce((a, v) => a + v.x * v.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: values[0].y };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

const riskOrder: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export function analyticsRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/analytics/gw-level-trend", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          plainId: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: z.enum(["month"]).optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const plainId = q.data.plainId ?? null;
      const from = q.data.from ?? "2021-01-01";
      const to = q.data.to ?? "2025-12-01";
      const granularity = q.data.granularity ?? "month";

      const wellIds = db.data.wells.filter((w) => (plainId ? w.plainId === plainId : true)).map((w) => w.id);
      const months = listMonths(from, to);

      const points = months.map((d) => {
        const vals = db.data.wellTimeseries.filter((p) => wellIds.includes(p.wellId) && p.date.startsWith(d.slice(0, 10)) && p.gwLevelM !== null);
        const avg = vals.length ? vals.reduce((a, v) => a + (v.gwLevelM ?? 0), 0) / vals.length : null;
        return { date: d.slice(0, 10) + "T00:00:00.000Z", gwLevelAvg: avg === null ? null : Number(avg.toFixed(2)) };
      });

      const trendInput = points
        .map((p, idx) => (p.gwLevelAvg === null ? null : { x: idx, y: p.gwLevelAvg }))
        .filter(Boolean) as Array<{ x: number; y: number }>;
      const { slope, intercept } = linearTrend(trendInput);

      const series = points.map((p, idx) => ({
        date: p.date.slice(0, 10),
        gwLevelAvg: p.gwLevelAvg ?? 0,
        trend: Number((slope * idx + intercept).toFixed(2)),
      }));

      const latest = series.length ? series[series.length - 1].gwLevelAvg : 0;
      const first = series.length ? series[0].gwLevelAvg : latest;
      const delta = Number((latest - first).toFixed(2));
      const slopePerYear = Number((slope * 12).toFixed(2));

      return ok(reply, request, {
        meta: { plainId: plainId ?? "all", from, to, granularity, unit: "m" },
        series,
        summary: { latest, delta, slopePerYear },
      });
    });

    app.get("/analytics/climate-combo", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          plainId: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
          granularity: z.enum(["month"]).optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const plainId = q.data.plainId ?? null;
      const from = q.data.from ?? "2021-01-01";
      const to = q.data.to ?? "2025-12-01";
      const months = listMonths(from, to);

      const wellIds = db.data.wells.filter((w) => (plainId ? w.plainId === plainId : true)).map((w) => w.id);
      const series = months.map((d) => {
        const pts = db.data.wellTimeseries.filter((p) => wellIds.includes(p.wellId) && p.date.startsWith(d.slice(0, 10)));
        const precip = pts.length ? pts.reduce((a, v) => a + v.precipMm, 0) / pts.length : 0;
        const tmean = pts.length ? pts.reduce((a, v) => a + v.tmeanC, 0) / pts.length : 0;
        return { date: d.slice(0, 10), precip: Number(precip.toFixed(1)), tmean: Number(tmean.toFixed(1)) };
      });

      return ok(reply, request, { meta: { unitPrecip: "mm", unitTemp: "C" }, series });
    });

    app.get("/analytics/risk-heatmap", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const from = q.data.from ?? "2024-01-01";
      const to = q.data.to ?? "2025-12-01";
      const months = listMonths(from, to).map((d) => monthKey(d));

      const y = db.data.plains.map((p) => ({ plainId: p.id, plainName: p.nameFa }));
      const values = [];
      for (const p of db.data.plains) {
        const wells = db.data.wells.filter((w) => w.plainId === p.id);
        const base = wells.length ? wells.reduce((a, w) => a + w.riskScore, 0) / wells.length : 0.4;
        for (let i = 0; i < months.length; i++) {
          const seasonal = Math.sin((i / 12) * Math.PI * 2) * 0.06;
          const risk = clamp(base + seasonal, 0, 1);
          values.push({ plainId: p.id, month: months[i], risk: Number(risk.toFixed(2)) });
        }
      }

      return ok(reply, request, {
        meta: { from, to },
        x: months,
        y,
        values,
        legend: { min: 0, max: 1, scale: "linear" },
      });
    });

    app.get("/analytics/top-risk-wells", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          plainId: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(50).optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const plainId = q.data.plainId;
      const limit = q.data.limit ?? 10;
      let items = db.data.wells;
      if (plainId) items = items.filter((w) => w.plainId === plainId);
      items = [...items].sort((a, b) => {
        const rl = riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
        if (rl !== 0) return rl;
        return b.riskScore - a.riskScore;
      });

      const out = items.slice(0, limit).map((w) => ({
        wellId: w.id,
        wellCode: w.code,
        riskLevel: w.riskLevel,
        probCrossThreshold: clamp(0.15 + w.riskScore * 0.75, 0, 0.99),
        latestLevel: w.latestGwLevelM ?? null,
        dataQuality: w.dataQualityScore,
      }));
      return ok(reply, request, { items: out });
    });

    app.get("/analytics/kpis", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          plainId: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const plainId = q.data.plainId ?? null;
      const from = q.data.from ?? "2025-01-01";
      const to = q.data.to ?? "2025-12-01";
      const months = listMonths(from, to);

      const wells = db.data.wells.filter((w) => (plainId ? w.plainId === plainId : true));
      const wellIds = wells.map((w) => w.id);
      const lastMonth = months.length ? months[months.length - 1].slice(0, 10) : "2025-12-01";
      const prevMonth = months.length > 1 ? months[months.length - 2].slice(0, 10) : lastMonth;

      const monthAvg = (isoDate10: string) => {
        const pts = db.data.wellTimeseries.filter((p) => wellIds.includes(p.wellId) && p.date.startsWith(isoDate10) && p.gwLevelM !== null);
        return pts.length ? pts.reduce((a, p) => a + (p.gwLevelM ?? 0), 0) / pts.length : null;
      };
      const avgNow = monthAvg(lastMonth);
      const avgPrev = monthAvg(prevMonth);
      const avgDelta = avgNow === null || avgPrev === null ? 0 : Number((avgNow - avgPrev).toFixed(2));

      const dropRates = wells.map((w) => {
        if (w.latestGwLevelM === null) return 0;
        // Approx: use riskScore-derived proxy for drop rate (demo)
        return clamp(0.15 + w.riskScore * 0.85, 0, 1.2);
      });
      const monthlyDropRate = dropRates.length ? dropRates.reduce((a, b) => a + b, 0) / dropRates.length : 0;

      const wellsAtRisk = wells.filter((w) => w.riskLevel === "high" || w.riskLevel === "critical").length;
      const dataQualityAvg = wells.length ? wells.reduce((a, w) => a + w.dataQualityScore, 0) / wells.length : 0;
      const droughtIndex = clamp(0.35 + (1 - (avgNow ?? 1100) / 1150) * 0.4 + (monthlyDropRate / 1.2) * 0.25, 0, 1);

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const alertsTriggered = db.data.alertHistory.filter((h) => new Date(h.triggeredAt).getTime() >= thirtyDaysAgo).length;

      return ok(reply, request, {
        kpis: [
          { key: "avg_gw_level", title: "میانگین سطح آب زیرزمینی", unit: "متر", value: avgNow === null ? null : Number(avgNow.toFixed(2)), delta: avgDelta },
          { key: "monthly_drop_rate", title: "نرخ افت ماهانه", unit: "متر/ماه", value: Number(monthlyDropRate.toFixed(2)), delta: null },
          { key: "wells_at_risk", title: "چاه‌های پرریسک", unit: "تعداد", value: wellsAtRisk, delta: null },
          { key: "data_quality", title: "امتیاز کیفیت داده", unit: "۰ تا ۱۰۰", value: Math.round(dataQualityAvg), delta: null },
          { key: "drought_index", title: "شاخص خشکسالی", unit: "۰ تا ۱", value: Number(droughtIndex.toFixed(2)), delta: null },
          { key: "alerts_30d", title: "هشدارهای ۳۰ روز اخیر", unit: "تعداد", value: alertsTriggered, delta: null },
        ],
        meta: { plainId: plainId ?? "all", from, to, computedAt: isoNow() },
      });
    });

    app.get("/analytics/activity", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }).safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const limit = q.data.limit ?? 15;
      const items = db.data.auditLogs.slice(0, limit).map((a) => ({
        id: a.id,
        createdAt: a.createdAt,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId ?? null,
        userEmail: a.userEmail,
      }));
      return ok(reply, request, { items });
    });
  };
}
