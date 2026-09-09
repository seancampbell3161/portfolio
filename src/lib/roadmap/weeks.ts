// src/lib/roadmap/weeks.ts
// Week arithmetic for the roadmap schedule. The plan works Mon–Sat: week n
// starts on its Monday and ends on its Saturday, and Sunday belongs to no week.
//
// This module imports NOTHING on purpose. src/data/roadmap.ts derives its spans
// from it, and src/lib/roadmap/{arrange,schedule}.ts import that data file — so
// anything this module reached for would close an import cycle.

/** Monday of Week 1. Move this and the entire plan moves with it. */
export const WEEK_ONE = new Date("2026-09-07T00:00:00Z");

/** A new Date n days on, via setUTCDate so it carries across months and years. */
export function shiftDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Monday of week n. Week 0 is the ramp, the week before Week 1. */
export const weekStart = (n: number): Date => shiftDays(WEEK_ONE, (n - 1) * 7);

/** Saturday of week n — the plan works Mon–Sat, and Saturday ships the log. */
export const weekEnd = (n: number): Date => shiftDays(weekStart(n), 5);

export interface WeekRange {
  fromWeek: number;
  toWeek: number;
}

/** The span covering every range given. Throws when given none. */
export function weeksToSpan(ranges: readonly WeekRange[]): { start: Date; end: Date } {
  if (ranges.length === 0) {
    throw new Error("weeksToSpan: no weeks — a clip with no phase is a data error");
  }
  return {
    start: weekStart(Math.min(...ranges.map((r) => r.fromWeek))),
    end: weekEnd(Math.max(...ranges.map((r) => r.toWeek))),
  };
}
