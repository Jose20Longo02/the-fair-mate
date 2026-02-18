/**
 * Rate limiter: Upstash Redis when configured (multi-instance / serverless),
 * otherwise in-memory (single instance only — document this limitation).
 */

type Entry = { count: number; resetAt: number };
const memoryStore = new Map<string, Entry>();

// Clean old entries periodically (in-memory only)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}, 60_000);

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number };

function windowMsToUpstash(windowMs: number): string {
  if (windowMs >= 60_000) {
    const min = Math.round(windowMs / 60_000);
    return min >= 60 ? `${Math.round(min / 60)} h` : `${min} m`;
  }
  const sec = Math.round(windowMs / 1000);
  return `${sec} s`;
}

let upstashRedis: import("@upstash/redis").Redis | null = null;
const upstashLimiters = new Map<string, import("@upstash/ratelimit").Ratelimit>();

function getUpstashRedis(): import("@upstash/redis").Redis | null {
  if (upstashRedis !== null) return upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = require("@upstash/redis");
    upstashRedis = new Redis({ url, token });
    if (process.env.NODE_ENV !== "test") {
      console.log("[rate-limit] Using Upstash Redis (distributed)");
    }
    return upstashRedis;
  } catch {
    return null;
  }
}

function getUpstashLimiter(limit: number, windowMs: number): import("@upstash/ratelimit").Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  const key = `${limit}:${windowMs}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    const { Ratelimit } = require("@upstash/ratelimit");
    const window = windowMsToUpstash(windowMs);
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: "rl",
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

/** In-memory fixed-window rate limit (single instance only). */
function checkRateLimitMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, entry);
    return { ok: true };
  }

  entry.count++;
  if (entry.count > limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

/**
 * Check rate limit. Uses Upstash Redis when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set (multi-instance); otherwise in-memory
 * (only valid for a single process — see docs).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(limit, windowMs);
  if (limiter) {
    const res = await limiter.limit(key);
    if (res.success) return { ok: true };
    const retryAfter = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return { ok: false, retryAfter };
  }
  return checkRateLimitMemory(key, limit, windowMs);
}

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  return ip;
}
