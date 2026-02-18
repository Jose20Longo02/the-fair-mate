import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateVerificationCode, sendVerificationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limit: max 3 resends per 5 minutes
  const rateKey = `resend-code:${session.userId}`;
  const rate = await checkRateLimit(rateKey, 3, 5 * 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rate.retryAfter} seconds.` },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, emailVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: "Email already verified." });
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: session.userId },
    data: { verificationCode: code, verificationCodeExpiresAt: expiresAt },
  });

  const result = await sendVerificationEmail(user.email, code);
  if (!result.success) {
    logger.error("resend_verification_email_failed", { userId: session.userId, error: result.error });
    return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
  }

  logger.info("verification_code_resent", { userId: session.userId });
  return NextResponse.json({ message: "Verification code sent." });
}
