import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { opponentId, stake } = body as { opponentId?: string; stake?: number };

    if (!opponentId || typeof opponentId !== "string") {
      return NextResponse.json({ error: "opponentId required" }, { status: 400 });
    }
    if (typeof stake !== "number" || stake <= 0) {
      return NextResponse.json({ error: "Invalid stake" }, { status: 400 });
    }

    // Verificar que el oponente existe
    const opponent = await prisma.user.findUnique({ where: { id: opponentId } });
    if (!opponent) {
      return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
    }

    // Crear partida (el creador es blancas, oponente negras)
    const game = await prisma.game.create({
      data: {
        whiteId: session.userId,
        blackId: opponentId,
        stake,
      },
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    logger.info("game_created_test", { gameId: game.id, whiteId: session.userId, blackId: opponentId, stake });
    return NextResponse.json({ game });
  } catch (e) {
    logger.error("create_game_error", { error: String(e) });
    return NextResponse.json({ error: "Error creating game" }, { status: 500 });
  }
}
