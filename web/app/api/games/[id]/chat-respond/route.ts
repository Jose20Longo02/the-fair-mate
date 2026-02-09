import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastGameUpdate } from "@/lib/ws-notify";
import { apiError, apiSuccess, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: gameId } = await params;
  let body: { accept?: boolean };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const accept = body.accept === true;

  try {
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return notFound("Game not found");
    if (game.status !== "active") return apiError("Game not active", 400);
    if (game.whiteId !== session.userId && game.blackId !== session.userId) return forbidden();

    const chatStatus = game.chatStatus ?? "none";
    if (chatStatus !== "pending") return apiError("No chat request pending", 400);
    if (game.chatInitiatedBy === session.userId) {
      return apiError("You cannot respond to your own chat request", 400);
    }

    const newStatus = accept ? "accepted" : "declined";
    await prisma.game.update({
      where: { id: gameId },
      data: {
        chatStatus: newStatus,
        ...(accept ? {} : { chatInitiatedBy: null }),
      },
    });

    broadcastGameUpdate({
      gameId,
      type: "chatRespond",
      chatStatus: newStatus,
      respondedBy: session.userId,
    });

    return apiSuccess({ ok: true, chatStatus: newStatus });
  } catch (e) {
    logger.error("chat_respond_error", { gameId, error: String(e) });
    return apiError("Error responding to chat", 500);
  }
}
