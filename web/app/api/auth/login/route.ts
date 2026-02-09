import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, getCookieName } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 60_000; // 1 min

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  const rateKey = `login:${clientKey}`;
  const rate = checkRateLimit(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const emailNorm = email.trim().toLowerCase();

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSession(user.id, user.email);
    logger.info("login_success", { userId: user.id, email: user.email });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, elo: user.elo },
    });
    res.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    logger.error("login_error", { error: String(e) });
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
