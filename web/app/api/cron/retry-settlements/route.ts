import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MATCHMAKING_SECRET, CRON_SECRET } from "@/lib/config";
import { executeOnChainSettlement } from "@/lib/settle-on-chain";
import { syncUserBalanceFromOnChain } from "@/lib/sync-balances-to-on-chain";
import { type NetworkId } from "@/lib/networks";
import { logger } from "@/lib/logger";

/**
 * Cron: retry on-chain settlement for games with settlementStatus = "failed".
 * Run every 5–15 min (e.g. after check-timeouts). Auth: X-Matchmaking-Secret or Bearer CRON_SECRET.
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

  try {
    const failed = await prisma.game.findMany({
      where: { settlementStatus: "failed", winner: { not: null } },
      select: { id: true, winner: true, whiteId: true, blackId: true, stake: true },
    });

    let retried = 0;
    let completed = 0;

    for (const game of failed) {
      const winnerId = game.winner!;
      const loserId = winnerId === game.whiteId ? game.blackId : game.whiteId;
      retried++;
      const result = await executeOnChainSettlement(winnerId, loserId, game.stake);
      if (result.ok) {
        await prisma.game.update({
          where: { id: game.id },
          data: { settlementStatus: "completed" },
        });
        const network = ((process.env.SETTLEMENT_NETWORK ?? "polygon") as NetworkId);
        try {
          await Promise.all([
            syncUserBalanceFromOnChain(winnerId, network),
            syncUserBalanceFromOnChain(loserId, network),
          ]);
        } catch (e) {
          logger.warn("retry_settlement_balance_sync_failed", {
            gameId: game.id,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        completed++;
        logger.info("retry_settlement_success", { gameId: game.id });
      } else {
        logger.warn("retry_settlement_still_failed", { gameId: game.id, error: result.error });
      }
    }

    return NextResponse.json({
      ok: true,
      failedCount: failed.length,
      retried,
      completed,
    });
  } catch (e) {
    logger.error("retry_settlements_error", { error: String(e) });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
