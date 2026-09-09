// src/lib/roadmap/schedule.ts
// "What week is it" for the roadmap's this-week band. Pure — no Astro, no DOM —
// so Vitest loads it and both the page and src/scripts/roadmap-schedule.ts call
// it, the same shape as src/lib/timeline/now.ts.
import { phases, type Phase } from "../../data/roadmap.js";
import { weekStart, weekEnd, shiftDays } from "./weeks.js";
import { longDate } from "../dates.js";

/** The last numbered week, from the phase table — never a second copy of it. */
export const LAST_WEEK = phases[phases.length - 1].toWeek;

/**
 * The week `now` falls in, or null outside the plan. A Sunday belongs to no
 * week — the plan works Mon–Sat — so it resolves forward to the week that is
 * about to start, which is the useful answer on a Sunday evening.
 */
export function weekOf(now: Date): number | null {
  // A week runs from its Monday 00:00 up to (not including) the following
  // Sunday 00:00. Comparing against weekEnd(n) directly would be an off-by-one:
  // weekEnd(n) is Saturday at midnight, so any Saturday *afternoon* would roll
  // forward a week — and the capstone's final Saturday, its ship day, would
  // report the plan finished.
  const t = now.getTime();
  const sundayAfter = (n: number) => shiftDays(weekEnd(n), 1).getTime();
  if (t < weekStart(0).getTime()) return null;
  if (t >= sundayAfter(LAST_WEEK)) return null;
  for (let n = 0; n <= LAST_WEEK; n++) {
    if (t < sundayAfter(n)) return n; // Mon–Sat of week n; a Sunday falls through
  }
  return null;
}

export function currentPhase(now: Date): Phase | null {
  const n = weekOf(now);
  if (n === null) return null;
  return phases.find((p) => n >= p.fromWeek && n <= p.toWeek) ?? null;
}

/**
 * The band's heading for `now`. Pure so the component and the client script
 * cannot drift: they call this, rather than each spelling out the five states.
 */
export function weekLabel(now: Date): string {
  const w = weekOf(now);
  if (w === null) {
    return now.getTime() < weekStart(0).getTime()
      ? `The plan starts ${longDate(weekStart(0))}`
      : "The plan is finished";
  }
  return w === 0 ? "Ramp week" : `Week ${w} of ${LAST_WEEK}`;
}
