import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import { requireMinRole } from "../rbac.js";
import { ApiError, isoNow, ok, safeJsonSnippet } from "../utils.js";
import bcrypt from "bcryptjs";

export function settingsRoutes(db: Db, env: Env): FastifyPluginAsync {
  return async function (app) {
    app.get("/settings/profile", { preHandler: [app.authenticate] }, async (request, reply) => {
      const u = db.data.users.find((x) => x.id === request.user.sub);
      if (!u) throw new ApiError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
      return ok(reply, request, {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        language: u.language,
        theme: u.theme,
      });
    });

    app.patch("/settings/profile", { preHandler: [app.authenticate] }, async (request, reply) => {
      const body = z
        .object({
          name: z.string().min(2).optional(),
          language: z.enum(["fa", "en"]).optional(),
          theme: z.enum(["light", "dark"]).optional(),
          currentPassword: z.string().optional(),
          newPassword: z.string().min(8).optional(),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const u = db.data.users.find((x) => x.id === request.user.sub);
      if (!u) throw new ApiError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });

      if (body.data.newPassword) {
        if (!body.data.currentPassword) {
          throw new ApiError({ code: "VALIDATION_ERROR", message: "Current password required", statusCode: 400 });
        }
        const okPw = await bcrypt.compare(body.data.currentPassword, u.passwordHash);
        if (!okPw) throw new ApiError({ code: "INVALID_CREDENTIALS", message: "Invalid current password", statusCode: 401 });
        u.passwordHash = await bcrypt.hash(body.data.newPassword, 10);
      }

      if (body.data.name) u.name = body.data.name;
      if (body.data.language) u.language = body.data.language;
      if (body.data.theme) u.theme = body.data.theme;

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: u.orgId,
        userId: u.id,
        userEmail: u.email,
        action: "settings.profile.update",
        entity: "user",
        entityId: u.id,
        createdAt: isoNow(),
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet({ ...body.data, currentPassword: "***", newPassword: body.data.newPassword ? "***" : undefined }),
      });

      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.get("/settings/org", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const org = db.data.orgs.find((o) => o.id === request.user.orgId);
      if (!org) throw new ApiError({ code: "NOT_FOUND", message: "Org not found", statusCode: 404 });
      return ok(reply, request, org);
    });

    app.patch("/settings/org", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const body = z
        .object({
          name: z.string().min(2).optional(),
          timezone: z.string().min(2).optional(),
          units: z
            .object({
              gwLevel: z.literal("m").optional(),
              precip: z.literal("mm").optional(),
              temp: z.literal("C").optional(),
            })
            .optional(),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const org = db.data.orgs.find((o) => o.id === request.user.orgId);
      if (!org) throw new ApiError({ code: "NOT_FOUND", message: "Org not found", statusCode: 404 });
      if (body.data.name) org.name = body.data.name;
      if (body.data.timezone) org.settings.timezone = body.data.timezone;
      if (body.data.units) org.settings.units = { ...org.settings.units, ...body.data.units };
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.post("/settings/org/logo", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "org_admin");
      const org = db.data.orgs.find((o) => o.id === request.user.orgId);
      if (!org) throw new ApiError({ code: "NOT_FOUND", message: "Org not found", statusCode: 404 });

      const parts = request.files();
      for await (const part of parts) {
        if (part.type !== "file") continue;
        const ext = path.extname(part.filename || ".svg") || ".svg";
        const filename = `org_${org.id}_${Date.now()}${ext}`;
        const targetDir = path.join(env.STORAGE_DIR, "uploads", "org_logos");
        await fs.mkdir(targetDir, { recursive: true });
        const target = path.join(targetDir, filename);
        const buf = await part.toBuffer();
        await fs.writeFile(target, buf);
        // Demo: we expose it via a simple download endpoint; store URL pointer.
        org.settings.logoUrl = `/uploads/org_logos/${filename}`;
        await db.persist();
        return ok(reply, request, { logoUrl: org.settings.logoUrl });
      }
      throw new ApiError({ code: "VALIDATION_ERROR", message: "No file uploaded", statusCode: 400 });
    });

    // Mock file serving for uploaded org logos.
    app.get("/uploads/org_logos/:filename", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "viewer");
      const params = z.object({ filename: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const filePath = path.join(env.STORAGE_DIR, "uploads", "org_logos", params.data.filename);
      const buf = await fs.readFile(filePath);
      reply.type("application/octet-stream");
      return reply.send(buf);
    });
  };
}

