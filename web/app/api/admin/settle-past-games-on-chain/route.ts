import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession, getAdminSecret } from "@/lib/admin-auth";
import { executeOnChainSettlementAndUpdateGame } from "@/lib/settle-on-chain";
import { logger } from "@/lib/logger";

const ENDED_WITH_WINNER = ["checkmate", "stalemate", "resigned", "timeout", "disconnected"] as const;

/**
 * One-time backfill: run on-chain settlement for all past games that ended with a winner
 * but were settled only in DB (before we added on-chain settlement).
 * Call once from admin (browser logged in) or: curl -X POST -H "Authorization: Bearer $ADMIN_SECRET" http://localhost:3001/api/admin/settle-past-games-on-chain
 */
export async function POST(request: Request) {
  const adminOk = await hasAdminSession();
  const authHeader = request.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const secretOk = bearer && bearer === getAdminSecret();
  if (!adminOk && !secretOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const games = await prisma.game.findMany({
      where: {
        status: { in: [...ENDED_WITH_WINNER] },
        winner: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, whiteId: true, blackId: true, winner: true, stake: true },
    });

    const settled: string[] = [];
    const errors: { gameId: string; error: string }[] = [];

    for (const game of games) {
      const winnerId = game.winner!;
      const loserId = winnerId === game.whiteId ? game.blackId : game.whiteId;
      const result = await executeOnChainSettlementAndUpdateGame(game.id, winnerId, loserId, game.stake);
      if (result.ok) {
        settled.push(game.id);
        logger.info("settle_past_game_on_chain", { gameId: game.id, winnerId, loserId, stake: game.stake });
      } else {
        errors.push({ gameId: game.id, error: result.error });
      }
    }

    return NextResponse.json({
      ok: true,
      total: games.length,
      settled: settled.length,
      failed: errors.length,
      settledIds: settled,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    logger.error("settle_past_games_on_chain_error", { error: String(e) });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
