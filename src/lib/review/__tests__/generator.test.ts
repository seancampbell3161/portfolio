import { describe, it, expect } from "vitest";
import { unlockedCards, dueCards, completedIdsFromProgress } from "../generator";
import type { ReviewCard } from "../../../data/review-cards";
import type { ReviewState } from "../types";

const cards: ReviewCard[] = [
  { id: "c.a", sourceId: "src.a", thread: "build", front: "A", back: "a" },
  { id: "c.b", sourceId: "src.b", thread: "reading", front: "B", back: "b" },
  { id: "c.beh", thread: "behavioral", front: "Beh", back: "beh" }, // no sourceId
];

const emptyState = (): ReviewState => ({ schedules: {}, streak: 0, lastReviewDate: null });
const TODAY = "2026-07-01";

describe("unlockedCards", () => {
  it("excludes a card whose sourceId isn't complete", () => {
    const out = unlockedCards(cards, new Set(["src.a"]));
    expect(out.map((c) => c.id).sort()).toEqual(["c.a", "c.beh"]);
  });
  it("always includes behavioral (no sourceId) cards", () => {
    const out = unlockedCards(cards, new Set());
    expect(out.map((c) => c.id)).toEqual(["c.beh"]);
  });
});

describe("dueCards", () => {
  it("treats an unlocked card with no schedule as due immediately", () => {
    const out = dueCards(cards, new Set(["src.a"]), emptyState(), TODAY);
    expect(out.map((d) => d.card.id).sort()).toEqual(["c.a", "c.beh"]);
  });
  it("excludes a card scheduled in the future", () => {
    const state: ReviewState = {
      schedules: { "c.a": { ease: 2.5, interval: 5, reps: 2, lapses: 0, due: "2026-07-10" } },
      streak: 0,
      lastReviewDate: null,
    };
    const out = dueCards(cards, new Set(["src.a"]), state, TODAY);
    expect(out.map((d) => d.card.id)).not.toContain("c.a");
  });
  it("sorts by due date ascending", () => {
    const state: ReviewState = {
      schedules: {
        "c.beh": { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-06-30" },
        "c.a": { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-06-25" },
      },
      streak: 0,
      lastReviewDate: null,
    };
    const out = dueCards(cards, new Set(["src.a"]), state, TODAY);
    expect(out.map((d) => d.card.id)).toEqual(["c.a", "c.beh"]);
  });
});

describe("completedIdsFromProgress", () => {
  it("returns the completed ids as a set", () => {
    expect([...completedIdsFromProgress({ completed: ["x", "y"] })].sort()).toEqual(["x", "y"]);
  });
  it("handles null/undefined/missing", () => {
    expect(completedIdsFromProgress(null).size).toBe(0);
    expect(completedIdsFromProgress(undefined).size).toBe(0);
    expect(completedIdsFromProgress({}).size).toBe(0);
  });
});
