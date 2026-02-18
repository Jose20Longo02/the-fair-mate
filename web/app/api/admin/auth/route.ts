import { NextResponse } from "next/server";
import { createAdminSession, getAdminSecret, getAdminCookieName, ADMIN_COOKIE_OPTIONS } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secret = (body.secret as string)?.trim();
    const expected = getAdminSecret();

    if (!secret || secret !== expected) {
      return NextResponse.json({ error: "Invalid admin secret" }, { status: 401 });
    }

    const token = await createAdminSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(getAdminCookieName(), token, ADMIN_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
