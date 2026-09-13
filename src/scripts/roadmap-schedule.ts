// src/scripts/roadmap-schedule.ts
// Keeps the roadmap's week honest when a deploy goes stale. Every block is
// already in the page, so this only rewrites each week label and re-picks which
// phase and build blocks show (roadmap-now spec §6). It never builds DOM, so a
// revealed block always matches the label above it. On /roadmap/now it drives
// RoadmapNow.astro; pages without those hooks are left alone.
import { onPage } from "./lifecycle";
import { nowShowing, weekLabel } from "../lib/roadmap/schedule";

export function initSchedule(): void {
  const now = new Date();

  const label = weekLabel(now);
  for (const el of document.querySelectorAll<HTMLElement>("[data-week-label]")) {
    el.textContent = label;
  }

  const { phase, milestone } = nowShowing(now);
  for (const el of document.querySelectorAll<HTMLElement>("[data-now-phase]")) {
    el.hidden = el.dataset.nowPhase !== phase;
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-now-milestone]")) {
    el.hidden = el.dataset.nowMilestone !== milestone;
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-now-outside]")) {
    el.hidden = phase !== null;
  }
}

onPage(initSchedule);
