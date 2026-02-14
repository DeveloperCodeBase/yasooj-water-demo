import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "../db.js";
import { ApiError, isoNow, ok, paginate, parsePageParams } from "../utils.js";

export function notificationRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/notifications", { preHandler: [app.authenticate] }, async (request, reply) => {
      const q = z
        .object({
          tab: z.enum(["all", "unread"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const tab = q.data.tab ?? "all";

      let items = db.data.notifications.filter((n) => n.orgId === request.user.orgId && n.userId === request.user.sub);
      if (tab === "unread") items = items.filter((n) => !n.readAt);

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
        return 0;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, { ...paged, sort, items: paged.items });
    });

    app.post("/notifications/:id/read", { preHandler: [app.authenticate] }, async (request, reply) => {
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const n = db.data.notifications.find((x) => x.id === params.data.id && x.userId === request.user.sub);
      if (!n) throw new ApiError({ code: "NOT_FOUND", message: "Notification not found", statusCode: 404 });
      n.readAt = isoNow();
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.post("/notifications/read-all", { preHandler: [app.authenticate] }, async (request, reply) => {
      const now = isoNow();
      for (const n of db.data.notifications.filter((x) => x.userId === request.user.sub && !x.readAt)) n.readAt = now;
      await db.persist();
      return ok(reply, request, { success: true });
    });
  };
}

