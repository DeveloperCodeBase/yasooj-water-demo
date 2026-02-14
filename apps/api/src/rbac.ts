import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Role } from "./types.js";
import { ApiError } from "./utils.js";
import { hasMinRole } from "./utils.js";

export function requireAuth(request: FastifyRequest) {
  if (!request.user?.sub) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
  }
}

export function requireMinRole(request: FastifyRequest, minRole: Role) {
  requireAuth(request);
  const role = request.user!.role;
  if (!hasMinRole(role, minRole)) {
    throw new ApiError({ code: "FORBIDDEN", message: "Forbidden", statusCode: 403 });
  }
}

export function addAuthDecorators(app: FastifyInstance) {
  // Convenience decorators usable in routes if needed.
  app.decorate("requireMinRole", function (request: FastifyRequest, minRole: Role) {
    requireMinRole(request, minRole);
  });
}

declare module "fastify" {
  interface FastifyInstance {
    requireMinRole(request: FastifyRequest, minRole: Role): void;
  }
}

