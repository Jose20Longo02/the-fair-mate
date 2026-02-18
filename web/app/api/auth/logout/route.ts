import { NextResponse } from "next/server";
import { getCookieName, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}
