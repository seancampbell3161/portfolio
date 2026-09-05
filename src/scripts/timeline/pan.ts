// src/scripts/timeline/pan.ts
// The overview strip as a control over the window's year offset (interactions
// spec §5). The server renders the strip aria-hidden; this module upgrades it
// into a slider. Keyboard here; pointer drag and tap are added below it.
import { maxOffset, windowFor, windowLabel } from "../../lib/timeline/layout";
import type { Ctx, TimelineState } from "./state";

export function initPan(ctx: Ctx): void {
  const strip = ctx.root.querySelector<HTMLElement>(".tl-ov");
  if (!strip) return;
  const { now, items, store } = ctx;
  const earliestYear = windowFor("all", now, items).from.getUTCFullYear();
  const thisYear = now.getUTCFullYear();

  strip.removeAttribute("aria-hidden");
  strip.tabIndex = 0;
  strip.setAttribute("role", "slider");
  strip.setAttribute("aria-label", "Visible years");
  strip.setAttribute("aria-valuemin", String(earliestYear));
  strip.setAttribute("aria-valuemax", String(thisYear));

  function updateAria(s: TimelineState): void {
    const win = windowFor(s.zoom, now, items, s.offset);
    strip!.setAttribute("aria-valuenow", String(win.to.getUTCFullYear()));
    strip!.setAttribute("aria-valuetext", windowLabel(s.zoom, win));
    if (maxOffset(s.zoom, now, items) === 0) strip!.setAttribute("aria-disabled", "true");
    else strip!.removeAttribute("aria-disabled");
  }
  updateAria(store.get());
  store.subscribe((s, prev) => {
    if (s.zoom !== prev.zoom || s.offset !== prev.offset) updateAria(s);
  });

  // Slider convention: left and down lower the value (an earlier year, a higher
  // offset); Home is the earliest year, End the current one.
  strip.addEventListener("keydown", (e) => {
    const s = store.get();
    const max = maxOffset(s.zoom, now, items);
    if (max === 0) return;
    let offset = s.offset;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        offset = Math.min(max, s.offset + 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        offset = Math.max(0, s.offset - 1);
        break;
      case "Home":
        offset = max;
        break;
      case "End":
        offset = 0;
        break;
      default:
        return;
    }
    e.preventDefault();
    store.set({ offset });
  });
}
