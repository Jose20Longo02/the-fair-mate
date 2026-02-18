import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [totalUsers, totalGames, gamesToday, gamesThisWeek, activeGames, depositsToday, withdrawalsToday] =
    await Promise.all([
      prisma.user.count(),
      prisma.game.count(),
      prisma.game.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.game.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.game.count({ where: { status: "active" } }),
      prisma.ledgerEntry.aggregate({
        where: { type: "deposit", createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { type: "withdrawal", createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
    ]);

  const depositsTodayCents = depositsToday._sum.amount ?? 0;
  const withdrawalsTodayCents = Math.abs(withdrawalsToday._sum.amount ?? 0);

  const gamesByStatus = await prisma.game.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const statusCounts = Object.fromEntries(
    gamesByStatus.map((g) => [g.status, g._count.id])
  );

  const gamesWithWinner = await prisma.game.findMany({
    where: { winner: { not: null } },
    select: { stake: true },
  });
  const totalVolumeCents = gamesWithWinner.reduce((sum, g) => sum + g.stake * 2, 0);
  const totalCommissionCents = gamesWithWinner.reduce(
    (sum, g) => sum + Math.floor(g.stake * 2 * PLATFORM_FEE_PERCENT),
    0
  );

  const failedSettlementsCount = await prisma.game.count({
    where: { settlementStatus: "failed", winner: { not: null } },
  });

  return NextResponse.json({
    totalUsers,
    totalGames,
    gamesToday,
    gamesThisWeek,
    activeGames,
    statusCounts,
    totalVolumeCents,
    totalCommissionCents,
    failedSettlementsCount,
    depositsTodayCents,
    withdrawalsTodayCents,
  });
}
