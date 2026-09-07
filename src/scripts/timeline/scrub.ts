// src/scripts/timeline/scrub.ts
// The ruler as a scrub bar (interactions spec §4). Hover shows a cursor and dims
// the clips that do not touch its date; pressing pins it; the pinned date fills
// the "On this date" panel and lives in the URL. The playhead never moves.
import { fraction, offsetToShow, windowFor } from "../../lib/timeline/layout";
import { dateAt, dayIndex, stepDate } from "../../lib/timeline/scrub";
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

  // ---- the ruler as a slider (spec §4.5): roles come from the script ----
  ruler.removeAttribute("aria-hidden");
  ticks.tabIndex = 0;
  ticks.setAttribute("role", "slider");
  ticks.setAttribute("aria-label", "Scrub the timeline");
  ticks.setAttribute("aria-valuemin", "0");
  ticks.setAttribute("aria-valuemax", String(dayIndex(allWin.to, allWin)));
  function updateAria(): void {
    const value = store.get().pinned ?? now;
    // A pin can sit outside the all-time window (spec §8.4), and aria-valuenow
    // has to stay between valuemin and valuemax whatever the pin does.
    const max = dayIndex(allWin.to, allWin);
    const valueNow = Math.min(max, Math.max(0, dayIndex(value, allWin)));
    ticks!.setAttribute("aria-valuenow", String(valueNow));
    ticks!.setAttribute("aria-valuetext", longDate(value));
  }
  updateAria();

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
    updateAria();
  });

  // ---- pointer on the ticks area (spec §4.2) ----
  let pointerId: number | null = null;
  ticks.addEventListener(
    "pointermove",
    (e) => {
      const date = dateFromPointer(e);
      if (e.pointerId === pointerId) {
        // The hover follows the pin, so an unpin leaves the cursor under the
        // pointer rather than back where the press started.
        hover = date;
        pin(ctx, date);
        return;
      }
      hover = date;
      render();
    },
    { signal: ctx.signal },
  );
  ticks.addEventListener(
    "pointerleave",
    () => {
      hover = null;
      render();
    },
    { signal: ctx.signal },
  );
  ticks.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 || pointerId !== null) return;
      pointerId = e.pointerId;
      ticks!.setPointerCapture(e.pointerId);
      pin(ctx, dateFromPointer(e));
      e.preventDefault();
    },
    { signal: ctx.signal },
  );
  function release(e: PointerEvent, cancelled: boolean): void {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    ticks!.releasePointerCapture(e.pointerId);
    // A cancelled press (the browser took the gesture over) is not a choice to
    // read the panel, so it does not scroll.
    if (!cancelled) panel!.scrollIntoView({ block: "nearest" });
  }
  ticks.addEventListener("pointerup", (e) => release(e, false), { signal: ctx.signal });
  ticks.addEventListener("pointercancel", (e) => release(e, true), { signal: ctx.signal });

  // ---- close: the panel's Close link, and Escape while pinned ----
  document.addEventListener(
    "click",
    (e) => {
      if (!(e.target as Element).closest("#on-date [data-inspector-close]")) return;
      e.preventDefault();
      unpin(ctx);
      ticks!.focus();
    },
    { signal: ctx.signal },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || !store.get().pinned) return;
      unpin(ctx);
      ticks!.focus();
    },
    { signal: ctx.signal },
  );

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
  ticks.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
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
    },
    { signal: ctx.signal },
  );
}
