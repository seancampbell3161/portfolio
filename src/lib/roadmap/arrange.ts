// src/lib/roadmap/arrange.ts
// The roadmap as an arrangement (spec §5): positioned clips for the roadmap
// page, three thread spans for the home Learning lane, and the quarter
// calendar window and ticks. Pure — no Astro, no DOM — so Vitest loads it and
// the page and getTimeline() call it at build time.
import { build, reading, foundations, type Track } from "../../data/roadmap.js";
import type { TimelineItem } from "../timeline/types.js";
import { fraction, type Window, type Tick } from "../timeline/layout.js";

export type { Track };

export type ClipStatus = "done" | "in-progress" | "planned";

export interface RoadmapClip {
  id: string;
  track: Track;
  title: string;
  sublabel?: string;
  start: Date;
  end: Date;
  kind: "span";
  status: ClipStatus;
  href: string; // "#clip-<id>"
}

/** Spec §5: planned before it starts with nothing done, done when all children are, else in-progress. */
export function clipStatus(done: number, total: number, start: Date, now: Date): ClipStatus {
  if (total > 0 && done === total) return "done";
  if (start.getTime() > now.getTime() && done === 0) return "planned";
  return "in-progress";
}

const countDone = (ids: readonly string[], completed: ReadonlySet<string>): number =>
  ids.filter((id) => completed.has(id)).length;

export function roadmapClips(completed: ReadonlySet<string>, now: Date): RoadmapClip[] {
  const clips: RoadmapClip[] = [];

  for (const m of build) {
    const ids = m.groups.map((g) => g.id);
    const done = countDone(ids, completed);
    clips.push({
      id: m.id,
      track: "build",
      title: m.course,
      sublabel: `${done} of ${ids.length} checkpoints`,
      start: m.start,
      end: m.end,
      kind: "span",
      status: clipStatus(done, ids.length, m.start, now),
      href: `#clip-${m.id}`,
    });
  }

  for (const b of reading) {
    const ids = b.chapters.map((c) => c.id);
    const done = countDone(ids, completed);
    clips.push({
      id: b.id,
      track: "reading",
      title: b.title,
      sublabel: `${done} of ${ids.length} chapters`,
      start: b.start,
      end: b.end,
      kind: "span",
      status: clipStatus(done, ids.length, b.start, now),
      href: `#clip-${b.id}`,
    });
  }

  for (const g of foundations) {
    const ids = g.items.map((i) => i.id);
    const done = countDone(ids, completed);
    clips.push({
      id: g.id,
      track: "foundations",
      title: g.label,
      sublabel: `${done} of ${ids.length} done`,
      start: g.start,
      end: g.end,
      kind: "span",
      status: clipStatus(done, ids.length, g.start, now),
      href: `#clip-${g.id}`,
    });
  }

  return clips;
}

const TRACK_DESC: Record<Track, string> = {
  build: "Building real systems from raw sockets up, one CodeCrafters course at a time.",
  reading: "Reading deeply alongside the builds — the anchor books and a lighter read.",
  foundations: "Data-structures and algorithms fundamentals, courses then NeetCode 150.",
};

/** Spec §5: one learning-lane span per track for the home page. */
export function threadSpans(now: Date): TimelineItem[] {
  const clips = roadmapClips(new Set<string>(), now);
  const tracks: Track[] = ["build", "reading", "foundations"];
  return tracks.map((track) => {
    const own = clips.filter((c) => c.track === track);
    const start = new Date(Math.min(...own.map((c) => c.start.getTime())));
    const end = new Date(Math.max(...own.map((c) => c.end.getTime())));
    const allDone = own.every((c) => c.status === "done");
    const id = `roadmap-${track}`;
    return {
      id,
      lane: "learning",
      title: track[0].toUpperCase() + track.slice(1),
      start,
      end,
      status: allDone ? "done" : "in-progress",
      href: `/#item-${id}`,
      kind: "span",
      body: {
        lane: "learning",
        description: TRACK_DESC[track],
        roadmapHref: `/roadmap#rm-track-${track}`,
      },
    };
  });
}

export type RoadmapZoom = "span" | "all";

const utc = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(Date.UTC(y, m, d, h, min, s, ms));

export function roadmapWindow(zoom: RoadmapZoom, _now: Date, clips: readonly RoadmapClip[]): Window {
  const spanFrom = utc(2026, 0, 1);
  const spanTo = utc(2027, 11, 31, 23, 59, 59, 999);
  if (zoom === "span" || clips.length === 0) return { from: spanFrom, to: spanTo };
  let from = spanFrom;
  let to = spanTo;
  for (const c of clips) {
    if (c.start.getTime() < from.getTime()) from = c.start;
    if (c.end.getTime() > to.getTime()) to = c.end;
  }
  return { from, to };
}

const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];

/** Ticks at each quarter boundary; Q1 shows the year (spec §5). */
export function quarterTicks(w: Window): Tick[] {
  const ticks: Tick[] = [];
  const startYear = w.from.getUTCFullYear();
  const startQ = Math.floor(w.from.getUTCMonth() / 3);
  let year = startYear;
  let q = startQ;
  // walk quarter by quarter until past the window
  for (let guard = 0; guard < 64; guard++) {
    const d = utc(year, q * 3, 1);
    if (d.getTime() > w.to.getTime()) break;
    ticks.push({ label: q === 0 ? String(year) : QUARTER_LABELS[q], x: fraction(d, w) });
    q += 1;
    if (q > 3) {
      q = 0;
      year += 1;
    }
  }
  return ticks;
}
