import { describe, it, expect } from "vitest";
import { generateToken, constantTimeEquals } from "../tokens.js";

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
