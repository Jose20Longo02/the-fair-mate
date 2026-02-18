import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  createSession: vi.fn().mockResolvedValue("mock-session-token"),
  getCookieName: () => "stakes_chess_session",
  SESSION_COOKIE_OPTIONS: { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", maxAge: 604800 },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => Promise.resolve({ ok: true }),
  getClientKey: () => "test-client",
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/auth/login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(bcrypt.compare).mockReset();
  });

  it("returns 400 when email is missing", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "pass123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Email");
  });

  it("returns 400 when password is missing", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@test.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Password");
  });

  it("returns 401 when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@test.com", password: "pass123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Invalid");
  });

  it("returns 401 when password is wrong", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "u@test.com",
      passwordHash: "hash",
      name: "User",
      elo: 1200,
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@test.com", password: "wrong" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Invalid");
  });

  it("returns 200 and sets cookie when credentials are valid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "u@test.com",
      passwordHash: "hash",
      name: "Test",
      elo: 1200,
    } as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "u@test.com", password: "goodpass123" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toEqual(
      expect.objectContaining({ id: "user-1", email: "u@test.com", name: "Test", elo: 1200 })
    );
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("stakes_chess_session");
  });
});
