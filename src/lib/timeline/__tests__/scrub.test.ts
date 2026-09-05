import { describe, it, expect } from "vitest";
import { dateAt, stepDate, dayIndex, parseHash, hashFor } from "../scrub.js";

const d = (s: string) => new Date(s);
const YEAR = { from: d("2026-01-01T00:00:00Z"), to: d("2026-12-31T23:59:59.999Z") };
const ALL = { from: d("2021-01-15T00:00:00Z"), to: d("2026-12-31T23:59:59.999Z") };

describe("dateAt (interactions 1, §6.3)", () => {
  it("maps 0 and 1 to the window's edges, floored to a UTC day", () => {
    expect(dateAt(0, YEAR)).toEqual(d("2026-01-01T00:00:00Z"));
    expect(dateAt(1, YEAR)).toEqual(d("2026-12-31T00:00:00Z"));
  });
  it("floors a mid-day fraction to that day", () => {
    expect(dateAt(0.5, YEAR)).toEqual(d("2026-07-02T00:00:00Z"));
  });
  it("clamps fractions outside the window", () => {
    expect(dateAt(-0.3, YEAR)).toEqual(d("2026-01-01T00:00:00Z"));
    expect(dateAt(1.7, YEAR)).toEqual(d("2026-12-31T00:00:00Z"));
  });
  it("starts on the first whole day of a window that begins mid-day", () => {
    const w = { from: d("2023-09-02T12:00:00Z"), to: YEAR.to };
    expect(dateAt(0, w)).toEqual(d("2023-09-03T00:00:00Z"));
  });
});

describe("stepDate", () => {
  it("steps a month, keeping the day", () => {
    expect(stepDate(d("2026-03-15"), "month", 1, ALL)).toEqual(d("2026-04-15"));
    expect(stepDate(d("2026-03-15"), "month", -1, ALL)).toEqual(d("2026-02-15"));
  });
  it("crosses year ends in both directions", () => {
    expect(stepDate(d("2025-12-15"), "month", 1, ALL)).toEqual(d("2026-01-15"));
    expect(stepDate(d("2026-01-15"), "month", -1, ALL)).toEqual(d("2025-12-15"));
  });
  it("falls back to the last day of a shorter month", () => {
    expect(stepDate(d("2026-01-31"), "month", 1, ALL)).toEqual(d("2026-02-28"));
    expect(stepDate(d("2024-02-29"), "year", 1, ALL)).toEqual(d("2025-02-28"));
  });
  it("steps a year", () => {
    expect(stepDate(d("2024-06-15"), "year", -1, ALL)).toEqual(d("2023-06-15"));
  });
  it("clamps to the bounds", () => {
    expect(stepDate(d("2026-12-15"), "month", 1, ALL)).toEqual(d("2026-12-31T00:00:00Z"));
    expect(stepDate(d("2021-01-20"), "month", -1, ALL)).toEqual(d("2021-01-15T00:00:00Z"));
    expect(stepDate(d("2021-06-01"), "year", -1, ALL)).toEqual(ALL.from);
  });
  it("clamps a mid-day lower bound up to the next whole day", () => {
    const b = { from: d("2023-09-02T12:00:00Z"), to: ALL.to };
    expect(stepDate(d("2023-09-20"), "month", -1, b)).toEqual(d("2023-09-03T00:00:00Z"));
  });
});

describe("dayIndex", () => {
  it("counts whole days from the window's start", () => {
    expect(dayIndex(d("2026-01-01"), YEAR)).toBe(0);
    expect(dayIndex(d("2026-01-02"), YEAR)).toBe(1);
    expect(dayIndex(YEAR.to, YEAR)).toBe(364);
  });
});

describe("parseHash and hashFor", () => {
  it("reads an item hash", () => {
    expect(parseHash("#item-daw-engine")).toEqual({ kind: "item", id: "daw-engine" });
  });
  it("reads a date hash as UTC midnight", () => {
    expect(parseHash("#on-2024-06-15")).toEqual({ kind: "on", date: d("2024-06-15T00:00:00Z") });
  });
  it("rejects malformed and impossible dates, and anything else", () => {
    expect(parseHash("#on-2024-02-31")).toBeNull();
    expect(parseHash("#on-2024-6-1")).toBeNull();
    expect(parseHash("#item-Bad_Id")).toBeNull();
    expect(parseHash("#lane-writing")).toBeNull();
    expect(parseHash("")).toBeNull();
  });
  it("round-trips a date", () => {
    expect(hashFor(d("2024-06-15"))).toBe("#on-2024-06-15");
    expect(parseHash(hashFor(d("2024-06-15")))).toEqual({ kind: "on", date: d("2024-06-15T00:00:00Z") });
  });
});
