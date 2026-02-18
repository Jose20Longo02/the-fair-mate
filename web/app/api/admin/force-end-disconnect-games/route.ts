import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { hasAdminSession, getAdminSecret } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

const DISCONNECT_FORFEIT_MS = 60 * 1000;

/**
 * Encuentra partidas "atascadas": activas con desconexión registrada hace > 60s.
 * Las marca como terminadas (disconnected), actualiza ledger/ELO si aún no se hizo, y hace broadcast.
 * NO ejecuta on-chain (por si ya se ejecutó y falló después). Útil cuando el dinero ya se movió pero el juego no se marcó como terminado.
 * Auth: sesión admin o Authorization: Bearer ADMIN_SECRET.
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
    const cutoff = new Date(Date.now() - DISCONNECT_FORFEIT_MS);
    const stuck = await prisma.game.findMany({
      where: {
        status: "active",
        disconnectedUserId: { not: null },
        disconnectedAt: { not: null, lt: cutoff },
      },
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    const results: { gameId: string; action: string; error?: string }[] = [];

    for (const game of stuck) {
      const disconnectedUserId = game.disconnectedUserId!;
      const winnerId = disconnectedUserId === game.whiteId ? game.blackId : game.whiteId;

      try {
        const existingWin = await prisma.ledgerEntry.findFirst({
          where: { gameId: game.id, userId: winnerId, type: "win" },
        });

        await prisma.game.update({
          where: { id: game.id },
          data: {
            status: "disconnected",
            winner: winnerId,
            disconnectedUserId: null,
            disconnectedAt: null,
          },
        });

        if (!existingWin) {
          await settleGame(game.id, winnerId, disconnectedUserId, game.stake);
          results.push({ gameId: game.id, action: "ended_and_settled" });
        } else {
          results.push({ gameId: game.id, action: "ended_only" });
        }

        const whiteElo = game.white.elo;
        const blackElo = game.black.elo;
        let whiteEloAfter = whiteElo;
        let blackEloAfter = blackElo;
        let eloWhiteDelta = 0;
        let eloBlackDelta = 0;
        if (!game.createdViaChallenge) {
          const winnerElo = winnerId === game.whiteId ? whiteElo : blackElo;
          const loserElo = disconnectedUserId === game.whiteId ? whiteElo : blackElo;
          const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);
          await Promise.all([
            prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
            prisma.user.update({ where: { id: disconnectedUserId }, data: { elo: loserNew } }),
          ]);
          whiteEloAfter = winnerId === game.whiteId ? winnerNew : loserNew;
          blackEloAfter = winnerId === game.blackId ? winnerNew : loserNew;
          eloWhiteDelta = winnerId === game.whiteId ? winnerNew - whiteElo : loserNew - whiteElo;
          eloBlackDelta = winnerId === game.blackId ? winnerNew - blackElo : loserNew - blackElo;
        }

        const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
          getUserBalance(game.whiteId),
          getUserBalance(game.blackId),
        ]);
        const stake = game.stake;
        const whiteBalanceBefore = whiteBalanceNow + stake;
        const blackBalanceBefore = blackBalanceNow + stake;

        await prisma.game.update({
          where: { id: game.id },
          data: {
            whiteEloBefore: whiteElo,
            blackEloBefore: blackElo,
            whiteEloAfter,
            blackEloAfter,
            whiteBalanceBeforeCents: whiteBalanceBefore,
            blackBalanceBeforeCents: blackBalanceBefore,
          },
        });

        const updatedGame = await prisma.game.findUnique({
          where: { id: game.id },
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
        broadcastGameUpdate({ gameId: game.id, game: updatedGame ?? undefined, gameOver });

        logger.info("force_end_disconnect_game", {
          gameId: game.id,
          disconnectedUserId,
          winnerId,
          settled: !existingWin,
        });
      } catch (e) {
        logger.error("force_end_disconnect_game_error", { gameId: game.id, error: String(e) });
        results.push({ gameId: game.id, action: "error", error: String(e) });
      }
    }

    return NextResponse.json({
      ok: true,
      found: stuck.length,
      results,
    });
  } catch (e) {
    logger.error("force_end_disconnect_games_error", { error: String(e) });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
