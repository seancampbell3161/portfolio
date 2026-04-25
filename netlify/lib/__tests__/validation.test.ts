import { describe, it, expect } from "vitest";
import { isValidEmail } from "../validation.js";

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("sean@example.com")).toBe(true);
  });

  it("accepts plus-addressing", () => {
    expect(isValidEmail("sean+blog@example.com")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects missing @", () => {
    expect(isValidEmail("seanexample.com")).toBe(false);
  });

  it("rejects missing TLD", () => {
    expect(isValidEmail("sean@example")).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(isValidEmail("sean @example.com")).toBe(false);
  });

  it("is case-insensitive about disposable domains", () => {
    expect(isValidEmail("foo@Mailinator.COM")).toBe(false);
  });

  it("rejects disposable-domain emails", () => {
    expect(isValidEmail("foo@mailinator.com")).toBe(false);
    expect(isValidEmail("foo@10minutemail.net")).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidEmail("  sean@example.com  ")).toBe(true);
  });

  it("rejects strings longer than 254 chars", () => {
    const long = "a".repeat(250) + "@x.co";
    expect(isValidEmail(long)).toBe(false);
  });
});
