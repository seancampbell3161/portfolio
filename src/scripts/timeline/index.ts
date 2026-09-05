// src/scripts/timeline/index.ts
// Progressive enhancement for the home timeline (foundation spec §9). Without
// this folder the page already works: clips are links and CSS :target shows
// panels. Each module exports an init that registers listeners against the
// shared store; this file reads the page, builds the context and runs them.
import { ZOOMS, offsetToShow, positionIn, windowFor, type Zoom } from "../../lib/timeline/layout";
import { hashFor, parseHash } from "../../lib/timeline/scrub";
import { readItems, makeMeasurer } from "./items";
import { createStore, readZoom, type Ctx, type TimelineState } from "./state";
import { applyLayout, initApply } from "./apply";
import { initInspector, openItem } from "./inspector";
import { initMotion } from "./motion";
import { initPan } from "./pan";
import { initScrub, pin } from "./scrub";

document.documentElement.classList.add("js");

const root = document.querySelector<HTMLElement>("[data-timeline]");
if (root) init(root);

function init(root: HTMLElement): void {
  const now = new Date();
  const refs = readItems(root);
  const store = createStore({
    zoom: readZoom() ?? (root.dataset.zoom as Zoom) ?? "year",
    offset: 0,
    pinned: null,
    openId: null,
  });
  const ctx: Ctx = { root, now, ...refs, measure: () => makeMeasurer(root), store };

  store.subscribe(syncHash);
  initApply(ctx);
  initInspector(ctx);
  initPan(ctx);
  initScrub(ctx);
  applyLayout(ctx, store.get());

  const deepLinked = openDeepLink(ctx);
  initMotion(ctx, { skip: deepLinked });
}

/** The URL is a function of state (spec §8.2): #item-<id>, #on-<date>, or nothing. */
function syncHash(s: TimelineState, prev: TimelineState): void {
  if (s.openId === prev.openId && s.pinned?.getTime() === prev.pinned?.getTime()) return;
  const hash = s.openId ? `#item-${s.openId}` : s.pinned ? hashFor(s.pinned) : "";
  history.replaceState(null, "", location.pathname + location.search + hash);
}

/**
 * Spec §8.3. #item-<id>: widen the zoom (without remembering it) until the item
 * is on screen, then open it without stealing focus. #on-<date>: pan to the
 * offset that shows the date, pin it, and bring the panel near. Either skips
 * the playhead draw-in.
 */
function openDeepLink(ctx: Ctx): boolean {
  const link = parseHash(location.hash);
  if (!link) return false;
  if (link.kind === "item") {
    // A hash that merely matches the deep-link pattern always suppresses the
    // playhead draw-in, even when the item no longer exists (a stale link) --
    // matching the original script.
    if (!document.getElementById(`item-${link.id}`)) return true;
    const item = ctx.itemById.get(link.id);
    if (item) {
      const current = ctx.store.get().zoom;
      const needed =
        ZOOMS.find((z) => positionIn(item, windowFor(z, ctx.now, ctx.items), ctx.now) !== null) ?? current;
      if (ZOOMS.indexOf(needed) > ZOOMS.indexOf(current)) ctx.store.set({ zoom: needed });
    }
    openItem(ctx, link.id, { scroll: true, focus: false });
    return true;
  }
  const s = ctx.store.get();
  ctx.store.set({ offset: offsetToShow(link.date, s.zoom, ctx.now, ctx.items) });
  pin(ctx, link.date);
  document.getElementById("on-date")?.scrollIntoView({ block: "nearest" });
  return true;
}
