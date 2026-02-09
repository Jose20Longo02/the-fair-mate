import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "stakes_chess_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-cambiar-en-produccion"
);

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
