import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed") },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => Promise.resolve({ ok: true }),
  getClientKey: () => "test",
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/auth/reset-password/route";

function jsonReq(body: object) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findFirst).mockReset();
    vi.mocked(prisma.user.update).mockReset();
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(jsonReq({ password: "Pass1234" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("token");
  });

  it("returns 400 when password is too short", async () => {
    const res = await POST(jsonReq({ token: "some-token", password: "Short1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("8");
  });

  it("returns 400 when password has no letter or no number", async () => {
    const res = await POST(jsonReq({ token: "t", password: "12345678" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is invalid or expired", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await POST(jsonReq({ token: "bad-token", password: "Pass1234" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid or expired");
  });

  it("returns 200 when token is valid and updates password", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-1",
      email: "u@test.com",
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    const res = await POST(jsonReq({ token: "valid-reset-token", password: "NewPass123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("updated");
  });
});
