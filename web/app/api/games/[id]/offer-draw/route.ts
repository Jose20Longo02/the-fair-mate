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
    if (game.drawOfferBy === session.userId) return apiError("You already offered a draw", 400);
    if (game.drawOfferBy) return apiError("There is already a draw offer", 400);

    await prisma.game.update({
      where: { id: gameId },
      data: { drawOfferBy: session.userId },
    });

    const offererName = game.whiteId === session.userId ? (game.white.name || game.white.email) : (game.black.name || game.black.email);
    broadcastGameUpdate({
      gameId,
      type: "drawOffer",
      drawOfferBy: session.userId,
      offererName,
    });

    return apiSuccess({ ok: true, drawOfferBy: session.userId });
  } catch (e) {
    logger.error("offer_draw_error", { gameId, error: String(e) });
    return apiError("Error offering draw", 500);
  }
}
