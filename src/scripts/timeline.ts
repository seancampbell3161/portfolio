// src/scripts/timeline.ts
// Progressive enhancement for the home timeline (spec §9). Without this file
// the page already works: clips are links and CSS :target shows panels.
import { LANES, type Kind, type Lane, type Status, type TimelineItem } from "../lib/timeline/types";
import {
  ZOOMS,
  fraction,
  graphLayout,
  laneSummary,
  packLane,
  ticksFor,
  whenLabel,
  windowFor,
  type WidthEstimator,
  type Zoom,
} from "../lib/timeline/layout";

document.documentElement.classList.add("js");

const root = document.querySelector<HTMLElement>("[data-timeline]");
if (root) init(root);

function init(root: HTMLElement) {
  const now = new Date();

  // ---- items, read back from the server-rendered list ----
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
  const elById = new Map(itemEls.map((el) => [el.dataset.id ?? "", el]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // ---- today's date in the transport bar ----
  const nowLabel = document.querySelector<HTMLTimeElement>("[data-now-label]");
  if (nowLabel) {
    nowLabel.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    nowLabel.dateTime = now.toISOString().slice(0, 10);
  }

  // ---- measured label widths (spec §7) ----
  function makeMeasurer(): WidthEstimator {
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

  // ---- zoom ----
  function readZoom(): Zoom | null {
    try {
      const z = localStorage.getItem("timeline-zoom");
      return ZOOMS.includes(z as Zoom) ? (z as Zoom) : null;
    } catch {
      return null;
    }
  }
  function saveZoom(z: Zoom) {
    try {
      localStorage.setItem("timeline-zoom", z);
    } catch {
      /* private mode or blocked storage: the choice just isn't remembered */
    }
  }

  function apply(zoom: Zoom) {
    const win = windowFor(zoom, now, items);
    const allWin = windowFor("all", now, items);
    const measure = makeMeasurer();

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
      windowLabel.textContent =
        zoom === "year" ? String(win.from.getFullYear()) : `${win.from.getFullYear()} to ${win.to.getFullYear()}`;
    }
    const ticksEl = root.querySelector<HTMLElement>("[data-ticks]");
    if (ticksEl) {
      ticksEl.replaceChildren(
        ...ticksFor(zoom, win).map((t) => {
          const s = document.createElement("span");
          s.style.setProperty("--x", String(t.x));
          s.textContent = t.label;
          return s;
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

  const initialZoom = readZoom() ?? (root.dataset.zoom as Zoom) ?? "year";
  apply(initialZoom);

  document.querySelectorAll<HTMLButtonElement>("[data-zoom-control] button").forEach((b) =>
    b.addEventListener("click", () => {
      const z = b.dataset.zoom as Zoom;
      apply(z);
      saveZoom(z);
    }),
  );
  let resizeTimer = 0;
  addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => apply(root.dataset.zoom as Zoom), 150);
  });

  // ---- inspector ----
  let openId: string | null = null;
  const panelFor = (id: string) => document.getElementById(`item-${id}`);

  function open(id: string, opts: { scroll?: boolean; focus?: boolean } = {}) {
    const panel = panelFor(id);
    const el = elById.get(id);
    if (!panel || !el) return;
    if (openId && openId !== id) {
      panelFor(openId)?.removeAttribute("data-open");
      elById.get(openId)?.removeAttribute("data-selected");
    }
    panel.setAttribute("data-open", "");
    el.setAttribute("data-selected", "");
    openId = id;
    history.replaceState(null, "", `#item-${id}`);
    if (opts.scroll) panel.scrollIntoView({ block: "nearest" });
    if (opts.focus !== false) panel.focus({ preventScroll: !opts.scroll });
  }

  function close() {
    if (!openId) return;
    const id = openId;
    panelFor(id)?.removeAttribute("data-open");
    const el = elById.get(id);
    el?.removeAttribute("data-selected");
    openId = null;
    history.replaceState(null, "", location.pathname + location.search);
    el?.querySelector<HTMLElement>(".tl-clip")?.focus();
  }

  root.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-item-link]");
    if (!a) return;
    e.preventDefault();
    open(a.dataset.itemLink ?? "", { scroll: true });
  });
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest("[data-inspector-close]")) return;
    e.preventDefault();
    close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openId) close();
  });

  const deepLink = location.hash.match(/^#item-([a-z0-9-]+)$/);
  if (deepLink && panelFor(deepLink[1])) open(deepLink[1], { scroll: true, focus: false });

  // ---- one motion on load: the playhead draws in (spec §9) ----
  const playhead = root.querySelector<HTMLElement>("[data-playhead]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (playhead && !reduceMotion && !deepLink) {
    const target = playhead.style.getPropertyValue("--x");
    playhead.style.setProperty("--x", "0");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        playhead.style.transition = "left 600ms ease-out";
        playhead.style.setProperty("--x", target);
      }),
    );
  }
}
