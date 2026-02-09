import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyChallengeUpdated } from "@/lib/ws-notify";
import { createNotification } from "@/lib/create-notification";
import { apiError, apiSuccess, unauthorized } from "@/lib/api-response";
import { STAKE_CENTS_MIN, STAKE_CENTS_MAX } from "@/lib/config";
import { logger } from "@/lib/logger";

/** List my challenges (as challenger or challenged). */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const challenges = await prisma.gameChallenge.findMany({
    where: {
      OR: [{ challengerId: session.userId }, { challengedId: session.userId }],
      status: { in: ["pending_accept", "pending_challenger", "pending_challenged"] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      challenger: { select: { id: true, email: true, name: true, elo: true } },
      challenged: { select: { id: true, email: true, name: true, elo: true } },
    },
  });

  return NextResponse.json({ challenges });
}

/** Create a challenge: find opponent by email or name, propose stake. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: { opponentEmailOrName?: string; stakeCents?: number };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const opponentInput = typeof body.opponentEmailOrName === "string" ? body.opponentEmailOrName.trim() : "";
  const stakeCents = typeof body.stakeCents === "number" ? body.stakeCents : 0;

  if (!opponentInput) return apiError("Opponent email or nickname required", 400);
  if (stakeCents < STAKE_CENTS_MIN || stakeCents > STAKE_CENTS_MAX) {
    return apiError(
      `Stake must be between $${STAKE_CENTS_MIN / 100} and $${STAKE_CENTS_MAX / 100} (${STAKE_CENTS_MIN}–${STAKE_CENTS_MAX} cents)`,
      400
    );
  }

  const isEmail = opponentInput.includes("@");
  let challenged: { id: string; email: string; name: string | null; balance: number } | null = null;
  if (isEmail) {
    challenged = await prisma.user.findFirst({
      where: { email: opponentInput.toLowerCase() },
      select: { id: true, email: true, name: true, balance: true },
    });
  } else {
    const users = await prisma.user.findMany({
      where: { name: { not: null } },
      select: { id: true, email: true, name: true, balance: true },
    });
    const nameLower = opponentInput.toLowerCase();
    challenged = users.find((u) => u.name!.toLowerCase() === nameLower) ?? null;
  }

  if (!challenged) return apiError("User not found with that email or nickname", 404);
  if (challenged.id === session.userId) return apiError("You cannot challenge yourself", 400);

  const myBalance = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balance: true },
  });
  if (!myBalance || myBalance.balance < stakeCents) {
    return apiError("Your balance is not enough for such stake", 400);
  }

  if (challenged.balance < stakeCents) {
    return apiError("Opponent has insufficient balance for that stake", 400);
  }

  const existing = await prisma.gameChallenge.findFirst({
    where: {
      status: { in: ["pending_accept", "pending_challenger", "pending_challenged"] },
      OR: [
        { challengerId: session.userId, challengedId: challenged.id },
        { challengerId: challenged.id, challengedId: session.userId },
      ],
    },
  });
  if (existing) {
    return apiError("There is already a pending challenge between you and this user", 400);
  }

  try {
    const challenge = await prisma.gameChallenge.create({
      data: {
        challengerId: session.userId,
        challengedId: challenged.id,
        initialStakeCents: stakeCents,
        currentStakeCents: stakeCents,
        lastProposedBy: "challenger",
        status: "pending_accept",
      },
      include: {
        challenger: { select: { id: true, email: true, name: true, elo: true } },
        challenged: { select: { id: true, email: true, name: true, elo: true } },
      },
    });

    await notifyChallengeUpdated(challenged.id);

    const challengerName = challenge.challenger.name || challenge.challenger.email;
    await createNotification({
      userId: challenged.id,
      type: "challenge_received",
      title: "You've been challenged",
      message: `${challengerName} challenges you with a stake of $${(stakeCents / 100).toFixed(2)}.`,
      linkUrl: "/#my-challenges",
      challengeId: challenge.id,
    });

    logger.info("challenge_created", { challengeId: challenge.id, challengerId: session.userId, challengedId: challenged.id, stakeCents });
    return NextResponse.json({ challenge });
  } catch (e) {
    logger.error("challenge_create_error", { error: String(e) });
    return apiError("Error creating challenge", 500);
  }
}
