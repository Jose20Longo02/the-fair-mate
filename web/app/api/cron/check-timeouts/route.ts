import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { logger } from "@/lib/logger";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

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

        await prisma.game.update({
          where: { id: game.id },
          data: { status: "timeout", winner: winnerId },
        });

        await settleGame(game.id, winnerId, loserId, game.stake);

        const winnerElo = winnerId === game.whiteId ? game.white.elo : game.black.elo;
        const loserElo = loserId === game.whiteId ? game.white.elo : game.black.elo;
        const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);

        await Promise.all([
          prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
          prisma.user.update({ where: { id: loserId }, data: { elo: loserNew } }),
        ]);

        const whiteEloAfter = winnerId === game.whiteId ? winnerNew : loserNew;
        const blackEloAfter = winnerId === game.blackId ? winnerNew : loserNew;

        await prisma.game.update({
          where: { id: game.id },
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
            eloWhiteDelta:
              winnerId === game.whiteId ? winnerNew - game.white.elo : loserNew - game.white.elo,
            eloBlackDelta:
              winnerId === game.blackId ? winnerNew - game.black.elo : loserNew - game.black.elo,
            isDraw: false,
          };
          broadcastGameUpdate({ gameId: game.id, game: updatedGame, gameOver });
        }
      }
    }

    return NextResponse.json({ ok: true, checked: activeGames.length });
  } catch (e) {
    logger.error("check_timeouts_error", { error: String(e) });
    return apiError("Check failed", 500);
  }
}
