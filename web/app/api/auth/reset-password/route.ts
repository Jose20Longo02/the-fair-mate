import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MIN_PASSWORD_LENGTH = 8;
const LIMIT = 5;
const WINDOW_MS = 60_000 * 5; // 5 requests per 5 minutes

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  const rate = await checkRateLimit(`reset-password:${clientKey}`, LIMIT, WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  try {
    const { token, password } = (await request.json()) as {
      token?: string;
      password?: string;
    };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 400 });
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

    // Find user with this valid, non-expired token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear the reset token (single-use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    logger.info("password_reset_success", { userId: user.id });

    return NextResponse.json({ message: "Password updated successfully. You can now log in." });
  } catch (e) {
    logger.error("reset_password_error", { error: String(e) });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
