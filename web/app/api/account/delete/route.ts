import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, getCookieName, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/account/delete
 * Anonymizes the current user's account (GDPR right to erasure).
 * Removes PII (email, name, avatar, password); keeps id for referential integrity of games/ledger.
 * Clears session cookie so the user is logged out.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, balance: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Optional: prevent delete if balance > 0 so they withdraw first (policy decision)
  if (user.balance > 0) {
    return NextResponse.json(
      { error: "Withdraw your balance before deleting your account." },
      { status: 400 }
    );
  }

  const anonymizedEmail = `deleted-${userId}@deleted.local`;
  const randomPasswordHash = await bcrypt.hash(
    `deleted-${userId}-${Date.now()}-${Math.random().toString(36)}`,
    12
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: anonymizedEmail,
      name: null,
      avatar: null,
      passwordHash: randomPasswordHash,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      resetToken: null,
      resetTokenExpiresAt: null,
      emailVerified: false,
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return res;
}
