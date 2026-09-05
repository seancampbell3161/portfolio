// src/scripts/timeline/pan.ts
// The overview strip as a control over the window's year offset (interactions
// spec §5). The server renders the strip aria-hidden; this module upgrades it
// into a slider. Keyboard here; pointer drag and tap are added below it.
import { fraction, maxOffset, offsetForDrag, offsetToShow, windowFor, windowLabel } from "../../lib/timeline/layout";
import { dateAt } from "../../lib/timeline/scrub";
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
    if (e.altKey || e.ctrlKey || e.metaKey) return;
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

  // ---- pointer: drag pans, a tap jumps (spec §5.2) ----
  const box = strip.querySelector<HTMLElement>("[data-ov-window]");
  const allWin = windowFor("all", now, items);
  const TAP_PX = 4;
  let pointerId: number | null = null;
  let startX = 0;
  let startOffset = 0;
  let boxX0 = 0;
  let boxW = 0;
  let dragging = false;

  // Mirrors the box positioning in apply.ts's applyLayout; kept here because the
  // drag overrides --x on every move, so the layout listener alone cannot
  // restore the snapped position on release.
  /** Put the box exactly where the current offset's window sits. */
  function settleBox(): void {
    if (!box) return;
    const s = store.get();
    const win = windowFor(s.zoom, now, items, s.offset);
    const x = fraction(win.from, allWin);
    box.style.setProperty("--x", String(x));
    box.style.setProperty("--w", String(fraction(win.to, allWin) - x));
  }

  strip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || pointerId !== null) return;
    const s = store.get();
    if (maxOffset(s.zoom, now, items) === 0) return;
    pointerId = e.pointerId;
    strip!.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startOffset = s.offset;
    dragging = false;
    const win = windowFor(s.zoom, now, items, s.offset);
    boxX0 = fraction(win.from, allWin);
    boxW = fraction(win.to, allWin) - boxX0;
    e.preventDefault();
  });

  strip.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) < TAP_PX) return;
    dragging = true;
    strip!.setAttribute("data-dragging", "");
    const delta = dx / strip!.clientWidth;
    const s = store.get();
    const next = offsetForDrag(startOffset, delta, s.zoom, now, items);
    // Re-lay first (the layout listener also moves the box to the snapped
    // position), then let the box follow the pointer until release.
    if (next !== s.offset) store.set({ offset: next });
    box?.style.setProperty("--x", String(Math.min(1 - boxW, Math.max(0, boxX0 + delta))));
  });

  function release(e: PointerEvent, cancelled: boolean): void {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    strip!.releasePointerCapture(e.pointerId);
    strip!.removeAttribute("data-dragging");
    const s = store.get();
    if (!dragging && !cancelled) {
      // A tap: the smallest move that shows the year under the pointer.
      const r = strip!.getBoundingClientRect();
      const date = dateAt((e.clientX - r.left) / r.width, allWin);
      const next = offsetToShow(date, s.zoom, now, items, s.offset);
      if (next !== s.offset) store.set({ offset: next });
      return;
    }
    dragging = false;
    settleBox();
  }
  strip.addEventListener("pointerup", (e) => release(e, false));
  strip.addEventListener("pointercancel", (e) => release(e, true));
}
