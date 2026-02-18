import { jwtVerify } from "jose";

const COOKIE_NAME = "stakes_chess_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-cambiar-en-produccion"
);

export async function hasValidSession(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getSessionUserId(cookieHeader: string | null): Promise<string | null> {
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...v] = c.trim().split("=");
      return [key, v.join("=").trim()];
    })
  );
}
