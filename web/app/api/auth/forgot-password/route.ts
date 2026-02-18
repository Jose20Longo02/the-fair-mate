import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { generateResetToken, sendPasswordResetEmail } from "@/lib/email";

const LIMIT = 3;
const WINDOW_MS = 60_000 * 5; // 3 requests per 5 minutes

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  const rate = await checkRateLimit(`forgot-password:${clientKey}`, LIMIT, WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rate.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  try {
    const { email } = (await request.json()) as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message: "If an account with that email exists, we sent a password reset link.",
    });

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) {
      console.log("[FORGOT-PASSWORD] No user found for email:", emailNorm);
      return successResponse;
    }
    console.log("[FORGOT-PASSWORD] User found:", user.id, "email:", user.email);

    const resetToken = generateResetToken();
    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiresAt },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const result = await sendPasswordResetEmail(user.email, resetUrl);
    if (!result.success) {
      logger.error("password_reset_email_failed", { userId: user.id, error: result.error });
    } else {
      logger.info("password_reset_email_sent", { userId: user.id });
    }

    return successResponse;
  } catch (e) {
    logger.error("forgot_password_error", { error: String(e) });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
