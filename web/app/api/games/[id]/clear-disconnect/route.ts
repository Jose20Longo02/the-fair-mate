import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Called by WS server when a player reconnects (joinGame). Clears the persisted disconnect
 * so the cron won't apply forfeit for that game.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  const { id: gameId } = await params;
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
    if (game.disconnectedUserId !== userId) return NextResponse.json({ ok: true });

    await prisma.game.update({
      where: { id: gameId },
      data: { disconnectedUserId: null, disconnectedAt: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError("Clear disconnect failed", 500);
  }
}
