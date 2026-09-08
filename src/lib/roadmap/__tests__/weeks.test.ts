import { describe, it, expect } from "vitest";
import { WEEK_ONE, weekStart, weekEnd, shiftDays, weeksToSpan } from "../weeks.js";

describe("week arithmetic", () => {
  it("starts week 1 on the Monday named by WEEK_ONE", () => {
    expect(weekStart(1)).toEqual(WEEK_ONE);
    expect(weekStart(1).getUTCDay()).toBe(1); // Monday
  });

  it("puts week 0 — the ramp — in the week before week 1", () => {
    expect(weekStart(0)).toEqual(new Date("2026-08-31T00:00:00Z"));
    expect(weekEnd(0)).toEqual(new Date("2026-09-05T00:00:00Z"));
  });

  it("ends every week on the Saturday, five days after its Monday", () => {
    for (const n of [0, 1, 7, 22]) {
      expect(weekEnd(n).getUTCDay(), `week ${n}`).toBe(6); // Saturday
      expect(weekEnd(n).getTime() - weekStart(n).getTime()).toBe(5 * 86400000);
    }
  });

  it("carries across month and year boundaries", () => {
    expect(weekStart(15)).toEqual(new Date("2026-12-14T00:00:00Z"));
    expect(weekEnd(22)).toEqual(new Date("2027-02-06T00:00:00Z")); // into 2027
  });

  it("does not mutate the date it shifts", () => {
    const d = new Date("2026-09-07T00:00:00Z");
    shiftDays(d, 40);
    expect(d).toEqual(new Date("2026-09-07T00:00:00Z"));
  });

  it("spans the widest week range given", () => {
    expect(weeksToSpan([{ fromWeek: 8, toWeek: 9 }, { fromWeek: 15, toWeek: 19 }]))
      .toEqual({ start: weekStart(8), end: weekEnd(19) });
  });

  it("throws on an empty range list rather than returning an Invalid Date", () => {
    // Math.min(...[]) is Infinity; arrange.ts:104 documents how an Invalid Date
    // here poisons the whole home-page timeline window.
    expect(() => weeksToSpan([])).toThrow(/no weeks/i);
  });
});
