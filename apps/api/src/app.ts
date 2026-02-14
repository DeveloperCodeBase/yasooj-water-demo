import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { nanoid } from "nanoid";
import { getEnv, type Env } from "./env.js";
import { Db } from "./db.js";
import { ApiError, fail, ok } from "./utils.js";
import { addAuthDecorators } from "./rbac.js";
import { authRoutes } from "./routes/auth.js";
import { lookupRoutes } from "./routes/lookups.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { wellRoutes } from "./routes/wells.js";
import { datasetRoutes } from "./routes/datasets.js";
import { scenarioRoutes } from "./routes/scenarios.js";
import { modelRoutes } from "./routes/models.js";
import { forecastRoutes } from "./routes/forecasts.js";
import { alertRoutes } from "./routes/alerts.js";
import { notificationRoutes } from "./routes/notifications.js";
import { reportRoutes } from "./routes/reports.js";
import { userRoutes } from "./routes/users.js";
import { settingsRoutes } from "./routes/settings.js";
import { auditRoutes } from "./routes/audit.js";
import { orgRoutes } from "./routes/orgs.js";
import { jobRoutes } from "./routes/jobs.js";
import { assistantRoutes } from "./routes/assistant.js";

export async function buildApp(opts?: { env?: Env; db?: Db; logger?: boolean }) {
  const env = opts?.env ?? getEnv();
  const db = opts?.db ?? (await Db.init(env));

  const app = Fastify({
    logger: opts?.logger ?? true,
    genReqId: () => nanoid(12),
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate("authenticate", async function (request: any, _reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      throw new ApiError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
    }
  });

  addAuthDecorators(app);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "مستندات API سامانه تصمیم‌یار آب زیرزمینی (دمو)",
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  // Important: Fastify error/not-found handlers are encapsulated.
  // Set them before registering routes so all route plugins inherit the same API response contract.
  app.setNotFoundHandler((request, reply) => {
    return fail(
      reply,
      request,
      new ApiError({
        code: "NOT_FOUND",
        message: "Route not found",
        statusCode: 404,
        details: [{ issue: "not_found" }],
      }),
    );
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof ApiError) return fail(reply, request, err);

    // Fastify validation errors
    const anyErr = err as any;
    if (anyErr?.validation) {
      return fail(
        reply,
        request,
        new ApiError({
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          statusCode: 400,
          details: (anyErr.validation as any[]).map((v) => ({ field: v.instancePath, issue: v.message })),
        }),
      );
    }

    request.log.error(err);
    return fail(
      reply,
      request,
      new ApiError({
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        statusCode: 500,
      }),
    );
  });

  app.get("/health", async (request, reply) => {
    return ok(reply, request, { ok: true });
  });

  await app.register(authRoutes(db, env));
  await app.register(lookupRoutes(db));
  await app.register(analyticsRoutes(db));
  await app.register(wellRoutes(db));
  await app.register(datasetRoutes(db, env));
  await app.register(scenarioRoutes(db));
  await app.register(modelRoutes(db));
  await app.register(forecastRoutes(db));
  await app.register(alertRoutes(db));
  await app.register(notificationRoutes(db));
  await app.register(reportRoutes(db, env));
  await app.register(userRoutes(db));
  await app.register(settingsRoutes(db, env));
  await app.register(auditRoutes(db));
  await app.register(orgRoutes(db));
  await app.register(jobRoutes(db));
  await app.register(assistantRoutes(db, env));

  return { app, env, db };
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }
}
