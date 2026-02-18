import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/account/balance/route";

describe("GET /api/account/balance", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    vi.mocked(prisma.user.findUnique).mockReset();
  });

  it("returns 401 when not logged in", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "missing-user",
      email: "u@test.com",
      exp: 0,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 200 with balance when user exists", async () => {
    vi.mocked(getSession).mockResolvedValue({
      userId: "user-1",
      email: "u@test.com",
      exp: 0,
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      balance: 5000,
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.balance).toBe(5000);
  });
});
