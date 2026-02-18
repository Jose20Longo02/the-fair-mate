import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/networks", () => ({
  getWithdrawConfig: vi.fn(),
}));
vi.mock("@/lib/deposit-address", () => ({
  getDepositWallet: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { update: vi.fn() },
    ledgerEntry: { create: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));
vi.mock("ethers", () => ({
  JsonRpcProvider: vi.fn(),
  Contract: vi.fn(),
  Wallet: vi.fn(),
}));

import { getWithdrawConfig } from "@/lib/networks";
import { getDepositWallet } from "@/lib/deposit-address";
import { prisma } from "@/lib/prisma";
import { executeWithdraw } from "@/lib/withdraw";

describe("lib/withdraw", () => {
  beforeEach(() => {
    vi.mocked(getWithdrawConfig).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
  });

  it("returns error when amount is zero or negative", async () => {
    const r1 = await executeWithdraw("user1", 0, "polygon", "0x123");
    expect(r1).toEqual({ success: false, error: "Amount must be positive" });

    const r2 = await executeWithdraw("user1", -100, "polygon", "0x123");
    expect(r2).toEqual({ success: false, error: "Amount must be positive" });
  });

  it("returns error when network is not configured", async () => {
    vi.mocked(getWithdrawConfig).mockReturnValue(null);

    const r = await executeWithdraw("user1", 100, "unknown-network", "0x123");
    expect(r.success).toBe(false);
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toContain("not configured");
  });

  it("returns error when deposit wallet is not configured", async () => {
    vi.mocked(getWithdrawConfig).mockReturnValue({
      rpcUrl: "https://rpc.example.com",
      usdcAddress: "0xUSDC",
      chainId: 137,
    });
    vi.mocked(getDepositWallet).mockImplementation(() => {
      throw new Error("DEPOSIT_MASTER_SECRET not set");
    });

    const r = await executeWithdraw("user1", 100, "polygon", "0x123");
    expect(r.success).toBe(false);
    expect((r as { error: string }).error).toContain("Deposit addresses not configured");
  });

  // Insufficient balance path (prisma.$transaction throws) would require also mocking
  // sendGasTopUp and ethers provider/wallet; covered by integration tests with test DB.
});
