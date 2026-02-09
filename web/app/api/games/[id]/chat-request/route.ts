import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, apiSuccess, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: gameId } = await params;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, name: true, email: true } },
        black: { select: { id: true, name: true, email: true } },
      },
    });

    if (!game) return notFound("Game not found");
    if (game.status !== "active") return apiError("Game not active", 400);
    if (game.whiteId !== session.userId && game.blackId !== session.userId) return forbidden();

    const chatStatus = game.chatStatus ?? "none";
    if (chatStatus === "accepted") return apiError("Chat already active", 400);
    if (chatStatus === "pending" && game.chatInitiatedBy === session.userId) {
      return apiError("Waiting for opponent to accept", 400);
    }
    if (chatStatus === "pending") return apiError("Opponent already requested chat", 400);

    await prisma.game.update({
      where: { id: gameId },
      data: { chatStatus: "pending", chatInitiatedBy: session.userId },
    });

    const initiatorName = game.whiteId === session.userId ? (game.white.name || game.white.email) : (game.black.name || game.black.email);
    broadcastGameUpdate({
      gameId,
      type: "chatRequest",
      chatInitiatedBy: session.userId,
      initiatorName,
    });

    return apiSuccess({ ok: true, chatStatus: "pending" });
  } catch (e) {
    logger.error("chat_request_error", { gameId, error: String(e) });
    return apiError("Error requesting chat", 500);
  }
}
