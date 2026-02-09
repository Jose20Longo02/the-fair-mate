import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, getCookieName } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isAllowedAvatar } from "@/lib/avatars";

const MIN_PASSWORD_LENGTH = 8;
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60_000; // 1 min
const ALLOWED_INITIAL_ELO = [400, 800, 1200, 1600] as const;

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  const rateKey = `register:${clientKey}`;
  const rate = checkRateLimit(rateKey, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many registrations. Try again in ${rate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const { email, password, name, avatar, initialElo: rawInitialElo } = body as {
      email?: string;
      password?: string;
      name?: string;
      avatar?: string;
      initialElo?: number;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    const emailNorm = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one letter and one number" },
        { status: 400 }
      );
    }

    if (!avatar || !isAllowedAvatar(avatar)) {
      return NextResponse.json({ error: "Please choose an avatar" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }

    const nameTrimmed = typeof name === "string" ? name.trim() : "";
    if (nameTrimmed.length >= 2) {
      const users = await prisma.user.findMany({
        where: { name: { not: null } },
        select: { name: true },
      });
      const nameTaken = users.some((u) => u.name!.toLowerCase() === nameTrimmed.toLowerCase());
      if (nameTaken) {
        return NextResponse.json({ error: "Username already taken" }, { status: 409 });
      }
    }

    const initialElo =
      typeof rawInitialElo === "number" && ALLOWED_INITIAL_ELO.includes(rawInitialElo as (typeof ALLOWED_INITIAL_ELO)[number])
        ? rawInitialElo
        : 1200;

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        name: nameTrimmed || null,
        avatar,
        elo: initialElo,
      },
    });

    const token = await createSession(user.id, user.email);
    logger.info("register_success", { userId: user.id, email: user.email });

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
    logger.error("register_error", { error: String(e) });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
