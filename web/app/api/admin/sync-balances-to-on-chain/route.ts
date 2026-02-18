import { NextResponse } from "next/server";
import { hasAdminSession, getAdminSecret } from "@/lib/admin-auth";
import { syncBalancesToOnChain } from "@/lib/sync-balances-to-on-chain";

const DEFAULT_NETWORK = "polygon";

/**
 * Syncs all users' DB balance to match on-chain USDC in their deposit wallet.
 * Auth: admin session or Authorization: Bearer ADMIN_SECRET.
 */
export async function POST(request: Request) {
  const adminOk = await hasAdminSession();
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const secretOk = bearer && bearer === getAdminSecret();
  if (!adminOk && !secretOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const network =
    (request.headers.get("X-Sync-Network") || process.env.SETTLEMENT_NETWORK || DEFAULT_NETWORK).trim();

  const result = await syncBalancesToOnChain(network);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
