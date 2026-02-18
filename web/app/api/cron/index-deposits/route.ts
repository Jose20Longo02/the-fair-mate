import { NextResponse } from "next/server";
import { indexDeposits } from "@/lib/index-deposits";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET, CRON_SECRET } from "@/lib/config";

/**
 * Index on-chain DepositFor events and credit user balances.
 * Called by Vercel Cron every 2 min, or by external cron with X-Matchmaking-Secret.
 * Auth: X-Matchmaking-Secret header OR Authorization: Bearer <CRON_SECRET> (Vercel sends CRON_SECRET).
 */
export async function GET(request: Request) {
  const headerSecret = request.headers.get("X-Matchmaking-Secret");
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const ok =
    headerSecret === MATCHMAKING_SECRET || (CRON_SECRET && bearer === CRON_SECRET);
  if (!ok) return unauthorized("Invalid matchmaking secret");


  try {
    const result = await indexDeposits();
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      errors: result.errors.length ? result.errors : undefined,
      scanned: result.scanned,
    });
  } catch (e) {
    return apiError("Index deposits failed", 500);
  }
}
