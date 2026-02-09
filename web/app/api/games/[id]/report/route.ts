import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: gameId } = await params;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.whiteId !== session.userId && game.blackId !== session.userId) {
    return NextResponse.json({ error: "You are not a player in this game" }, { status: 403 });
  }

  if (game.status === "active") {
    return NextResponse.json(
      { error: "Cannot report an active game. Wait until the game has ended." },
      { status: 400 }
    );
  }

  const existingReport = await prisma.gameReport.findFirst({
    where: { gameId, userId: session.userId },
  });
  if (existingReport) {
    return NextResponse.json(
      { error: "You have already reported this game. You can see your report and our response in My reports." },
      { status: 400 }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length < 10) {
    return NextResponse.json(
      { error: "Please provide a message of at least 10 characters explaining your concern." },
      { status: 400 }
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message is too long (max 2000 characters)." },
      { status: 400 }
    );
  }

  const report = await prisma.gameReport.create({
    data: {
      gameId,
      userId: session.userId,
      message,
    },
  });

  return NextResponse.json({ ok: true, reportId: report.id });
}
