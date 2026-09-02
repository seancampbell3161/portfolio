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

// ---------- ruler ticks (spec §4: months / quarters / years) ----------

export interface Tick {
  label: string;
  x: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodStart(zoom: Zoom, d: Date): Date {
  if (zoom === "year") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  if (zoom === "three-years") {
    return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function nextPeriod(zoom: Zoom, d: Date): Date {
  if (zoom === "year") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  if (zoom === "three-years") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1));
  return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
}

function periodLabel(zoom: Zoom, d: Date): string {
  if (zoom === "year") return MONTHS[d.getUTCMonth()];
  if (zoom === "three-years") return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
  return String(d.getUTCFullYear());
}

/** First tick is the period containing `from`, at x = 0; then every period boundary up to `to`. */
export function ticksFor(zoom: Zoom, w: Window): Tick[] {
  const first = periodStart(zoom, w.from);
  const ticks: Tick[] = [{ label: periodLabel(zoom, first), x: 0 }];
  for (let d = nextPeriod(zoom, first); d.getTime() <= w.to.getTime(); d = nextPeriod(zoom, d)) {
    ticks.push({ label: periodLabel(zoom, d), x: fraction(d, w) });
  }
  return ticks;
}

// ---------- lane head summaries (spec §4) ----------

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function laneSummary(lane: Lane, items: readonly TimelineItem[], w: Window, now: Date): string {
  const inWindow = items.filter((i) => i.lane === lane && positionIn(i, w, now) !== null);
  const n = inWindow.length;
  if (n === 0) return "nothing yet";
  const inProgress = inWindow.filter((i) => i.status === "in-progress").length;
  switch (lane) {
    case "writing":
      return plural(n, "essay");
    case "building": {
      const live = inWindow.filter((i) => i.status === "live").length;
      const parts: string[] = [];
      if (live) parts.push(`${live} live`);
      if (inProgress) parts.push(`${inProgress} in progress`);
      return parts.length ? parts.join(", ") : plural(n, "project");
    }
    case "learning":
      return inProgress ? `${inProgress} in progress` : plural(n, "item");
    case "community":
      return plural(n, "appearance");
  }
}

// ---------- vertical graph for phones (spec §8) ----------

export interface GraphBar {
  id: string;
  lane: Lane;
  slot: 0 | 1;
  fromRow: number;
  /** null: runs to the now line */
  toRow: number | null;
}

export interface GraphDot {
  id: string;
  lane: Lane;
  row: number;
}

export interface GraphLayout {
  rows: TimelineItem[];
  bars: GraphBar[];
  dots: GraphDot[];
  /** index of the row after which the now line is drawn */
  nowRow: number;
}

/**
 * Rows are the in-window items in start order. A span's bar runs from its row
 * down to the last row whose start is not after the span's end, or to the now
 * line when ongoing. Each lane has two slots so two concurrent spans don't
 * overlap; a third concurrent span shares slot 1.
 */
export function graphLayout(items: readonly TimelineItem[], w: Window, now: Date): GraphLayout {
  const rows = items
    .filter((i) => positionIn(i, w, now) !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
  const nowRow = rows.filter((i) => i.start.getTime() <= now.getTime()).length;

  const slotEnds: Record<Lane, [number, number]> = {
    writing: [-1, -1],
    building: [-1, -1],
    learning: [-1, -1],
    community: [-1, -1],
  };
  const bars: GraphBar[] = [];
  const dots: GraphDot[] = [];

  rows.forEach((item, idx) => {
    if (item.kind === "moment") {
      dots.push({ id: item.id, lane: item.lane, row: idx });
      return;
    }
    let toRow: number | null = null;
    if (item.end) {
      let j = idx;
      while (j + 1 < rows.length && rows[j + 1].start.getTime() <= item.end.getTime()) j++;
      toRow = j;
    }
    const ends = slotEnds[item.lane];
    const slot: 0 | 1 = ends[0] < idx ? 0 : 1;
    ends[slot] = toRow ?? nowRow;
    bars.push({ id: item.id, lane: item.lane, slot, fromRow: idx, toRow });
  });

  return { rows, bars, dots, nowRow };
}

/** The date column in the vertical graph. */
export function whenLabel(date: Date, zoom: Zoom): string {
  const m = MONTHS[date.getUTCMonth()];
  return zoom === "year" ? m : `${m} ${date.getUTCFullYear()}`;
}
