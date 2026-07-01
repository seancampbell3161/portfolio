import { describe, it, expect } from "vitest";
import { addDays, schedule, updateStreak, displayStreak } from "../sm2";
import type { CardSchedule, ReviewState } from "../types";

const newCard = (): CardSchedule => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-07-01" });
const TODAY = "2026-07-01";

describe("addDays", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });
  it("subtracts days with a negative n", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
});

describe("schedule — Again (0)", () => {
  it("resets interval/reps, increments lapses, drops ease by 0.2, due today", () => {
    const s = schedule({ ease: 2.5, interval: 12, reps: 3, lapses: 0, due: TODAY }, 0, TODAY);
    expect(s.interval).toBe(0);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3, 5);
    expect(s.due).toBe(TODAY);
    expect(s.lastReviewed).toBe(TODAY);
  });
  it("floors ease at 1.3", () => {
    const s = schedule({ ease: 1.4, interval: 5, reps: 2, lapses: 4, due: TODAY }, 0, TODAY);
    expect(s.ease).toBe(1.3);
  });
});

describe("schedule — Good (2) on a new card", () => {
  it("interval 1 on first rep", () => {
    expect(schedule(newCard(), 2, TODAY).interval).toBe(1);
  });
  it("interval 3 on second rep", () => {
    const first = schedule(newCard(), 2, TODAY); // reps 1
    expect(schedule(first, 2, TODAY).interval).toBe(3);
  });
  it("interval round(interval*ease) from the third rep on", () => {
    const first = schedule(newCard(), 2, TODAY);   // reps 1, interval 1
    const second = schedule(first, 2, TODAY);      // reps 2, interval 3
    const third = schedule(second, 2, TODAY);      // reps 3
    expect(third.interval).toBe(8); // round(3 * 2.5)
    expect(third.due).toBe(addDays(TODAY, third.interval));
  });
});

describe("schedule — Hard (1) and Easy (3)", () => {
  it("Hard lowers ease by 0.15 and keeps interval >= 1", () => {
    const s = schedule(newCard(), 1, TODAY);
    expect(s.ease).toBeCloseTo(2.35, 5);
    expect(s.interval).toBe(1);
  });
  it("Easy grows faster than Good and raises ease", () => {
    const easy = schedule(newCard(), 3, TODAY);
    const good = schedule(newCard(), 2, TODAY);
    expect(easy.ease).toBeCloseTo(2.65, 5);
    expect(easy.interval).toBeGreaterThan(good.interval);
  });
});

describe("updateStreak / displayStreak", () => {
  const state = (streak: number, last: string | null): ReviewState => ({ schedules: {}, streak, lastReviewDate: last });

  it("first-ever review sets streak 1", () => {
    expect(updateStreak(state(0, null), TODAY)).toEqual({ streak: 1, lastReviewDate: TODAY });
  });
  it("reviewing again the same day is a no-op on the count", () => {
    expect(updateStreak(state(4, TODAY), TODAY)).toEqual({ streak: 4, lastReviewDate: TODAY });
  });
  it("reviewing the day after increments", () => {
    expect(updateStreak(state(4, addDays(TODAY, -1)), TODAY)).toEqual({ streak: 5, lastReviewDate: TODAY });
  });
  it("a gap resets to 1", () => {
    expect(updateStreak(state(9, addDays(TODAY, -3)), TODAY)).toEqual({ streak: 1, lastReviewDate: TODAY });
  });
  it("displayStreak is 0 when the last review is neither today nor yesterday (without mutating)", () => {
    const s = state(9, addDays(TODAY, -3));
    expect(displayStreak(s, TODAY)).toBe(0);
    expect(s.streak).toBe(9); // unchanged
  });
  it("displayStreak shows the count when last review is today or yesterday", () => {
    expect(displayStreak(state(6, TODAY), TODAY)).toBe(6);
    expect(displayStreak(state(6, addDays(TODAY, -1)), TODAY)).toBe(6);
  });
});
