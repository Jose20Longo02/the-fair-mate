import { NextResponse } from "next/server";
import { getAdminCookieName, ADMIN_COOKIE_OPTIONS } from "@/lib/admin-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getAdminCookieName(), "", {
    ...ADMIN_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}
