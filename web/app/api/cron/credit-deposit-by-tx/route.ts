import { NextResponse } from "next/server";
import { creditDepositByTxHash } from "@/lib/index-deposits";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * Acredita un depósito por txHash cuando el indexador no lo detecta
 * (p. ej. la dirección no coincide con el mapa por cambio de secret o usuario).
 * Auth: X-Matchmaking-Secret.
 * POST body: { "txHash": "0x...", "chainId": 137, "userId": "cuid..." | "userName": "Jose2002" } (acredita a ese usuario).
 */
export async function POST(request: Request) {
  const headerSecret = request.headers.get("X-Matchmaking-Secret");
  if (headerSecret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  let body: { txHash?: string; chainId?: number; userId?: string; userName?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const txHash = typeof body.txHash === "string" ? body.txHash.trim() : undefined;
  if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
    return apiError("txHash required (0x + 64 hex chars)", 400);
  }

  const chainId = typeof body.chainId === "number" ? body.chainId : 137;
  let userId = typeof body.userId === "string" ? body.userId.trim() || undefined : undefined;

  if (!userId && typeof body.userName === "string" && body.userName.trim()) {
    const user = await prisma.user.findFirst({
      where: { name: { equals: body.userName.trim() } },
      select: { id: true },
    });
    if (!user) return apiError("User not found for name: " + body.userName.trim(), 404);
    userId = user.id;
  }

  const result = await creditDepositByTxHash(chainId, txHash, userId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, processed: result.processed, error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({
    ok: true,
    processed: result.processed,
    error: result.error,
  });
}
