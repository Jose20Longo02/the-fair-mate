import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api-response";

const RECONNECT_WINDOW_MS = 60 * 1000; // 1 min, must match WS server

/**
 * Returns the active game (if any) where the current user is the disconnected player
 * and can still reconnect (disconnectedAt within the last 60 seconds).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const cutoff = new Date(Date.now() - RECONNECT_WINDOW_MS);
  const game = await prisma.game.findFirst({
    where: {
      status: "active",
      disconnectedUserId: session.userId,
      disconnectedAt: { not: null, gte: cutoff },
    },
    include: {
      white: { select: { id: true, name: true, email: true } },
      black: { select: { id: true, name: true, email: true } },
    },
  });

  if (!game) {
    return NextResponse.json({ game: null, canReconnect: false });
  }

  const opponent = game.whiteId === session.userId ? game.black : game.white;
  return NextResponse.json({
    game: {
      id: game.id,
      stake: game.stake,
      opponentName: opponent.name || opponent.email.split("@")[0],
    },
    canReconnect: true,
  });
}
