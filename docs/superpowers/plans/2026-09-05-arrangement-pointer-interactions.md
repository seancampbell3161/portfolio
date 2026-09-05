# Arrangement interactions 1 (scrub and pan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a visitor scrub the home timeline's ruler to see what was happening on any date, and drag the overview strip to pan the window back a year at a time, on desktop and phones.

**Architecture:** The pure math grows in `src/lib/timeline/` (a year offset on the window, an "on this date" overlap helper, and a small cursor module), all unit-tested. The client script `src/scripts/timeline.ts` becomes a folder of modules that share one store: layout, inspector, scrub and pan never call each other, they set state and listeners react. Roles and handlers are added by the script, so the built HTML stays exactly as usable without JavaScript as it is today.

**Tech Stack:** Astro 5, TypeScript, Vitest, plain CSS with custom properties, vanilla-JS progressive enhancement, Pointer Events. Node 20.

**Spec:** `docs/superpowers/specs/2026-09-05-arrangement-pointer-interactions-design.md`

## Global Constraints

- **All calendar math is UTC.** Content dates are UTC midnight. Every user-visible date goes through `src/lib/dates.ts`. The one existing `toLocaleDateString` call (today's date in the transport bar) is pre-existing and stays.
- **No new dependencies, no framework, no islands.** Scripts are plain modules imported from a page's `<script>` tag.
- **The built HTML gains no interactive roles.** The overview strip and the ruler keep `aria-hidden="true"` in the server output; only the client script removes it and adds `role="slider"`, `tabindex` and the value attributes (spec §7.1).
- **No motion is added.** Dimming has no transition; the cursor and the overview box are positioned, never animated. The playhead draw-in in `motion.ts` is the page's only animation and stays as it is.
- **The playhead never moves.** "Now" is the build date nudged to the real date on load, and nothing in this plan changes it.
- **The offset is not persisted.** Only `timeline-zoom` is stored in `localStorage`, wrapped in try/catch.
- **The roadmap is untouched.** Nothing under `src/scripts/roadmap*.ts`, `src/scripts/review.ts`, `src/components/roadmap/` or `netlify/` changes.
- **The responsive breakpoint is 900px**, written `@media (max-width: 899.98px)` and `@media (min-width: 900px)`.
- **Commit messages carry no co-author or agent trailer.** The repo owner's global instructions forbid it.
- **Every task ends with `npx tsc --noEmit` and `npx vitest run` green.** `tsc` runs clean on the repo today, so any output is a regression.

**Wording ruling made while planning (spec §4.1 amended):** the cursor's chip uses `monthDayYear` ("Sep 14, 2024", the transport bar's format) so it does not cover the month ticks; the panel heading and the slider's value text use `longDate` ("14 September 2024"). The slider role and pointer handlers sit on the ruler's ticks area (`[data-ticks]`), and `aria-hidden` is removed from the ruler that contains it.

---

### Task 1: Split the client script into modules, no behavior change

The current `src/scripts/timeline.ts` is one 262-line closure doing six jobs. Move it into `src/scripts/timeline/` with one module per job and a store the later tasks hang on. Nothing the page does changes in this task; the store carries `offset` and `pinned` fields that stay at their initial values until Tasks 5 and 8.

**Files:**
- Create: `src/scripts/timeline/state.ts`
- Create: `src/scripts/timeline/items.ts`
- Create: `src/scripts/timeline/apply.ts`
- Create: `src/scripts/timeline/inspector.ts`
- Create: `src/scripts/timeline/motion.ts`
- Create: `src/scripts/timeline/index.ts`
- Delete: `src/scripts/timeline.ts`
- Modify: `src/pages/index.astro:31` (the import path)
- Modify: `src/components/Inspector.astro:93-94` (a comment naming the old path)
- Modify: `src/lib/timeline/layout.ts:2` and `src/scripts/roadmap-arrangement.ts:5` (comments naming the old path)
- Modify: `CLAUDE.md:24` (the path in "Component composition")

**Interfaces:**
- Consumes: `src/lib/timeline/layout.ts` (`ZOOMS`, `Zoom`, `windowFor`, `fraction`, `positionIn`, `packLane`, `ticksFor`, `laneSummary`, `graphLayout`, `whenLabel`, `WidthEstimator`), `src/lib/timeline/types.ts` (`LANES`, `TimelineItem`, `Lane`, `Kind`, `Status`).
- Produces, from `state.ts`: `TimelineState { zoom: Zoom; offset: number; pinned: Date | null; openId: string | null }`, `Store { get(); set(patch); subscribe(fn) }`, `createStore(initial)`, `Ctx { root; now; items; itemEls; elById; itemById; measure(); store }`, `readZoom()`, `saveZoom(z)`. From `apply.ts`: `applyLayout(ctx, state)`, `initApply(ctx)`. From `inspector.ts`: `openItem(ctx, id, { scroll?, focus? })`, `closeItem(ctx)`, `initInspector(ctx)`. From `motion.ts`: `initMotion(ctx, { skip })`. From `items.ts`: `readItems(root)`, `makeMeasurer(root)`.

- [ ] **Step 1: Create `src/scripts/timeline/state.ts`**

```ts
// src/scripts/timeline/state.ts
// The one place the home timeline's client state lives, plus the shared context
// every module's init receives. Modules never call each other's layout or DOM
// code directly: they set state, and listeners react (interactions spec §8.2).
import type { WidthEstimator, Zoom } from "../../lib/timeline/layout";
import { ZOOMS } from "../../lib/timeline/layout";
import type { TimelineItem } from "../../lib/timeline/types";

export interface TimelineState {
  zoom: Zoom;
  /** Whole years back from the preset window; 0 is the preset itself (spec §5.1). */
  offset: number;
  /** The scrub cursor's pinned date (spec §4.2), or null. */
  pinned: Date | null;
  /** The open inspector item, or null. */
  openId: string | null;
}

export type Listener = (state: TimelineState, prev: TimelineState) => void;

export interface Store {
  get(): TimelineState;
  /** Merge a patch; notify listeners only when something changed. */
  set(patch: Partial<TimelineState>): void;
  subscribe(fn: Listener): () => void;
}

const sameDate = (a: Date | null, b: Date | null): boolean =>
  a === null || b === null ? a === b : a.getTime() === b.getTime();

export function createStore(initial: TimelineState): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const next = { ...state, ...patch };
      if (
        next.zoom === prev.zoom &&
        next.offset === prev.offset &&
        next.openId === prev.openId &&
        sameDate(next.pinned, prev.pinned)
      ) {
        return;
      }
      state = next;
      for (const fn of listeners) fn(next, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** What every module's init receives. */
export interface Ctx {
  root: HTMLElement;
  now: Date;
  items: TimelineItem[];
  itemEls: HTMLLIElement[];
  elById: Map<string, HTMLLIElement>;
  itemById: Map<string, TimelineItem>;
  /** Fresh each call: label widths depend on the current clip-area width. */
  measure: () => WidthEstimator;
  store: Store;
}

// ---- zoom persistence (spec §5.5: the zoom is remembered, the offset is not) ----
const ZOOM_KEY = "timeline-zoom";

export function readZoom(): Zoom | null {
  try {
    const z = localStorage.getItem(ZOOM_KEY);
    return ZOOMS.includes(z as Zoom) ? (z as Zoom) : null;
  } catch {
    return null;
  }
}

export function saveZoom(z: Zoom): void {
  try {
    localStorage.setItem(ZOOM_KEY, z);
  } catch {
    /* private mode or blocked storage: the choice just isn't remembered */
  }
}
```

- [ ] **Step 2: Create `src/scripts/timeline/items.ts`**

```ts
// src/scripts/timeline/items.ts
// Rebuilds the item list from the server-rendered markup and measures label
// widths with a canvas, so the browser packs rows with real widths (foundation
// spec §7) instead of the build-time estimate.
import type { Kind, Lane, Status, TimelineItem } from "../../lib/timeline/types";
import type { WidthEstimator } from "../../lib/timeline/layout";

export interface ItemRefs {
  items: TimelineItem[];
  itemEls: HTMLLIElement[];
  elById: Map<string, HTMLLIElement>;
  itemById: Map<string, TimelineItem>;
}

export function readItems(root: HTMLElement): ItemRefs {
  const itemEls = Array.from(root.querySelectorAll<HTMLLIElement>(".tl-item"));
  const items: TimelineItem[] = itemEls.map((el) => ({
    id: el.dataset.id ?? "",
    lane: el.dataset.lane as Lane,
    kind: el.dataset.kind as Kind,
    status: el.dataset.status as Status,
    start: new Date(el.dataset.start ?? ""),
    end: el.dataset.end ? new Date(el.dataset.end) : undefined,
    title: el.querySelector(".tl-title")?.textContent ?? "",
    subtitle: el.querySelector(".tl-sub")?.textContent ?? undefined,
    href: el.querySelector<HTMLAnchorElement>(".tl-clip")?.getAttribute("href") ?? "#",
  }));
  return {
    items,
    itemEls,
    elById: new Map(itemEls.map((el) => [el.dataset.id ?? "", el])),
    itemById: new Map(items.map((i) => [i.id, i])),
  };
}

export function makeMeasurer(root: HTMLElement): WidthEstimator {
  const area = root.querySelector<HTMLElement>(".tl-items");
  const sample = root.querySelector<HTMLElement>(".tl-clip");
  const font = sample ? getComputedStyle(sample).font : "13px sans-serif";
  const ctx = document.createElement("canvas").getContext("2d");
  return (item) => {
    const width = area?.clientWidth || 1040;
    if (!ctx) return ((item.title.length + (item.subtitle?.length ?? 0)) * 7 + 30) / width;
    ctx.font = font;
    let px = ctx.measureText(item.title).width + 26;
    if (item.subtitle) {
      ctx.font = font.replace(/\d+(\.\d+)?px/, "12px");
      px += 8 + ctx.measureText(item.subtitle).width;
    }
    return px / width;
  };
}
```

- [ ] **Step 3: Create `src/scripts/timeline/apply.ts`**

```ts
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
  packLane,
  ticksFor,
  whenLabel,
  windowFor,
  type Zoom,
} from "../../lib/timeline/layout";
import { saveZoom, type Ctx, type TimelineState } from "./state";

export function applyLayout(ctx: Ctx, s: TimelineState): void {
  const { root, now, items, itemEls, elById, itemById } = ctx;
  const zoom = s.zoom;
  const win = windowFor(zoom, now, items);
  const allWin = windowFor("all", now, items);
  const measure = ctx.measure();

  const placedIds = new Set<string>();
  LANES.forEach((lane, laneIndex) => {
    for (const p of packLane(items, lane, win, now, measure)) {
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

  const windowLabel = root.querySelector("[data-window-label]");
  if (windowLabel) {
    const label =
      zoom === "year"
        ? String(win.from.getUTCFullYear())
        : `${win.from.getUTCFullYear()} to ${win.to.getUTCFullYear()}`;
    windowLabel.textContent = label;
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
  document
    .querySelectorAll<HTMLButtonElement>("[data-zoom-control] button")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zoom === zoom)));
}

/** Today's date in the transport bar, the zoom buttons, resize, and the layout listener. */
export function initApply(ctx: Ctx): void {
  const { now, store } = ctx;

  const nowLabel = document.querySelector<HTMLTimeElement>("[data-now-label]");
  if (nowLabel) {
    nowLabel.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    nowLabel.dateTime = now.toISOString().slice(0, 10);
  }
  const yearButton = document.querySelector<HTMLButtonElement>('[data-zoom-control] button[data-zoom="year"]');
  if (yearButton) yearButton.textContent = String(now.getUTCFullYear());

  store.subscribe((s, prev) => {
    if (s.zoom !== prev.zoom || s.offset !== prev.offset) applyLayout(ctx, s);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-zoom-control] button").forEach((b) =>
    b.addEventListener("click", () => {
      const z = b.dataset.zoom as Zoom;
      if (!ZOOMS.includes(z)) return;
      store.set({ zoom: z });
      saveZoom(z);
    }),
  );

  let resizeTimer = 0;
  addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => applyLayout(ctx, store.get()), 150);
  });
}
```

- [ ] **Step 4: Create `src/scripts/timeline/inspector.ts`**

```ts
// src/scripts/timeline/inspector.ts
// The inspector's DOM follows the store: whichever item id is open gets
// data-open on its panel and data-selected on its clip. Focus and scrolling are
// side effects of the two entry points below, not of state changes, so a deep
// link can open a panel without stealing focus.
import type { Ctx } from "./state";

const panelFor = (id: string): HTMLElement | null => document.getElementById(`item-${id}`);

export function openItem(ctx: Ctx, id: string, opts: { scroll?: boolean; focus?: boolean } = {}): void {
  const panel = panelFor(id);
  if (!panel || !ctx.elById.has(id)) return;
  ctx.store.set({ openId: id });
  if (opts.scroll) panel.scrollIntoView({ block: "nearest" });
  if (opts.focus !== false) panel.focus({ preventScroll: !opts.scroll });
}

export function closeItem(ctx: Ctx): void {
  const id = ctx.store.get().openId;
  if (!id) return;
  ctx.store.set({ openId: null });
  ctx.elById.get(id)?.querySelector<HTMLElement>(".tl-clip")?.focus();
}

export function initInspector(ctx: Ctx): void {
  ctx.store.subscribe((s, prev) => {
    if (s.openId === prev.openId) return;
    if (prev.openId) {
      panelFor(prev.openId)?.removeAttribute("data-open");
      ctx.elById.get(prev.openId)?.removeAttribute("data-selected");
    }
    if (s.openId) {
      panelFor(s.openId)?.setAttribute("data-open", "");
      ctx.elById.get(s.openId)?.setAttribute("data-selected", "");
    }
  });

  // Delegated on the document, not the timeline root, so a link to an item from
  // anywhere on the page (later: the "On this date" panel) opens it in place.
  document.addEventListener("click", (e) => {
    const target = e.target as Element;
    const a = target.closest<HTMLAnchorElement>("a[data-item-link]");
    if (a) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      openItem(ctx, a.dataset.itemLink ?? "", { scroll: true });
      return;
    }
    if (target.closest("[data-inspector-close]")) {
      e.preventDefault();
      closeItem(ctx);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ctx.store.get().openId) closeItem(ctx);
  });
}
```

- [ ] **Step 5: Create `src/scripts/timeline/motion.ts`**

```ts
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
```

- [ ] **Step 6: Create `src/scripts/timeline/index.ts`**

```ts
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
 * on screen, then open it without stealing focus.
 */
function openDeepLink(ctx: Ctx): boolean {
  const m = location.hash.match(/^#item-([a-z0-9-]+)$/);
  if (!m || !document.getElementById(`item-${m[1]}`)) return false;
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
```

- [ ] **Step 7: Point the page at the folder and delete the old file**

In `src/pages/index.astro`, change the script block to:

```astro
<script>
  import "../scripts/timeline/index";
</script>
```

Then:

```bash
git rm -q src/scripts/timeline.ts
```

- [ ] **Step 8: Update the three comments and CLAUDE.md that name the old path**

In `src/components/Inspector.astro`, the comment above `html:not(.js) .insp:target` becomes:

```css
  /* Without JavaScript the URL hash shows a panel; with it, the script owns the state
     (see src/scripts/timeline/, whose index adds the js class). */
```

In `src/lib/timeline/layout.ts` line 2, replace `src/scripts/timeline.ts` with `src/scripts/timeline/`. In `src/scripts/roadmap-arrangement.ts` line 5, replace `src/scripts/timeline.ts` with `src/scripts/timeline/apply.ts`.

In `CLAUDE.md`, in the "Component composition" paragraph, replace `by \`src/scripts/timeline.ts\` with it` with `by \`src/scripts/timeline/\` with it`.

- [ ] **Step 9: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no `tsc` output, every test passes, the build succeeds. If `tsc` reports the `...refs` spread not matching `Ctx`, the `ItemRefs` fields were renamed; they must be `items`, `itemEls`, `elById`, `itemById`.

- [ ] **Step 10: Smoke the page for identical behavior**

Run `npm run preview` in the background and open `http://localhost:4321/` at 1280px wide. Check each of these, which are all the behaviors the old script had:

1. The transport bar shows today's date and the first zoom button shows the current year.
2. Clicking "3 yr" and "All" re-lays the lanes, changes the ruler ticks and the corner label, moves the overview box, and marks the pressed button. Reload: the choice is remembered.
3. Clicking a clip opens its panel below, marks the clip, sets the URL hash to `#item-<id>`, and focuses the panel. Clicking another clip swaps panels. Escape closes and returns focus to the clip; the hash clears.
4. Opening `http://localhost:4321/#item-roaming-camp` directly opens that panel without focusing it, with no playhead animation. Opening an essay hash such as `#item-essay-io-multiplexing` widens the zoom if needed.
5. Reload without a hash: the playhead draws in from the left once.
6. Resize the window: the lanes re-pack after a short pause.
7. At 390px wide the vertical graph shows, and "3 yr" and "All" still change its rows.

- [ ] **Step 11: Commit**

```bash
git add src/scripts/timeline src/pages/index.astro src/components/Inspector.astro src/lib/timeline/layout.ts src/scripts/roadmap-arrangement.ts CLAUDE.md
git commit -m "refactor(timeline): split the client script into modules behind one store"
```

---

### Task 2: The window's year offset

Pure math in `layout.ts`: the offset on `windowFor`, its bound, the offset that shows a date, the offset a drag lands on, and one shared label helper so the corner label and the strip's value text come from one place.

**Files:**
- Modify: `src/lib/timeline/layout.ts`
- Test: `src/lib/timeline/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `windowFor(zoom, now, items, offset = 0): Window`, `maxOffset(zoom, now, items): number`, `offsetToShow(date, zoom, now, items, current = 0): number`, `offsetForDrag(startOffset, deltaFraction, zoom, now, items): number`, `windowLabel(zoom, w): string`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/timeline/__tests__/layout.test.ts`, and add `maxOffset`, `offsetToShow`, `offsetForDrag`, `windowLabel` to the import from `../layout.js`:

```ts
describe("windowFor with a year offset (interactions 1, §5.1)", () => {
  const items = [mk("a", "learning", "2021-01-15"), mk("b", "writing", "2025-12-21")];
  it("offset zero is the preset", () => {
    expect(windowFor("year", NOW, items, 0)).toEqual(windowFor("year", NOW, items));
  });
  it("shifts both ends of the year window back by whole years", () => {
    const w = windowFor("year", NOW, items, 2);
    expect(w.from).toEqual(new Date(Date.UTC(2024, 0, 1)));
    expect(w.to.getUTCFullYear()).toBe(2024);
    expect(w.to.getUTCMonth()).toBe(11);
    expect(w.to.getUTCDate()).toBe(31);
  });
  it("shifts the three-year window the same way", () => {
    const w = windowFor("three-years", NOW, items, 1);
    expect(w.from.getUTCFullYear()).toBe(2022);
    expect(w.from.getUTCMonth()).toBe(8);
    expect(w.to.getUTCFullYear()).toBe(2025);
  });
  it("ignores the offset at the all zoom", () => {
    expect(windowFor("all", NOW, items, 3)).toEqual(windowFor("all", NOW, items));
  });
});

describe("maxOffset", () => {
  const items = [mk("a", "learning", "2021-01-15"), mk("b", "writing", "2025-12-21")];
  it("is the current year minus the earliest item's year, for year and three-years alike", () => {
    expect(maxOffset("year", NOW, items)).toBe(5);
    expect(maxOffset("three-years", NOW, items)).toBe(5);
  });
  it("is zero for all, and zero with no items", () => {
    expect(maxOffset("all", NOW, items)).toBe(0);
    expect(maxOffset("year", NOW, [])).toBe(0);
  });
});

describe("offsetToShow", () => {
  const items = [mk("a", "learning", "2021-01-15"), mk("b", "writing", "2025-12-21")];
  it("is zero for a date already in the preset window", () => {
    expect(offsetToShow(d("2026-03-01"), "year", NOW, items)).toBe(0);
  });
  it("is the year distance at the year zoom", () => {
    expect(offsetToShow(d("2024-06-15"), "year", NOW, items)).toBe(2);
  });
  it("prefers the containing window nearest the current offset", () => {
    // June 2025 lies in the offset-0 (Sep 2023 to Dec 2026) and offset-1 (Sep 2022 to Dec 2025) three-year windows.
    expect(offsetToShow(d("2025-06-01"), "three-years", NOW, items)).toBe(0);
    expect(offsetToShow(d("2025-06-01"), "three-years", NOW, items, 3)).toBe(1);
  });
  it("clamps: before the earliest window gives the max, after the newest gives zero", () => {
    expect(offsetToShow(d("2015-01-01"), "year", NOW, items)).toBe(5);
    expect(offsetToShow(d("2030-01-01"), "year", NOW, items)).toBe(0);
  });
  it("is zero at the all zoom", () => {
    expect(offsetToShow(d("2024-06-15"), "all", NOW, items)).toBe(0);
  });
});

describe("offsetForDrag", () => {
  // The all-time window runs 2021-01-15 to 2026-12-31, about 5.96 years.
  const items = [mk("a", "learning", "2021-01-15"), mk("b", "writing", "2025-12-21")];
  it("rounds a drag shorter than half a year away", () => {
    expect(offsetForDrag(0, -0.05, "year", NOW, items)).toBe(0);
  });
  it("dragging left (earlier) raises the offset once past half a year", () => {
    expect(offsetForDrag(0, -0.1, "year", NOW, items)).toBe(1);
  });
  it("dragging right (later) lowers it", () => {
    expect(offsetForDrag(3, 0.2, "year", NOW, items)).toBe(2);
  });
  it("clamps at both ends", () => {
    expect(offsetForDrag(0, 0.5, "year", NOW, items)).toBe(0);
    expect(offsetForDrag(5, -0.5, "year", NOW, items)).toBe(5);
  });
  it("never moves at the all zoom", () => {
    expect(offsetForDrag(0, -0.5, "all", NOW, items)).toBe(0);
  });
});

describe("windowLabel", () => {
  it("is the year at the year zoom and a range otherwise", () => {
    expect(windowLabel("year", windowFor("year", NOW, [], 2))).toBe("2024");
    expect(windowLabel("three-years", windowFor("three-years", NOW, [], 1))).toBe("2022 to 2025");
    expect(windowLabel("all", windowFor("all", NOW, [mk("a", "learning", "2021-01-15")]))).toBe("2021 to 2026");
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: FAIL, `maxOffset is not a function` (or an import error).

- [ ] **Step 3: Implement**

In `src/lib/timeline/layout.ts`, replace the existing `windowFor` with:

```ts
function earliestStart(items: readonly TimelineItem[]): Date | null {
  let earliest: Date | null = null;
  for (const item of items) {
    if (!earliest || item.start.getTime() < earliest.getTime()) earliest = item.start;
  }
  return earliest;
}

function shiftYears(d: Date, years: number): Date {
  const c = new Date(d.getTime());
  c.setUTCFullYear(c.getUTCFullYear() + years);
  return c;
}

/** Spec §5 zoom windows, shifted back `offset` whole years (interactions spec §5.1). "all" ignores the offset. */
export function windowFor(zoom: Zoom, now: Date, items: readonly TimelineItem[], offset = 0): Window {
  const to = endOfYear(now);
  let base: Window;
  if (zoom === "year") base = { from: startOfYear(now), to };
  else if (zoom === "three-years") base = { from: shiftYears(now, -3), to };
  else return { from: earliestStart(items) ?? startOfYear(now), to };
  if (offset === 0) return base;
  return { from: shiftYears(base.from, -offset), to: shiftYears(base.to, -offset) };
}

/** How far back the window may pan: the current year minus the earliest item's year. Zero for "all". */
export function maxOffset(zoom: Zoom, now: Date, items: readonly TimelineItem[]): number {
  if (zoom === "all") return 0;
  const earliest = earliestStart(items);
  if (!earliest) return 0;
  return Math.max(0, now.getUTCFullYear() - earliest.getUTCFullYear());
}

function contains(w: Window, t: number): boolean {
  return t >= w.from.getTime() && t <= w.to.getTime();
}

/**
 * The offset whose window contains `date`, choosing the one nearest `current`
 * when several do (ties go to the smaller). Before every window: the max.
 * After every window: zero.
 */
export function offsetToShow(
  date: Date,
  zoom: Zoom,
  now: Date,
  items: readonly TimelineItem[],
  current = 0,
): number {
  const max = maxOffset(zoom, now, items);
  const t = date.getTime();
  let best: number | null = null;
  for (let o = 0; o <= max; o++) {
    if (!contains(windowFor(zoom, now, items, o), t)) continue;
    if (best === null || Math.abs(o - current) < Math.abs(best - current)) best = o;
  }
  if (best !== null) return best;
  return t < windowFor(zoom, now, items, max).from.getTime() ? max : 0;
}

const YEAR_MS = 365.25 * 86_400_000;

/**
 * Where a drag lands: the pointer's travel as a fraction of the all-time strip,
 * in years, rounded to a whole offset and clamped. Dragging right moves the
 * window later, so it lowers the offset.
 */
export function offsetForDrag(
  startOffset: number,
  deltaFraction: number,
  zoom: Zoom,
  now: Date,
  items: readonly TimelineItem[],
): number {
  const all = windowFor("all", now, items);
  const years = (all.to.getTime() - all.from.getTime()) / YEAR_MS;
  const raw = Math.round(startOffset - deltaFraction * years);
  return Math.min(maxOffset(zoom, now, items), Math.max(0, raw));
}

/** The corner label and the strip's value text: "2024", or "2022 to 2025". */
export function windowLabel(zoom: Zoom, w: Window): string {
  return zoom === "year" ? String(w.from.getUTCFullYear()) : `${w.from.getUTCFullYear()} to ${w.to.getUTCFullYear()}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: PASS, including every pre-existing `windowFor` test.

- [ ] **Step 5: Use `windowLabel` in the two places that compute the label today**

In `src/components/Timeline.astro`, replace the `const windowLabel = ...` ternary with:

```ts
const label = windowLabel(zoom, win);
```

and change the two uses of `windowLabel` in that file's template (the section's `aria-label` and the corner `<span>`) to `label`; add `windowLabel` to the import from `../lib/timeline/layout`. In `src/scripts/timeline/apply.ts`, replace the ternary inside `if (windowLabel)` with `const label = windowLabel(zoom, win);` and add `windowLabel` to the import; rename the DOM query variable from `windowLabel` to `labelEl` so the names do not collide.

- [ ] **Step 6: Type-check, test, build, commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean.

```bash
git add src/lib/timeline/layout.ts src/lib/timeline/__tests__/layout.test.ts src/components/Timeline.astro src/scripts/timeline/apply.ts
git commit -m "feat(timeline): year offset on the window, with the offsets a tap and a drag land on"
```

---

### Task 3: The cursor module

A new pure module for the scrub cursor: date from a fraction, keyboard steps, the slider's day index, and both hash shapes.

**Files:**
- Create: `src/lib/timeline/scrub.ts`
- Test: `src/lib/timeline/__tests__/scrub.test.ts`

**Interfaces:**
- Consumes: `Window` from `./layout.js`.
- Produces: `dateAt(fraction, win): Date`, `stepDate(date, unit, direction, bounds): Date`, `dayIndex(date, win): number`, `parseHash(hash): DeepLink | null`, `hashFor(date): string`, type `DeepLink = { kind: "item"; id: string } | { kind: "on"; date: Date }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/timeline/__tests__/scrub.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dateAt, stepDate, dayIndex, parseHash, hashFor } from "../scrub.js";

const d = (s: string) => new Date(s);
const YEAR = { from: d("2026-01-01T00:00:00Z"), to: d("2026-12-31T23:59:59.999Z") };
const ALL = { from: d("2021-01-15T00:00:00Z"), to: d("2026-12-31T23:59:59.999Z") };

describe("dateAt (interactions 1, §6.3)", () => {
  it("maps 0 and 1 to the window's edges, floored to a UTC day", () => {
    expect(dateAt(0, YEAR)).toEqual(d("2026-01-01T00:00:00Z"));
    expect(dateAt(1, YEAR)).toEqual(d("2026-12-31T00:00:00Z"));
  });
  it("floors a mid-day fraction to that day", () => {
    expect(dateAt(0.5, YEAR)).toEqual(d("2026-07-02T00:00:00Z"));
  });
  it("clamps fractions outside the window", () => {
    expect(dateAt(-0.3, YEAR)).toEqual(d("2026-01-01T00:00:00Z"));
    expect(dateAt(1.7, YEAR)).toEqual(d("2026-12-31T00:00:00Z"));
  });
  it("never lands before a window that starts mid-day", () => {
    const w = { from: d("2023-09-02T12:00:00Z"), to: YEAR.to };
    expect(dateAt(0, w)).toEqual(w.from);
  });
});

describe("stepDate", () => {
  it("steps a month, keeping the day", () => {
    expect(stepDate(d("2026-03-15"), "month", 1, ALL)).toEqual(d("2026-04-15"));
    expect(stepDate(d("2026-03-15"), "month", -1, ALL)).toEqual(d("2026-02-15"));
  });
  it("crosses year ends in both directions", () => {
    expect(stepDate(d("2025-12-15"), "month", 1, ALL)).toEqual(d("2026-01-15"));
    expect(stepDate(d("2026-01-15"), "month", -1, ALL)).toEqual(d("2025-12-15"));
  });
  it("falls back to the last day of a shorter month", () => {
    expect(stepDate(d("2026-01-31"), "month", 1, ALL)).toEqual(d("2026-02-28"));
    expect(stepDate(d("2024-02-29"), "year", 1, ALL)).toEqual(d("2025-02-28"));
  });
  it("steps a year", () => {
    expect(stepDate(d("2024-06-15"), "year", -1, ALL)).toEqual(d("2023-06-15"));
  });
  it("clamps to the bounds", () => {
    expect(stepDate(d("2026-12-15"), "month", 1, ALL)).toEqual(ALL.to);
    expect(stepDate(d("2021-01-20"), "month", -1, ALL)).toEqual(ALL.from);
    expect(stepDate(d("2021-06-01"), "year", -1, ALL)).toEqual(ALL.from);
  });
});

describe("dayIndex", () => {
  it("counts whole days from the window's start", () => {
    expect(dayIndex(d("2026-01-01"), YEAR)).toBe(0);
    expect(dayIndex(d("2026-01-02"), YEAR)).toBe(1);
    expect(dayIndex(YEAR.to, YEAR)).toBe(364);
  });
});

describe("parseHash and hashFor", () => {
  it("reads an item hash", () => {
    expect(parseHash("#item-daw-engine")).toEqual({ kind: "item", id: "daw-engine" });
  });
  it("reads a date hash as UTC midnight", () => {
    expect(parseHash("#on-2024-06-15")).toEqual({ kind: "on", date: d("2024-06-15T00:00:00Z") });
  });
  it("rejects malformed and impossible dates, and anything else", () => {
    expect(parseHash("#on-2024-02-31")).toBeNull();
    expect(parseHash("#on-2024-6-1")).toBeNull();
    expect(parseHash("#item-Bad_Id")).toBeNull();
    expect(parseHash("#lane-writing")).toBeNull();
    expect(parseHash("")).toBeNull();
  });
  it("round-trips a date", () => {
    expect(hashFor(d("2024-06-15"))).toBe("#on-2024-06-15");
    expect(parseHash(hashFor(d("2024-06-15")))).toEqual({ kind: "on", date: d("2024-06-15T00:00:00Z") });
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/lib/timeline/__tests__/scrub.test.ts`
Expected: FAIL, cannot find module `../scrub.js`.

- [ ] **Step 3: Implement**

Create `src/lib/timeline/scrub.ts`:

```ts
// src/lib/timeline/scrub.ts
// Pure math for the scrub cursor (interactions spec §6.3): a date from a
// pointer fraction, keyboard steps, the slider's day index, and the two hash
// shapes the home page deep-links with. UTC throughout, no DOM.
import type { Window } from "./layout.js";

const DAY_MS = 86_400_000;

const floorToDay = (t: number): number => Math.floor(t / DAY_MS) * DAY_MS;

/** `fraction` of the window, clamped, floored to a UTC day, never before `from`. */
export function dateAt(fraction: number, win: Window): Date {
  const f = Math.min(1, Math.max(0, fraction));
  const t = win.from.getTime() + f * (win.to.getTime() - win.from.getTime());
  return new Date(Math.max(win.from.getTime(), floorToDay(t)));
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * One month or one year in either direction, keeping the day of the month and
 * falling back to the last day of a shorter month; clamped to `bounds`.
 */
export function stepDate(date: Date, unit: "month" | "year", direction: -1 | 1, bounds: Window): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  let ny = y;
  let nm = m;
  if (unit === "year") {
    ny = y + direction;
  } else {
    const total = m + direction;
    ny = y + Math.floor(total / 12);
    nm = ((total % 12) + 12) % 12;
  }
  const target = Date.UTC(ny, nm, Math.min(day, daysIn(ny, nm)));
  return new Date(Math.min(bounds.to.getTime(), Math.max(bounds.from.getTime(), target)));
}

/** Whole days from `win.from` to `date`, for aria-valuenow. */
export function dayIndex(date: Date, win: Window): number {
  return Math.floor((date.getTime() - win.from.getTime()) / DAY_MS);
}

export type DeepLink = { kind: "item"; id: string } | { kind: "on"; date: Date };

/** `#item-<slug>` or `#on-YYYY-MM-DD`; anything else, including an impossible date, is null. */
export function parseHash(hash: string): DeepLink | null {
  const item = hash.match(/^#item-([a-z0-9-]+)$/);
  if (item) return { kind: "item", id: item[1] };
  const on = hash.match(/^#on-(\d{4})-(\d{2})-(\d{2})$/);
  if (!on) return null;
  const [y, m, day] = [Number(on[1]), Number(on[2]), Number(on[3])];
  const date = new Date(Date.UTC(y, m - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) return null;
  return { kind: "on", date };
}

/** "#on-2024-06-15" */
export function hashFor(date: Date): string {
  return `#on-${date.toISOString().slice(0, 10)}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/timeline/__tests__/scrub.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/scrub.ts src/lib/timeline/__tests__/scrub.test.ts
git commit -m "feat(timeline): cursor math, keyboard steps and the two deep-link hashes"
```

---

### Task 4: `onDate` in the track module

What was happening on one day, across every lane, in the order the panel lists it.

**Files:**
- Modify: `src/lib/timeline/track.ts`
- Test: `src/lib/timeline/__tests__/track.test.ts`

**Interfaces:**
- Consumes: `spanTouches`, `MOMENT_WINDOW_DAYS`, `DAY_MS`, `LANES` already in the module.
- Produces: `onDate(items: readonly TimelineItem[], date: Date, now: Date): TimelineItem[]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/timeline/__tests__/track.test.ts` and add `onDate` to the import from `../track.js`:

```ts
describe("onDate (interactions 1, §6.2)", () => {
  const now = d("2026-09-02");
  const item = (o: Partial<TimelineItem> & Pick<TimelineItem, "id" | "lane" | "start" | "kind">): TimelineItem => ({
    title: o.id,
    status: "done",
    href: `/#item-${o.id}`,
    ...o,
  });
  const day = d("2024-06-15");

  const essay = item({ id: "essay", lane: "writing", start: d("2024-06-15"), kind: "moment" });
  const essayEdge = item({ id: "essay-edge", lane: "writing", start: d("2024-06-01"), kind: "moment" }); // 14 days before
  const essayFar = item({ id: "essay-far", lane: "writing", start: d("2024-06-30"), kind: "moment" }); // 15 days after
  const project = item({ id: "project", lane: "building", start: d("2024-06-15"), end: d("2024-08-01"), kind: "span" });
  const ended = item({ id: "ended", lane: "building", start: d("2024-01-01"), end: d("2024-06-15"), kind: "span" });
  const before = item({ id: "before", lane: "building", start: d("2024-01-01"), end: d("2024-06-14"), kind: "span" });
  const ongoing = item({ id: "ongoing", lane: "learning", start: d("2024-01-01"), kind: "span", status: "in-progress" });
  const talk = item({ id: "talk", lane: "community", start: d("2024-06-20"), kind: "moment" });
  const all = [talk, ongoing, before, ended, project, essayEdge, essayFar, essay];

  it("includes a span on its first and on its last day, not the day after it ends", () => {
    const ids = onDate(all, day, now).map((i) => i.id);
    expect(ids).toContain("project");
    expect(ids).toContain("ended");
    expect(ids).not.toContain("before");
  });
  it("runs an ongoing span to now and not before its start", () => {
    expect(onDate(all, day, now).map((i) => i.id)).toContain("ongoing");
    expect(onDate(all, d("2026-09-01"), now).map((i) => i.id)).toContain("ongoing");
    expect(onDate(all, d("2023-12-31"), now).map((i) => i.id)).not.toContain("ongoing");
  });
  it("includes a moment 14 days away and excludes one 15 days away", () => {
    const ids = onDate(all, day, now).map((i) => i.id);
    expect(ids).toContain("essay-edge");
    expect(ids).not.toContain("essay-far");
  });
  it("orders by lane in timeline order, then start, then id", () => {
    expect(onDate(all, day, now).map((i) => i.id)).toEqual([
      "essay-edge", "essay", "ended", "project", "ongoing", "talk",
    ]);
  });
  it("returns an empty list for an empty day", () => {
    expect(onDate(all, d("2019-01-01"), now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `onDate is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/timeline/track.ts`, after `during`, add:

```ts
/**
 * Interactions spec §6.2: what was happening on one day. A span counts when the
 * day lies between its start and its effective end (its end, or now while in
 * progress), inclusive. A moment counts within MOMENT_WINDOW_DAYS either side.
 * Every lane, in timeline order; within a lane by start, then id.
 */
export function onDate(items: readonly TimelineItem[], date: Date, now: Date): TimelineItem[] {
  const t = date.getTime();
  const overlaps = (item: TimelineItem): boolean =>
    item.kind === "span"
      ? spanTouches(item, t, t, now)
      : Math.abs(item.start.getTime() - t) <= MOMENT_WINDOW_DAYS * DAY_MS;
  return items
    .filter(overlaps)
    .sort(
      (a, b) =>
        LANES.indexOf(a.lane) - LANES.indexOf(b.lane) ||
        a.start.getTime() - b.start.getTime() ||
        a.id.localeCompare(b.id),
    );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts
git commit -m "feat(timeline): onDate, what was happening on one day across every lane"
```

---

### Task 5: The offset flows through layout, the zoom buttons, and the strip's keyboard slider

The window now honors `state.offset`. The year button shows the year on screen and doubles as "back to this year". The overview strip becomes a keyboard slider over the offset. Pointer handling comes in Task 6.

**Files:**
- Modify: `src/scripts/timeline/apply.ts`
- Create: `src/scripts/timeline/pan.ts`
- Modify: `src/scripts/timeline/index.ts`

**Interfaces:**
- Consumes: `windowFor(..., offset)`, `maxOffset`, `windowLabel` from Task 2; `Ctx`, `TimelineState`, `Store` from Task 1.
- Produces: `initPan(ctx)` from `pan.ts`. The strip's aria contract: `role="slider"`, `aria-label="Visible years"`, `aria-valuemin` earliest year, `aria-valuemax` current year, `aria-valuenow` the window's last year, `aria-valuetext` the window label, `aria-disabled="true"` when the max offset is zero.

- [ ] **Step 1: Thread the offset through `applyLayout`**

In `src/scripts/timeline/apply.ts`:

1. Change `const win = windowFor(zoom, now, items);` to `const win = windowFor(zoom, now, items, s.offset);`.
2. Add `maxOffset` to the import from `../../lib/timeline/layout`.
3. Replace the zoom-button block at the end of `applyLayout` with one that also drives the year button:

```ts
  root.dataset.zoom = zoom;
  const thisYear = now.getUTCFullYear();
  document.querySelectorAll<HTMLButtonElement>("[data-zoom-control] button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.zoom === zoom));
    if (b.dataset.zoom !== "year") return;
    // Spec §5.3: at the year zoom the button names the year on screen, and while
    // panned it is the way back to this year.
    b.textContent = String(zoom === "year" ? win.to.getUTCFullYear() : thisYear);
    if (zoom === "year" && s.offset > 0) b.setAttribute("aria-label", `Back to ${thisYear}`);
    else b.removeAttribute("aria-label");
  });
```

4. In `initApply`, delete the two lines that set `yearButton` (the `const yearButton = ...` and the `if (yearButton) ...`), since `applyLayout` owns that text now.
5. Replace the zoom click handler body with the offset rules from spec §5.3:

```ts
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
```

- [ ] **Step 2: Create `src/scripts/timeline/pan.ts` with the keyboard slider**

```ts
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
```

- [ ] **Step 3: Run `initPan` from the index**

In `src/scripts/timeline/index.ts`, import `initPan` from `./pan` and call `initPan(ctx);` right after `initInspector(ctx);`.

- [ ] **Step 4: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean. The `strip!` non-null assertions inside `updateAria` are there because TypeScript does not narrow across the closure; if `tsc` complains about them, keep the guard at the top and the assertions as written.

- [ ] **Step 5: Verify in the browser**

Run `npm run preview` in the background. At `http://localhost:4321/` at 1280px wide:

1. Tab past the transport bar's links: the first stop inside the timeline is the overview strip, with the site's blue focus ring. Open the accessibility tree in devtools: it is a slider, "Visible years", value the current year, value text the corner label.
2. Press Left: the corner label reads last year, the ruler shows that year's months, the overview box moves left one year, the first zoom button reads last year and its accessible name is "Back to <this year>". Press Left until the earliest year; further Left does nothing. Press End: back to this year.
3. At last year, click "3 yr": the corner label reads a range ending last year. Click the year button: the year zoom at last year (offset kept). Click it again: this year.
4. Click "All": the corner label spans everything, the strip has `aria-disabled="true"`, Left and Right do nothing. Click the year button: this year at the year zoom.
5. Reload: the zoom is remembered, the offset is not (this year shows).
6. At 390px wide, Tab to the strip and press Left: the vertical graph's rows change to last year's items.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/timeline/apply.ts src/scripts/timeline/pan.ts src/scripts/timeline/index.ts
git commit -m "feat(timeline): pan the window a year at a time from the keyboard; the year button is the way back"
```

---

### Task 6: Drag and tap the overview strip

Pointer handling on the strip: drag pans with the box following the pointer and the arrangement re-laying at each year crossing; a tap jumps to the year under the pointer; touch lets vertical scroll through.

**Files:**
- Modify: `src/scripts/timeline/pan.ts`
- Modify: `src/components/Timeline.astro` (strip styles)

**Interfaces:**
- Consumes: `offsetForDrag`, `offsetToShow`, `fraction`, `windowFor` from `layout.ts`; `dateAt` from `scrub.ts`.
- Produces: `data-dragging` on the strip while a drag is in flight (styling hook only).

- [ ] **Step 1: Add the pointer handlers to `pan.ts`**

Add to the imports:

```ts
import { fraction, maxOffset, offsetForDrag, offsetToShow, windowFor, windowLabel } from "../../lib/timeline/layout";
import { dateAt } from "../../lib/timeline/scrub";
```

(replacing the existing layout import line). Then append inside `initPan`, after the keydown listener:

```ts
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
```

- [ ] **Step 2: Style the strip as a control**

In `src/components/Timeline.astro`, inside the `is:global` style block, directly after the `.tl-ov { ... }` rule, add:

```css
  /* The strip is a control (interactions spec §5.2, §7.5): drag pans, tap jumps,
     a vertical swipe still scrolls the page. The script adds role=slider. */
  .tl-ov {
    cursor: grab;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }
  .tl-ov[data-dragging] {
    cursor: grabbing;
  }
  .tl-ov[aria-disabled="true"] {
    cursor: default;
  }
```

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean.

- [ ] **Step 4: Verify in the browser**

With `npm run preview` running, at 1280px wide:

1. Hover the strip: a grab cursor. Press and drag left slowly: the box follows the pointer, the cursor is a grabbing hand, and as the box crosses half a year the lanes re-lay to the previous year and the corner label changes. Release: the box snaps to the year boundary. The URL does not change.
2. Drag right past this year: the box stops at the right edge and the offset stays at zero.
3. Click (no movement) on the 2024 part of the strip at the year zoom: the window jumps to 2024. Click inside the box: nothing happens.
4. At the "All" zoom: the cursor is the default arrow and dragging does nothing.
5. At 390px wide in device emulation: a horizontal swipe on the strip pans the graph a year; a vertical swipe starting on the strip scrolls the page.
6. Tab to the strip and use the keys from Task 5: still work.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/timeline/pan.ts src/components/Timeline.astro
git commit -m "feat(timeline): drag the overview strip to pan, tap it to jump"
```

---

### Task 7: Markup and styles for the cursor, the pin tick, dimming and the date panel, plus the home contract test

Everything the scrub script will drive is rendered here, hidden, with no behavior yet. The contract test locks the hooks in `dist/index.html` before any script depends on them.

**Files:**
- Modify: `src/components/Timeline.astro`
- Modify: `src/components/Inspector.astro`
- Create: `src/__tests__/home-contract.test.ts`

**Interfaces:**
- Produces, in `Timeline.astro`: `[data-cursor]` (`.tl-cursor`, positioned by `--x`, flips its chip with `data-flip`), `[data-cursor-label]`, `[data-ov-pin]` (`.tl-ov-pin`, positioned by `--x` in the all-time strip); the root attribute `data-scrubbing` and the item attribute `data-touch` that the dimming CSS keys on. In `Inspector.astro`: `#on-date` (`.insp.insp-date`), `[data-on-date-title]`, `[data-on-date-list]`.

- [ ] **Step 1: Write the failing contract test**

Create `src/__tests__/home-contract.test.ts`:

```ts
// The home page is server-rendered markup driven by src/scripts/timeline/, which
// finds its targets by data attribute and id. A markup change can break scrub,
// pan or the inspector with a green unit suite and a clean build, so this reads
// the built page and asserts every hook is still there. It needs dist/, so it is
// skipped without one; `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const PAGE = "dist/index.html";
const built = existsSync(PAGE);

describe.skipIf(!built)("home client contract (dist/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  it("keeps the root, the overview strip's box and pin tick", () => {
    for (const hook of ["data-timeline", "data-ov-window", "data-ov-pin"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  it("keeps the ruler, ticks, playhead and cursor", () => {
    for (const hook of ["data-window-label", "data-ticks", "data-playhead", "data-cursor", "data-cursor-label"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  it("keeps the strip and the ruler aria-hidden in the built page; the script adds the roles", () => {
    expect(html).toMatch(/<div class="tl-ov" aria-hidden="true"/);
    expect(html).toMatch(/<div class="tl-ruler" aria-hidden="true"/);
    expect(html).not.toContain('role="slider"');
  });

  it("keeps the date panel and its two fill targets", () => {
    expect(html).toContain('id="on-date"');
    expect(html).toContain("data-on-date-title");
    expect(html).toContain("data-on-date-list");
  });

  it("keeps the zoom control and its three buttons", () => {
    expect(html).toContain("data-zoom-control");
    for (const z of ["year", "three-years", "all"]) {
      expect(html, `missing zoom ${z}`).toContain(`data-zoom="${z}"`);
    }
  });

  it("keeps every attribute the script rebuilds items and the graph from", () => {
    for (const hook of [
      'class="tl-item"', "data-id=", "data-lane=", "data-kind=", "data-status=", "data-start=",
      "data-item-link=", "data-inspector-close", "data-lane-summary=", "data-gutter", "data-nowline", "data-now-label",
    ]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });
});
```

- [ ] **Step 2: Build and run it to see the three new hooks fail**

Run: `npm run build && npx vitest run src/__tests__/home-contract.test.ts`
Expected: FAIL on the pin tick, the cursor, and the date panel assertions; the rest pass.

- [ ] **Step 3: Add the cursor and pin tick to `Timeline.astro`**

In the template, directly after the `<div class="tl-ov-win" data-ov-window ...></div>` line, add:

```astro
    <i class="tl-ov-pin" data-ov-pin hidden></i>
```

Directly after the `<div class="tl-playhead" ...>...</div>` line, add:

```astro
    <div class="tl-cursor" aria-hidden="true" data-cursor hidden><span data-cursor-label></span></div>
```

- [ ] **Step 4: Add the cursor, pin tick and dimming styles**

In the `is:global` block of `Timeline.astro`, directly after the `.tl-playhead span { ... }` rule, add:

```css
  /* ---------- scrub cursor (interactions spec §4.1, §7.5) ---------- */
  .tl-cursor {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--head-w) + (100% - var(--head-w)) * var(--x));
    width: 1px;
    background: var(--color-text-secondary);
    pointer-events: none;
    z-index: 1;
  }
  .tl-cursor span {
    position: absolute;
    top: 7px;
    left: 6px;
    padding: 1px 5px;
    border-radius: 2px;
    background: var(--color-text-secondary);
    color: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
  }
  /* Near the right edge the chip would be clipped by the stage; the script flips it. */
  .tl-cursor[data-flip] span {
    left: auto;
    right: 6px;
  }
  .tl-ticks {
    cursor: crosshair;
  }
  .tl-ticks:focus-visible {
    outline: 2px solid var(--lane-learning);
    outline-offset: -2px;
  }
  /* While a cursor shows, clips that do not touch its date step back. No transition. */
  .tl[data-scrubbing] .tl-item:not([data-touch]) {
    opacity: 0.35;
  }
```

Directly after the `.tl-ov-win { ... }` rule, add:

```css
  .tl-ov-pin {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--x) * 100%);
    width: 1px;
    background: var(--color-text-primary);
    pointer-events: none;
  }
```

In the `@media (max-width: 899.98px)` block, change the rule that hides the ruler and playhead to also hide the cursor:

```css
    .tl-ruler,
    .tl-playhead,
    .tl-cursor {
      display: none;
    }
```

- [ ] **Step 5: Add the date panel to `Inspector.astro`**

In the template, directly after the closing `})}` of the `items.map(...)` block and before `</div>`, add:

```astro
  <section
    class="insp insp-date"
    id="on-date"
    tabindex="-1"
    role="region"
    aria-labelledby="on-date-title"
    hidden
    style="--c: var(--color-text-primary)"
  >
    <div class="insp-main">
      <p class="insp-k"><i aria-hidden="true"></i>On this date</p>
      <h2 id="on-date-title" data-on-date-title></h2>
      <ul class="insp-on" data-on-date-list></ul>
      <div class="insp-links">
        <a href="#" class="insp-close" data-inspector-close>Close</a>
      </div>
    </div>
  </section>
```

In the style block, directly after the `.insp-facts dd { ... }` rule, add:

```css
  /* The "On this date" panel (interactions spec §4.3): one column, filled by the
     script. Without JavaScript it must never show, even when targeted. */
  .insp-date {
    grid-template-columns: 1fr;
  }
  html:not(.js) .insp-date:target {
    display: none;
  }
  .insp-on {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 15px;
  }
  .insp-on li {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 10px;
  }
  .insp-on li i {
    flex: none;
    align-self: center;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--c);
  }
  .insp-on a {
    color: var(--color-text-primary);
    padding-bottom: 1px;
    border-bottom: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  }
  .insp-on small {
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .insp-on .insp-empty {
    color: var(--color-text-secondary);
  }
```

- [ ] **Step 6: Build and run the contract test and the suite**

Run: `npm run build && npx vitest run`
Expected: everything passes, including the home contract test.

- [ ] **Step 7: Confirm nothing visible changed**

With `npm run preview` running, load `http://localhost:4321/` at 1280px and 390px: the page looks exactly as before (the cursor, tick and panel are hidden). Load `http://localhost:4321/#on-date` with JavaScript disabled in devtools: no empty panel shows.

- [ ] **Step 8: Commit**

```bash
git add src/components/Timeline.astro src/components/Inspector.astro src/__tests__/home-contract.test.ts
git commit -m "feat(timeline): hidden cursor, pin tick and date panel, locked by a home contract test"
```

---

### Task 8: Scrub with the pointer

Hover shows the cursor and dims clips; press pins; drag moves the pin; the panel fills; the hash follows; Escape unpins. One thing open at a time.

**Files:**
- Create: `src/scripts/timeline/scrub.ts`
- Modify: `src/scripts/timeline/inspector.ts` (opening an item unpins)
- Modify: `src/scripts/timeline/index.ts` (hash sync covers the pin; run `initScrub`)

**Interfaces:**
- Consumes: `dateAt`, `hashFor` from `lib/timeline/scrub.ts`; `onDate`, `whenText` from `track.ts`; `fraction`, `windowFor` from `layout.ts`; `longDate`, `monthDayYear` from `lib/dates.ts`; `Ctx`, `TimelineState`.
- Produces: `initScrub(ctx)` and the exported `pin(ctx, date)` / `unpin(ctx)` helpers Task 9 reuses.

- [ ] **Step 1: Make opening an item unpin**

In `src/scripts/timeline/inspector.ts`, in `openItem`, change `ctx.store.set({ openId: id });` to:

```ts
  ctx.store.set({ openId: id, pinned: null });
```

- [ ] **Step 2: Create `src/scripts/timeline/scrub.ts`**

```ts
// src/scripts/timeline/scrub.ts
// The ruler as a scrub bar (interactions spec §4). Hover shows a cursor and dims
// the clips that do not touch its date; pressing pins it; the pinned date fills
// the "On this date" panel and lives in the URL. The playhead never moves.
import { fraction, windowFor } from "../../lib/timeline/layout";
import { dateAt } from "../../lib/timeline/scrub";
import { onDate, whenText } from "../../lib/timeline/track";
import { longDate, monthDayYear } from "../../lib/dates";
import type { TimelineItem } from "../../lib/timeline/types";
import type { Ctx } from "./state";

/** Pin a date. Pinning closes an open item (spec §8.2: one thing open at a time). */
export function pin(ctx: Ctx, date: Date): void {
  ctx.store.set({ pinned: date, openId: null });
}

export function unpin(ctx: Ctx): void {
  ctx.store.set({ pinned: null });
}

export function initScrub(ctx: Ctx): void {
  const { root, now, items, itemEls, store } = ctx;
  const ruler = root.querySelector<HTMLElement>(".tl-ruler");
  const ticks = root.querySelector<HTMLElement>("[data-ticks]");
  const cursor = root.querySelector<HTMLElement>("[data-cursor]");
  const label = root.querySelector<HTMLElement>("[data-cursor-label]");
  const pinTick = root.querySelector<HTMLElement>("[data-ov-pin]");
  const panel = document.getElementById("on-date");
  const title = panel?.querySelector<HTMLElement>("[data-on-date-title]");
  const list = panel?.querySelector<HTMLElement>("[data-on-date-list]");
  if (!ruler || !ticks || !cursor || !label || !panel || !title || !list) return;

  // The script owns the panel from here; .insp stays display:none until data-open.
  panel.hidden = false;
  const allWin = windowFor("all", now, items);
  const currentWindow = () => {
    const s = store.get();
    return windowFor(s.zoom, now, items, s.offset);
  };
  let hover: Date | null = null;

  function dateFromPointer(e: PointerEvent): Date {
    const r = ticks!.getBoundingClientRect();
    return dateAt((e.clientX - r.left) / r.width, currentWindow());
  }

  // ---- render: cursor line, chip, dimming, pin tick ----
  function render(): void {
    const s = store.get();
    const shown = s.pinned ?? hover;
    const f = shown ? fraction(shown, currentWindow()) : -1;
    // A pinned date outside the window keeps its pin, panel and hash (spec
    // §8.4) but shows no cursor and dims nothing.
    const visible = shown !== null && f >= 0 && f <= 1;
    cursor!.hidden = !visible;
    if (visible && shown) {
      cursor!.style.setProperty("--x", String(f));
      cursor!.toggleAttribute("data-flip", f > 0.8);
      label!.textContent = monthDayYear(shown);
      root.setAttribute("data-scrubbing", "");
      const touching = new Set(onDate(items, shown, now).map((i) => i.id));
      for (const el of itemEls) el.toggleAttribute("data-touch", touching.has(el.dataset.id ?? ""));
    } else {
      root.removeAttribute("data-scrubbing");
      for (const el of itemEls) el.removeAttribute("data-touch");
    }
    if (pinTick) {
      pinTick.hidden = !s.pinned;
      if (s.pinned) pinTick.style.setProperty("--x", String(fraction(s.pinned, allWin)));
    }
  }

  // ---- the panel ----
  function entry(item: TimelineItem): HTMLLIElement {
    const li = document.createElement("li");
    li.style.setProperty("--c", `var(--lane-${item.lane})`);
    const dot = document.createElement("i");
    dot.setAttribute("aria-hidden", "true");
    const a = document.createElement("a");
    a.href = `#item-${item.id}`;
    a.dataset.itemLink = item.id;
    a.textContent = item.title;
    const when = document.createElement("small");
    when.textContent = whenText(item);
    li.append(dot, a, when);
    return li;
  }
  function fillPanel(date: Date): void {
    title!.textContent = longDate(date);
    const found = onDate(items, date, now);
    if (found.length) {
      list!.replaceChildren(...found.map(entry));
    } else {
      const li = document.createElement("li");
      li.className = "insp-empty";
      li.textContent = "Nothing on the timeline that day.";
      list!.replaceChildren(li);
    }
  }

  store.subscribe((s, prev) => {
    const pinChanged = s.pinned?.getTime() !== prev.pinned?.getTime();
    if (pinChanged) {
      if (s.pinned) {
        fillPanel(s.pinned);
        panel!.setAttribute("data-open", "");
      } else {
        panel!.removeAttribute("data-open");
      }
    }
    render();
  });

  // ---- pointer on the ticks area (spec §4.2) ----
  let pointerId: number | null = null;
  ticks.addEventListener("pointermove", (e) => {
    if (pointerId !== null) {
      pin(ctx, dateFromPointer(e));
      return;
    }
    hover = dateFromPointer(e);
    render();
  });
  ticks.addEventListener("pointerleave", () => {
    hover = null;
    render();
  });
  ticks.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || pointerId !== null) return;
    pointerId = e.pointerId;
    ticks!.setPointerCapture(e.pointerId);
    pin(ctx, dateFromPointer(e));
    e.preventDefault();
  });
  function release(e: PointerEvent): void {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    ticks!.releasePointerCapture(e.pointerId);
    panel!.scrollIntoView({ block: "nearest" });
  }
  ticks.addEventListener("pointerup", release);
  ticks.addEventListener("pointercancel", release);

  // ---- close: the panel's Close link, and Escape while pinned ----
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest("#on-date [data-inspector-close]")) return;
    e.preventDefault();
    unpin(ctx);
    ticks!.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !store.get().pinned) return;
    unpin(ctx);
    ticks!.focus();
  });
}
```

- [ ] **Step 3: Sync the hash for the pin and run `initScrub`**

In `src/scripts/timeline/index.ts`:

1. Add `import { hashFor } from "../../lib/timeline/scrub";` and `import { initScrub } from "./scrub";`.
2. Replace `syncHash` with:

```ts
/** The URL is a function of state (spec §8.2): #item-<id>, #on-<date>, or nothing. */
function syncHash(s: TimelineState, prev: TimelineState): void {
  if (s.openId === prev.openId && s.pinned?.getTime() === prev.pinned?.getTime()) return;
  const hash = s.openId ? `#item-${s.openId}` : s.pinned ? hashFor(s.pinned) : "";
  history.replaceState(null, "", location.pathname + location.search + hash);
}
```

3. Call `initScrub(ctx);` right after `initPan(ctx);` and before `applyLayout(ctx, store.get());`.

- [ ] **Step 4: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean. Note `ticks` has no `tabIndex` yet, so `ticks.focus()` is a no-op until Task 9 makes it focusable; that is expected here.

- [ ] **Step 5: Verify in the browser**

With `npm run preview` running, at 1280px wide:

1. Move the pointer along the ruler's ticks: a thin line follows with a chip such as "Sep 14, 2026"; clips that do not touch that date fade to about a third; the ones that do stay bright. Moving over the corner label ("2026") shows nothing. Leaving the ruler restores everything.
2. Near the right edge, the chip flips to the left of the line.
3. Press on the ruler: the line stays, the URL becomes `#on-YYYY-MM-DD`, the "On this date" panel opens below with the long date and a list of items, each with a lane dot, a title link, and a phrase such as "in progress since June 2026". Focus does not move. Drag while holding: the pin, the panel and the hash follow. Release: the page scrolls just enough to show the panel.
4. A pinned date shows as a 1px tick in the overview strip.
5. Pin, then click a clip: the item panel replaces the date panel, the URL becomes `#item-<id>`, the cursor line disappears. Click a link inside the date panel: same swap.
6. Pin, then pan with the strip so the pinned date leaves the window: the line hides, nothing is dimmed, the panel stays, the tick in the strip stays. Pan back: the line and the dimming return.
7. If you can find a day with nothing on it, the panel says "Nothing on the timeline that day." The deterministic check for the empty branch is a deep link in Task 9.
8. Press Escape: the pin, the panel and the hash clear. Click the panel's Close link: same.
9. At 390px wide nothing changes: no ruler, no cursor.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/timeline/scrub.ts src/scripts/timeline/inspector.ts src/scripts/timeline/index.ts
git commit -m "feat(timeline): scrub the ruler, pin a date, and see what was happening on it"
```

---

### Task 9: Scrub from the keyboard, and the date deep link

The ticks area becomes a slider over the all-time range. Both deep links go through `parseHash`.

**Files:**
- Modify: `src/scripts/timeline/scrub.ts`
- Modify: `src/scripts/timeline/index.ts`

**Interfaces:**
- Consumes: `stepDate`, `dayIndex`, `parseHash` from `lib/timeline/scrub.ts`; `offsetToShow` from `layout.ts`; `pin` from Task 8.
- Produces: the ruler's aria contract: `role="slider"`, `aria-label="Scrub the timeline"`, `aria-valuemin="0"`, `aria-valuemax` days in the all-time window, `aria-valuenow` the pinned date's day index (now when unpinned), `aria-valuetext` the long date.

- [ ] **Step 1: Add the slider to `scrub.ts`**

Add to the imports in `src/scripts/timeline/scrub.ts`:

```ts
import { fraction, offsetToShow, windowFor } from "../../lib/timeline/layout";
import { dateAt, dayIndex, stepDate } from "../../lib/timeline/scrub";
```

(replacing the two existing lines for those modules). Then inside `initScrub`, directly after the `const allWin = windowFor("all", now, items);` line (it must come after that declaration, since it reads `allWin`), add:

```ts
  // ---- the ruler as a slider (spec §4.5): roles come from the script ----
  ruler.removeAttribute("aria-hidden");
  ticks.tabIndex = 0;
  ticks.setAttribute("role", "slider");
  ticks.setAttribute("aria-label", "Scrub the timeline");
  ticks.setAttribute("aria-valuemin", "0");
  ticks.setAttribute("aria-valuemax", String(dayIndex(allWin.to, allWin)));
  function updateAria(): void {
    const value = store.get().pinned ?? now;
    ticks!.setAttribute("aria-valuenow", String(dayIndex(value, allWin)));
    ticks!.setAttribute("aria-valuetext", longDate(value));
  }
  updateAria();
```

In the existing `store.subscribe` callback, add `updateAria();` as its last line, after `render();`.

Then, after the Escape listener at the end of `initScrub`, add:

```ts
  // ---- keys: arrows step, Home/End go to the window's edges, Enter enters the panel ----
  function showDate(date: Date): void {
    const s = store.get();
    const win = windowFor(s.zoom, now, items, s.offset);
    const f = fraction(date, win);
    if (f < 0 || f > 1) {
      const offset = offsetToShow(date, s.zoom, now, items, s.offset);
      if (offset !== s.offset) store.set({ offset });
    }
    pin(ctx, date);
  }
  ticks.addEventListener("keydown", (e) => {
    const s = store.get();
    const base = s.pinned ?? now;
    const unit = e.shiftKey ? "year" : "month";
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        showDate(stepDate(base, unit, -1, allWin));
        break;
      case "ArrowRight":
      case "ArrowUp":
        showDate(stepDate(base, unit, 1, allWin));
        break;
      case "Home":
        showDate(dateAt(0, currentWindow()));
        break;
      case "End":
        showDate(dateAt(1, currentWindow()));
        break;
      case "Enter":
        if (!s.pinned) return;
        panel!.focus();
        break;
      default:
        return;
    }
    e.preventDefault();
  });
```

- [ ] **Step 2: Route both deep links through `parseHash`**

In `src/scripts/timeline/index.ts`, change the scrub import to `import { hashFor, parseHash } from "../../lib/timeline/scrub";`, add `offsetToShow` to the layout import and `pin` to the scrub import (`import { initScrub, pin } from "./scrub";`), and replace `openDeepLink` with:

```ts
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
    if (!document.getElementById(`item-${link.id}`)) return false;
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
```

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: clean.

- [ ] **Step 4: Verify in the browser**

With `npm run preview` running, at 1280px wide:

1. Tab from the overview strip: the next stop is the ruler's ticks area, which precedes the clips in the DOM. The focus ring is inset inside the ruler. In the accessibility tree it is a slider, "Scrub the timeline", value text today's long date.
2. Press Left: a pin appears one month before today, the panel opens, focus stays on the ruler, and the value text reads that date. Shift+Left: a year earlier; at the year zoom the window pans to last year so the cursor stays visible. Right and Shift+Right step forward and, when the pin re-enters this year, the window pans back. Home and End pin the window's first and last day.
3. Press Left until the earliest item's date: further Left stays there.
4. Press Enter: focus moves into the panel; Tab reaches its item links. Escape: the pin clears and focus returns to the ruler.
5. Open `http://localhost:4321/#on-2024-06-15`: the window shows 2024 at the year zoom (or the containing range at "3 yr"), the pin sits on June 15, the panel is open, nothing is focused, and the playhead did not animate. Open `#on-2024-02-31`: ignored, the page loads as with no hash. Open `#on-2019-01-01`, a day before every item: the window pans as far back as it can, no cursor shows, and the panel says "Nothing on the timeline that day."
6. Open `#item-roaming-camp`: still works as in Task 1.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/timeline/scrub.ts src/scripts/timeline/index.ts
git commit -m "feat(timeline): scrub from the keyboard; #on-<date> deep links"
```

---

### Task 10: Docs, the full check, and the end-to-end pass

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Scratch (not committed): `.superpowers/scratch/interactions.mjs`

- [ ] **Step 1: Document the folder and the two interactions in `CLAUDE.md`**

In the "Architecture" section, directly after the "Component composition" paragraph, add:

```markdown
**Timeline interactions:** `src/scripts/timeline/` is a folder of modules sharing one store (`state.ts`): `apply.ts` lays out a window, `inspector.ts` opens panels, `pan.ts` drives the overview strip's whole-year offset (drag, tap, arrow keys), and `scrub.ts` drives the ruler's cursor and the "On this date" panel (hover, press to pin, arrow keys by month). Pure math lives beside the rest of the timeline in `src/lib/timeline/` (`layout.ts` offsets, `scrub.ts` cursor math and hashes, `track.ts` `onDate`). A pinned date is `#on-YYYY-MM-DD` in the URL; the pan offset is never stored. Both are JavaScript-only like zoom: the built HTML keeps the strip and ruler `aria-hidden`, and the script upgrades them into sliders. `src/__tests__/home-contract.test.ts` reads `dist/index.html` to keep every hook the scripts depend on.
```

In the first paragraph of "Architecture" (the one that starts "This is a static portfolio site"), after "stay usable but render at zero." add:

```markdown
The home timeline's zoom, scrubbing and panning are enhancements too: without scripting the page shows the current year and every clip is a link.
```

- [ ] **Step 2: Add the same note to the README**

In `README.md`, at the end of the paragraph that begins "Static [Astro](https://astro.build) 5.", after "stay usable but render at zero.", add:

```markdown
The home timeline's zoom, scrubbing and panning are enhancements too: without
scripting the page shows the current year and every clip stays a link.
```

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: the build succeeds and every test passes, including the two dist-reading contract tests.

- [ ] **Step 4: Write and run the end-to-end scratch script**

Start `npm run preview` in the background. Create `.superpowers/scratch/interactions.mjs` (the `.superpowers/` directory is gitignored):

```js
// End-to-end pass over scrub and pan against `npm run preview`.
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:4321";
const browser = await chromium.launch();
const failures = [];
const check = (name, ok) => { if (!ok) failures.push(name); console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

// ---- desktop ----
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const ticks = page.locator("[data-ticks]");
const strip = page.locator(".tl-ov");
const box = await ticks.boundingBox();

// hover shows the cursor and dims something
await page.mouse.move(box.x + box.width * 0.3, box.y + 10);
check("hover shows cursor", !(await page.locator("[data-cursor]").isHidden()));
check("hover marks the root as scrubbing", (await page.locator(".tl[data-scrubbing]").count()) === 1);
check("hover marks touching clips", (await page.locator(".tl-item[data-touch]").count()) > 0);

// press pins, hash follows, panel opens, focus stays put
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.5, box.y + 10, { steps: 5 });
await page.mouse.up();
check("pin sets #on- hash", (await page.evaluate(() => location.hash)).startsWith("#on-"));
check("date panel opens", await page.locator("#on-date[data-open]").count() === 1);
check("panel heading filled", ((await page.locator("[data-on-date-title]").textContent()) ?? "").length > 8);
check("pin tick shows", !(await page.locator("[data-ov-pin]").isHidden()));
check("focus did not move to the panel", await page.evaluate(() => document.activeElement?.id !== "on-date"));

// opening an item unpins
await page.locator(".tl-item:not([data-out]) .tl-clip").first().click();
check("item hash replaces on hash", (await page.evaluate(() => location.hash)).startsWith("#item-"));
check("date panel closed by item", await page.locator("#on-date[data-open]").count() === 0);
await page.keyboard.press("Escape");

// keyboard scrub on the ruler
await ticks.focus();
check("ruler is a slider", (await ticks.getAttribute("role")) === "slider");
await page.keyboard.press("ArrowLeft");
check("ArrowLeft pins a month back", (await page.evaluate(() => location.hash)).startsWith("#on-"));
await page.keyboard.press("Shift+ArrowLeft");
check("Shift+ArrowLeft pans to last year", (await page.locator("[data-window-label]").textContent()) === String(new Date().getUTCFullYear() - 1));
await page.keyboard.press("Escape");
check("Escape clears the hash", (await page.evaluate(() => location.hash)) === "");
check("Escape returns focus to the ruler", await page.evaluate(() => document.activeElement?.hasAttribute("data-ticks")));

// strip keyboard and drag
await strip.focus();
check("strip is a slider", (await strip.getAttribute("role")) === "slider");
await page.keyboard.press("End");
const sb = await strip.boundingBox();
await page.mouse.move(sb.x + sb.width * 0.9, sb.y + sb.height / 2);
await page.mouse.down();
await page.mouse.move(sb.x + sb.width * 0.5, sb.y + sb.height / 2, { steps: 10 });
await page.mouse.up();
const thisYear = new Date().getUTCFullYear();
check("drag pans back", Number(await page.locator("[data-window-label]").textContent()) < thisYear);
check("year button names the year on screen", (await page.locator('[data-zoom="year"]').textContent()) === (await page.locator("[data-window-label]").textContent()));
await page.locator('[data-zoom="year"]').click();
check("year button returns to this year", (await page.locator("[data-window-label]").textContent()) === String(thisYear));

// tap jumps
await page.mouse.click(sb.x + sb.width * 0.15, sb.y + sb.height / 2);
check("tap jumps to an earlier year", Number(await page.locator("[data-window-label]").textContent()) < thisYear);

// deep link
await page.goto(`${BASE}/#on-2024-06-15`, { waitUntil: "networkidle" });
check("date deep link pins", await page.locator("#on-date[data-open]").count() === 1);
check("date deep link pans", (await page.locator("[data-window-label]").textContent())?.includes("2024"));
await page.goto(`${BASE}/#on-2024-02-31`, { waitUntil: "networkidle" });
check("malformed date hash ignored", await page.locator("#on-date[data-open]").count() === 0);

// ---- phone ----
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await phone.goto(`${BASE}/`, { waitUntil: "networkidle" });
const firstWhen = await phone.locator(".tl-item:not([data-out]) .tl-when").first().textContent();
const pb = await phone.locator(".tl-ov").boundingBox();
await phone.mouse.move(pb.x + pb.width * 0.9, pb.y + pb.height / 2);
await phone.mouse.down();
await phone.mouse.move(pb.x + pb.width * 0.4, pb.y + pb.height / 2, { steps: 10 });
await phone.mouse.up();
const afterWhen = await phone.locator(".tl-item:not([data-out]) .tl-when").first().textContent();
check("phone drag changes the graph's rows", firstWhen !== afterWhen);
check("phone has no cursor", await phone.locator("[data-cursor]").isHidden());

await browser.close();
if (failures.length) { console.error(`\n${failures.length} failure(s)`); process.exit(1); }
console.log("\nall checks passed");
```

Run: `node .superpowers/scratch/interactions.mjs`
Expected: every line `ok`, then `all checks passed`. A `FAIL` line names the behavior to fix in its task before continuing.

- [ ] **Step 5: Screenshots for regressions in the static views**

Run: `npm run shots`
Expected: `screenshots/` regenerates. Open the home desktop and phone shots: identical to before this plan apart from the new grab cursor not being visible in a screenshot. No cursor line, no panel, no tick in a fresh load.

- [ ] **Step 6: Commit the docs**

```bash
git add CLAUDE.md README.md
git commit -m "docs: the timeline script folder, scrubbing and panning"
```

---

## Self-review against the spec

- §4.1 cursor, chip, dimming, day precision, ticks area: Task 7 (markup, CSS) and Task 8 (render). Chip format ruled `monthDayYear` at the top of this plan.
- §4.2 press to pin, drag, stays through zoom and pan, hidden when out of window, scroll near, no focus, pin tick: Task 8.
- §4.3 the panel, its frame, lane dots, `whenText`, the empty line, entries open items: Task 7 (markup) and Task 8 (fill). The delegated click handler moved to the document in Task 1 so entry links open in place.
- §4.4 hash on pin, cleared on unpin, deep link pans and pins with no focus and no draw-in, malformed ignored: Task 8 (sync) and Task 9 (deep link, `parseHash`).
- §4.5 slider roles and values, month and year steps, Home/End, pan on overflow, Enter into the panel, Escape back to the ruler: Task 9 (keys) and Task 8 (Escape and Close).
- §5.1 offset and bound: Task 2. §5.2 drag, tap, touch-action: Task 6. §5.3 zoom-button rules and the year button: Task 5. §5.4 strip slider: Task 5. §5.5 no stored offset: Task 1's store and Task 5's handlers never write it.
- §6 pure math and named tests: Tasks 2, 3, 4. `windowLabel` was added to §6.1's list while planning so the corner label and the strip's value text share one function.
- §7 markup, roles from the script, styles, contract test: Tasks 5, 6, 7, 8, 9.
- §8 modules, store, load order, failure rules: Tasks 1, 8, 9. `context` lives in `state.ts` as `Ctx` rather than a ninth module.
- §9 files: all named across the tasks; `src/scripts/timeline.ts` deleted in Task 1.
- §10 accessibility: dimmed clips keep their focus ring at full color because the outline is on `.tl-clip` and opacity is on `.tl-item`, which does dim the ring too. Ruling: acceptable, the ring is still visible at a third, and a focused clip that does not touch the date is a correct signal; noted here so a reviewer does not treat it as a bug.
- §11 testing: unit tests in Tasks 2, 3, 4; contract in Task 7; `npm run check`, the manual matrix and `npm run shots` in Task 10, with the scratch script covering the matrix's pointer and keyboard cases.
