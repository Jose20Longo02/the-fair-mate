import { describe, it, expect } from "vitest";
import {
  calculateExpected,
  calculateNewElo,
  getEloChanges,
} from "@/lib/elo";

describe("lib/elo", () => {
  describe("calculateExpected", () => {
    it("returns 0.5 when both players have same ELO", () => {
      expect(calculateExpected(1200, 1200)).toBe(0.5);
      expect(calculateExpected(1500, 1500)).toBe(0.5);
    });

    it("returns > 0.5 when player has higher ELO than opponent", () => {
      expect(calculateExpected(1400, 1200)).toBeGreaterThan(0.5);
      expect(calculateExpected(1600, 1200)).toBeGreaterThan(0.9);
    });

    it("returns < 0.5 when player has lower ELO than opponent", () => {
      expect(calculateExpected(1200, 1400)).toBeLessThan(0.5);
      expect(calculateExpected(1200, 1600)).toBeLessThan(0.1);
    });
  });

  describe("calculateNewElo", () => {
    it("increases ELO when actualScore > expectedScore (win when expected to lose)", () => {
      const current = 1200;
      const expected = 0.25; // expected to lose
      const newElo = calculateNewElo(current, expected, 1);
      expect(newElo).toBeGreaterThan(current);
    });

    it("decreases ELO when actualScore < expectedScore (loss when expected to win)", () => {
      const current = 1200;
      const expected = 0.75;
      const newElo = calculateNewElo(current, expected, 0);
      expect(newElo).toBeLessThan(current);
    });

    it("winner gains about 16 and loser loses about 16 when equal ELO (K=32)", () => {
      const expected = 0.5;
      const winnerNew = calculateNewElo(1200, expected, 1);
      const loserNew = calculateNewElo(1200, expected, 0);
      expect(winnerNew - 1200).toBe(16);
      expect(1200 - loserNew).toBe(16);
    });
  });

  describe("getEloChanges", () => {
    it("returns symmetric deltas for equal ELO win/loss", () => {
      const r = getEloChanges(1200, 1200, false);
      expect(r.winnerNew).toBe(1216);
      expect(r.loserNew).toBe(1184);
      expect(r.winnerDelta).toBe(16);
      expect(r.loserDelta).toBe(-16);
    });

    it("draw gives smaller changes when equal ELO", () => {
      const r = getEloChanges(1200, 1200, true);
      expect(r.winnerNew).toBe(1200);
      expect(r.loserNew).toBe(1200);
      expect(r.winnerDelta).toBe(0);
      expect(r.loserDelta).toBe(0);
    });

    it("underdog win gives larger winner gain and loser loss", () => {
      const r = getEloChanges(1000, 1400, false);
      expect(r.winnerDelta).toBeGreaterThan(16);
      expect(r.loserDelta).toBeLessThan(-16);
    });

    it("favorite win gives smaller winner gain and loser loss", () => {
      const r = getEloChanges(1400, 1000, false);
      expect(r.winnerDelta).toBeLessThan(16);
      expect(r.loserDelta).toBeGreaterThan(-16);
    });
  });
});
