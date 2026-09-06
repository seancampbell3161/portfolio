// src/lib/timeline/now.ts
// The hero's "Right now" readout (interactions 2): what touches today, grouped
// by lane, and how each entry is spoken. Pure: no Astro, no DOM, so Vitest
// loads it and both the page and the client script call it.
import { longDay } from "../dates.js";
import { onDate, rangeText } from "./track.js";
import type { Lane, TimelineItem } from "./types.js";
import { LANES } from "./types.js";

export interface NowRow {
  lane: Lane;
  entries: TimelineItem[];
}

/**
 * How an entry is spoken in the readout. A span is described by when it began,
 * whatever its end, because the readout describes the present; a moment by its
 * day without the year, since a moment is only "now" for two weeks.
 */
export function nowText(item: TimelineItem): string {
  return item.kind === "span" ? rangeText(item.start) : longDay(item.start);
}

/** onDate(items, now, now) as rows in lane order; a lane with nothing today is dropped. */
export function rightNow(items: readonly TimelineItem[], now: Date): NowRow[] {
  const today = onDate(items, now, now);
  return LANES.flatMap((lane) => {
    const entries = today.filter((i) => i.lane === lane);
    return entries.length ? [{ lane, entries }] : [];
  });
}
