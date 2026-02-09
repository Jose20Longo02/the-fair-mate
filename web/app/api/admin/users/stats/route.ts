import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [totalUsers, totalGames, usersWithGameLast7Days] = await Promise.all([
    prisma.user.count(),
    prisma.game.count(),
    prisma.game.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { whiteId: true, blackId: true },
    }),
  ]);

  const uniqueActiveUserIds = new Set<string>();
  usersWithGameLast7Days.forEach((g) => {
    uniqueActiveUserIds.add(g.whiteId);
    uniqueActiveUserIds.add(g.blackId);
  });
  const activeLast7Days = uniqueActiveUserIds.size;
  const returnRatePct = totalUsers > 0 ? Math.round((activeLast7Days / totalUsers) * 100) : 0;
  const avgGamesPerUser = totalUsers > 0 ? (totalGames / totalUsers).toFixed(1) : "0";

  return NextResponse.json({
    totalUsers,
    totalGames,
    activeLast7Days,
    returnRatePct,
    avgGamesPerUser,
  });
}
