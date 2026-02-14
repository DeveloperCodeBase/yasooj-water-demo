import bcrypt from "bcryptjs";
import type { FastifyPluginAsync } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db.js";
import type { Env } from "../env.js";
import type { Session } from "../types.js";
import { ApiError, isoNow, ok, safeJsonSnippet } from "../utils.js";

type RateState = { count: number; firstAtMs: number };
const loginAttempts = new Map<string, RateState>();

function keyFor(ip: string, email: string) {
  return `${ip}::${email.toLowerCase()}`;
}

function checkRateLimit(ip: string, email: string) {
  const k = keyFor(ip, email);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const max = 5;

  const s = loginAttempts.get(k);
  if (!s) return;

  if (now - s.firstAtMs > windowMs) {
    loginAttempts.delete(k);
    return;
  }
  if (s.count >= max) {
    throw new ApiError({
      code: "RATE_LIMITED",
      message: "Too many login attempts. Please try again later.",
      statusCode: 429,
      details: [{ issue: "rate_limited" }],
    });
  }
}

function recordFailedAttempt(ip: string, email: string) {
  const k = keyFor(ip, email);
  const now = Date.now();
  const s = loginAttempts.get(k);
  if (!s) {
    loginAttempts.set(k, { count: 1, firstAtMs: now });
    return;
  }
  s.count += 1;
}

function clearAttempts(ip: string, email: string) {
  loginAttempts.delete(keyFor(ip, email));
}

function clientIp(request: { ip?: string; headers: Record<string, unknown> }) {
  const xf = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return xf || request.ip || "unknown";
}

export function authRoutes(db: Db, _env: Env): FastifyPluginAsync {
  return async function (app) {
    const LoginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      rememberMe: z.boolean().optional(),
    });

    app.post("/auth/login", async (request, reply) => {
      const body = LoginSchema.safeParse(request.body);
      if (!body.success) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          statusCode: 400,
          details: body.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
        });
      }

      const ip = clientIp({ ip: request.ip, headers: request.headers as Record<string, unknown> });
      checkRateLimit(ip, body.data.email);

      const user = db.data.users.find((u) => u.email.toLowerCase() === body.data.email.toLowerCase());
      if (!user) {
        recordFailedAttempt(ip, body.data.email);
        throw new ApiError({ code: "INVALID_CREDENTIALS", message: "Invalid credentials", statusCode: 401 });
      }

      if (user.status === "suspended") {
        throw new ApiError({ code: "USER_SUSPENDED", message: "User suspended", statusCode: 403 });
      }
      if (user.status === "locked") {
        throw new ApiError({ code: "USER_LOCKED", message: "User locked", statusCode: 403 });
      }

      const okPw = await bcrypt.compare(body.data.password, user.passwordHash);
      if (!okPw) {
        recordFailedAttempt(ip, body.data.email);
        throw new ApiError({ code: "INVALID_CREDENTIALS", message: "Invalid credentials", statusCode: 401 });
      }

      clearAttempts(ip, body.data.email);

      user.lastLoginAt = isoNow();
      const refreshToken = nanoid(48);
      const session: Session = {
        id: `sess_${nanoid(10)}`,
        orgId: user.orgId,
        userId: user.id,
        refreshToken,
        createdAt: isoNow(),
        ip,
        userAgent: String(request.headers["user-agent"] ?? ""),
      };
      db.data.sessions.unshift(session);

      db.data.auditLogs.unshift({
        id: `aud_${nanoid(10)}`,
        orgId: user.orgId,
        userId: user.id,
        userEmail: user.email,
        action: "auth.login",
        entity: "session",
        entityId: session.id,
        createdAt: isoNow(),
        ip,
        userAgent: session.userAgent,
        payloadSnippet: safeJsonSnippet({ email: user.email, rememberMe: body.data.rememberMe ?? false }),
      });

      await db.persist();

      const accessToken = await reply.jwtSign(
        {
          sub: user.id,
          orgId: user.orgId,
          role: user.role,
          email: user.email,
          name: user.name,
        },
        { expiresIn: "15m" },
      );

      return ok(reply, request, {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          orgId: user.orgId,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          language: user.language,
          theme: user.theme,
          lastLoginAt: user.lastLoginAt ?? null,
        },
      });
    });

    const RefreshSchema = z.object({ refreshToken: z.string().min(10) });
    app.post("/auth/refresh", async (request, reply) => {
      const body = RefreshSchema.safeParse(request.body);
      if (!body.success) {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      }
      const sess = db.data.sessions.find((s) => s.refreshToken === body.data.refreshToken && !s.revokedAt);
      if (!sess) {
        throw new ApiError({ code: "INVALID_REFRESH", message: "Invalid refresh token", statusCode: 401 });
      }

      const user = db.data.users.find((u) => u.id === sess.userId);
      if (!user || user.status !== "active") {
        throw new ApiError({ code: "FORBIDDEN", message: "Forbidden", statusCode: 403 });
      }

      const accessToken = await reply.jwtSign(
        {
          sub: user.id,
          orgId: user.orgId,
          role: user.role,
          email: user.email,
          name: user.name,
        },
        { expiresIn: "15m" },
      );

      return ok(reply, request, {
        accessToken,
        user: {
          id: user.id,
          orgId: user.orgId,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          language: user.language,
          theme: user.theme,
          lastLoginAt: user.lastLoginAt ?? null,
        },
      });
    });

    const LogoutSchema = z.object({ refreshToken: z.string().min(10) });
    app.post("/auth/logout", async (request, reply) => {
      const body = LogoutSchema.safeParse(request.body);
      if (!body.success) {
        throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid input", statusCode: 400 });
      }
      const sess = db.data.sessions.find((s) => s.refreshToken === body.data.refreshToken && !s.revokedAt);
      if (sess) {
        sess.revokedAt = isoNow();
        await db.persist();
      }
      return ok(reply, request, { success: true });
    });

    app.get(
      "/me",
      { preHandler: [app.authenticate] },
      async (request, reply) => {
        const me = db.data.users.find((u) => u.id === request.user.sub);
        if (!me) throw new ApiError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
        return ok(reply, request, {
          id: me.id,
          orgId: me.orgId,
          name: me.name,
          email: me.email,
          role: me.role,
          status: me.status,
          language: me.language,
          theme: me.theme,
          lastLoginAt: me.lastLoginAt ?? null,
        });
      },
    );

    app.get("/auth/demo-accounts", async (request, reply) => {
      return ok(reply, request, {
        password: "Password123!",
        accounts: db.data.users.map((u) => ({ email: u.email, role: u.role, status: u.status })),
      });
    });
  };
}

