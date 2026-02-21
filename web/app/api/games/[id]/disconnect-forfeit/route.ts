import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { executeOnChainSettlementAndUpdateGame } from "@/lib/settle-on-chain";
import { logger } from "@/lib/logger";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Called by WS server when a player has been disconnected for 1 minute.
 * That player loses; the other wins. If they reconnect before then, the timer is cleared.
 * If drawBecauseBothDisconnected: true, both were disconnected for 1 min → empate (devolución de stakes, sin on-chain).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  const { id: gameId } = await params;
  let body: { disconnectedUserId?: string; drawBecauseBothDisconnected?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const drawBecauseBothDisconnected = !!body.drawBecauseBothDisconnected;
  const disconnectedUserId: string | null = body.disconnectedUserId ?? null;
  if (!drawBecauseBothDisconnected && !disconnectedUserId) {
    return NextResponse.json({ error: "disconnectedUserId or drawBecauseBothDisconnected required" }, { status: 400 });
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
    logger.info("disconnect_forfeit_request_received", {
      gameId,
      requestedDisconnectedUserId: disconnectedUserId ?? null,
      drawBecauseBothDisconnected,
      gameStatus: game.status,
      persistedDisconnectedUserId: game.disconnectedUserId ?? null,
      persistedDisconnectedAt: game.disconnectedAt ? game.disconnectedAt.toISOString() : null,
      persistedDisconnectAgeMs: game.disconnectedAt ? Date.now() - new Date(game.disconnectedAt).getTime() : null,
    });
    if (game.status !== "active") {
      return NextResponse.json({ error: "Game not active" }, { status: 400 });
    }
    if (!drawBecauseBothDisconnected && disconnectedUserId !== game.whiteId && disconnectedUserId !== game.blackId) {
      return NextResponse.json({ error: "User not in game" }, { status: 400 });
    }

    // CRITICAL GUARD:
    // Avoid stale/disputed forfeits (e.g. timer/cron races) by requiring that DB still
    // marks this exact user as disconnected at decision time.
    if (!drawBecauseBothDisconnected) {
      if (!game.disconnectedUserId || !game.disconnectedAt) {
        logger.warn("disconnect_forfeit_rejected_no_persisted_disconnect", {
          gameId,
          requestedDisconnectedUserId: disconnectedUserId,
        });
        return NextResponse.json({ ok: false, skipped: true, reason: "Disconnect state cleared" }, { status: 409 });
      }
      if (game.disconnectedUserId !== disconnectedUserId) {
        logger.warn("disconnect_forfeit_rejected_mismatch_user", {
          gameId,
          requestedDisconnectedUserId: disconnectedUserId,
          persistedDisconnectedUserId: game.disconnectedUserId,
        });
        return NextResponse.json({ ok: false, skipped: true, reason: "Disconnect user mismatch" }, { status: 409 });
      }
    }

    if (drawBecauseBothDisconnected) {
      // Empate: ambos desconectados 1 min. Devolver stake a ambos, sin movimiento on-chain.
      const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
        getUserBalance(game.whiteId),
        getUserBalance(game.blackId),
      ]);
      const stake = game.stake;
      const whiteBalanceBefore = whiteBalanceNow + stake;
      const blackBalanceBefore = blackBalanceNow + stake;

      await prisma.game.update({
        where: { id: gameId },
        data: { status: "draw", winner: null, disconnectedUserId: null, disconnectedAt: null },
      });
      await settleGame(gameId, null, null, game.stake);

      const whiteElo = game.white.elo;
      const blackElo = game.black.elo;
      let whiteEloAfter = whiteElo;
      let blackEloAfter = blackElo;
      let eloWhiteDelta = 0;
      let eloBlackDelta = 0;
      if (!game.createdViaChallenge) {
        const higherElo = Math.max(whiteElo, blackElo);
        const lowerElo = Math.min(whiteElo, blackElo);
        const { winnerNew, loserNew } = getEloChanges(higherElo, lowerElo, true);
        whiteEloAfter = whiteElo >= blackElo ? winnerNew : loserNew;
        blackEloAfter = blackElo >= whiteElo ? winnerNew : loserNew;
        eloWhiteDelta = whiteEloAfter - whiteElo;
        eloBlackDelta = blackEloAfter - blackElo;
        await Promise.all([
          prisma.user.update({ where: { id: game.whiteId }, data: { elo: whiteEloAfter } }),
          prisma.user.update({ where: { id: game.blackId }, data: { elo: blackEloAfter } }),
        ]);
      }
      await prisma.game.updateMany({
        where: {
          id: gameId,
          whiteBalanceBeforeCents: null,
          blackBalanceBeforeCents: null,
        },
        data: {
          whiteEloBefore: whiteElo,
          blackEloBefore: blackElo,
          whiteEloAfter,
          blackEloAfter,
          whiteBalanceBeforeCents: whiteBalanceBefore,
          blackBalanceBeforeCents: blackBalanceBefore,
        },
      });

      logger.info("game_disconnect_draw_both_disconnected", { gameId, stake: game.stake });

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
        eloWhiteDelta,
        eloBlackDelta,
        isDraw: true,
      };
      broadcastGameUpdate({ gameId, game: updatedGame, gameOver });
      return NextResponse.json({ ok: true, game: updatedGame, gameOver });
    }

    if (!disconnectedUserId) {
      return NextResponse.json({ error: "disconnectedUserId required" }, { status: 400 });
    }

    const winnerId = disconnectedUserId === game.whiteId ? game.blackId : game.whiteId;

    const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
      getUserBalance(game.whiteId),
      getUserBalance(game.blackId),
    ]);
    const stake = game.stake;
    const whiteBalanceBefore = whiteBalanceNow + stake;
    const blackBalanceBefore = blackBalanceNow + stake;

    // Orden: terminar partida + ledger primero, broadcast, luego on-chain (evita partida atascada si falla on-chain).
    await prisma.game.update({
      where: { id: gameId },
      data: { status: "disconnected", winner: winnerId, disconnectedUserId: null, disconnectedAt: null },
    });

    await settleGame(gameId, winnerId, disconnectedUserId, game.stake);

    let whiteEloAfter = game.white.elo;
    let blackEloAfter = game.black.elo;
    let eloWhiteDelta = 0;
    let eloBlackDelta = 0;
    if (!game.createdViaChallenge) {
      const winnerElo = winnerId === game.whiteId ? game.white.elo : game.black.elo;
      const loserElo = disconnectedUserId === game.whiteId ? game.white.elo : game.black.elo;
      const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);
      await Promise.all([
        prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
        prisma.user.update({ where: { id: disconnectedUserId }, data: { elo: loserNew } }),
      ]);
      whiteEloAfter = winnerId === game.whiteId ? winnerNew : loserNew;
      blackEloAfter = winnerId === game.blackId ? winnerNew : loserNew;
      eloWhiteDelta = winnerId === game.whiteId ? winnerNew - game.white.elo : loserNew - game.white.elo;
      eloBlackDelta = winnerId === game.blackId ? winnerNew - game.black.elo : loserNew - game.black.elo;
    }

    await prisma.game.updateMany({
      where: {
        id: gameId,
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
      eloWhiteDelta,
      eloBlackDelta,
      isDraw: false,
    };

    broadcastGameUpdate({ gameId, game: updatedGame, gameOver });

    await executeOnChainSettlementAndUpdateGame(gameId, winnerId, disconnectedUserId, stake);

    return NextResponse.json({ ok: true, game: updatedGame, gameOver });
  } catch (e) {
    logger.error("disconnect_forfeit_error", { gameId, error: String(e) });
    return NextResponse.json({ error: "Forfeit failed" }, { status: 500 });
  }
}
