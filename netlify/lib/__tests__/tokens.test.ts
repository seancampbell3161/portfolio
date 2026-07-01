import { describe, it, expect } from "vitest";
import { generateToken, constantTimeEquals, bearerToken, isAuthorized } from "../tokens.js";

describe("generateToken", () => {
  it("returns a 64-char lowercase hex string (32 bytes)", () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is unique across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateToken());
    expect(set.size).toBe(100);
  });
});

describe("constantTimeEquals", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEquals("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeEquals("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEquals("abc", "abcd")).toBe(false);
  });
});

const reqWith = (auth?: string) =>
  new Request("http://x/api/review", auth ? { headers: { authorization: auth } } : undefined);

describe("bearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(bearerToken(reqWith("Bearer abc123"))).toBe("abc123");
  });
  it("returns null when the header is missing or malformed", () => {
    expect(bearerToken(reqWith())).toBeNull();
    expect(bearerToken(reqWith("Token abc"))).toBeNull();
    expect(bearerToken(reqWith("Bearer "))).toBeNull();
  });
});

describe("isAuthorized", () => {
  it("is true only for the exact expected token", () => {
    expect(isAuthorized(reqWith("Bearer secret"), "secret")).toBe(true);
    expect(isAuthorized(reqWith("Bearer wrong"), "secret")).toBe(false);
  });
  it("is false when no token is provided", () => {
    expect(isAuthorized(reqWith(), "secret")).toBe(false);
  });
  it("is false when the expected token is empty (writes disabled)", () => {
    expect(isAuthorized(reqWith("Bearer anything"), "")).toBe(false);
  });
});
