import { NextResponse } from "next/server";
import { getSession, createWsToken } from "@/lib/auth";

/**
 * Returns a short-lived JWT for WebSocket authentication.
 * Client must be logged in (session cookie). Use the returned token in the WS URL: ?token=...
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = await createWsToken(session.userId);
  return NextResponse.json({ token });
}
