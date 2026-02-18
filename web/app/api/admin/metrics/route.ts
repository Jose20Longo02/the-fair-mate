import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

/**
 * JSON metrics for external dashboards (Grafana JSON datasource, cron scripts, etc.).
 * Requires admin session. Returns same business metrics as /api/admin/stats plus timestamp.
 */
export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalUsers,
    totalGames,
    gamesToday,
    gamesThisWeek,
    activeGames,
    depositsToday,
    withdrawalsToday,
    gamesWithWinner,
    failedSettlementsCount,
  ] = await Promise.all([
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
    prisma.game.findMany({
      where: { winner: { not: null } },
      select: { stake: true },
    }),
    prisma.game.count({
      where: { settlementStatus: "failed", winner: { not: null } },
    }),
  ]);

  const totalVolumeCents = gamesWithWinner.reduce((sum, g) => sum + g.stake * 2, 0);
  const totalCommissionCents = gamesWithWinner.reduce(
    (sum, g) => sum + Math.floor(g.stake * 2 * PLATFORM_FEE_PERCENT),
    0
  );

  return NextResponse.json({
    ts: now.toISOString(),
    totalUsers,
    totalGames,
    gamesToday,
    gamesThisWeek,
    activeGames,
    totalVolumeCents,
    totalCommissionCents,
    depositsTodayCents: depositsToday._sum.amount ?? 0,
    withdrawalsTodayCents: Math.abs(withdrawalsToday._sum.amount ?? 0),
    failedSettlementsCount,
  });
}
