import { z } from "zod";

/**
 * Environment. Parsed once at boot so a misconfigured service fails loudly
 * here rather than on the first request.
 */
const Env = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM: z.string().default("Vessel <crew@mail.vessel.wtf>"),
  ADMIN_KEY: z.string().default(""),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGINS: z.string().default(""),
  IP_HASH_SALT: z.string().default(""),
  NODE_ENV: z.string().default("production"),
  LOG_LEVEL: z.string().default("info"),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  // Print the failing keys only — never the values.
  const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  console.error(`[config] invalid environment: ${keys}`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  databaseUrl: env.DATABASE_URL,
  resendApiKey: env.RESEND_API_KEY,
  resendFrom: env.RESEND_FROM,
  adminKey: env.ADMIN_KEY,
  port: env.PORT,
  ipHashSalt: env.IP_HASH_SALT,
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,

  /** Exact-match allowlist. Empty entries are dropped. */
  corsOrigins: env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  get resendConfigured(): boolean {
    return this.resendApiKey.length > 0;
  },
} as const;

export type Config = typeof config;
