import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { logger } from "@/lib/logger";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Called by WS server when a player has been disconnected for 1 minute.
 * That player loses; the other wins. If they reconnect (reopen game page) before then, the timer is cleared.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  const { id: gameId } = await params;
  let body: { disconnectedUserId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const disconnectedUserId = body.disconnectedUserId;
  if (!disconnectedUserId) {
    return NextResponse.json({ error: "disconnectedUserId required" }, { status: 400 });
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { elo: true } },
        black: { select: { elo: true } },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (game.status !== "active") {
      return NextResponse.json({ error: "Game not active" }, { status: 400 });
    }
    if (disconnectedUserId !== game.whiteId && disconnectedUserId !== game.blackId) {
      return NextResponse.json({ error: "User not in game" }, { status: 400 });
    }

    const winnerId = disconnectedUserId === game.whiteId ? game.blackId : game.whiteId;

    const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
      getUserBalance(game.whiteId),
      getUserBalance(game.blackId),
    ]);
    const stake = game.stake;
    const whiteBalanceBefore = whiteBalanceNow + stake;
    const blackBalanceBefore = blackBalanceNow + stake;

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "disconnected", winner: winnerId },
    });

    await settleGame(gameId, winnerId, disconnectedUserId, game.stake);

    const winnerElo = winnerId === game.whiteId ? game.white.elo : game.black.elo;
    const loserElo = disconnectedUserId === game.whiteId ? game.white.elo : game.black.elo;
    const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);

    await Promise.all([
      prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
      prisma.user.update({ where: { id: disconnectedUserId }, data: { elo: loserNew } }),
    ]);

    const whiteEloAfter = winnerId === game.whiteId ? winnerNew : loserNew;
    const blackEloAfter = winnerId === game.blackId ? winnerNew : loserNew;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        whiteEloBefore: game.white.elo,
        blackEloBefore: game.black.elo,
        whiteEloAfter,
        blackEloAfter,
        whiteBalanceBeforeCents: whiteBalanceBefore,
        blackBalanceBeforeCents: blackBalanceBefore,
      },
    });

    logger.info("game_disconnect_forfeit", {
      gameId,
      disconnectedUserId,
      winnerId,
      stake: game.stake,
    });

    const updatedGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    const gameOver = {
      winnerId,
      stake: game.stake,
      eloWhiteDelta: winnerId === game.whiteId ? winnerNew - game.white.elo : loserNew - game.white.elo,
      eloBlackDelta: winnerId === game.blackId ? winnerNew - game.black.elo : loserNew - game.black.elo,
      isDraw: false,
    };

    broadcastGameUpdate({ gameId, game: updatedGame, gameOver });

    return NextResponse.json({ ok: true, game: updatedGame, gameOver });
  } catch (e) {
    logger.error("disconnect_forfeit_error", { gameId, error: String(e) });
    return NextResponse.json({ error: "Forfeit failed" }, { status: 500 });
  }
}
