import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "15", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const search = searchParams.get("search")?.trim() || undefined;

  const where: { OR?: Array<{ email: { contains: string } } | { name: { contains: string } | null }> } = {};
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        elo: true,
        balance: true,
        createdAt: true,
        _count: { select: { gamesAsWhite: true, gamesAsBlack: true } },
      },
    }),
    prisma.user.count({ where: Object.keys(where).length ? where : undefined }),
  ]);

  const usersWithGames = users.map((u) => ({
    ...u,
    gamesPlayed: u._count.gamesAsWhite + u._count.gamesAsBlack,
    _count: undefined,
  }));

  return NextResponse.json({ users: usersWithGames, total });
}
