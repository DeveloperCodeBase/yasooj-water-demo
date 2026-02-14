import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import { createJob, simulateJob } from "../jobs.js";
import { requireMinRole } from "../rbac.js";
import type { ReportType } from "../types.js";
import { ApiError, isoNow, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";

function renderHtmlReport(opts: { title: string; type: ReportType; sections: string[]; generatedAt: string }) {
  const typeFa = opts.type === "executive" ? "مدیریتی" : opts.type === "technical" ? "فنی" : "عملیاتی";
  const sectionFa: Record<string, string> = {
    kpis: "شاخص‌ها",
    scenario_summary: "خلاصه سناریو",
    forecast_charts: "نمودارهای پیش‌بینی",
    risk_table: "جدول ریسک",
    data_quality: "کیفیت داده",
    alerts_summary: "خلاصه هشدارها",
  };
  const sectionList = opts.sections.map((s) => `<li>${sectionFa[s] ?? s}</li>`).join("");

  const d = new Date(opts.generatedAt);
  const generatedFa = Number.isNaN(d.getTime())
    ? opts.generatedAt
    : new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${opts.title}</title>
    <style>
      body { font-family: Vazirmatn, ui-sans-serif, system-ui; padding: 24px; background: #f7f7fb; color: #111; }
      .card { background: #fff; border: 1px solid #e9e9ef; border-radius: 14px; padding: 18px 20px; max-width: 920px; margin: 0 auto; }
      h1 { margin: 0 0 10px; font-size: 22px; }
      .meta { color: #444; font-size: 13px; margin-bottom: 12px; }
      ul { margin: 0; padding-right: 18px; }
      .footer { margin-top: 18px; color: #555; font-size: 12px; }
      .pill { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #eef2ff; border: 1px solid #dbe4ff; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${opts.title}</h1>
      <div class="meta">
        <span class="pill">نوع: ${typeFa}</span>
        <span style="display:inline-block; width: 10px"></span>
        <span>تاریخ تولید: ${generatedFa}</span>
      </div>
      <h3 style="margin:12px 0 6px">بخش‌ها</h3>
      <ul>${sectionList}</ul>
      <div class="footer">مالکیت و حقوق این سامانه متعلق به مرکز راهبری پژوهش و پیشرفت هوش مصنوعی جهاددانشگاهی است.</div>
    </div>
  </body>
</html>`;
}

export function reportRoutes(db: Db, env: Env): FastifyPluginAsync {
  return async function (app) {
    app.get("/reports", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      let items = db.data.reports.filter((r) => r.orgId === request.user.orgId);

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
        return 0;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.post("/reports/generate", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const body = z
        .object({
          type: z.enum(["executive", "technical", "ops"]) satisfies z.ZodType<ReportType>,
          title: z.string().min(2).max(120).optional(),
          sections: z.array(z.string()).min(1),
          scope: z.record(z.any()).optional(),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const id = `rp_${nanoid(10)}`;
      const now = isoNow();
      const title = body.data.title ?? (body.data.type === "executive" ? "گزارش مدیریتی (دمو)" : body.data.type === "technical" ? "گزارش فنی (دمو)" : "گزارش عملیاتی (دمو)");
      const filename = `${id}.html`;
      db.data.reports.unshift({
        id,
        orgId: request.user.orgId,
        title,
        type: body.data.type,
        createdAt: now,
        status: "generating",
        sections: body.data.sections,
        filename,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "report.generate.requested",
        entity: "report",
        entityId: id,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      await db.persist();

      const job = await createJob(db, { orgId: request.user.orgId, type: "report_generate", steps: ["assemble", "render", "store"], result: { reportId: id } });

      simulateJob(db, job.id, {
        onSuccess: async () => {
          const rp = db.data.reports.find((r) => r.id === id);
          if (!rp) return;
          const html = renderHtmlReport({ title: rp.title, type: rp.type, sections: rp.sections, generatedAt: isoNow() });
          const dst = path.join(env.STORAGE_DIR, "reports", rp.filename);
          await fs.mkdir(path.dirname(dst), { recursive: true });
          await fs.writeFile(dst, html, "utf8");
          rp.status = "ready";
          await db.persist();
        },
      });

      return ok(reply, request, { reportId: id, job });
    });

    app.get("/reports/:id/download", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const rp = db.data.reports.find((r) => r.id === params.data.id && r.orgId === request.user.orgId);
      if (!rp) throw new ApiError({ code: "NOT_FOUND", message: "Report not found", statusCode: 404 });
      const filePath = path.join(env.STORAGE_DIR, "reports", rp.filename);
      const buf = await fs.readFile(filePath);
      return ok(reply, request, { filename: rp.filename, mimeType: "text/html; charset=utf-8", contentBase64: buf.toString("base64") });
    });
  };
}
