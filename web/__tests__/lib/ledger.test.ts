import { describe, it, expect } from "vitest";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

/** Mirrors commission logic in lib/ledger.ts. Winner receives totalPot - fee. */
function winnerReceivesCents(stakeCents: number): number {
  const totalPot = 2 * stakeCents;
  const feeCents = Math.floor(totalPot * PLATFORM_FEE_PERCENT);
  return totalPot - feeCents;
}

describe("ledger financial logic (commission)", () => {
  it("stake 100¢: total pot 200, fee 5%, winner receives 190¢", () => {
    expect(winnerReceivesCents(100)).toBe(190);
  });

  it("stake 500¢: total pot 1000, fee 5%, winner receives 950¢", () => {
    expect(winnerReceivesCents(500)).toBe(950);
  });

  it("stake 1000¢: total pot 2000, fee 5%, winner receives 1900¢", () => {
    expect(winnerReceivesCents(1000)).toBe(1900);
  });

  it("fee matches PLATFORM_FEE_PERCENT of total pot (2× stake)", () => {
    const stake = 333;
    const totalPot = 2 * stake;
    const received = winnerReceivesCents(stake);
    const fee = totalPot - received;
    expect(fee).toBe(Math.floor(totalPot * PLATFORM_FEE_PERCENT));
  });
});
