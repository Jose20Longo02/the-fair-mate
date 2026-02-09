import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addLedgerEntry, updateUserBalance } from "@/lib/ledger";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { apiError, unauthorized, tooManyRequests } from "@/lib/api-response";
import { DEPOSIT_CENTS, RATE_DEPOSITS_PER_MIN, RATE_WINDOW_MS } from "@/lib/config";

/**
 * POST /api/account/deposit
 * Adds simulated balance to the current user (amount from config).
 */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  const rateKey = `deposit:${session.userId}`;
  const rate = checkRateLimit(rateKey, RATE_DEPOSITS_PER_MIN, RATE_WINDOW_MS);
  if (!rate.ok) {
    return tooManyRequests(
      `Too many deposits. Try again in ${rate.retryAfter}s.`,
      rate.retryAfter
    );
  }

  const depositAmount = DEPOSIT_CENTS;

  try {
    await updateUserBalance(session.userId, depositAmount);
    await addLedgerEntry(
      session.userId,
      depositAmount,
      "deposit",
      undefined,
      "Simulated deposit +$10"
    );

    logger.info("deposit", { userId: session.userId, amount: depositAmount });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { balance: true },
    });

    return NextResponse.json({ success: true, balance: user?.balance });
  } catch (e) {
    logger.error("deposit_error", { userId: session?.userId, error: String(e) });
    return apiError("Deposit failed", 500);
  }
}
