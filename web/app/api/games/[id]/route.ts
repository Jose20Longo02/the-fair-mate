import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      white: { select: { id: true, email: true, name: true, elo: true } },
      black: { select: { id: true, email: true, name: true, elo: true } },
    },
  });

  if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Solo los jugadores de la partida pueden verla (en MVP)
  if (game.whiteId !== session.userId && game.blackId !== session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Si la partida terminó, indicar si el usuario ya reportó esta partida
  let alreadyReported = false;
  if (game.status !== "active") {
    const report = await prisma.gameReport.findFirst({
      where: { gameId: id, userId: session.userId },
    });
    alreadyReported = !!report;
  }

  return NextResponse.json({
    game: { ...game, alreadyReported },
  });
}
