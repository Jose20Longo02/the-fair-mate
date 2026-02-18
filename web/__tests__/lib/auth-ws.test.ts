import { describe, it, expect } from "vitest";
import { createWsToken, verifyWsToken } from "@/lib/auth";

describe("lib/auth (WS token)", () => {
  const userId = "user-id-123";

  it("createWsToken returns a non-empty string", async () => {
    const token = await createWsToken(userId);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifyWsToken returns userId for a valid token", async () => {
    const token = await createWsToken(userId);
    const payload = await verifyWsToken(token);
    expect(payload).toEqual({ userId });
  });

  it("verifyWsToken returns null for invalid token", async () => {
    const payload = await verifyWsToken("invalid.jwt.token");
    expect(payload).toBeNull();
  });

  it("verifyWsToken returns null for empty string", async () => {
    expect(await verifyWsToken("")).toBeNull();
  });

  it("verifyWsToken returns null for tampered token", async () => {
    const token = await createWsToken(userId);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifyWsToken(tampered)).toBeNull();
  });

  it("different userIds produce different tokens", async () => {
    const t1 = await createWsToken("user-a");
    const t2 = await createWsToken("user-b");
    expect(t1).not.toBe(t2);
    expect(await verifyWsToken(t1)).toEqual({ userId: "user-a" });
    expect(await verifyWsToken(t2)).toEqual({ userId: "user-b" });
  });
});
