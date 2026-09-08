// src/scripts/roadmap-schedule.ts
// Keeps the this-week band honest when a deploy goes stale. Every phase's panel
// is already in the page, so this only re-picks which one is shown and rewrites
// the heading — it never builds DOM, and the panel it reveals always matches
// the label above it.
import { onPage } from "./lifecycle";
import { currentPhase, weekLabel } from "../lib/roadmap/schedule";

export function initThisWeek(): void {
  const band = document.querySelector<HTMLElement>("[data-this-week]");
  if (!band) return;

  const now = new Date();
  const label = band.querySelector<HTMLElement>("[data-week-label]");
  if (label) label.textContent = weekLabel(now);

  const activeId = currentPhase(now)?.id;
  for (const panel of band.querySelectorAll<HTMLElement>("[data-week-panel]")) {
    panel.hidden = panel.dataset.weekPanel !== activeId;
  }
}

onPage(initThisWeek);
