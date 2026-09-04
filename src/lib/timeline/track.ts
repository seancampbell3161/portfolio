// src/lib/timeline/track.ts
// The Writing lane as a vertical track (writing spec §6 to §8, §10): the rows
// the index and the essay sidebar render, plus reading time. Pure: no Astro,
// no DOM, so Vitest loads it and the pages call it at build time.
import { longDate, monthDayYear, monthYearLong } from "../dates.js";
import type { Lane, Status, TimelineItem } from "./types.js";
import { effectiveEnd } from "./layout.js";

/**
 * Spec §5.1: how a date range is spoken everywhere on the site. A start and end
 * inside one month collapse to that month; no end reads as open-ended.
 */
export function rangeText(start: Date, end?: Date): string {
  if (!end) return `since ${monthYearLong(start)}`;
  const from = monthYearLong(start);
  const to = monthYearLong(end);
  return from === to ? from : `${from} to ${to}`;
}

/**
 * Spec §5.1: the kicker and inspector wording, one rule for every page. A moment
 * (done, no end) is spoken as its day; everything else is a range.
 */
export function whenText(o: { status: Status; start: Date; end?: Date }): string {
  switch (o.status) {
    case "in-progress":
      return `in progress since ${monthYearLong(o.start)}`;
    case "planned":
      return `planned, ${rangeText(o.start, o.end)}`;
    case "live":
      return `${rangeText(o.start, o.end)}, live`;
    default:
      return o.end ? rangeText(o.start, o.end) : longDate(o.start);
  }
}

/** An essay as both the blog collection and the timeline's writing lane can supply it. */
export interface Essay {
  /** `essay-<slug>`, the id fromBlog produces. */
  id: string;
  /** `/blog/<slug>` */
  href: string;
  title: string;
  /** pubDate */
  date: Date;
  description?: string;
  tags?: string[];
  minutes?: number;
}

export type EssayRow = {
  kind: "essay";
  id: string;
  href: string;
  title: string;
  date: Date;
  current?: boolean;
  minutes?: number;
  description?: string;
  tags?: string[];
};

export type TrackRow =
  | { kind: "now"; label: string }
  | { kind: "year"; label: string }
  | { kind: "more"; label: string; href: string }
  | EssayRow;

export const WORDS_PER_MINUTE = 220;

/** Spec §10: whitespace-separated tokens over 220 words per minute, rounded, at least 1. */
export function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Newest first, ties by id, so every builder sees one order. Returns a copy. */
export function sortEssays(essays: readonly Essay[]): Essay[] {
  return [...essays].sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));
}

/** Spec §6: a now row, then a year row before the first essay of each year, then the essays. */
export function indexRows(essays: readonly Essay[], now: Date): TrackRow[] {
  const rows: TrackRow[] = [{ kind: "now", label: monthDayYear(now) }];
  let year: number | undefined;
  for (const e of sortEssays(essays)) {
    const y = e.date.getUTCFullYear();
    if (y !== year) {
      rows.push({ kind: "year", label: String(y) });
      year = y;
    }
    rows.push({
      kind: "essay",
      id: e.id,
      href: e.href,
      title: e.title,
      date: e.date,
      minutes: e.minutes,
      description: e.description,
      tags: e.tags,
    });
  }
  return rows;
}

const INDEX_HREF = "/blog";

const briefRow = (e: Essay): EssayRow => ({ kind: "essay", id: e.id, href: e.href, title: e.title, date: e.date });

/**
 * Spec §7: the current essay ringed between its neighbours. The head is now
 * for the newest essay, otherwise "{n} newer"; the tail is "{n} older" when
 * any remain. It doubles as previous and next.
 */
export function segmentRows(essays: readonly Essay[], currentId: string, now: Date): TrackRow[] {
  const sorted = sortEssays(essays);
  const i = sorted.findIndex((e) => e.id === currentId);
  if (i < 0) throw new Error(`Unknown essay: ${currentId}`);
  const n = sorted.length;
  const rows: TrackRow[] = [];

  if (i === 0) rows.push({ kind: "now", label: monthDayYear(now) });
  else rows.push({ kind: "more", label: `${i} newer, all essays`, href: INDEX_HREF });

  if (i > 0) rows.push(briefRow(sorted[i - 1]));
  rows.push({ ...briefRow(sorted[i]), current: true });
  if (i < n - 1) rows.push(briefRow(sorted[i + 1]));

  const older = n - i - 2;
  if (older > 0) rows.push({ kind: "more", label: `${older} older, all essays`, href: INDEX_HREF });

  return rows;
}

const WHILE_LANES: readonly Lane[] = ["building", "learning", "community"];
export const MOMENT_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Spec §8: items from the other lanes that overlap the publish date. A span
 * counts when it starts on or before the date and its effective end (its end,
 * or now while in progress) is on or after it. A moment counts within 14 days
 * either side, inclusive. Building, then learning, then community; within a
 * lane by start, then id.
 */
export function writtenWhile(items: readonly TimelineItem[], published: Date, now: Date): TimelineItem[] {
  const p = published.getTime();
  const overlaps = (item: TimelineItem): boolean => {
    if (!WHILE_LANES.includes(item.lane)) return false;
    if (item.kind === "span") {
      return item.start.getTime() <= p && effectiveEnd(item, now).getTime() >= p;
    }
    return Math.abs(item.start.getTime() - p) <= MOMENT_WINDOW_DAYS * DAY_MS;
  };
  return items
    .filter(overlaps)
    .sort(
      (a, b) =>
        WHILE_LANES.indexOf(a.lane) - WHILE_LANES.indexOf(b.lane) ||
        a.start.getTime() - b.start.getTime() ||
        a.id.localeCompare(b.id),
    );
}
