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
