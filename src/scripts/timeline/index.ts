// src/scripts/timeline/index.ts
// Progressive enhancement for the home timeline (foundation spec §9). Without
// this folder the page already works: clips are links and CSS :target shows
// panels. Each module exports an init that registers listeners against the
// shared store; this file reads the page, builds the context and runs them.
import { ZOOMS, positionIn, windowFor, type Zoom } from "../../lib/timeline/layout";
import { readItems, makeMeasurer } from "./items";
import { createStore, readZoom, type Ctx, type TimelineState } from "./state";
import { applyLayout, initApply } from "./apply";
import { initInspector, openItem } from "./inspector";
import { initMotion } from "./motion";

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
  applyLayout(ctx, store.get());

  const deepLinked = openDeepLink(ctx);
  initMotion(ctx, { skip: deepLinked });
}

/** The URL is a function of state (spec §8.2): #item-<id>, or nothing. */
function syncHash(s: TimelineState, prev: TimelineState): void {
  if (s.openId === prev.openId) return;
  const hash = s.openId ? `#item-${s.openId}` : "";
  history.replaceState(null, "", location.pathname + location.search + hash);
}

/**
 * #item-<id> on load: widen the zoom (without remembering it) until the item is
 * on screen, then open it without stealing focus. A hash that merely matches the
 * deep-link pattern always suppresses the draw-in below, even when the item no
 * longer exists (a stale link) -- matching the original script.
 */
function openDeepLink(ctx: Ctx): boolean {
  const m = location.hash.match(/^#item-([a-z0-9-]+)$/);
  if (!m) return false;
  if (!document.getElementById(`item-${m[1]}`)) return true;
  const item = ctx.itemById.get(m[1]);
  if (item) {
    const current = ctx.store.get().zoom;
    const needed =
      ZOOMS.find((z) => positionIn(item, windowFor(z, ctx.now, ctx.items), ctx.now) !== null) ?? current;
    if (ZOOMS.indexOf(needed) > ZOOMS.indexOf(current)) ctx.store.set({ zoom: needed });
  }
  openItem(ctx, m[1], { scroll: true, focus: false });
  return true;
}
