import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api-response";
import { MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Internal API for matchmaking: returns a user's ELO.
 * Only callable by the WS server (X-Matchmaking-Secret header).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) return unauthorized("Invalid matchmaking secret");

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "User id required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { elo: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ elo: user.elo });
}
