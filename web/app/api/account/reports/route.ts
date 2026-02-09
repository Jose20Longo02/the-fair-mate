import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** List reports submitted by the current user. Includes admin response (adminNotes) and status. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const reports = await prisma.gameReport.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      game: {
        select: {
          id: true,
          status: true,
          winner: true,
          stake: true,
          createdAt: true,
          white: { select: { id: true, name: true, email: true } },
          black: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json({ reports });
}
