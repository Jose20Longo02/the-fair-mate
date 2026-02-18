import { NextResponse } from "next/server";
import { MATCHMAKING_SECRET, CRON_SECRET } from "@/lib/config";
import { syncBalancesToOnChain } from "@/lib/sync-balances-to-on-chain";

const DEFAULT_NETWORK = process.env.SETTLEMENT_NETWORK || "polygon";

/**
 * Cron: syncs all users' DB balance to on-chain USDC (source of truth).
 * Run every 5–15 min so app balance always matches wallet balance.
 * Auth: X-Matchmaking-Secret or Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const headerSecret = request.headers.get("X-Matchmaking-Secret");
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const ok =
    headerSecret === MATCHMAKING_SECRET || (CRON_SECRET && bearer === CRON_SECRET);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const network =
    (request.headers.get("X-Sync-Network") || DEFAULT_NETWORK).trim();

  const result = await syncBalancesToOnChain(network);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
