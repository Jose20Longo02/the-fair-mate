import { NextResponse } from "next/server";
import { MATCHMAKING_SECRET } from "@/lib/config";
import { verifyWsToken } from "@/lib/auth";

/**
 * Internal API for the WebSocket server: verifies a WS JWT and returns the userId.
 * Auth: X-Matchmaking-Secret. Body: { token: string }.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("X-Matchmaking-Secret");
  if (secret !== MATCHMAKING_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const token = body?.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }
  const payload = await verifyWsToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  return NextResponse.json({ userId: payload.userId });
}
