import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, apiSuccess, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: gameId } = await params;
  let body: { accept?: boolean };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const accept = body.accept === true;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, elo: true, name: true, email: true } },
        black: { select: { id: true, elo: true, name: true, email: true } },
      },
    });

    if (!game) return notFound("Game not found");
    if (game.status !== "active") return apiError("Game not active", 400);
    if (game.whiteId !== session.userId && game.blackId !== session.userId) return forbidden();
    if (!game.drawOfferBy) return apiError("No draw offer", 400);
    if (game.drawOfferBy === session.userId) {
      return apiError("You cannot respond to your own draw offer", 400);
    }

    if (accept) {
      const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
        getUserBalance(game.whiteId),
        getUserBalance(game.blackId),
      ]);
      const stake = game.stake;
      const whiteBalanceBefore = whiteBalanceNow + stake;
      const blackBalanceBefore = blackBalanceNow + stake;

      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "draw",
          winner: null,
          drawOfferBy: null,
          chatStatus: null,
          chatInitiatedBy: null,
        },
      });

      await settleGame(gameId, null, null, game.stake);

      await prisma.game.updateMany({
        where: {
          id: gameId,
          whiteBalanceBeforeCents: null,
          blackBalanceBeforeCents: null,
        },
        data: {
          whiteEloBefore: game.white.elo,
          blackEloBefore: game.black.elo,
          whiteEloAfter: game.white.elo,
          blackEloAfter: game.black.elo,
          whiteBalanceBeforeCents: whiteBalanceBefore,
          blackBalanceBeforeCents: blackBalanceBefore,
        },
      });

      const updatedGame = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          white: { select: { id: true, email: true, name: true, elo: true } },
          black: { select: { id: true, email: true, name: true, elo: true } },
        },
      });

      const gameOver = {
        winnerId: null,
        stake: game.stake,
        eloWhiteDelta: 0,
        eloBlackDelta: 0,
        isDraw: true,
      };

      broadcastGameUpdate({ gameId, game: updatedGame, gameOver });
      logger.info("game_ended", { gameId, status: "draw", stake: game.stake });
      return apiSuccess({ ok: true, game: updatedGame, gameOver });
    }

    await prisma.game.update({
      where: { id: gameId },
      data: { drawOfferBy: null },
    });
    broadcastGameUpdate({ gameId, type: "drawDeclined", declinedBy: session.userId });
    return apiSuccess({ ok: true, accepted: false });
  } catch (e) {
    logger.error("respond_draw_error", { gameId, error: String(e) });
    return apiError("Error responding to draw", 500);
  }
}
