/**
 * Validates required environment variables at startup (first import of this module or env.ts).
 * Uses zod so missing or invalid vars cause an immediate throw instead of failing at runtime.
 */

import { z } from "zod";

const isTest = process.env.NODE_ENV === "test";

const envSchema = z
  .object({
    DATABASE_URL: isTest
      ? z.string().optional().default("postgresql://localhost:5432/test")
      : z.string().min(1, "DATABASE_URL is required"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    ADMIN_SECRET: z.string().min(16, "ADMIN_SECRET must be at least 16 characters"),
    MATCHMAKING_SECRET: z.string().min(16, "MATCHMAKING_SECRET must be at least 16 characters"),
    TREASURY_PRIVATE_KEY: z
      .string()
      .optional()
      .refine((v) => !v || v.length >= 64, "TREASURY_PRIVATE_KEY must be at least 64 characters when set"),
  });

export type ValidatedEnv = z.infer<typeof envSchema>;

let cached: ValidatedEnv | null = null;

/**
 * Validates process.env against the schema. Call once at startup (e.g. from env.ts).
 * In test, DATABASE_URL may be omitted (defaults to placeholder).
 */
export function validateEnv(): ValidatedEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const first = parsed.error.flatten();
    const message =
      typeof first.formErrors?.[0] === "string"
        ? first.formErrors[0]
        : Object.entries(first.fieldErrors)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("; ");
    throw new Error(`Environment validation failed: ${message}`);
  }
  cached = parsed.data;
  return cached;
}
