import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deductStakesForGame } from "@/lib/ledger";
import { logger } from "@/lib/logger";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Internal API for matchmaking: creates a game between two players.
 * Only callable by the WS server (X-Matchmaking-Secret header).
 * Validates balance and deducts stakes on creation.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  try {
    const body = await request.json();
    const { player1Id, player2Id, stake } = body as {
      player1Id?: string;
      player2Id?: string;
      stake?: number;
    };

    if (!player1Id || !player2Id || typeof stake !== "number" || stake <= 0) {
      return NextResponse.json(
        { error: "player1Id, player2Id and stake required" },
        { status: 400 }
      );
    }
    if (player1Id === player2Id) {
      return NextResponse.json({ error: "Both players must be different" }, { status: 400 });
    }

    const [p1, p2] = await Promise.all([
      prisma.user.findUnique({ where: { id: player1Id }, select: { id: true, balance: true } }),
      prisma.user.findUnique({ where: { id: player2Id }, select: { id: true, balance: true } }),
    ]);
    if (!p1 || !p2) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Validar saldo
    if (p1.balance < stake || p2.balance < stake) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Blanco/negro al azar
    const whiteId = Math.random() < 0.5 ? player1Id : player2Id;
    const blackId = whiteId === player1Id ? player2Id : player1Id;

    const game = await prisma.game.create({
      data: { whiteId, blackId, stake },
      include: {
        white: { select: { id: true, email: true, name: true, elo: true, balance: true } },
        black: { select: { id: true, email: true, name: true, elo: true, balance: true } },
      },
    });

    // Descontar stakes a ambos jugadores
    await deductStakesForGame(player1Id, player2Id, stake, game.id);

    logger.info("game_created", {
      gameId: game.id,
      whiteId: game.whiteId,
      blackId: game.blackId,
      stake,
    });

    return NextResponse.json({ game });
  } catch (e) {
    logger.error("create_game_error", { error: String(e) });
    return apiError("Error creating game", 500);
  }
}
