import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGameBetweenPlayers } from "@/lib/create-game";
import { notifyChallengeUpdated, isUserOnline, notifyChallengeAccepted } from "@/lib/ws-notify";
import { createNotification } from "@/lib/create-notification";
import { apiError, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { STAKE_CENTS_MIN, STAKE_CENTS_MAX } from "@/lib/config";
import { logger } from "@/lib/logger";

type Body = { action: "accept" | "propose"; stakeCents?: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  const action = body.action === "accept" || body.action === "propose" ? body.action : null;
  if (!action) return apiError("action must be 'accept' or 'propose'", 400);

  const challenge = await prisma.gameChallenge.findUnique({
    where: { id },
    include: {
      challenger: { select: { id: true, balance: true, name: true, email: true } },
      challenged: { select: { id: true, balance: true, name: true, email: true } },
    },
  });

  if (!challenge) return notFound("Challenge not found");
  if (challenge.status === "accepted" || challenge.status === "rejected") {
    return apiError("Challenge already resolved", 400);
  }

  const isChallenger = challenge.challengerId === session.userId;
  const isChallenged = challenge.challengedId === session.userId;
  if (!isChallenger && !isChallenged) return forbidden();

  const currentStake = challenge.currentStakeCents;

  const canAccept =
    (challenge.status === "pending_accept" && isChallenged) ||
    (challenge.status === "pending_challenger" && isChallenger) ||
    (challenge.status === "pending_challenged" && isChallenged);

  const otherPlayerId = isChallenger ? challenge.challengedId : challenge.challengerId;

  async function ensureOtherPlayerAvailable(): Promise<{ error?: string }> {
    const inActiveGame = await prisma.game.findFirst({
      where: {
        OR: [{ whiteId: otherPlayerId }, { blackId: otherPlayerId }],
        status: "active",
      },
    });
    if (inActiveGame) return { error: "Player not available at the moment" };
    const online = await isUserOnline(otherPlayerId);
    if (!online) return { error: "Player not available at the moment" };
    return {};
  }

  const myBalance = isChallenger ? challenge.challenger.balance : challenge.challenged.balance;
  const otherBalance = isChallenger ? challenge.challenged.balance : challenge.challenger.balance;

  if (action === "accept") {
    if (!canAccept) return apiError("It is not your turn to accept", 400);
    const stake = currentStake;
    if (myBalance < stake) {
      return apiError("Your balance is not enough for such stake", 400);
    }
    if (otherBalance < stake) {
      return apiError("Opponent has insufficient balance for that stake", 400);
    }
    const avail = await ensureOtherPlayerAvailable();
    if (avail.error) return apiError(avail.error, 400);
    const game = await createGameBetweenPlayers(challenge.challengerId, challenge.challengedId, stake);
    await prisma.gameChallenge.update({
      where: { id },
      data: { status: "accepted", gameId: game.id },
    });
    await notifyChallengeAccepted(otherPlayerId, game.id);
    await createNotification({
      userId: otherPlayerId,
      type: "challenge_accepted",
      title: "Challenge accepted - Game started",
      message: "The challenge was accepted. Join the game!",
      linkUrl: `/game/${game.id}`,
      challengeId: id,
      gameId: game.id,
    });
    return NextResponse.json({ game, challengeId: id });
  }

  // action === "propose"
  const proposedCents = typeof body.stakeCents === "number" ? body.stakeCents : 0;
  if (proposedCents < STAKE_CENTS_MIN || proposedCents > STAKE_CENTS_MAX) {
    return apiError(
      `Stake must be between $${STAKE_CENTS_MIN / 100} and $${STAKE_CENTS_MAX / 100} (${STAKE_CENTS_MIN}–${STAKE_CENTS_MAX} cents)`,
      400
    );
  }

  const whoResponds =
    challenge.status === "pending_accept"
      ? "challenged"
      : challenge.status === "pending_challenger"
        ? "challenger"
        : challenge.status === "pending_challenged"
          ? "challenged"
          : null;
  if (!whoResponds) return apiError("Invalid state", 400);

  const canRespond =
    (challenge.status === "pending_accept" && isChallenged) ||
    (challenge.status === "pending_challenger" && isChallenger) ||
    (challenge.status === "pending_challenged" && isChallenged);
  if (!canRespond) return apiError("It is not your turn to respond", 400);

  if (proposedCents <= currentStake) {
    const stake = proposedCents;
    if (myBalance < stake) {
      return apiError("Your balance is not enough for such stake", 400);
    }
    if (otherBalance < stake) {
      return apiError("Opponent has insufficient balance for that stake", 400);
    }
    const avail = await ensureOtherPlayerAvailable();
    if (avail.error) return apiError(avail.error, 400);
    const game = await createGameBetweenPlayers(challenge.challengerId, challenge.challengedId, stake);
    await prisma.gameChallenge.update({
      where: { id },
      data: { status: "accepted", gameId: game.id, currentStakeCents: stake },
    });
    await notifyChallengeAccepted(otherPlayerId, game.id);
    await createNotification({
      userId: otherPlayerId,
      type: "challenge_accepted",
      title: "Challenge accepted - Game started",
      message: "The challenge was accepted. Join the game!",
      linkUrl: `/game/${game.id}`,
      challengeId: id,
      gameId: game.id,
    });
    return NextResponse.json({ game, challengeId: id });
  }

  if (myBalance < proposedCents) {
    return apiError("Your balance is not enough for such stake", 400);
  }
  if (otherBalance < proposedCents) {
    return apiError("Opponent has insufficient balance for that stake", 400);
  }

  const nextStatus = challenge.status === "pending_accept" ? "pending_challenger" : challenge.status === "pending_challenger" ? "pending_challenged" : "pending_challenger";
  const nextProposedBy = nextStatus === "pending_challenger" ? "challenged" : "challenger";

  await prisma.gameChallenge.update({
    where: { id },
    data: {
      currentStakeCents: proposedCents,
      lastProposedBy: whoResponds,
      status: nextStatus,
    },
  });

  await notifyChallengeUpdated(otherPlayerId);

  const proposerName = whoResponds === "challenged"
    ? (challenge.challenged.name || challenge.challenged.email)
    : (challenge.challenger.name || challenge.challenger.email);
  await createNotification({
    userId: otherPlayerId,
    type: "challenge_counter_proposal",
    title: "New stake proposal",
    message: proposerName
      ? `${proposerName} proposes a stake of $${(proposedCents / 100).toFixed(2)}.`
      : `New stake proposal: $${(proposedCents / 100).toFixed(2)}.`,
    linkUrl: "/#my-challenges",
    challengeId: id,
  });

  const updated = await prisma.gameChallenge.findUnique({
    where: { id },
    include: {
      challenger: { select: { id: true, email: true, name: true, elo: true } },
      challenged: { select: { id: true, email: true, name: true, elo: true } },
    },
  });

  return NextResponse.json({ challenge: updated });
}
