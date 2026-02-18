import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/account/export
 * Returns a JSON export of the current user's data (GDPR right of access).
 * Does not include password hash or verification/reset tokens.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const [user, ledgerEntries, gamesAsWhite, gamesAsBlack, gameReports, challengesSent, challengesReceived, notifications] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          elo: true,
          balance: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.ledgerEntry.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.game.findMany({
        where: { whiteId: userId },
        select: {
          id: true,
          stake: true,
          status: true,
          winner: true,
          fen: true,
          moves: true,
          createdAt: true,
          blackId: true,
        },
      }),
      prisma.game.findMany({
        where: { blackId: userId },
        select: {
          id: true,
          stake: true,
          status: true,
          winner: true,
          fen: true,
          moves: true,
          createdAt: true,
          whiteId: true,
        },
      }),
      prisma.gameReport.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true, gameId: true, message: true, status: true, createdAt: true },
      }),
      prisma.gameChallenge.findMany({
        where: { challengerId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          challengedId: true,
          initialStakeCents: true,
          currentStakeCents: true,
          status: true,
          gameId: true,
          createdAt: true,
        },
      }),
      prisma.gameChallenge.findMany({
        where: { challengedId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          challengerId: true,
          initialStakeCents: true,
          currentStakeCents: true,
          status: true,
          gameId: true,
          createdAt: true,
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, message: true, read: true, linkUrl: true, createdAt: true },
      }),
    ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const gamesAsWhiteExport = gamesAsWhite.map((g) => ({
    id: g.id,
    role: "white",
    opponentId: g.blackId,
    stake: g.stake,
    status: g.status,
    winner: g.winner,
    fen: g.fen,
    moves: g.moves,
    createdAt: g.createdAt.toISOString(),
  }));
  const gamesAsBlackExport = gamesAsBlack.map((g) => ({
    id: g.id,
    role: "black",
    opponentId: g.whiteId,
    stake: g.stake,
    status: g.status,
    winner: g.winner,
    fen: g.fen,
    moves: g.moves,
    createdAt: g.createdAt.toISOString(),
  }));

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    ledgerEntries: ledgerEntries.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    games: [...gamesAsWhiteExport, ...gamesAsBlackExport].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
    gameReports: gameReports.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    challengesSent: challengesSent.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    challengesReceived: challengesReceived.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    notifications: notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="fairmate-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
