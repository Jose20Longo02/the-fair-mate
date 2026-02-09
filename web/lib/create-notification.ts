import { prisma } from "@/lib/prisma";
import { notifyNotificationNew } from "@/lib/ws-notify";

export type NotificationType =
  | "challenge_sent"
  | "challenge_received"
  | "challenge_rejected"
  | "challenge_cancelled"
  | "challenge_counter_proposal"
  | "challenge_accepted";

type CreateNotificationParams = {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  linkUrl?: string | null;
  challengeId?: string | null;
  gameId?: string | null;
};

export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, linkUrl, challengeId, gameId } = params;
  const created = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message: message ?? null,
      linkUrl: linkUrl ?? null,
      challengeId: challengeId ?? null,
      gameId: gameId ?? null,
    },
  });
  await notifyNotificationNew(userId, {
    id: created.id,
    title: created.title,
    message: created.message,
    linkUrl: created.linkUrl,
  });
}
