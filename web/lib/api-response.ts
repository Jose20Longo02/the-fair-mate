/**
 * Consistent API response helpers.
 * All error responses use { error: string }; success responses use explicit payloads.
 * Makes it easier to handle errors on the client and to audit responses.
 */

import { NextResponse } from "next/server";

/** Standard error response. Always use status 4xx/5xx and body { error }. */
export function apiError(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Standard success response. Use for 200 with optional data. */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

/** 401 Unauthorized (not authenticated). */
export function unauthorized(message: string = "Not authenticated"): NextResponse {
  return apiError(message, 401);
}

/** 403 Forbidden (authenticated but not allowed). */
export function forbidden(message: string = "Unauthorized"): NextResponse {
  return apiError(message, 403);
}

/** 404 Not found. */
export function notFound(message: string = "Not found"): NextResponse {
  return apiError(message, 404);
}

/** 429 Too many requests. Optionally set Retry-After header. */
export function tooManyRequests(
  message: string,
  retryAfterSeconds?: number
): NextResponse {
  const headers: HeadersInit = {};
  if (retryAfterSeconds != null) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return NextResponse.json({ error: message }, { status: 429, headers });
}
