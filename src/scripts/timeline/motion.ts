// src/scripts/timeline/motion.ts
// The one motion on the page (foundation spec §9): the playhead draws in from
// the left once, over about 600ms. Not under reduced motion, not on a deep link.
import type { Ctx } from "./state";

export function initMotion(ctx: Ctx, opts: { skip: boolean }): void {
  const playhead = ctx.root.querySelector<HTMLElement>("[data-playhead]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!playhead || reduceMotion || opts.skip) return;
  const target = playhead.style.getPropertyValue("--x");
  playhead.style.setProperty("--x", "0");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      playhead.style.transition = "left 600ms ease-out";
      playhead.style.setProperty("--x", target);
    }),
  );
}
