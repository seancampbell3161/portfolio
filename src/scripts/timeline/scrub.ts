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
