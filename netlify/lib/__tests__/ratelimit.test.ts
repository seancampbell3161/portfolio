import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../ratelimit.js";
import { memoryStorage } from "./helpers/memory-storage.js";

const ten = (n: number) => new Date(`2026-04-25T12:${String(n).padStart(2, "0")}:00Z`);

describe("checkRateLimit", () => {
  it("allows the first attempt", async () => {
    const s = memoryStorage();
    const allowed = await checkRateLimit(s, "1.2.3.4", ten(0));
    expect(allowed).toBe(true);
  });

  it("allows up to 5 attempts in a 10-min window", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit(s, "1.2.3.4", ten(i))).toBe(true);
    }
  });

  it("blocks the 6th attempt within the window", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) await checkRateLimit(s, "1.2.3.4", ten(i));
    expect(await checkRateLimit(s, "1.2.3.4", ten(9))).toBe(false);
  });

  it("resets after the 10-min window expires", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) await checkRateLimit(s, "1.2.3.4", ten(0));
    expect(await checkRateLimit(s, "1.2.3.4", ten(11))).toBe(true);
  });

  it("isolates per-IP", async () => {
    const s = memoryStorage();
    for (let i = 0; i < 5; i++) await checkRateLimit(s, "1.1.1.1", ten(i));
    expect(await checkRateLimit(s, "2.2.2.2", ten(5))).toBe(true);
  });
});
