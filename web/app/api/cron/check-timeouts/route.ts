import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { executeOnChainSettlementAndUpdateGame } from "@/lib/settle-on-chain";
import { logger } from "@/lib/logger";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

const NEXT_API_URL = process.env.NEXT_API_URL || "http://localhost:3001";

/**
 * Checks active games for timeouts. Called by WS server every 5 seconds.
 * Protected by MATCHMAKING_SECRET.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  try {
    const activeGames = await prisma.game.findMany({
      where: { status: "active" },
      include: {
        white: { select: { elo: true } },
        black: { select: { elo: true } },
      },
    });

    const now = Date.now();
    for (const game of activeGames) {
      const turnStartedMs = new Date(game.turnStartedAt).getTime();
      const elapsed = now - turnStartedMs;
      const activeTime =
        game.turn === "w" ? game.whiteTimeRemaining : game.blackTimeRemaining;

      if (elapsed >= activeTime) {
        const loserId = game.turn === "w" ? game.whiteId : game.blackId;
        const winnerId = game.turn === "w" ? game.blackId : game.whiteId;

        const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
          getUserBalance(game.whiteId),
          getUserBalance(game.blackId),
        ]);
        const stake = game.stake;
        const whiteBalanceBefore = whiteBalanceNow + stake;
        const blackBalanceBefore = blackBalanceNow + stake;

        // Orden: terminar partida + ledger primero, broadcast, luego on-chain (evita partida atascada si falla on-chain).
        await prisma.game.update({
          where: { id: game.id },
          data: { status: "timeout", winner: winnerId },
        });

        await settleGame(game.id, winnerId, loserId, game.stake);

        let whiteEloAfter = game.white.elo;
        let blackEloAfter = game.black.elo;
        let eloWhiteDelta = 0;
        let eloBlackDelta = 0;
        if (!game.createdViaChallenge) {
          const winnerElo = winnerId === game.whiteId ? game.white.elo : game.black.elo;
          const loserElo = loserId === game.whiteId ? game.white.elo : game.black.elo;
          const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);
          await Promise.all([
            prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
            prisma.user.update({ where: { id: loserId }, data: { elo: loserNew } }),
          ]);
          whiteEloAfter = winnerId === game.whiteId ? winnerNew : loserNew;
          blackEloAfter = winnerId === game.blackId ? winnerNew : loserNew;
          eloWhiteDelta = winnerId === game.whiteId ? winnerNew - game.white.elo : loserNew - game.white.elo;
          eloBlackDelta = winnerId === game.blackId ? winnerNew - game.black.elo : loserNew - game.black.elo;
        }

        await prisma.game.updateMany({
          where: {
            id: game.id,
            whiteBalanceBeforeCents: null,
            blackBalanceBeforeCents: null,
          },
          data: {
            whiteEloBefore: game.white.elo,
            blackEloBefore: game.black.elo,
            whiteEloAfter,
            blackEloAfter,
            whiteBalanceBeforeCents: whiteBalanceBefore,
            blackBalanceBeforeCents: blackBalanceBefore,
          },
        });

        logger.info("game_timeout", {
          gameId: game.id,
          loserId,
          winnerId,
          stake: game.stake,
        });

        const updatedGame = await prisma.game.findUnique({
          where: { id: game.id },
          include: {
            white: { select: { id: true, email: true, name: true, elo: true } },
            black: { select: { id: true, email: true, name: true, elo: true } },
          },
        });
        if (updatedGame) {
          const gameOver = {
            winnerId,
            stake: game.stake,
            eloWhiteDelta,
            eloBlackDelta,
            isDraw: false,
          };
          broadcastGameUpdate({ gameId: game.id, game: updatedGame, gameOver });
        }

        await executeOnChainSettlementAndUpdateGame(game.id, winnerId, loserId, stake);
      }
    }

    // Forfeit por desconexión persistida: si el WS se reinició, el timer en memoria se pierde.
    // Partidas activas con disconnectedAt > 60s se liquidan aquí.
    const DISCONNECT_FORFEIT_MS = 60 * 1000;
    const disconnectCutoff = new Date(Date.now() - DISCONNECT_FORFEIT_MS);
    const disconnectGames = await prisma.game.findMany({
      where: {
        status: "active",
        disconnectedUserId: { not: null },
        disconnectedAt: { not: null, lt: disconnectCutoff },
      },
    });
    for (const g of disconnectGames) {
      if (!g.disconnectedUserId) continue;
      try {
        const res = await fetch(`${NEXT_API_URL}/api/games/${g.id}/disconnect-forfeit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Matchmaking-Secret": MATCHMAKING_SECRET,
          },
          body: JSON.stringify({ disconnectedUserId: g.disconnectedUserId }),
        });
        if (!res.ok) logger.error("check_timeouts_disconnect_forfeit_failed", { gameId: g.id, status: res.status });
      } catch (e) {
        logger.error("check_timeouts_disconnect_forfeit_error", { gameId: g.id, error: String(e) });
      }
    }

    return NextResponse.json({ ok: true, checked: activeGames.length });
  } catch (e) {
    logger.error("check_timeouts_error", { error: String(e) });
    return apiError("Check failed", 500);
  }
}
