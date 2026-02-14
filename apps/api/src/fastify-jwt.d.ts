import "@fastify/jwt";
import type { Role } from "./types.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      orgId: string;
      role: Role;
      email: string;
      name: string;
    };
    user: {
      sub: string;
      orgId: string;
      role: Role;
      email: string;
      name: string;
    };
  }
}

