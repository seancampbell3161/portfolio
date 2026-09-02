// Pure layout math (spec §7). No DOM: runs at build time in Astro and again in
// the browser (src/scripts/timeline.ts) for zoom changes.
// All calendar math is UTC: content dates parse from YYYY-MM-DD strings, which are UTC midnight.
import type { Lane, TimelineItem } from "./types.js";

export type Zoom = "year" | "three-years" | "all";
export const ZOOMS: readonly Zoom[] = ["year", "three-years", "all"];

export interface Window {
  from: Date;
  to: Date;
}

export function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export function endOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

/** Spec §5 zoom windows. */
export function windowFor(zoom: Zoom, now: Date, items: readonly TimelineItem[]): Window {
  const to = endOfYear(now);
  if (zoom === "year") return { from: startOfYear(now), to };
  if (zoom === "three-years") {
    const from = new Date(now.getTime());
    from.setUTCFullYear(now.getUTCFullYear() - 3);
    return { from, to };
  }
  let earliest: Date | null = null;
  for (const item of items) {
    if (!earliest || item.start.getTime() < earliest.getTime()) earliest = item.start;
  }
  return { from: earliest ?? startOfYear(now), to };
}

/** Position of a date inside a window as a fraction of its width. Not clamped. */
export function fraction(date: Date, w: Window): number {
  const span = w.to.getTime() - w.from.getTime();
  return (date.getTime() - w.from.getTime()) / span;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Where an item stops: its end, or now for an ongoing span, or its start for a moment. */
export function effectiveEnd(item: TimelineItem, now: Date): Date {
  if (item.end) return item.end;
  return item.kind === "span" ? now : item.start;
}

export interface Placed {
  item: TimelineItem;
  /** left edge, fraction of window width, clamped to [0, 1] */
  x: number;
  /** width, fraction of window width; 0 for a moment */
  w: number;
}

/** Null when the item lies entirely outside the window. */
export function positionIn(item: TimelineItem, w: Window, now: Date): Placed | null {
  const end = effectiveEnd(item, now);
  if (end.getTime() < w.from.getTime() || item.start.getTime() > w.to.getTime()) return null;
  const x = clamp01(fraction(item.start, w));
  const xe = clamp01(fraction(end, w));
  return { item, x, w: item.kind === "moment" ? 0 : Math.max(0, xe - x) };
}

/** Returns the horizontal extent a moment's label occupies, as a fraction of the window width. */
export type WidthEstimator = (item: TimelineItem) => number;

/**
 * Build-time estimate: 7px per character of title plus subtitle, plus 30px for
 * the dot and padding, against the clip area width at the 1280px reference
 * (1280 minus 80px page margins minus a 160px lane head = 1040px).
 * The browser replaces this with measured widths.
 */
export function estimateLabelWidth(referenceWidthPx = 1040): WidthEstimator {
  return (item) => ((item.title.length + (item.subtitle?.length ?? 0)) * 7 + 30) / referenceWidthPx;
}

/** A bare dot's extent (a demoted moment). */
export const DOT_WIDTH = 14 / 1040;

export interface RowPlaced extends Placed {
  row: number;
  /** false when a moment has been demoted to a bare dot */
  labeled: boolean;
}

function assignRows(sorted: readonly Placed[], extentOf: (p: Placed) => number): { rows: number[]; maxRow: number } {
  const rowEnds: number[] = [];
  const rows: number[] = [];
  let maxRow = -1;
  sorted.forEach((p, i) => {
    let r = rowEnds.findIndex((end) => end < p.x);
    if (r === -1) {
      r = rowEnds.length;
      rowEnds.push(Number.NEGATIVE_INFINITY);
    }
    rowEnds[r] = extentOf(p);
    rows[i] = r;
    if (r > maxRow) maxRow = r;
  });
  return { rows, maxRow };
}

/**
 * Greedy packing by start (spec §7): an item takes the first row whose last
 * occupant ends before it starts. A moment occupies its label width. When more
 * than maxRows are needed, the oldest labeled moments become bare dots, one at
 * a time, until the packing fits. Spans are never demoted; if spans alone need
 * more rows, the extra rows are returned as computed.
 */
export function packRows(placed: readonly Placed[], estimate: WidthEstimator, maxRows = 3): RowPlaced[] {
  const sorted = [...placed].sort(
    (a, b) => a.x - b.x || b.w - a.w || a.item.id.localeCompare(b.item.id),
  );
  const demoted = new Set<string>();
  const extentOf = (p: Placed): number =>
    p.item.kind === "moment"
      ? p.x + (demoted.has(p.item.id) ? DOT_WIDTH : estimate(p.item))
      : p.x + p.w;

  for (;;) {
    const { rows, maxRow } = assignRows(sorted, extentOf);
    if (maxRow < maxRows) {
      return sorted.map((p, i) => ({ ...p, row: rows[i], labeled: !demoted.has(p.item.id) }));
    }
    const candidate = sorted.find((p) => p.item.kind === "moment" && !demoted.has(p.item.id));
    if (!candidate) {
      return sorted.map((p, i) => ({ ...p, row: rows[i], labeled: true }));
    }
    demoted.add(candidate.item.id);
  }
}

export function packLane(
  items: readonly TimelineItem[],
  lane: Lane,
  w: Window,
  now: Date,
  estimate: WidthEstimator,
  maxRows = 3,
): RowPlaced[] {
  const placed: Placed[] = [];
  for (const item of items) {
    if (item.lane !== lane) continue;
    const p = positionIn(item, w, now);
    if (p) placed.push(p);
  }
  return packRows(placed, estimate, maxRows);
}
