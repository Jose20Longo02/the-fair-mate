import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { executeWithdraw } from "@/lib/withdraw";
import { apiError, unauthorized } from "@/lib/api-response";
import { SUPPORTED_NETWORK_IDS } from "@/lib/networks";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * POST /api/account/withdraw
 * Body: { amountCents: number, network: "polygon" | "base" | "ethereum" | "bsc", destinationAddress: string }
 * Withdraws USDC from user balance to the given address on the chosen network.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: { amountCents?: number; network?: string; destinationAddress?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const amountCents = typeof body.amountCents === "number" ? body.amountCents : undefined;
  const network = body.network;
  const destinationAddress =
    typeof body.destinationAddress === "string" ? body.destinationAddress.trim() : undefined;

  if (amountCents == null || amountCents <= 0) {
    return apiError("amountCents must be a positive number", 400);
  }
  if (!network || !SUPPORTED_NETWORK_IDS.includes(network)) {
    return apiError("network must be one of: " + SUPPORTED_NETWORK_IDS.join(", "), 400);
  }
  if (!destinationAddress || !ADDRESS_REGEX.test(destinationAddress)) {
    return apiError("destinationAddress must be a valid 0x address", 400);
  }

  const result = await executeWithdraw(
    session.userId,
    amountCents,
    network,
    destinationAddress
  );

  if (result.success) {
    return NextResponse.json({ success: true, txHash: result.txHash });
  }
  if (result.error === "Insufficient balance") {
    return apiError(result.error, 400);
  }
  return apiError(result.error || "Withdrawal failed", 500);
}
