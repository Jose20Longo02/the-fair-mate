/**
 * Central config: env and business constants.
 * Single place for stakes limits, WS URL, and rate limits — easier to audit and change.
 */

/** WebSocket server base URL (used for broadcast, notify, etc.). */
export const WS_SERVER_URL =
  process.env.WS_SERVER_URL ?? "http://localhost:3002";

/** Secret for server-to-server calls (matchmaking, cron, disconnect-forfeit). */
export { MATCHMAKING_SECRET } from "./env";

/** Optional: for Vercel Cron, same value sent as Bearer token. Set CRON_SECRET = MATCHMAKING_SECRET in Vercel. */
export const CRON_SECRET = process.env.CRON_SECRET ?? "";

// --- Stakes (cents) ---
/** Minimum stake per game/challenge: $1. */
export const STAKE_CENTS_MIN = 100;
/** Maximum stake per game/challenge: $1000. */
export const STAKE_CENTS_MAX = 100_000;
/** Simulated deposit amount: $10. */
export const DEPOSIT_CENTS = 1000;

// --- Rate limits (for reference; actual values in route handlers) ---
/** Moves per minute per user per game (blitz pace). */
export const RATE_MOVES_PER_MIN = 120;
/** Simulated deposits per minute per user. */
export const RATE_DEPOSITS_PER_MIN = 10;
/** Rate limit window in ms. */
export const RATE_WINDOW_MS = 60_000;
