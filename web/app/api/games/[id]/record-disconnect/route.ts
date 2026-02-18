import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Called by WS server when a player disconnects. Persists so cron can apply forfeit
 * even if the WS server restarts and loses the in-memory timer.
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
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (game.status !== "active") return NextResponse.json({ error: "Game not active" }, { status: 400 });
    if (disconnectedUserId !== game.whiteId && disconnectedUserId !== game.blackId) {
      return NextResponse.json({ error: "User not in game" }, { status: 400 });
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        disconnectedUserId,
        disconnectedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("Record disconnect failed", 500);
  }
}
