import { describe, it, expect } from "vitest";
import { weekOf, currentPhase, thisWeek } from "../schedule.js";
import { weekStart, weekEnd } from "../weeks.js";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("weekOf", () => {
  it("is null before the ramp begins", () => {
    expect(weekOf(at("2026-08-20"))).toBeNull();
  });
  it("is 0 during the ramp week", () => {
    expect(weekOf(at("2026-09-02"))).toBe(0);
  });
  it("is 1 on the Monday the plan starts", () => {
    expect(weekOf(weekStart(1))).toBe(1);
  });
  it("is 1 on that week's Saturday", () => {
    expect(weekOf(weekEnd(1))).toBe(1);
  });
  it("still says week 1 on that week's Saturday afternoon", () => {
    // weekEnd(1) is Saturday 00:00. Saturday is the ship day, not the next week.
    expect(weekOf(at("2026-09-12"))).toBe(1);
  });
  it("still says week 22 on the capstone's final Saturday", () => {
    expect(weekOf(at("2027-02-06"))).toBe(22);
  });
  it("resolves a Sunday forward to the week about to start", () => {
    // The plan works Mon–Sat, so Sunday belongs to no week. On a Sunday evening
    // the useful answer is what starts tomorrow.
    expect(weekOf(at("2026-09-13"))).toBe(2); // the Sunday between W1 and W2
  });
  it("is null after the capstone's last Saturday", () => {
    expect(weekOf(at("2027-02-08"))).toBeNull();
  });
});

describe("currentPhase", () => {
  it("names the phase covering the week", () => {
    expect(currentPhase(at("2026-09-09"))?.id).toBe("m1");   // W1
    expect(currentPhase(at("2026-11-10"))?.id).toBe("m3");   // W10
    expect(currentPhase(at("2027-01-20"))?.id).toBe("capstone"); // W20
  });
  it("is the ramp during week 0", () => {
    expect(currentPhase(at("2026-09-02"))?.id).toBe("ramp");
  });
  it("is null outside the plan", () => {
    expect(currentPhase(at("2027-06-01"))).toBeNull();
  });
});

describe("thisWeek", () => {
  it("carries the phase, its milestone, and what to read and drill", () => {
    const w = thisWeek(at("2026-09-09"))!;
    expect(w.week).toBe(1);
    expect(w.phase.id).toBe("m1");
    expect(w.milestone?.id).toBe("redis");
    expect(w.reading.map((p) => p.ref)).toContain("ddia.ch3");
    expect(w.foundations.map((p) => p.ref)).toContain("fd.nc.twopointers");
  });
  it("has no milestone during the ramp", () => {
    const w = thisWeek(at("2026-09-02"))!;
    expect(w.week).toBe(0);
    expect(w.milestone).toBeUndefined();
  });
  it("includes an optional pairing — it is still read, just not span-extending", () => {
    const w = thisWeek(at("2027-01-20"))!; // capstone
    expect(w.foundations.map((p) => p.ref)).toContain("fd.advanced");
  });
  it("is null once the plan is finished", () => {
    expect(thisWeek(at("2027-02-08"))).toBeNull();
  });
});
