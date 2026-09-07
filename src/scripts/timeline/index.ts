// src/scripts/timeline/index.ts
// Progressive enhancement for the home timeline (foundation spec §9). Without
// this folder the page already works: clips are links and CSS :target shows
// panels. Each module exports an init that registers listeners against the
// shared store; this file reads the page, builds the context and runs them.
// Re-runnable: registered through onPage, so every navigation rebuilds the
// store and the previous run's listeners are dropped with its signal.
import { ZOOMS, offsetToShow, positionIn, windowFor, type Zoom } from "../../lib/timeline/layout";
import { hashFor, parseHash } from "../../lib/timeline/scrub";
import { onPage, type PageCtx } from "../lifecycle";
import { readItems, makeMeasurer } from "./items";
import { createStore, readZoom, type Ctx, type TimelineState } from "./state";
import { applyLayout, initApply } from "./apply";
import { initInspector, openItem } from "./inspector";
import { initMotion } from "./motion";
import { initNow } from "./now";
import { initPan } from "./pan";
import { initScrub, pin } from "./scrub";

/**
 * The URL is a function of state (spec §8.2): #item-<id>, #on-<date>, or
 * nothing. Pin changes are coalesced (spec §4.4): a drag or a held arrow key
 * changes the pin many times a second, and browsers rate-limit replaceState
 * (WebKit throws after 100 calls in 30 s). Item changes and clearing write at
 * once. A failed write is swallowed: the page must keep rendering even when
 * the URL falls behind.
 */
const HASH_DELAY_MS = 300;

export function initTimeline({ first, signal }: PageCtx): void {
  const root = document.querySelector<HTMLElement>("[data-timeline]");
  if (!root) return;

  const now = new Date();
  const refs = readItems(root);
  const store = createStore({
    zoom: readZoom() ?? (root.dataset.zoom as Zoom) ?? "year",
    offset: 0,
    pinned: null,
    openId: null,
  });
  const ctx: Ctx = { root, now, ...refs, measure: () => makeMeasurer(root), store, signal };

  let hashTimer = 0;
  signal.addEventListener("abort", () => window.clearTimeout(hashTimer));

  function writeHash(hash: string): void {
    try {
      history.replaceState(null, "", location.pathname + location.search + hash);
    } catch {
      /* rate-limited or blocked: the URL lags, nothing else does */
    }
  }
  function syncHash(s: TimelineState, prev: TimelineState): void {
    if (s.openId === prev.openId && s.pinned?.getTime() === prev.pinned?.getTime()) return;
    window.clearTimeout(hashTimer);
    const hash = s.openId ? `#item-${s.openId}` : s.pinned ? hashFor(s.pinned) : "";
    const pinMoved = s.pinned !== null && prev.pinned !== null && s.openId === null;
    if (pinMoved) {
      hashTimer = window.setTimeout(() => writeHash(hash), HASH_DELAY_MS);
    } else {
      writeHash(hash);
    }
  }

  initApply(ctx);
  initNow(ctx);
  initInspector(ctx);
  initPan(ctx);
  initScrub(ctx);
  // Last: the URL is a courtesy and must never run ahead of rendering, so a
  // throw or a slow write in here cannot starve the listeners that draw.
  store.subscribe(syncHash);
  applyLayout(ctx, store.get());

  const deepLinked = openDeepLink(ctx);
  // Only a cold load replays the playhead draw-in (spec §3.3): arriving here
  // from inside the site finds the arrangement already running.
  initMotion(ctx, { skip: deepLinked || !first });
}

onPage(initTimeline);

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
