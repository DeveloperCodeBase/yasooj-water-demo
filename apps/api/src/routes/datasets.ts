import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import { requireMinRole } from "../rbac.js";
import type { DatasetStatus, DatasetType } from "../types.js";
import { ApiError, ok, paginate, parsePageParams, safeJsonSnippet } from "../utils.js";
import { clamp, isoNow } from "../utils.js";

function bumpVersion(version: string, bump: "major" | "minor" | "patch") {
  const parts = version.split(".").map((n) => Number(n));
  const [maj, min, pat] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  if (bump === "major") return `${maj + 1}.0.0`;
  if (bump === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

export function datasetRoutes(db: Db, env: Env): FastifyPluginAsync {
  return async function (app) {
    app.get("/datasets", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const q = z
        .object({
          search: z.string().optional(),
          type: z.enum(["climate", "groundwater", "usage", "gis"]).optional(),
          status: z.enum(["draft", "validated", "published"]).optional(),
          page: z.coerce.number().int().min(1).optional(),
          pageSize: z.coerce.number().int().min(1).max(100).optional(),
          sort: z.string().optional(),
        })
        .safeParse(request.query);
      if (!q.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const { page, pageSize, sort } = parsePageParams(q.data as Record<string, unknown>);
      const search = q.data.search?.toLowerCase().trim() ?? "";

      let items = db.data.datasets.filter((d) => d.orgId === request.user.orgId);
      if (q.data.type) items = items.filter((d) => d.type === q.data.type);
      if (q.data.status) items = items.filter((d) => d.status === q.data.status);
      if (search) items = items.filter((d) => d.name.toLowerCase().includes(search));

      const [sortField, sortDirRaw] = (sort ?? "createdAt:desc").split(":");
      const sortDir = sortDirRaw === "asc" ? 1 : -1;
      items.sort((a, b) => {
        if (sortField === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
        if (sortField === "updatedAt") return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortDir;
        return a.name.localeCompare(b.name) * sortDir;
      });

      const paged = paginate(items, page, pageSize);
      const out = paged.items.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        version: d.version,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
      return ok(reply, request, { ...paged, sort, items: out });
    });

    app.post("/datasets", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const body = z
        .object({
          name: z.string().min(2),
          type: z.enum(["climate", "groundwater", "usage", "gis"]) satisfies z.ZodType<DatasetType>,
          source: z.enum(["ManualUpload", "API", "Other"]),
          description: z.string().max(2000).optional(),
        })
        .safeParse(request.body);
      if (!body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });

      const id = `ds_${nanoid(10)}`;
      const now = isoNow();
      db.data.datasets.unshift({
        id,
        orgId: request.user.orgId,
        name: body.data.name,
        type: body.data.type,
        source: body.data.source,
        description: body.data.description,
        version: "0.1.0",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "dataset.create",
        entity: "dataset",
        entityId: id,
        createdAt: now,
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet(body.data),
      });

      await db.persist();
      return ok(reply, request, { id });
    });

    app.get("/datasets/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const ds = db.data.datasets.find((d) => d.id === params.data.id && d.orgId === request.user.orgId);
      if (!ds) throw new ApiError({ code: "NOT_FOUND", message: "Dataset not found", statusCode: 404 });
      const files = db.data.datasetFiles.filter((f) => f.datasetId === ds.id);
      const validation = db.data.datasetValidations.find((v) => v.datasetId === ds.id) ?? null;
      return ok(reply, request, { ...ds, files, validation });
    });

    app.patch("/datasets/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z
        .object({
          name: z.string().min(2).optional(),
          description: z.string().max(2000).optional(),
        })
        .safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const ds = db.data.datasets.find((d) => d.id === params.data.id && d.orgId === request.user.orgId);
      if (!ds) throw new ApiError({ code: "NOT_FOUND", message: "Dataset not found", statusCode: 404 });
      Object.assign(ds, body.data);
      ds.updatedAt = isoNow();
      await db.persist();
      return ok(reply, request, { success: true });
    });

    app.post("/datasets/:id/upload", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const ds = db.data.datasets.find((d) => d.id === params.data.id && d.orgId === request.user.orgId);
      if (!ds) throw new ApiError({ code: "NOT_FOUND", message: "Dataset not found", statusCode: 404 });

      const parts = request.files();
      const uploaded: Array<{ id: string; filename: string; sizeBytes: number }> = [];
      for await (const part of parts) {
        if (part.type !== "file") continue;
        const filename = part.filename || `file_${nanoid(6)}`;
        const targetDir = path.join(env.STORAGE_DIR, "uploads", ds.id);
        await fs.mkdir(targetDir, { recursive: true });
        const target = path.join(targetDir, `${Date.now()}_${filename}`);
        const buf = await part.toBuffer();
        await fs.writeFile(target, buf);

        const fileId = `dsf_${nanoid(10)}`;
        db.data.datasetFiles.unshift({
          id: fileId,
          datasetId: ds.id,
          filename,
          sizeBytes: buf.byteLength,
          status: "uploaded",
          uploadedAt: isoNow(),
        });
        uploaded.push({ id: fileId, filename, sizeBytes: buf.byteLength });
      }
      ds.updatedAt = isoNow();
      await db.persist();
      return ok(reply, request, { uploaded });
    });

    app.post("/datasets/:id/validate", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "analyst");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      if (!params.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const ds = db.data.datasets.find((d) => d.id === params.data.id && d.orgId === request.user.orgId);
      if (!ds) throw new ApiError({ code: "NOT_FOUND", message: "Dataset not found", statusCode: 404 });

      const rows = Math.round(120 + Math.random() * 1800);
      const columns = Math.round(5 + Math.random() * 8);
      const missingPct = clamp(Math.random() * 6, 0, 18);
      const invalidDatePct = clamp(Math.random() * 0.7, 0, 4);
      const duplicates = Math.round(Math.random() * 4);

      const validationId = `dsv_${nanoid(10)}`;
      const columnsList = Array.from({ length: columns }).map((_, i) => `col_${i + 1}`);
      const errors = Array.from({ length: Math.round(3 + Math.random() * 12) }).map((_, i) => ({
        column: columnsList[i % columnsList.length],
        errorType: i % 3 === 0 ? "missing" : i % 3 === 1 ? "invalid_format" : "outlier",
        rowIndex: Math.round(Math.random() * rows),
        message: "Validation issue (demo).",
      }));
      const completenessByColumn = columnsList.map((c) => ({ column: c, completeness: Number(clamp(0.75 + Math.random() * 0.25, 0, 1).toFixed(3)) }));

      const validation = {
        id: validationId,
        datasetId: ds.id,
        validatedAt: isoNow(),
        summary: { rows, columns, missingPct: Number(missingPct.toFixed(1)), invalidDatePct: Number(invalidDatePct.toFixed(1)), duplicates },
        errors,
        completenessByColumn,
      };

      // Replace existing validation (demo)
      db.data.datasetValidations = db.data.datasetValidations.filter((v) => v.datasetId !== ds.id);
      db.data.datasetValidations.unshift(validation);
      ds.status = "validated";
      ds.updatedAt = isoNow();

      // Mark files validated
      for (const f of db.data.datasetFiles.filter((f) => f.datasetId === ds.id)) f.status = "validated";

      await db.persist();
      return ok(reply, request, validation);
    });

    app.post("/datasets/:id/publish", { preHandler: [app.authenticate] }, async (request, reply) => {
      requireMinRole(request, "admin");
      const params = z.object({ id: z.string() }).safeParse(request.params);
      const body = z
        .object({
          bump: z.enum(["major", "minor", "patch"]),
          releaseNotes: z.string().min(1).max(4000).optional(),
        })
        .safeParse(request.body);
      if (!params.success || !body.success) throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      const ds = db.data.datasets.find((d) => d.id === params.data.id && d.orgId === request.user.orgId);
      if (!ds) throw new ApiError({ code: "NOT_FOUND", message: "Dataset not found", statusCode: 404 });

      const nextVersion = bumpVersion(ds.version, body.data.bump);
      ds.version = nextVersion;
      ds.status = "published" satisfies DatasetStatus;
      ds.releaseNotes = body.data.releaseNotes;
      ds.updatedAt = isoNow();

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: request.user.orgId,
        userId: request.user.sub,
        userEmail: request.user.email,
        action: "dataset.publish",
        entity: "dataset",
        entityId: ds.id,
        createdAt: isoNow(),
        ip: request.ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
        payloadSnippet: safeJsonSnippet({ bump: body.data.bump, version: nextVersion }),
      });

      await db.persist();
      return ok(reply, request, { id: ds.id, version: ds.version, status: ds.status });
    });
  };
}

