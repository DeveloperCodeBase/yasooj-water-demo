import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import { requireMinRole } from "../rbac.js";
import type { Role, UserStatus } from "../types.js";
import { ApiError, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";
import { hasMinRole, isoNow } from "../utils.js";

export function userRoutes(db: Db): FastifyPluginAsync {
  return async function (app) {
    app.get("/users", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const q = z
        .object({
          search: z.string().optional(),
          role: z.enum(["viewer", "analyst", "admin", "org_admin", "super_admin"]).optional(),
          status: z.enum(["active", "suspended", "locked"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const search = q.data.search?.toLowerCase().trim() ?? "";

      let items = db.data.users.filter((u) => u.orgId === request.user.orgId);
      if (q.data.role) items = items.filter((u) => u.role === q.data.role);
      if (q.data.status) items = items.filter((u) => u.status === q.data.status);
      if (search) items = items.filter((u) => u.email.toLowerCase().includes(search) || u.name.toLowerCase().includes(search));

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "lastLoginAt") return ((a.lastLoginAt ?? "") < (b.lastLoginAt ?? "") ? -1 : 1) * sortDir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
      });

      const paged = paginate(items, page, pageSize);
      return ok(reply, request, {
        ...paged,
        sort,
        items: paged.items.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          lastLoginAt: u.lastLoginAt ?? null,
          createdAt: u.createdAt,
        })),
      });
    });

    app.post("/users", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const body = z
        .object({
          name: z.string().min(2),
          email: z.string().email(),
          role: z.enum(["viewer", "analyst", "admin", "org_admin", "super_admin"]) satisfies z.ZodType<Role>,
          status: z.enum(["active", "suspended", "locked"]).default("active"),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      if (body.data.role === "super_admin" && request.user.role !== "super_admin") {
        throw new ApiError({ code: "FORBIDDEN", message: "Only super admins can create super admins", statusCode: 403 });
      }

      if (!hasMinRole(request.user.role, "org_admin")) {
        throw new ApiError({ code: "FORBIDDEN", message: "Forbidden", statusCode: 403 });
      }

      const exists = db.data.users.some((u) => u.email.toLowerCase() === body.data.email.toLowerCase());
      if (exists) throw new ApiError({ code: "DUPLICATE", message: "Email already exists", statusCode: 409 });

      const tempPassword = "Password123!";
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const id = `u_${nanoid(10)}`;
      const now = isoNow();
      db.data.users.unshift({
        id,
        orgId: request.user.orgId,
        name: body.data.name,
        email: body.data.email,
        role: body.data.role,
        status: body.data.status,
        passwordHash,
        language: "fa",
        theme: "light",
        createdAt: now,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "user.create",
        entity: "user",
        entityId: id,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet({ ...body.data, tempPassword: "***" }),
      });

      await db.persist();
      return ok(reply, request, { id, tempPassword });
    });

    app.patch("/users/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z
        .object({
          name: z.string().min(2).optional(),
          role: z.enum(["viewer", "analyst", "admin", "org_admin", "super_admin"]).optional(),
          status: z.enum(["active", "suspended", "locked"]).optional(),
        })
        .safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const u = db.data.users.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!u) throw new ApiError({ code: "NOT_FOUND", message: "User not found", statusCode: 404 });

      if (body.data.role === "super_admin" && request.user.role !== "super_admin") {
        throw new ApiError({ code: "FORBIDDEN", message: "Only super admins can set super admin role", statusCode: 403 });
      }

      Object.assign(u, body.data);
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.post("/users/:id/reset-password", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const u = db.data.users.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!u) throw new ApiError({ code: "NOT_FOUND", message: "User not found", statusCode: 404 });

      const token = nanoid(24);
      const resetLink = `https://demo.local/reset-password?token=${token}&user=${u.id}`;
      return ok(reply, request, { resetLink });
    });

    app.post("/users/:id/force-logout", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const u = db.data.users.find((x) => x.id === params.data.id && x.orgId === request.user.orgId);
      if (!u) throw new ApiError({ code: "NOT_FOUND", message: "User not found", statusCode: 404 });
      const now = isoNow();
      for (const s of db.data.sessions.filter((s) => s.userId === u.id && !s.revokedAt)) s.revokedAt = now;
      await db.persist();
      return ok(reply, request, { success: true });
    });
  };
}
