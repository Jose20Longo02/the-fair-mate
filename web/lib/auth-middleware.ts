import { jwtVerify } from "jose";

const COOKIE_NAME = "stakes_chess_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-secret-cambiar-en-produccion"
);

export async function hasValidSession(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false;
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...v] = c.trim().split("=");
      return [key, v.join("=").trim()];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}
