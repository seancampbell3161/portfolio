// src/scripts/roadmap-schedule.ts
// Keeps the this-week band honest when a deploy goes stale — a build shipped on
// a Friday would still claim "Week 1" three weeks later. Unlike the hero's
// readout (src/scripts/timeline/now.ts), which may only remove, this one
// rewrites: its inputs are WEEK_ONE and the static phase table, both already in
// this bundle, so recomputing on the client is exactly as trustworthy.
import { onPage } from "./lifecycle";
import { thisWeek } from "../lib/roadmap/schedule";
import { LAST_WEEK, weekStart } from "../lib/roadmap/weeks";
import { longDate } from "../lib/dates";

onPage(() => {
  const band = document.querySelector<HTMLElement>("[data-this-week]");
  if (!band) return;

  const now = new Date();
  const w = thisWeek(now);
  const before = now.getTime() < weekStart(0).getTime();

  const set = (sel: string, text: string) => {
    const el = band.querySelector<HTMLElement>(sel);
    if (el) el.textContent = text;
  };

  set("[data-week-label]", w === null
    ? (before ? `The plan starts ${longDate(weekStart(0))}` : "The plan is finished")
    : (w.week === 0 ? "Ramp week" : `Week ${w.week} of ${LAST_WEEK}`));
  set("[data-week-phase]", w?.phase.name ?? "");
});
