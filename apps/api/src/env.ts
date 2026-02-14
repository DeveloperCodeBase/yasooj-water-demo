import { z } from "zod";
import path from "node:path";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  JWT_SECRET: z.string().min(16).default("dev_super_secret_change_me"),
  REFRESH_SECRET: z.string().min(16).default("dev_refresh_super_secret_change_me"),
  DB_FILE: z.string().default(path.resolve(process.cwd(), "storage/db.json")),
  STORAGE_DIR: z.string().default(path.resolve(process.cwd(), "storage")),
  // Optional project assistant configuration (LLM gateway).
  ASSISTANT_API_KEY: z.string().optional(),
  ASSISTANT_BASE_URL: z.string().url().optional(),
  ASSISTANT_MODEL: z.string().optional(),
  ASSISTANT_REFERER: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
