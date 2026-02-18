import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api-response";

/**
 * POST /api/account/deposit
 * Simulated deposits are disabled. Use the deposit page to add real funds (USDC on Polygon).
 */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  return apiError(
    "Simulated deposits are disabled. Go to Deposit to add real USDC from your wallet.",
    400
  );
}
