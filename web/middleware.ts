import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasValidSession } from "@/lib/auth-middleware";
import { hasAdminSessionFromCookieHeader } from "@/lib/admin-auth";

const PROTECTED_PATHS = ["/cuenta", "/partida", "/jugar"];
const ADMIN_PATH = "/admin";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin: only /admin and /admin/* (except /admin/login) require admin session
  if (pathname === ADMIN_PATH || (pathname.startsWith(ADMIN_PATH + "/") && pathname !== "/admin/login")) {
    const cookieHeader = request.headers.get("cookie");
    const isAdmin = await hasAdminSessionFromCookieHeader(cookieHeader);
    if (!isAdmin) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  const cookieHeader = request.headers.get("cookie");
  const valid = await hasValidSession(cookieHeader);

  if (!valid) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
