import { WS_SERVER_URL, MATCHMAKING_SECRET } from "@/lib/config";

/**
 * Notifies a user via WebSocket that the challenge list has changed
 * (new challenge, counter-proposal or rejection). Client will refetch the list.
 */
export async function notifyChallengeUpdated(userId: string): Promise<void> {
  try {
    await fetch(`${WS_SERVER_URL}/notify-challenge-updated`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Matchmaking-Secret": MATCHMAKING_SECRET,
      },
      body: JSON.stringify({ userId }),
    });
  } catch {
    // fire-and-forget
  }
}

/**
 * Notifies a user via WebSocket of a new notification (real-time popup/toast).
 */
export async function notifyNotificationNew(
  userId: string,
  payload: { id: string; title: string; message?: string | null; linkUrl?: string | null }
): Promise<void> {
  try {
    await fetch(`${WS_SERVER_URL}/notify-notification-new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Matchmaking-Secret": MATCHMAKING_SECRET,
      },
      body: JSON.stringify({ userId, ...payload }),
    });
  } catch {
    // fire-and-forget
  }
}

/**
 * Broadcasts a payload to all clients in a game room.
 * Payload must include gameId; for game end use { gameId, game, gameOver }; for draw/chat use { gameId, type, ... }.
 */
export async function broadcastGameUpdate(
  payload: { gameId: string; game?: unknown; gameOver?: unknown; [key: string]: unknown }
): Promise<void> {
  try {
    await fetch(`${WS_SERVER_URL}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // fire-and-forget
  }
}

/** Checks if a user is currently connected to the WS server (e.g. on /play). */
export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${WS_SERVER_URL}/online?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    return !!data?.online;
  } catch {
    return false;
  }
}

/** Notifies a user via WebSocket that a challenge was accepted and a game was created (redirect to game). */
export async function notifyChallengeAccepted(userId: string, gameId: string): Promise<void> {
  try {
    await fetch(`${WS_SERVER_URL}/notify-challenge-accepted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Matchmaking-Secret": MATCHMAKING_SECRET,
      },
      body: JSON.stringify({ userId, gameId }),
    });
  } catch {
    // fire-and-forget
  }
}
