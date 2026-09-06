// src/scripts/timeline/apply.ts
// One window in, the whole page out: clip positions and rows, ticks, the
// overview box, lane summaries, the playhead, the phone graph and the zoom
// buttons' pressed state. Runs on every zoom change and on resize. Nothing in
// here reads pointer or keyboard events.
import { LANES } from "../../lib/timeline/types";
import {
  ZOOMS,
  fraction,
  graphLayout,
  laneSummary,
  maxOffset,
  packLane,
  rowsNeeded,
  ticksFor,
  whenLabel,
  windowFor,
  windowLabel,
  type Zoom,
} from "../../lib/timeline/layout";
import { saveZoom, type Ctx, type TimelineState } from "./state";

export function applyLayout(ctx: Ctx, s: TimelineState): void {
  const { root, now, items, itemEls, elById, itemById } = ctx;
  const zoom = s.zoom;
  const win = windowFor(zoom, now, items, s.offset);
  const allWin = windowFor("all", now, items);
  const measure = ctx.measure();

  const placedIds = new Set<string>();
  LANES.forEach((lane, laneIndex) => {
    const packed = packLane(items, lane, win, now, measure);
    // Thumbnails spec §6: the building lane follows its packed rows, floor two.
    if (lane === "building") root.style.setProperty("--rows-building", String(rowsNeeded(packed, 2)));
    for (const p of packed) {
      const el = elById.get(p.item.id);
      if (!el) continue;
      el.style.setProperty("--lane", String(laneIndex));
      el.style.setProperty("--row", String(p.row));
      el.style.setProperty("--x", String(p.x));
      el.style.setProperty("--w", String(p.w));
      el.dataset.labeled = String(p.labeled);
      el.removeAttribute("data-out");
      placedIds.add(p.item.id);
    }
  });
  for (const el of itemEls) {
    if (!placedIds.has(el.dataset.id ?? "")) el.setAttribute("data-out", "");
    const when = el.querySelector(".tl-when");
    const item = itemById.get(el.dataset.id ?? "");
    if (when && item) {
      when.textContent = whenLabel(item.start, item.start.getTime() < win.from.getTime() ? "all" : zoom);
    }
  }

  const labelEl = root.querySelector("[data-window-label]");
  if (labelEl) {
    const label = windowLabel(zoom, win);
    labelEl.textContent = label;
    root.setAttribute("aria-label", `Timeline, ${label}`);
  }
  const ticksEl = root.querySelector<HTMLElement>("[data-ticks]");
  if (ticksEl) {
    ticksEl.replaceChildren(
      ...ticksFor(zoom, win).map((t) => {
        const span = document.createElement("span");
        span.style.setProperty("--x", String(t.x));
        span.textContent = t.label;
        return span;
      }),
    );
  }
  const ovWin = root.querySelector<HTMLElement>("[data-ov-window]");
  if (ovWin) {
    const x = fraction(win.from, allWin);
    ovWin.style.setProperty("--x", String(x));
    ovWin.style.setProperty("--w", String(fraction(win.to, allWin) - x));
  }
  for (const lane of LANES) {
    const el = root.querySelector(`[data-lane-summary="${lane}"]`);
    if (el) el.textContent = laneSummary(lane, items, win, now);
  }
  root.querySelector<HTMLElement>("[data-playhead]")?.style.setProperty("--x", String(fraction(now, win)));

  const g = graphLayout(items, win, now);
  const gutter = root.querySelector<HTMLElement>("[data-gutter]");
  if (gutter) {
    const bars = g.bars.map((b) => {
      const i = document.createElement("i");
      const live = itemById.get(b.id)?.status === "in-progress";
      i.className = `tl-bar${live ? " live" : ""}${b.toRow === null ? " to-now" : ""}`;
      i.style.cssText = `--lane:${LANES.indexOf(b.lane)};--slot:${b.slot};--from:${b.fromRow};--to:${b.toRow ?? g.nowRow};--c:var(--lane-${b.lane})`;
      return i;
    });
    const dots = g.dots.map((d) => {
      const i = document.createElement("i");
      i.className = "tl-dot";
      i.style.cssText = `--lane:${LANES.indexOf(d.lane)};--row:${d.row};--c:var(--lane-${d.lane})`;
      return i;
    });
    gutter.replaceChildren(...bars, ...dots);
  }
  root.querySelector<HTMLElement>("[data-nowline]")?.style.setProperty("--row", String(g.nowRow));

  root.dataset.zoom = zoom;
  const thisYear = now.getUTCFullYear();
  document.querySelectorAll<HTMLButtonElement>("[data-zoom-control] button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.zoom === zoom));
    if (b.dataset.zoom !== "year") return;
    // Spec §5.3: the button always names the last year of the window on screen,
    // and at the year zoom while panned it is the way back to this year.
    b.textContent = String(win.to.getUTCFullYear());
    if (zoom === "year" && s.offset > 0) b.setAttribute("aria-label", `Back to ${thisYear}`);
    else b.removeAttribute("aria-label");
  });
}

/** Today's date in the transport bar, the zoom buttons, resize, and the layout listener. */
export function initApply(ctx: Ctx): void {
  const { now, store } = ctx;

  const nowLabel = document.querySelector<HTMLTimeElement>("[data-now-label]");
  if (nowLabel) {
    nowLabel.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    nowLabel.dateTime = now.toISOString().slice(0, 10);
  }
  store.subscribe((s, prev) => {
    if (s.zoom !== prev.zoom || s.offset !== prev.offset) applyLayout(ctx, s);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-zoom-control] button").forEach((b) =>
    b.addEventListener("click", () => {
      const z = b.dataset.zoom as Zoom;
      if (!ZOOMS.includes(z)) return;
      const s = store.get();
      // The offset survives year <-> three-years, resets at "all", and the
      // pressed year button while panned means "back to this year".
      let offset = z === "all" ? 0 : Math.min(s.offset, maxOffset(z, now, ctx.items));
      if (z === "year" && s.zoom === "year" && s.offset > 0) offset = 0;
      store.set({ zoom: z, offset });
      saveZoom(z);
    }),
  );

  let resizeTimer = 0;
  addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => applyLayout(ctx, store.get()), 150);
  });
}
