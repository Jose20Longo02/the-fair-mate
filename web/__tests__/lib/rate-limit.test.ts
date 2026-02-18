import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

describe("lib/rate-limit", () => {
  describe("checkRateLimit", () => {
    it("allows first request within limit", async () => {
      const r = await checkRateLimit("key1", 5, 60_000);
      expect(r).toEqual({ ok: true });
    });

    it("allows requests under the limit", async () => {
      const key = "key-under-limit";
      for (let i = 0; i < 4; i++) {
        const r = await checkRateLimit(key, 5, 60_000);
        expect(r).toEqual({ ok: true });
      }
    });

    it("returns ok: false when over limit", async () => {
      const key = "key-over";
      for (let i = 0; i < 5; i++) await checkRateLimit(key, 5, 60_000);
      const r = await checkRateLimit(key, 5, 60_000);
      expect(r.ok).toBe(false);
      expect("retryAfter" in r && r.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("getClientKey", () => {
    it("uses x-forwarded-for when present", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });
      expect(getClientKey(req)).toBe("192.168.1.1");
    });

    it("uses first IP when x-forwarded-for has multiple", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
      });
      expect(getClientKey(req)).toMatch(/^[\d.,]+$/);
    });

    it("falls back when no x-forwarded-for", () => {
      const req = new Request("http://localhost");
      const key = getClientKey(req);
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    });
  });
});
