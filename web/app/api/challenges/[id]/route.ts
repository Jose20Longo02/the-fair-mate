import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGameBetweenPlayers } from "@/lib/create-game";

/** GET a single challenge (for detail). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const challenge = await prisma.gameChallenge.findUnique({
    where: { id },
    include: {
      challenger: { select: { id: true, email: true, name: true, elo: true } },
      challenged: { select: { id: true, email: true, name: true, elo: true } },
    },
  });

  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (challenge.challengerId !== session.userId && challenge.challengedId !== session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ challenge });
}
