import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import { requireMinRole } from "../rbac.js";
import { ApiError, isoNow, ok } from "../utils.js";

export function orgRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/orgs", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "super_admin");
      return ok(reply, request, { items: db.data.orgs });
    });

    app.post("/orgs", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "super_admin");
      const body = z.object({ name: z.string().min(2) }).safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const id = `org_${nanoid(8)}`;
      db.data.orgs.unshift({
        id,
        name: body.data.name,
        createdAt: isoNow(),
        settings: { units: { gwLevel: "m", precip: "mm", temp: "C" }, timezone: "Asia/Tehran" },
      });
      await db.persist();
      return ok(reply, request, { id });
    });

    app.patch("/orgs/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "super_admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z.object({ name: z.string().min(2).optional() }).safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const org = db.data.orgs.find((o) => o.id === params.data.id);
      if (!org) throw new ApiError({ code: "NOT_FOUND", message: "Org not found", statusCode: 404 });
      if (body.data.name) org.name = body.data.name;
      await db.persist();
      return ok(reply, request, { success: true });
    });
  };
}

