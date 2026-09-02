// src/lib/timeline/track.ts
// The Writing lane as a vertical track (writing spec §6 to §8, §10): the rows
// the index and the essay sidebar render, plus reading time. Pure: no Astro,
// no DOM, so Vitest loads it and the pages call it at build time.
import { monthDayYear } from "../dates.js";

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
