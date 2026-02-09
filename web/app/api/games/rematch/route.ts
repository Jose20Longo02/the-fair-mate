import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deductStakesForGame } from "@/lib/ledger";
import { logger } from "@/lib/logger";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Creates a new game with the same two players and stake as a finished game (rematch).
 * Only callable by the WS server (X-Matchmaking-Secret).
 */
export async function POST(request: Request) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  try {
    const body = await request.json();
    const { gameId: previousGameId } = body as { gameId?: string };

    if (!previousGameId) {
      return NextResponse.json({ error: "gameId required" }, { status: 400 });
    }

    const previousGame = await prisma.game.findUnique({
      where: { id: previousGameId },
      select: { whiteId: true, blackId: true, stake: true, status: true },
    });

    if (!previousGame) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (previousGame.status === "active") {
      return NextResponse.json({ error: "Game is still active" }, { status: 400 });
    }

    const { whiteId: w, blackId: b, stake } = previousGame;
    const [p1, p2] = await Promise.all([
      prisma.user.findUnique({ where: { id: w }, select: { id: true, balance: true } }),
      prisma.user.findUnique({ where: { id: b }, select: { id: true, balance: true } }),
    ]);
    if (!p1 || !p2) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    if (p1.balance < stake || p2.balance < stake) {
      return NextResponse.json({ error: "Insufficient balance for rematch" }, { status: 400 });
    }

    const whiteId = Math.random() < 0.5 ? w : b;
    const blackId = whiteId === w ? b : w;

    const game = await prisma.game.create({
      data: { whiteId, blackId, stake },
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    await deductStakesForGame(w, b, stake, game.id);

    logger.info("game_rematch", {
      previousGameId,
      newGameId: game.id,
      whiteId: game.whiteId,
      blackId: game.blackId,
      stake,
    });

    return NextResponse.json({ game });
  } catch (e) {
    logger.error("rematch_error", { error: String(e) });
    return apiError("Error creating rematch", 500);
  }
}
