import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const userId = searchParams.get("userId")?.trim() || undefined;
  const gameId = searchParams.get("gameId")?.trim() || undefined;
  const status = searchParams.get("status")?.trim() || undefined;
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;

  const where: {
    id?: string | { contains: string };
    status?: string;
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<{ whiteId: string } | { blackId: string }>;
  } = {};

  if (gameId) {
    where.id = { contains: gameId };
  }
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = toDate;
    }
  }
  if (userId) {
    where.OR = [{ whiteId: userId }, { blackId: userId }];
  }

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        white: { select: { id: true, email: true, name: true, elo: true } },
        black: { select: { id: true, email: true, name: true, elo: true } },
      },
    }),
    prisma.game.count({ where }),
  ]);

  return NextResponse.json({ games, total });
}
