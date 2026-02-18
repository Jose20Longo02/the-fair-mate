import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSION_SECRET } from "./env";

const COOKIE_NAME = "stakes_chess_session";
const SECRET = new TextEncoder().encode(SESSION_SECRET);

/** Cookie options for session: HttpOnly (XSS), Secure in prod, SameSite=Lax (CSRF). */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

export async function createSession(userId: string, email: string): Promise<string> {
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(SECRET);
  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export function getCookieName() {
  return COOKIE_NAME;
}

/** Short-lived JWT for WebSocket auth (e.g. 5 min). Payload: { userId }. */
export async function createWsToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .setIssuedAt()
    .sign(SECRET);
}

/** Verify a WS token; returns { userId } or null. */
export async function verifyWsToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.userId as string;
    return userId ? { userId } : null;
  } catch {
    return null;
  }
}
