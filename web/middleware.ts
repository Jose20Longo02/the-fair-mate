import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth-middleware";
import { hasAdminSessionFromCookieHeader } from "@/lib/admin-auth";

const PROTECTED_PATHS = ["/account", "/game", "/play"];
const ADMIN_PATH = "/admin";

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function csrfReject() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function withResponseTime(response: NextResponse, startMs: number): NextResponse {
  response.headers.set("X-Response-Time", `${Date.now() - startMs}ms`);
  return response;
}

export async function middleware(request: NextRequest) {
  const startMs = Date.now();
  const { pathname } = request.nextUrl;

  // CSRF: reject mutating requests from another origin (Origin header must match host when present)
  if (MUTATING_METHODS.includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return withResponseTime(csrfReject(), startMs);
        }
      } catch {
        return withResponseTime(csrfReject(), startMs);
      }
    }
  }

  // Admin: only /admin and /admin/* (except /admin/login) require admin session
  if (pathname === ADMIN_PATH || (pathname.startsWith(ADMIN_PATH + "/") && pathname !== "/admin/login")) {
    const cookieHeader = request.headers.get("cookie");
    const isAdmin = await hasAdminSessionFromCookieHeader(cookieHeader);
    if (!isAdmin) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("from", pathname);
      return withResponseTime(NextResponse.redirect(url), startMs);
    }
    return withResponseTime(NextResponse.next(), startMs);
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return withResponseTime(NextResponse.next(), startMs);

  const cookieHeader = request.headers.get("cookie");
  const valid = await hasValidSession(cookieHeader);

  if (!valid) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return withResponseTime(NextResponse.redirect(url), startMs);
  }

  return withResponseTime(NextResponse.next(), startMs);
}
