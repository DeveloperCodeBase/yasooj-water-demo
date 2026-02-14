import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "./types.js";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  analyst: 2,
  admin: 3,
  org_admin: 4,
  super_admin: 5,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function reqMeta(request: FastifyRequest) {
  return { requestId: request.id ?? randomUUID() };
}

export function ok<T>(reply: FastifyReply, request: FastifyRequest, data: T) {
  return reply.send({ data, meta: reqMeta(request) });
}

export type ApiErrorDetails = Array<{ field?: string; issue: string; value?: unknown }>;

export class ApiError extends Error {
  public code: string;
  public statusCode: number;
  public details?: ApiErrorDetails;

  constructor(opts: { code: string; message: string; statusCode: number; details?: ApiErrorDetails }) {
    super(opts.message);
    this.code = opts.code;
    this.statusCode = opts.statusCode;
    this.details = opts.details;
  }
}

export function fail(reply: FastifyReply, request: FastifyRequest, err: ApiError) {
  return reply.status(err.statusCode).send({
    error: {
      code: err.code,
      message: err.message,
      details: err.details ?? [],
    },
    meta: reqMeta(request),
  });
}

export function safeJsonSnippet(payload: unknown, maxLen = 800): string {
  try {
    const s = JSON.stringify(payload);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "...";
  } catch {
    return "[unserializable]";
  }
}

export function parsePageParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20) || 20));
  const sort = typeof query.sort === "string" ? query.sort : "createdAt:desc";
  return { page, pageSize, sort };
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total };
}

export function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[\",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
  return s;
}

