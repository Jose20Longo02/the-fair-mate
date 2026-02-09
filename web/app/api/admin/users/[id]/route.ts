import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      elo: true,
      balance: true,
      createdAt: true,
      _count: { select: { gamesAsWhite: true, gamesAsBlack: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const gamesPlayed = user._count.gamesAsWhite + user._count.gamesAsBlack;

  const [recentGames, recentLedger, reports] = await Promise.all([
    prisma.game.findMany({
      where: { OR: [{ whiteId: id }, { blackId: id }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        white: { select: { id: true, name: true, email: true } },
        black: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.ledgerEntry.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.gameReport.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        game: { select: { id: true, status: true, createdAt: true } },
      },
    }),
  ]);

  return NextResponse.json({
    user: {
      ...user,
      gamesPlayed,
      _count: undefined,
    },
    recentGames,
    recentLedger,
    reports,
  });
}
