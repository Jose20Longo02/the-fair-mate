import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyChallengeUpdated } from "@/lib/ws-notify";
import { createNotification } from "@/lib/create-notification";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const challenge = await prisma.gameChallenge.findUnique({
    where: { id },
    include: {
      challenger: { select: { name: true, email: true } },
      challenged: { select: { name: true, email: true } },
    },
  });

  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (challenge.status !== "pending_accept" && challenge.status !== "pending_challenger" && challenge.status !== "pending_challenged") {
    return NextResponse.json({ error: "Challenge already resolved" }, { status: 400 });
  }

  const isChallenger = challenge.challengerId === session.userId;
  const isChallenged = challenge.challengedId === session.userId;
  if (!isChallenger && !isChallenged) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const canReject =
    (challenge.status === "pending_accept" && (isChallenged || isChallenger)) ||
    (challenge.status === "pending_challenger" && isChallenger) ||
    (challenge.status === "pending_challenged" && isChallenged);
  if (!canReject) {
    return NextResponse.json({ error: "You cannot reject this challenge" }, { status: 400 });
  }

  await prisma.gameChallenge.update({
    where: { id },
    data: { status: "rejected" },
  });

  const otherUserId = isChallenger ? challenge.challengedId : challenge.challengerId;
  await notifyChallengeUpdated(otherUserId);

  const actorName = isChallenger ? (challenge.challenger?.name || challenge.challenger?.email) : (challenge.challenged?.name || challenge.challenged?.email);
  if (isChallenger) {
    await createNotification({
      userId: otherUserId,
      type: "challenge_cancelled",
      title: "Challenge cancelled",
      message: actorName ? `${actorName} has cancelled the challenge.` : "The challenge has been cancelled.",
      linkUrl: null,
      challengeId: id,
    });
  } else {
    await createNotification({
      userId: otherUserId,
      type: "challenge_rejected",
      title: "Challenge rejected",
      message: actorName ? `${actorName} has rejected the challenge.` : "The challenge has been rejected.",
      linkUrl: null,
      challengeId: id,
    });
  }

  return NextResponse.json({ ok: true });
}
