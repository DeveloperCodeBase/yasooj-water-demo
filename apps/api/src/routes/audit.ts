import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";
import { requireMinRole } from "../rbac.js";
import { ApiError, ok, paginate, parsePageParams } from "../utils.js";

export function auditRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/audit-logs", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const q = z
        .object({
          userId: z.string().optional(),
          action: z.string().optional(),
          entity: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);

      let items = db.data.auditLogs.filter((a) => a.orgId === request.user.orgId);
      if (q.data.userId) items = items.filter((a) => a.userId === q.data.userId);
      if (q.data.action) items = items.filter((a) => a.action === q.data.action);
      if (q.data.entity) items = items.filter((a) => a.entity === q.data.entity);
      if (q.data.from) items = items.filter((a) => new Date(a.createdAt) >= new Date(q.data.from!));
      if (q.data.to) items = items.filter((a) => new Date(a.createdAt) <= new Date(q.data.to!));

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
        return 0;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.get("/audit-logs/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const a = db.data.auditLogs.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!a) throw new ApiError({ code: "NOT_FOUND", message: "Audit log not found", statusCode: 404 });
      return ok(reply, request, a);
    });
  };
}

