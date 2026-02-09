import { NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settleGame, getUserBalance } from "@/lib/ledger";
import { getEloChanges } from "@/lib/elo";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, unauthorized, forbidden } from "@/lib/api-response";
import { RATE_MOVES_PER_MIN, RATE_WINDOW_MS } from "@/lib/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const clientKey = getClientKey(request);
  const rateKey = `move:${session.userId}:${id}`;
  const rate = checkRateLimit(rateKey, RATE_MOVES_PER_MIN, RATE_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: `Too many moves. Wait ${rate.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  let body: { from?: string; to?: string; promotion?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const { from, to, promotion } = body;
  if (!from || !to) return apiError("from and to required", 400);

  try {
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return apiError("Game not found", 404);
    if (game.status !== "active") return apiError("Game has ended", 400);

    const isWhiteTurn = game.turn === "w";
    const isPlayerWhite = game.whiteId === session.userId;
    const isPlayerBlack = game.blackId === session.userId;
    if ((isWhiteTurn && !isPlayerWhite) || (!isWhiteTurn && !isPlayerBlack)) {
      return forbidden("Not your turn");
    }

    // Check if moving player has run out of time
    const now = Date.now();
    const turnStartedMs = new Date(game.turnStartedAt).getTime();
    const elapsed = now - turnStartedMs;
    const moverTimeRemaining = isWhiteTurn ? game.whiteTimeRemaining : game.blackTimeRemaining;
    if (elapsed >= moverTimeRemaining) {
      // Timeout: moving player loses
      const loserId = session.userId;
      const winnerId = loserId === game.whiteId ? game.blackId : game.whiteId;
      const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
        getUserBalance(game.whiteId),
        getUserBalance(game.blackId),
      ]);
      const stake = game.stake;
      const whiteBalanceBefore = whiteBalanceNow + stake;
      const blackBalanceBefore = blackBalanceNow + stake;
      const updatedGame = await prisma.game.update({
        where: { id },
        data: { status: "timeout", winner: winnerId },
        include: {
          white: { select: { id: true, email: true, name: true, elo: true } },
          black: { select: { id: true, email: true, name: true, elo: true } },
        },
      });
      await settleGame(id, winnerId, loserId, game.stake);
      const whiteElo = updatedGame.white.elo;
      const blackElo = updatedGame.black.elo;
      const winnerIsWhite = winnerId === game.whiteId;
      const { winnerNew, loserNew } = getEloChanges(
        winnerIsWhite ? whiteElo : blackElo,
        winnerIsWhite ? blackElo : whiteElo,
        false
      );
      await Promise.all([
        prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
        prisma.user.update({ where: { id: loserId }, data: { elo: loserNew } }),
      ]);
      const whiteEloAfter = winnerIsWhite ? winnerNew : loserNew;
      const blackEloAfter = winnerIsWhite ? loserNew : winnerNew;
      await prisma.game.update({
        where: { id },
        data: {
          whiteEloBefore: whiteElo,
          blackEloBefore: blackElo,
          whiteEloAfter,
          blackEloAfter,
          whiteBalanceBeforeCents: whiteBalanceBefore,
          blackBalanceBeforeCents: blackBalanceBefore,
        },
      });
      const gameOver = {
        winnerId,
        stake: game.stake,
        eloWhiteDelta: winnerIsWhite ? winnerNew - whiteElo : loserNew - whiteElo,
        eloBlackDelta: winnerIsWhite ? loserNew - blackElo : winnerNew - blackElo,
        isDraw: false,
      };
      const finalGame = await prisma.game.findUnique({
        where: { id },
        include: {
          white: { select: { id: true, email: true, name: true, elo: true } },
          black: { select: { id: true, email: true, name: true, elo: true } },
        },
      });
      broadcastGameUpdate({ gameId: id, game: finalGame ?? updatedGame, gameOver });
      logger.info("game_ended", { gameId: id, status: "timeout", winnerId, stake: game.stake });
      return NextResponse.json({ game: finalGame ?? updatedGame, gameOver });
    }

    // Validate move with chess.js
    const chess = new Chess(game.fen);
    const move = chess.move({ from, to, promotion });
    if (!move) return apiError("Invalid move", 400);

    // Actualizar partida
    const newFen = chess.fen();
    const newTurn = chess.turn();
    let status = game.status;
    let winner = game.winner;

    if (chess.isCheckmate()) {
      status = "checkmate";
      winner = isWhiteTurn ? game.whiteId : game.blackId;
    } else if (chess.isStalemate()) {
      status = "stalemate";
      winner = null;
    } else if (
      chess.isInsufficientMaterial() ||
      chess.isThreefoldRepetition()
    ) {
      status = "draw";
      winner = null;
    }

    // Subtract elapsed time from the player who just moved
    const newWhiteTime = isWhiteTurn
      ? Math.max(0, game.whiteTimeRemaining - elapsed)
      : game.whiteTimeRemaining;
    const newBlackTime = !isWhiteTurn
      ? Math.max(0, game.blackTimeRemaining - elapsed)
      : game.blackTimeRemaining;

    // If they ran out of time on this move (edge case: exactly at limit)
    let finalStatus = status;
    let finalWinner = winner;
    if (status === "active" && (newWhiteTime === 0 || newBlackTime === 0)) {
      finalStatus = "timeout";
      finalWinner = newWhiteTime === 0 ? game.blackId : game.whiteId;
    }

    const movesJson = (game as { moves?: string | null }).moves;
    const movesSoFar: string[] = movesJson ? JSON.parse(movesJson) : [];
    const newMoves = [...movesSoFar, move.san];

    const updatedGame = await prisma.game.update({
      where: { id },
      data: {
        fen: newFen,
        turn: newTurn,
        status: finalStatus,
        winner: finalWinner,
        whiteTimeRemaining: newWhiteTime,
        blackTimeRemaining: newBlackTime,
        turnStartedAt: new Date(),
        moves: JSON.stringify(newMoves),
      } as Record<string, unknown>,
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    let gameOver: {
      winnerId: string | null;
      stake: number;
      eloWhiteDelta: number;
      eloBlackDelta: number;
      isDraw: boolean;
    } | null = null;

    // If game ended, settle stakes and update ELO
    if (finalStatus !== "active") {
      const isDraw = finalStatus === "stalemate" || finalStatus === "draw";
      const winnerId = finalWinner;
      const loserId = winnerId === game.whiteId ? game.blackId : game.whiteId;

      const [whiteBalanceNow, blackBalanceNow] = await Promise.all([
        getUserBalance(game.whiteId),
        getUserBalance(game.blackId),
      ]);
      const stake = game.stake;
      const whiteBalanceBefore = whiteBalanceNow + stake;
      const blackBalanceBefore = blackBalanceNow + stake;

      await settleGame(id, isDraw ? null : winnerId, isDraw ? null : loserId, game.stake);

      const whiteElo = (updatedGame as { white: { elo: number }; black: { elo: number } }).white.elo;
      const blackElo = (updatedGame as { white: { elo: number }; black: { elo: number } }).black.elo;
      let eloWhiteDelta = 0;
      let eloBlackDelta = 0;
      let whiteEloAfter = whiteElo;
      let blackEloAfter = blackElo;

      if (isDraw) {
        const higherElo = Math.max(whiteElo, blackElo);
        const lowerElo = Math.min(whiteElo, blackElo);
        const { winnerNew, loserNew } = getEloChanges(higherElo, lowerElo, true);
        if (whiteElo >= blackElo) {
          eloWhiteDelta = winnerNew - whiteElo;
          eloBlackDelta = loserNew - blackElo;
          whiteEloAfter = winnerNew;
          blackEloAfter = loserNew;
        } else {
          eloWhiteDelta = loserNew - whiteElo;
          eloBlackDelta = winnerNew - blackElo;
          whiteEloAfter = loserNew;
          blackEloAfter = winnerNew;
        }
        await Promise.all([
          prisma.user.update({ where: { id: game.whiteId }, data: { elo: whiteEloAfter } }),
          prisma.user.update({ where: { id: game.blackId }, data: { elo: blackEloAfter } }),
        ]);
      } else if (winnerId) {
        const winnerIsWhite = winnerId === game.whiteId;
        const winnerElo = winnerIsWhite ? whiteElo : blackElo;
        const loserElo = winnerIsWhite ? blackElo : whiteElo;
        const { winnerNew, loserNew } = getEloChanges(winnerElo, loserElo, false);
        if (winnerIsWhite) {
          eloWhiteDelta = winnerNew - whiteElo;
          eloBlackDelta = loserNew - blackElo;
          whiteEloAfter = winnerNew;
          blackEloAfter = loserNew;
        } else {
          eloWhiteDelta = loserNew - whiteElo;
          eloBlackDelta = winnerNew - blackElo;
          whiteEloAfter = loserNew;
          blackEloAfter = winnerNew;
        }
        await Promise.all([
          prisma.user.update({ where: { id: winnerId }, data: { elo: winnerNew } }),
          prisma.user.update({ where: { id: loserId }, data: { elo: loserNew } }),
        ]);
      }

      await prisma.game.update({
        where: { id },
        data: {
          whiteEloBefore: whiteElo,
          blackEloBefore: blackElo,
          whiteEloAfter,
          blackEloAfter,
          whiteBalanceBeforeCents: whiteBalanceBefore,
          blackBalanceBeforeCents: blackBalanceBefore,
        },
      });

      gameOver = { winnerId, stake: game.stake, eloWhiteDelta, eloBlackDelta, isDraw };

      logger.info("game_ended", {
        gameId: id,
        status: finalStatus,
        winnerId,
        stake: game.stake,
      });
    }

    const gameToReturn =
      finalStatus !== "active"
        ? await prisma.game.findUnique({
            where: { id },
            include: {
              white: { select: { id: true, email: true, name: true, elo: true } },
              black: { select: { id: true, email: true, name: true, elo: true } },
            },
          })
        : updatedGame;

    broadcastGameUpdate({ gameId: id, game: gameToReturn ?? updatedGame, gameOver });
    return NextResponse.json({ game: gameToReturn ?? updatedGame, move, gameOver });
  } catch (e) {
    logger.error("move_error", { gameId: id, error: String(e) });
    return apiError("Error processing move", 500);
  }
}
