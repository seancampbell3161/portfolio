import { describe, it, expect } from "vitest";
import { longDate, shortDay, shortDate, monthYear, monthDayYear, isoDay, monthYearLong } from "../dates.js";

const sep1 = new Date("2026-09-01T00:00:00Z");
const dec31 = new Date("2025-12-31T00:00:00Z");

describe("dates (spec §11, always UTC)", () => {
  it("longDate", () => {
    expect(longDate(sep1)).toBe("1 September 2026");
    expect(longDate(dec31)).toBe("31 December 2025");
  });
  it("shortDay pads the day to two digits", () => {
    expect(shortDay(sep1)).toBe("01 Sep");
    expect(shortDay(dec31)).toBe("31 Dec");
  });
  it("shortDate", () => {
    expect(shortDate(sep1)).toBe("01 Sep 2026");
    expect(shortDate(dec31)).toBe("31 Dec 2025");
  });
  it("monthYear", () => {
    expect(monthYear(sep1)).toBe("Sep 2026");
    expect(monthYear(dec31)).toBe("Dec 2025");
  });
  it("monthYearLong spells the month", () => {
    expect(monthYearLong(sep1)).toBe("September 2026");
    expect(monthYearLong(dec31)).toBe("December 2025");
  });
  it("monthDayYear", () => {
    expect(monthDayYear(sep1)).toBe("Sep 1, 2026");
    expect(monthDayYear(dec31)).toBe("Dec 31, 2025");
  });
  it("isoDay", () => {
    expect(isoDay(sep1)).toBe("2026-09-01");
    expect(isoDay(dec31)).toBe("2025-12-31");
  });
  it("ignores the machine's time zone", () => {
    // 23:30 UTC on Dec 31 is already Jan 1 in zones east of UTC+0:30.
    expect(longDate(new Date("2025-12-31T23:30:00Z"))).toBe("31 December 2025");
    expect(isoDay(new Date("2025-12-31T23:30:00Z"))).toBe("2025-12-31");
  });
});
