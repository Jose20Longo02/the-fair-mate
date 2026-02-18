import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balance: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const expiresBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.pendingDeposit.updateMany({
    where: {
      userId: session.userId,
      status: "pending",
      createdAt: { lt: expiresBefore },
    },
    data: { status: "expired", error: "Deposit was not credited within 24h" },
  });

  const pendingDepositsCount = await prisma.pendingDeposit.count({
    where: { userId: session.userId, status: "pending" },
  });

  return NextResponse.json({
    balance: user.balance,
    hasPendingDeposit: pendingDepositsCount > 0,
    pendingDepositsCount,
  });
}
