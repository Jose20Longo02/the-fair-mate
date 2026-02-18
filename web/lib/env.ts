/**
 * Validates required env vars at startup (first import). Uses zod schema in env-schema.ts.
 * Ensures production never runs with missing or too-short secrets.
 */

import { validateEnv } from "./env-schema";

const env = validateEnv();

/** Session signing (JWT). Min 32 chars for HS256. */
export const SESSION_SECRET = env.SESSION_SECRET;

/** Admin panel login secret. */
export const ADMIN_SECRET = env.ADMIN_SECRET;

/** Server-to-server (matchmaking, cron, WS verify). */
export const MATCHMAKING_SECRET = env.MATCHMAKING_SECRET;
