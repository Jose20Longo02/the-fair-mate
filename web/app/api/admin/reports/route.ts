import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() || undefined;

  const reports = await prisma.gameReport.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      game: {
        select: {
          id: true,
          status: true,
          winner: true,
          stake: true,
          createdAt: true,
          white: { select: { id: true, email: true, name: true } },
          black: { select: { id: true, email: true, name: true } },
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  return NextResponse.json({ reports });
}
