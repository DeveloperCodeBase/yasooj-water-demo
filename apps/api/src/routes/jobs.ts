import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";
import { requireMinRole } from "../rbac.js";
import { ApiError, ok, paginate, parsePageParams } from "../utils.js";

export function jobRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/jobs", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const q = z
        .object({
          type: z.enum(["scenario_run", "model_train", "forecast_run", "report_generate"]).optional(),
          status: z.enum(["queued", "running", "success", "failed"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      let items = db.data.jobs.filter((j) => j.orgId === request.user.orgId);
      if (q.data.type) items = items.filter((j) => j.type === q.data.type);
      if (q.data.status) items = items.filter((j) => j.status === q.data.status);

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
        return 0;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.get("/jobs/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const job = db.data.jobs.find((j) => j.id === params.data.id && j.orgId === request.user.orgId);
      if (!job) throw new ApiError({ code: "NOT_FOUND", message: "Job not found", statusCode: 404 });
      return ok(reply, request, job);
    });
  };
}

