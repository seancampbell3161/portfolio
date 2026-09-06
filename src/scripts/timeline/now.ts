// src/scripts/timeline/now.ts
// The hero's "Right now" readout follows the real day (interactions 2). The
// build renders every entry that touched the build day; between deploys that
// set can only shrink (a moment ages past its 14-day window, a span reaches
// its end), so this module only removes. Nothing new can appear without a
// rebuild, and without JavaScript the page stays as built.
import { onDate } from "../../lib/timeline/track";
import type { Ctx } from "./state";

export function initNow(ctx: Ctx): void {
  const block = document.querySelector<HTMLElement>("[data-right-now]");
  if (!block) return;
  const today = new Set(onDate(ctx.items, ctx.now, ctx.now).map((i) => i.id));

  for (const row of block.querySelectorAll<HTMLElement>("[data-now-row]")) {
    for (const dd of row.querySelectorAll<HTMLElement>("dd[data-id]")) {
      if (!today.has(dd.dataset.id ?? "")) dd.remove();
    }
    const left = row.querySelectorAll("dd");
    if (left.length === 0) row.remove();
    else if (left.length === 1) left[0].querySelector<HTMLElement>("[data-now-when]")?.removeAttribute("hidden");
  }
  if (!block.querySelector("[data-now-row]")) block.remove();
}
