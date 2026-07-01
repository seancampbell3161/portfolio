import { describe, it, expect } from "vitest";
import { reviewCards } from "../review-cards";
import { allIds } from "../roadmap";

describe("reviewCards", () => {
  it("has unique card ids", () => {
    const ids = reviewCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every sourceId references a real roadmap id", () => {
    const bad = reviewCards
      .filter((c) => c.sourceId && !allIds.has(c.sourceId))
      .map((c) => `${c.id} -> ${c.sourceId}`);
    expect(bad).toEqual([]);
  });

  it("behavioral cards have no sourceId (always unlocked)", () => {
    for (const c of reviewCards) {
      if (c.thread === "behavioral") expect(c.sourceId).toBeUndefined();
    }
  });

  it("non-behavioral cards all have a sourceId", () => {
    for (const c of reviewCards) {
      if (c.thread !== "behavioral") expect(typeof c.sourceId).toBe("string");
    }
  });
});
