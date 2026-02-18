import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
}));
vi.mock("@/lib/auth", () => ({
  createSession: vi.fn().mockResolvedValue("mock-token"),
  getCookieName: () => "stakes_chess_session",
  SESSION_COOKIE_OPTIONS: { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", maxAge: 604800 },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => Promise.resolve({ ok: true }),
  getClientKey: () => "test",
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/avatars", () => ({ isAllowedAvatar: (a: string) => ["Pawn", "King"].includes(a) }));
vi.mock("@/lib/email", () => ({
  generateVerificationCode: () => "123456",
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/auth/register/route";

function jsonReq(body: object) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "new-user",
      email: "new@test.com",
      name: "New",
      elo: 1200,
    } as never);
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(
      jsonReq({ password: "Pass1234", name: "A", avatar: "Pawn", initialElo: 1200 })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Email");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await POST(
      jsonReq({
        email: "not-an-email",
        password: "Pass1234",
        name: "A",
        avatar: "Pawn",
        initialElo: 1200,
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid email");
  });

  it("returns 400 when password is too short", async () => {
    const res = await POST(
      jsonReq({
        email: "a@b.com",
        password: "Short1",
        name: "A",
        avatar: "Pawn",
        initialElo: 1200,
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("at least 8");
  });

  it("returns 400 when password has no letter or no number", async () => {
    const res1 = await POST(
      jsonReq({
        email: "a@b.com",
        password: "12345678",
        name: "A",
        avatar: "Pawn",
        initialElo: 1200,
      })
    );
    expect(res1.status).toBe(400);
    const res2 = await POST(
      jsonReq({
        email: "a@b.com",
        password: "abcdefgh",
        name: "A",
        avatar: "Pawn",
        initialElo: 1200,
      })
    );
    expect(res2.status).toBe(400);
  });

  it("returns 400 when avatar is invalid", async () => {
    const res = await POST(
      jsonReq({
        email: "a@b.com",
        password: "Pass1234",
        name: "A",
        avatar: "InvalidAvatar",
        initialElo: 1200,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 and user when valid", async () => {
    const res = await POST(
      jsonReq({
        email: "new@test.com",
        password: "Pass1234",
        name: "New",
        avatar: "Pawn",
        initialElo: 1200,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("new@test.com");
  });
});
