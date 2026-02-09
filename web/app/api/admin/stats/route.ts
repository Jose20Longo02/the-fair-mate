import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalUsers, totalGames, gamesToday, gamesThisWeek, activeGames] = await Promise.all([
    prisma.user.count(),
    prisma.game.count(),
    prisma.game.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.game.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.game.count({ where: { status: "active" } }),
  ]);

  const gamesByStatus = await prisma.game.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const statusCounts = Object.fromEntries(
    gamesByStatus.map((g) => [g.status, g._count.id])
  );

  return NextResponse.json({
    totalUsers,
    totalGames,
    gamesToday,
    gamesThisWeek,
    activeGames,
    statusCounts,
  });
}
