/**
 * Fetches a short-lived JWT for WebSocket authentication.
 * Uses session cookie. Returns null if not logged in.
 */
export async function getWsToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/ws-token", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

/**
 * Appends the WS token to a base WebSocket URL (which may already have query params).
 */
export function wsUrlWithToken(baseUrl: string, token: string): string {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}token=${encodeURIComponent(token)}`;
}
