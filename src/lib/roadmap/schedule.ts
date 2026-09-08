// src/lib/roadmap/schedule.ts
// "What week is it" for the roadmap's this-week band. Pure — no Astro, no DOM —
// so Vitest loads it and both the page and src/scripts/roadmap-schedule.ts call
// it, the same shape as src/lib/timeline/now.ts.
import { build, phases, type BuildMilestone, type Pairing, type Phase } from "../../data/roadmap.js";
import { weekStart, weekEnd, shiftDays, LAST_WEEK } from "./weeks.js";

export interface ThisWeek {
  week: number;              // 0 is the ramp; 1–22 are the build weeks
  phase: Phase;
  milestone?: BuildMilestone;
  reading: Pairing[];
  foundations: Pairing[];
}

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

export function thisWeek(now: Date): ThisWeek | null {
  const week = weekOf(now);
  const phase = currentPhase(now);
  if (week === null || phase === null) return null;
  return {
    week,
    phase,
    milestone: build.find((m) => m.id === phase.milestone),
    reading: phase.reading,
    foundations: phase.foundations,
  };
}
