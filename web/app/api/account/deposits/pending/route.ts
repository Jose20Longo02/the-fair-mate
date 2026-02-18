import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, unauthorized } from "@/lib/api-response";

type Body = {
  txHash?: string;
  chainId?: number;
  amountRaw?: string;
  amountCents?: number;
};

/**
 * Registers a user-intended on-chain deposit tx so UI can show
 * "Acreditando..." until the indexer credits it.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
  const chainId = typeof body.chainId === "number" ? body.chainId : NaN;
  const amountRaw = typeof body.amountRaw === "string" ? body.amountRaw.trim() : undefined;
  const amountCents = typeof body.amountCents === "number" ? body.amountCents : undefined;

  if (!/^0x[a-f0-9]{64}$/.test(txHash)) {
    return apiError("Invalid txHash", 400);
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return apiError("Invalid chainId", 400);
  }
  if (amountCents != null && (!Number.isInteger(amountCents) || amountCents <= 0)) {
    return apiError("Invalid amountCents", 400);
  }

  const pending = await prisma.pendingDeposit.upsert({
    where: { chainId_txHash: { chainId, txHash } },
    create: {
      userId: session.userId,
      chainId,
      txHash,
      amountRaw,
      amountCents,
      status: "pending",
    },
    update: {
      userId: session.userId,
      amountRaw,
      amountCents,
      // If user retries with same txHash, keep workflow resumable.
      status: "pending",
      error: null,
      creditedAt: null,
    },
    select: {
      id: true,
      chainId: true,
      txHash: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess({ pending });
}
