# Arrangement Sub-project 3: Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/roadmap` as an arrangement — three dated lane-threads, milestones as clips, planned work as dashed outlines, an editable checkpoint-and-decision-log inspector — and derive the home page's Learning lane from the roadmap.

**Architecture:** A new pure module `src/lib/roadmap/arrange.ts` turns the dated roadmap content into positioned clips and into three home-page thread spans, reusing the positioning math in `src/lib/timeline/layout.ts`. New roadmap Astro components render the arrangement, meters, and an editable inspector that reuses the existing `CheckItem` and `DecisionLog`. The existing progress and review client scripts are preserved unchanged by keeping every element id and `data-*` hook they target; a small new script handles only zoom and the playhead.

**Tech Stack:** Astro 5 (legacy content collections and plain `.astro`), TypeScript, Vitest 4, Netlify Functions + Blobs (unchanged), Playwright (screenshots), CSS with the tokens in `src/styles/global.css`.

**Spec:** `docs/superpowers/specs/2026-09-02-arrangement-roadmap-design.md` (read it first; section numbers below refer to it). The foundation spec `docs/superpowers/specs/2026-09-02-arrangement-foundation-home-design.md` defines the timeline model and the home inspector this builds on.

## Global Constraints

- Leaf ids never change: progress is stored by id. Dates and a Foundations grouping are added; no group id, chapter id, stage-group id, log id, or foundation item id is renamed.
- The stored-data shapes do not change. The Netlify functions, handlers, and Blobs stores under `netlify/` are untouched, and their tests (`netlify/lib/__tests__/handlers/progress.test.ts`, `review.test.ts`) stay green as the proof.
- Preserve the client contract: `src/scripts/roadmap.ts` and `src/scripts/review.ts` are not edited. Every element id and `data-*` attribute they read (listed in Task 4 and Task 8) is reproduced in the new markup, so their fetch, save, `deriveStats`, and review logic keep working. Both scripts use null-safe `getElementById`, so an id that no longer appears simply no-ops.
- All dates are UTC midnight, written `new Date("YYYY-MM-DD")`. Every date printed on the page goes through `src/lib/dates.ts`. Never a local-time accessor on a content date.
- Only tokens from `src/styles/global.css` for colour, type, radius, spacing, plus three new track tokens (`--track-build`, `--track-reading`, `--track-foundations`). No `--color-accent` on the page.
- The responsive breakpoint is 900px, written `@media (max-width: 899.98px)`.
- No client JavaScript beyond the two existing scripts and one new arrangement-enhancement script (zoom + playhead + inspector close).
- Copy on the page is verbatim from the spec and the existing page (the hero, the track notes). Do not rephrase.
- Commit messages use plain conventional prefixes; no `Co-Authored-By` or agent trailer.
- `npm test` passes before every commit; `npm run build` passes before Tasks 4 onward are committed.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/roadmap.ts` (modify) | Dates on milestones and books; `FoundationGroup[]`; `allIds` flatten; `deriveStats` foundations pass. |
| `src/data/__tests__/roadmap.test.ts` (modify) | Updated for the grouped foundations shape; counts and `deriveStats` numbers unchanged. |
| `src/lib/timeline/layout.ts` (modify) | Widen the positioning helpers' parameter type to a `Positionable` subset. |
| `src/lib/roadmap/arrange.ts` (new) | `ClipStatus`, `RoadmapClip`, `clipStatus`, `roadmapClips`, `threadSpans`, `RoadmapZoom`, `roadmapWindow`, `quarterTicks`. Pure. |
| `src/lib/roadmap/__tests__/arrange.test.ts` (new) | Unit tests for the above. |
| `src/lib/timeline/sources.ts` (modify) | Replace `fromLearning` with `fromRoadmap`. |
| `src/lib/timeline/astro.ts` (modify) | `getTimeline` calls `fromRoadmap(now)`. |
| `src/lib/timeline/__tests__/sources.test.ts` (modify) | Swap the `fromLearning` cases for `fromRoadmap`. |
| `src/data/learning.ts` (delete) | Retired. |
| `src/data/parked/hundred-devs.ts` (new) | 100Devs + testimonial, unreferenced, preserved. |
| `src/components/roadmap/RoadmapMeters.astro` (new) | Three meters + edit controls; carries the `rm-*` ids. |
| `src/components/roadmap/RoadmapInspector.astro` (new) | One `:target` panel per clip; reuses `CheckItem`, `DecisionLog`. |
| `src/components/roadmap/RoadmapArrangement.astro` (new) | Ruler, lanes, clips, playhead, legend, mobile graph; embeds clip JSON. |
| `src/scripts/roadmap-arrangement.ts` (new) | Zoom apply, playhead, inspector close. |
| `src/pages/roadmap.astro` (rewrite) | Assemble the page; the `<style is:global>`. |
| `src/components/roadmap/RetentionSection.astro` (modify) | Restyle; keep its `rv-*` ids. |
| `src/components/roadmap/{RoadmapDashboard,Milestone,BookCard,FoundationsSection}.astro` (delete) | Replaced by the components above. |
| `src/styles/global.css` (modify) | Three track tokens. |
| `scripts/screenshots.mjs`, `CLAUDE.md` (modify) | Verify roadmap shot; document the arrangement. |

`CheckItem.astro`, `DecisionLog.astro`, `src/scripts/roadmap.ts`, and `src/scripts/review.ts` are unchanged.

---

### Task 1: Dated data model

**Files:**
- Modify: `src/data/roadmap.ts`
- Test: `src/data/__tests__/roadmap.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BuildMilestone` and `Book` each gain `start: Date; end: Date`. New `FoundationGroup { id: string; label: string; start: Date; end: Date; items: FoundationItem[] }` and `foundations: FoundationGroup[]`. `allIds`, `logIds`, `deriveStats`, and `RoadmapStats` keep the same membership, ids, and numbers.

- [ ] **Step 1: Update the tests for the grouped shape**

In `src/data/__tests__/roadmap.test.ts`, the foundations assertions change from a flat array to groups. Replace the foundations-count and any `foundations.length` / `foundations.map` references with the grouped equivalents, keeping the totals identical (22 items across the groups, `allIds` still 82). Add:

```ts
import { build, reading, foundations, allIds, deriveStats } from "../roadmap";

it("foundations is two groups whose items keep their ids", () => {
  expect(foundations.map((g) => g.id)).toEqual(["fd.courses", "fd.neetcode"]);
  const items = foundations.flatMap((g) => g.items);
  expect(items).toHaveLength(22);
  expect(items.filter((i) => i.kind === "course")).toHaveLength(4);
  expect(items.filter((i) => i.kind === "pattern")).toHaveLength(18);
  // the leaf ids are unchanged, so stored progress is not orphaned
  expect(items.map((i) => i.id)).toContain("fd.nc.arrays");
});

it("every milestone and book carries a start and end", () => {
  for (const m of build) {
    expect(m.start instanceof Date).toBe(true);
    expect(m.end.getTime()).toBeGreaterThanOrEqual(m.start.getTime());
  }
  for (const b of reading) {
    expect(b.end.getTime()).toBeGreaterThanOrEqual(b.start.getTime());
  }
  for (const g of foundations) {
    expect(g.end.getTime()).toBeGreaterThanOrEqual(g.start.getTime());
  }
});

it("allIds still holds every leaf id (82)", () => {
  expect(allIds.size).toBe(82);
});

it("deriveStats foundations still counts items, not groups", () => {
  expect(deriveStats([]).foundations.itemsTotal).toBe(22);
  expect(deriveStats(["fd.pyci", "fd.nc.arrays"]).foundations.itemsDone).toBe(2);
});
```

Keep every existing `deriveStats` test for build and reading unchanged — their numbers do not move.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/__tests__/roadmap.test.ts`
Expected: FAIL — `foundations` is still flat, milestones have no `start`.

- [ ] **Step 3: Add dates and the grouping**

In `src/data/roadmap.ts`:

Add `start`/`end` to the interfaces:

```ts
export interface BuildMilestone {
  id: string;
  no: string;
  course: string;
  goal: string;
  start: Date;   // NEW
  end: Date;     // NEW
  groups: BuildGroup[];
  logs?: DecisionLog[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  url?: string;
  free?: boolean;
  scopeNote?: string;
  start: Date;   // NEW
  end: Date;     // NEW
  chapters: Chapter[];
}
```

Add the group interface above `foundations` and keep `FoundationItem` as it is:

```ts
// A foundations clip: a small number of these, each holding existing items.
// Dates are placeholders (mockup-derived) until Sean supplies real months.
export interface FoundationGroup {
  id: string;      // new; clip + inspector anchor only, never stored as progress
  label: string;
  start: Date;
  end: Date;
  items: FoundationItem[];
}
```

Add these placeholder dates to each existing entry (do not change any other field). Placeholders, comment each block `// placeholder dates (mockup); Sean to confirm`:

| id | start | end |
|---|---|---|
| redis | 2026-06-01 | 2026-09-30 |
| sqlite | 2026-10-01 | 2026-12-15 |
| http | 2027-01-01 | 2027-02-28 |
| dns | 2027-03-01 | 2027-04-15 |
| kafka | 2027-05-01 | 2027-08-31 |
| ddia | 2026-01-01 | 2026-11-30 |
| dbint | 2026-11-01 | 2027-04-30 |
| ostep | 2027-05-01 | 2027-10-31 |
| aposd | 2026-02-01 | 2026-05-31 |

e.g. for redis: `start: new Date("2026-06-01"), end: new Date("2026-09-30"),`.

Convert `foundations` from the flat `FoundationItem[]` into two groups. Move the four `kind: "course"` items into `fd.courses` and the eighteen `fd.nc.*` items into `fd.neetcode`, verbatim (ids and fields unchanged):

```ts
export const foundations: FoundationGroup[] = [
  {
    id: "fd.courses",
    label: "Courses",
    start: new Date("2026-01-01"), // placeholder
    end: new Date("2026-04-30"),   // placeholder
    items: [
      { id: "fd.pyci", label: "Python for Coding Interviews", kind: "course", total: 40 },
      { id: "fd.dsab", label: "Algorithms & Data Structures for Beginners", kind: "course", total: 35 },
      { id: "fd.coreskills", label: "Core Skills — implement the data structures", kind: "course", total: 20 },
      { id: "fd.advanced", label: "Advanced Algorithms (optional, later)", kind: "course", total: 35 },
    ],
  },
  {
    id: "fd.neetcode",
    label: "NeetCode 150, pattern by pattern",
    start: new Date("2026-04-01"), // placeholder
    end: new Date("2027-06-30"),   // placeholder
    items: [
      { id: "fd.nc.arrays", label: "Arrays & Hashing", kind: "pattern", total: 9, pairsWith: "Redis hash store" },
      // …the remaining 17 fd.nc.* items, moved verbatim…
    ],
  },
];
```

Update `allIds` to flatten the groups (same leaf ids as before):

```ts
export const allIds: Set<string> = new Set([
  ...build.flatMap((m) => [...m.groups.map((g) => g.id), ...(m.logs ?? []).map((l) => l.id)]),
  ...reading.flatMap((b) => b.chapters.map((c) => c.id)),
  ...foundations.flatMap((g) => g.items.map((i) => i.id)),
]);
```

In `deriveStats`, the foundations pass currently reads the flat array. Replace it with:

```ts
const fItems = foundations.flatMap((g) => g.items);
const itemsTotal = fItems.length;
const itemsDone = fItems.filter((i) => done.has(i.id)).length;
```

Leave the `RoadmapStats` shape and every build/reading/logs computation unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/__tests__/roadmap.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/roadmap.ts src/data/__tests__/roadmap.test.ts
git commit -m "feat(roadmap): dated milestones and books, grouped foundations"
```

---

### Task 2: Positioning subset and the pure arrange module

**Files:**
- Modify: `src/lib/timeline/layout.ts`
- Create: `src/lib/roadmap/arrange.ts`
- Test: `src/lib/roadmap/__tests__/arrange.test.ts`

**Interfaces:**
- Consumes: `build`, `reading`, `foundations` and their types from `src/data/roadmap.ts` (Task 1); `Window`, `Tick`, `fraction`, `positionIn`, `packRows`, `estimateLabelWidth` from `layout.ts`; `TimelineItem`, `Lane` from `../timeline/types`.
- Produces: `ClipStatus`, `RoadmapClip`, `Track` (re-exported), `clipStatus`, `roadmapClips`, `threadSpans`, `RoadmapZoom`, `roadmapWindow`, `quarterTicks`.

- [ ] **Step 1: Make the layout helpers generic over the item type**

`packLane(items, lane, w, now, estimate)` filters by `item.lane` and is `TimelineItem`-specific, so the roadmap cannot use it (a `RoadmapClip` has `track`, not `lane`). The roadmap will call `positionIn` + `packRows` directly, so those two — and the `Placed`/`RowPlaced` shapes they thread — must become generic over the item type. `positionIn`, `effectiveEnd`, and `estimateLabelWidth` read only `id`, `title`, `subtitle`, `start`, `end`, and `kind`; `packRows` reads `item.id` and `item.kind`.

In `src/lib/timeline/layout.ts` add:

```ts
export interface Positionable {
  id: string;
  title: string;
  subtitle?: string;
  start: Date;
  end?: Date;
  kind: Kind;
}
```

and make these generic (`TimelineItem` satisfies `Positionable`, so every existing caller keeps its concrete `p.item` type):

```ts
export function effectiveEnd(item: Positionable, now: Date): Date { /* unchanged body */ }

export interface Placed<T extends Positionable = TimelineItem> {
  item: T;
  x: number;
  w: number;
}
export function positionIn<T extends Positionable>(item: T, w: Window, now: Date): Placed<T> | null { /* unchanged body, returns { item, x, w } */ }

export type WidthEstimator = (item: Positionable) => number;
// estimateLabelWidth's returned function already takes only title/subtitle; retype its return to WidthEstimator.

export interface RowPlaced<T extends Positionable = TimelineItem> extends Placed<T> {
  row: number;
  labeled: boolean;
}
export function packRows<T extends Positionable>(placed: readonly Placed<T>[], estimate: WidthEstimator, maxRows = 3): RowPlaced<T>[] { /* unchanged body */ }
```

Leave `packLane` as it is (`items: readonly TimelineItem[]`, the `lane` filter, returning `RowPlaced<TimelineItem>[]`) — the home page still calls it. Leave `windowFor`, `laneSummary`, `graphLayout` on `TimelineItem`. `assignRows` is internal; if its parameter type needs relaxing to `Placed<Positionable>` for the generic `packRows` to compile, do that.

Run `npx vitest run src/lib/timeline` and confirm the existing timeline suite still passes before writing new code.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/roadmap/__tests__/arrange.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clipStatus, roadmapClips, threadSpans, roadmapWindow, quarterTicks } from "../arrange.js";

const now = new Date("2026-09-02T00:00:00Z");

describe("clipStatus", () => {
  it("planned when it starts after now and nothing is done", () => {
    expect(clipStatus(0, 4, new Date("2027-01-01"), now)).toBe("planned");
  });
  it("done when every child is complete", () => {
    expect(clipStatus(4, 4, new Date("2026-01-01"), now)).toBe("done");
  });
  it("in-progress when started and partly complete", () => {
    expect(clipStatus(2, 4, new Date("2026-06-01"), now)).toBe("in-progress");
  });
  it("in-progress when started, nothing done, but start is in the past", () => {
    expect(clipStatus(0, 4, new Date("2026-06-01"), now)).toBe("in-progress");
  });
});

describe("roadmapClips", () => {
  const clips = roadmapClips(new Set<string>(), now);

  it("makes one clip per milestone, book, and foundation group", () => {
    // 5 build + 4 reading + 2 foundations
    expect(clips).toHaveLength(11);
    expect(clips.filter((c) => c.track === "build")).toHaveLength(5);
    expect(clips.filter((c) => c.track === "reading")).toHaveLength(4);
    expect(clips.filter((c) => c.track === "foundations")).toHaveLength(2);
  });
  it("derives status from completion and now", () => {
    const redis = clips.find((c) => c.id === "redis")!;
    expect(redis.status).toBe("in-progress"); // starts 2026-06, before now, nothing done
    const kafka = clips.find((c) => c.id === "kafka")!;
    expect(kafka.status).toBe("planned"); // starts 2027-05
  });
  it("marks a fully-completed milestone done", () => {
    const done = new Set(["redis.core", "redis.rdb", "redis.aof", "redis.replication", "redis.log.resp", "redis.log.durability", "redis.log.replication"]);
    const redis = roadmapClips(done, now).find((c) => c.id === "redis")!;
    expect(redis.status).toBe("done");
  });
  it("links each clip to its inspector anchor and is a span", () => {
    const redis = clips.find((c) => c.id === "redis")!;
    expect(redis.href).toBe("#clip-redis");
    expect(redis.kind).toBe("span");
  });
});

describe("threadSpans", () => {
  const spans = threadSpans(now);

  it("makes three learning-lane items, one per track", () => {
    expect(spans.map((s) => s.id)).toEqual(["roadmap-build", "roadmap-reading", "roadmap-foundations"]);
    expect(spans.every((s) => s.lane === "learning")).toBe(true);
    expect(spans.every((s) => s.kind === "span")).toBe(true);
  });
  it("spans each track from its earliest start to its latest end", () => {
    const build = spans.find((s) => s.id === "roadmap-build")!;
    expect(build.start).toEqual(new Date("2026-06-01"));
    expect(build.end).toEqual(new Date("2027-08-31"));
  });
  it("links into the roadmap thread anchor via the inspector body", () => {
    const reading = spans.find((s) => s.id === "roadmap-reading")!;
    expect(reading.href).toBe("/#item-roadmap-reading");
    expect(reading.body).toMatchObject({ lane: "learning", roadmapHref: "/roadmap#rm-track-reading" });
  });
});

describe("roadmapWindow", () => {
  it("span zoom is the fixed 2026-to-2027 calendar", () => {
    const w = roadmapWindow("span", now, []);
    expect(w.from).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(w.to).toEqual(new Date("2027-12-31T23:59:59.999Z"));
  });
  it("all zoom runs from the earliest clip start to the later of latest end and end of 2027", () => {
    const clips = roadmapClips(new Set<string>(), now);
    const w = roadmapWindow("all", now, clips);
    expect(w.from).toEqual(new Date("2026-01-01")); // earliest = ddia / fd.courses
    expect(w.to.getTime()).toBeGreaterThanOrEqual(new Date("2027-12-31").getTime());
  });
});

describe("quarterTicks", () => {
  it("emits a quarter tick across the span with the year label on each Q1", () => {
    const ticks = quarterTicks(roadmapWindow("span", now, []));
    expect(ticks).toHaveLength(8);
    expect(ticks[0]).toMatchObject({ label: "2026", x: 0 });
    expect(ticks[1].label).toBe("Q2");
    expect(ticks[4].label).toBe("2027");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/roadmap/__tests__/arrange.test.ts`
Expected: FAIL — `../arrange.js` cannot be resolved.

- [ ] **Step 4: Write the module**

Create `src/lib/roadmap/arrange.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/roadmap/__tests__/arrange.test.ts`
Expected: all pass. Then `npx vitest run src/lib/timeline` to confirm the widened signatures broke nothing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/timeline/layout.ts src/lib/roadmap/arrange.ts src/lib/roadmap/__tests__/arrange.test.ts
git commit -m "feat(roadmap): positioned clips, thread spans, quarter calendar"
```

---

### Task 3: Home Learning lane derivation

**Files:**
- Modify: `src/lib/timeline/sources.ts`, `src/lib/timeline/astro.ts`
- Modify: `src/lib/timeline/__tests__/sources.test.ts`
- Create: `src/data/parked/hundred-devs.ts`
- Delete: `src/data/learning.ts`

**Interfaces:**
- Consumes: `threadSpans(now)` from Task 2.
- Produces: `fromRoadmap(now: Date): TimelineItem[]` in `sources.ts` (replaces `fromLearning`).

- [ ] **Step 1: Park the 100Devs content**

Create `src/data/parked/hundred-devs.ts` (nothing imports it; it exists only to preserve the content and testimonial for a later decision — spec §10):

```ts
// Parked: 100Devs and Leon Noel's testimonial. Removed from the timeline in
// sub-project 3 (docs/superpowers/specs/2026-09-02-arrangement-roadmap-design.md
// §10) because the Learning lane now derives from the roadmap. Kept verbatim
// until we decide where, if anywhere, it belongs. Not imported anywhere.
export const hundredDevs = {
  id: "100devs",
  title: "100Devs",
  subtitle: "where it started",
  description:
    "A free, community-run software engineering program led by Leon Noel. Where I learned to build for the web and to keep showing up.",
  start: "2021-01-15",
  end: "2022-01-15",
  status: "done",
  testimonial: {
    quote:
      "Talented developer and lightning fast learner. I had the pleasure of mentoring Sean at 100devs. No matter the challenge or how short the deadline, Sean always triumphed. He never settled for just what was due, but pushed boundaries and always delivered a product well above and beyond what was asked. Not only was Sean's work ethic unparalleled, but the speed at which he was able to learn new materials was astonishing. His hard work and ability to quickly understand complex topics made him into a great programmer.",
    author: "Leon Noel",
    role: "Managing Director of Engineering, Resilient Coders",
  },
} as const;
```

- [ ] **Step 2: Update the sources test**

In `src/lib/timeline/__tests__/sources.test.ts`, remove the `fromLearning` import and its cases and add `fromRoadmap`:

```ts
import { fromRoadmap } from "../sources.js";

describe("fromRoadmap", () => {
  const now = new Date("2026-09-02T00:00:00Z");
  it("produces the three learning-lane thread spans", () => {
    const items = fromRoadmap(now);
    expect(items.map((i) => i.id)).toEqual(["roadmap-build", "roadmap-reading", "roadmap-foundations"]);
    expect(items.every((i) => i.lane === "learning")).toBe(true);
  });
});
```

(If a `mergeTimeline` test referenced `fromLearning`, switch it to `fromRoadmap(now)`.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/timeline/__tests__/sources.test.ts`
Expected: FAIL — `fromRoadmap` is not exported.

- [ ] **Step 4: Replace the adapter and rewire the loader**

In `src/lib/timeline/sources.ts`, delete `fromLearning` and its `LearningEntry` import, and add:

```ts
import { threadSpans } from "../roadmap/arrange.js";

/** Spec §10: the home Learning lane is derived from the roadmap. */
export function fromRoadmap(now: Date): TimelineItem[] {
  return threadSpans(now);
}
```

In `src/lib/timeline/astro.ts`, replace the learning import and call:

```ts
import { fromBlog, fromProjects, fromCommunity, fromRoadmap, mergeTimeline } from "./sources";
// …drop:  import learning from "../../data/learning";
```

and in `getTimeline`, build the merged list with `fromRoadmap(now)` where it currently passes `fromLearning(learning)`. `now` is already created in `getTimeline`; compute it before the merge:

```ts
const now = new Date();
const items = mergeTimeline(
  fromBlog(blog, { includeDrafts }),
  fromProjects(projects),
  fromCommunity(community),
  fromRoadmap(now),
);
return { items, now, projects };
```

Delete `src/data/learning.ts` (`git rm src/data/learning.ts`).

- [ ] **Step 5: Run tests and build**

Run: `npm test` — all pass.
Run: `npm run build` — succeeds; the home page's Learning lane now shows three clips (Build, Reading, Foundations).

- [ ] **Step 6: Commit**

```bash
git add src/lib/timeline/sources.ts src/lib/timeline/astro.ts src/lib/timeline/__tests__/sources.test.ts src/data/parked/hundred-devs.ts
git rm src/data/learning.ts
git commit -m "feat(home): derive the Learning lane from the roadmap; park 100Devs"
```

---

### Task 4: RoadmapMeters component

**Files:**
- Create: `src/components/roadmap/RoadmapMeters.astro`

**Interfaces:**
- Consumes: `deriveStats` from `src/data/roadmap`.
- Produces: markup carrying every id `src/scripts/roadmap.ts` writes. The page (Task 8) renders it.

This component replaces `RoadmapDashboard.astro`. It must preserve, verbatim, the element ids and attributes `roadmap.ts` targets, or the live numbers stop updating. The required ids: `rm-build-stages`, `rm-build-courses`, `rm-build-bar`, `rm-read-ch`, `rm-read-books`, `rm-read-bar`, `rm-fnd-done`, `rm-fnd-bar`, `rm-logs-done`, `rm-save-state`, `rm-message`, and the button `rm-edit`. Bars are the `<i>` elements whose `width` the script sets.

- [ ] **Step 1: Write the component**

Create `src/components/roadmap/RoadmapMeters.astro`:

```astro
---
// Three progress meters + the owner's edit controls (spec §6). Numbers render
// zeroed; src/scripts/roadmap.ts fills them by the ids below. Those ids are a
// contract with that script — do not rename them.
import { deriveStats } from "../../data/roadmap";
const s = deriveStats([]); // zeroed; the script overwrites on load
---

<div class="rm-meters">
  <div class="rm-meter" style="--c: var(--track-build)">
    <div class="rm-meter-head">
      <b><i class="rm-mdot"></i>Build</b>
      <small><span id="rm-build-stages">0</span>/{s.build.stagesTotal} stages ·
        <span id="rm-build-courses">0</span>/{s.build.coursesTotal} courses ·
        <span id="rm-logs-done">0</span>/{s.logsTotal} logs</small>
    </div>
    <div class="rm-bar"><i id="rm-build-bar"></i></div>
  </div>

  <div class="rm-meter" style="--c: var(--track-reading)">
    <div class="rm-meter-head">
      <b><i class="rm-mdot"></i>Reading</b>
      <small><span id="rm-read-ch">0</span>/{s.reading.chaptersTotal} chapters ·
        <span id="rm-read-books">0</span>/{s.reading.booksTotal} books</small>
    </div>
    <div class="rm-bar"><i id="rm-read-bar"></i></div>
  </div>

  <div class="rm-meter" style="--c: var(--track-foundations)">
    <div class="rm-meter-head">
      <b><i class="rm-mdot"></i>Foundations</b>
      <small><span id="rm-fnd-done">0</span>/{s.foundations.itemsTotal} items</small>
    </div>
    <div class="rm-bar"><i id="rm-fnd-bar"></i></div>
  </div>
</div>

<div class="rm-controls">
  <span id="rm-save-state" class="rm-save-state" role="status" aria-live="polite"></span>
  <button id="rm-edit" type="button" class="rm-edit-btn">Edit</button>
</div>
<p id="rm-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>
```

The `rm-bar`/`<i>` and `rm-meter` styling comes in Task 8's stylesheet (adapt `.rm-bar` and `.rm-stat` from the current `roadmap.astro` `<style is:global>`, which the implementer can read before deleting).

- [ ] **Step 2: Type-check via build later**

This component is rendered by the page in Task 8; there is nothing to run standalone. Verify only that `deriveStats([])` still type-checks: `npx tsc --noEmit` (the project's check) or defer to Task 8's `npm run build`. No commit yet — commit with the page in Task 8 so the branch never has an orphaned unused component. (Ledger note: Tasks 4–8 form the page; they commit together at the end of Task 8, or each with a build that includes the page. The implementer may hold Task 4–7 files uncommitted until Task 8 assembles them, then commit once; the reviewer sees the whole page diff.)

> **Execution note for the controller:** Tasks 4, 5, 6, and 7 each produce a component or script that only compiles meaningfully once the page (Task 8) imports it. Dispatch them as one implementer working through Tasks 4→8 in order with a single build+commit at the end of Task 8, and review the assembled page as one diff. The steps stay separate for clarity, but they share a commit.

---

### Task 5: RoadmapInspector component

**Files:**
- Create: `src/components/roadmap/RoadmapInspector.astro`

**Interfaces:**
- Consumes: `build`, `reading`, `foundations` from `src/data/roadmap`; `CheckItem.astro`, `DecisionLog.astro`; `roadmapClips` from `arrange.ts` for the clip status/label; `longDate`/`monthYear` from `src/lib/dates`.
- Produces: one panel per clip, `id="clip-<id>"`, shown by `:target` (see Task 8 CSS). Carries `data-id`, `data-log-id`, `data-log-field`, `data-milestone-pct`, `data-book-pct` so `roadmap.ts` reaches them.

- [ ] **Step 1: Write the component**

Create `src/components/roadmap/RoadmapInspector.astro`. It renders a panel for every milestone, book, and foundation group. The checkpoint rows and decision logs are the existing components, moved out of the retired `Milestone`/`BookCard`/`FoundationsSection` bodies. Model the panel structure on the home `Inspector.astro` (read it for the `:target`/`data-open` panel pattern and `scroll-margin-top`).

```astro
---
import { build, reading, foundations } from "../../data/roadmap";
import CheckItem from "./CheckItem.astro";
import DecisionLog from "./DecisionLog.astro";
import { longDate } from "../../lib/dates";

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);
const range = (start: Date, end: Date) => `${longDate(start)} – ${longDate(end)}`;
---

{/* Build */}
{build.map((m) => (
  <section class="rm-insp" id={`clip-${m.id}`} style="--c: var(--track-build)" data-clip>
    <p class="rm-insp-k"><i></i>Build · {m.no}</p>
    <h2 class="rm-insp-title">{m.course}</h2>
    <p class="rm-insp-goal">{m.goal}</p>
    <p class="rm-insp-facts">
      {range(m.start, m.end)} · <span data-milestone-pct={m.id}>0%</span>
    </p>
    <div class="rm-insp-checks">
      {m.groups.map((g) => (
        <CheckItem id={g.id} label={g.label} meta={`${g.stages} stages${g.hours ? ` · ~${g.hours}h` : ""}`} />
      ))}
    </div>
    {(m.logs ?? []).map((log) => <DecisionLog log={log} />)}
  </section>
))}

{/* Reading */}
{reading.map((b) => (
  <section class="rm-insp" id={`clip-${b.id}`} style="--c: var(--track-reading)" data-clip>
    <p class="rm-insp-k"><i></i>Reading</p>
    <h2 class="rm-insp-title">{b.title}</h2>
    <p class="rm-insp-goal">{b.author}{b.scopeNote ? ` — ${b.scopeNote}` : ""}</p>
    <p class="rm-insp-facts">
      {range(b.start, b.end)} · <span data-book-pct={b.id}>0/0</span>
    </p>
    <div class="rm-insp-checks">
      {b.chapters.map((c) => <CheckItem id={c.id} label={`${c.no}. ${c.title}`} />)}
    </div>
  </section>
))}

{/* Foundations */}
{foundations.map((g) => (
  <section class="rm-insp" id={`clip-${g.id}`} style="--c: var(--track-foundations)" data-clip>
    <p class="rm-insp-k"><i></i>Foundations</p>
    <h2 class="rm-insp-title">{g.label}</h2>
    <p class="rm-insp-facts">{range(g.start, g.end)}</p>
    <div class="rm-insp-checks">
      {g.items.map((it) => (
        <CheckItem id={it.id} label={it.label} meta={it.total ? `${it.total}${it.kind === "pattern" ? " problems" : " lessons"}` : undefined} hint={it.pairsWith} />
      ))}
    </div>
  </section>
))}
```

Every panel is server-rendered whether or not it is the `:target`, so a deep link (`/roadmap#clip-redis`) opens the right one with no JavaScript and edit mode reaches all of them. The `data-milestone-pct`/`data-book-pct` spans keep `roadmap.ts`'s per-clip percent updates working; Foundations has no per-group percent in `deriveStats`, so it omits that span.

---

### Task 6: RoadmapArrangement component

**Files:**
- Create: `src/components/roadmap/RoadmapArrangement.astro`

**Interfaces:**
- Consumes: `roadmapClips`, `roadmapWindow`, `quarterTicks`, `RoadmapClip`, `Track` from `arrange.ts`; `positionIn`, `packRows`, `estimateLabelWidth`, `fraction` from `layout.ts` (the generic versions from Task 2).
- Produces: the ruler, three lanes, positioned clips, the playhead, the legend, and a mobile graph; embeds the clip list as JSON in `#rm-clip-data` for the arrangement script (Task 7).

- [ ] **Step 1: Write the component**

Create `src/components/roadmap/RoadmapArrangement.astro`. Compute positions at build time for the default `"span"` window using the shared math, as the home `Timeline.astro` does for its lanes (read that file for the lane/clip/ruler markup and CSS-variable pattern — `--x`, `--w`, `--y`, and the `grid-template-columns: 160px 1fr` lane shape). The roadmap does its own per-track filter and calls `positionIn` + `packRows` directly (not `packLane`, which filters by `lane`). Every roadmap clip is a span, so `packRows` never demotes and the `estimate` argument is effectively unused, but pass it for the shared signature.

Frontmatter:

```astro
---
import { roadmapClips, roadmapWindow, quarterTicks, type Track } from "../../lib/roadmap/arrange";
import { positionIn, packRows, estimateLabelWidth, fraction } from "../../lib/timeline/layout";

const now = new Date();
const clips = roadmapClips(new Set<string>(), now); // zeroed; live progress fills numbers, not positions
const win = roadmapWindow("span", now, clips);
const ticks = quarterTicks(win);
const estimate = estimateLabelWidth();
const nowX = fraction(now, win); // 0..1 within the window

const TRACKS: { key: Track; label: string; note: string }[] = [
  { key: "build", label: "Build", note: "CodeCrafters, in order" },
  { key: "reading", label: "Reading", note: "anchor + light" },
  { key: "foundations", label: "Foundations", note: "NeetCode" },
];

// Per track: position its clips in the window, then pack into rows.
// packRows returns RowPlaced<RoadmapClip>[] — each has .item (the clip), .x, .w, .row.
const lanes = TRACKS.map((t) => {
  const placed = clips.filter((c) => c.track === t.key).flatMap((c) => positionIn(c, win, now) ?? []);
  return { ...t, rows: packRows(placed, estimate) };
});

// Serialize for the client script so it can re-lay for the "All" zoom.
const clipData = clips.map((c) => ({
  id: c.id, track: c.track, title: c.title, sublabel: c.sublabel,
  start: c.start.toISOString(), end: c.end.toISOString(), status: c.status, href: c.href,
}));
---
```

> A `RowPlaced<RoadmapClip>` has `.item` (the clip: `.id`, `.title`, `.sublabel`, `.status`, `.href`), `.x` and `.w` (fractions 0–1), and `.row`. Use exactly those field names; `positionIn` returns `{ item, x, w }` and `packRows` adds `{ row, labeled }`.

Markup: a `.rm-arr` with a zoom control (two buttons `data-rm-zoom="span"` / `data-rm-zoom="all"`, the first `aria-pressed="true"`), a ruler built from `ticks`, three `.rm-lane` blocks each with a head (`<h3 id="rm-track-<key>">` — preserve these ids; the home Learning inspector links to them) and its packed clips as anchors:

```astro
<div class="rm-arr" data-window-from={win.from.toISOString()} data-window-to={win.to.toISOString()}>
  <div class="rm-arr-head">
    <div class="rm-zoom" role="group" aria-label="Zoom">
      <button type="button" data-rm-zoom="span" aria-pressed="true">2026–2027</button>
      <button type="button" data-rm-zoom="all" aria-pressed="false">All</button>
    </div>
  </div>

  <div class="rm-ruler" aria-hidden="true">
    {ticks.map((t) => <span class="rm-tick" style={`left:${t.x * 100}%`}>{t.label}</span>)}
  </div>

  {lanes.map((lane) => (
    <div class="rm-lane" style={`--c: var(--track-${lane.key})`}>
      <div class="rm-lane-head">
        <h3 id={`rm-track-${lane.key}`}><i class="rm-mdot"></i>{lane.label}</h3>
        <small>{lane.note}</small>
      </div>
      <div class="rm-clips" data-track={lane.key}>
        {lane.rows.map((p) => (
          <a
            class:list={["rm-clip", `is-${p.item.status}`]}
            href={p.item.href}
            data-clip-id={p.item.id}
            style={`--x:${p.x * 100}%; --w:${p.w * 100}%; --y:${p.row}`}
          >
            <span class="rm-clip-title">{p.item.title}</span>
            {p.item.sublabel && <small class="rm-clip-sub">{p.item.sublabel}</small>}
          </a>
        ))}
      </div>
    </div>
  ))}

  <div class="rm-playhead" style={`--ph:${nowX}`} data-rm-playhead><span>now</span></div>
</div>

{/* Mobile graph: the same clips, date-ordered, shown below 900px (spec §6). */}
<ol class="rm-graph" aria-label="Roadmap, by date">
  {[...clips].sort((a, b) => a.start.getTime() - b.start.getTime()).map((c) => (
    <li class:list={["rm-graph-row", `t-${c.track}`, `is-${c.status}`]}>
      <a href={c.href}><b>{c.title}</b><small>{c.sublabel}</small></a>
    </li>
  ))}
</ol>

<script type="application/json" id="rm-clip-data" set:html={JSON.stringify(clipData)}></script>

<div class="rm-legend" aria-hidden="true">
  <span><i class="l-done"></i>done</span>
  <span><i class="l-prog"></i>in progress</span>
  <span><i class="l-plan"></i>planned</span>
</div>
```

The desktop `.rm-arr` and the mobile `.rm-graph` are both server-rendered; Task 8's CSS shows one and hides the other at 900px (the same one-DOM-two-layouts split the writing index used). Clip status classes (`is-done`/`is-in-progress`/`is-planned`) are server-rendered from the zeroed state and recomputed on load only if the arrangement script chooses to (Task 7 keeps it simple: it does not restyle clips, matching spec §8).

---

### Task 7: Arrangement enhancement script

**Files:**
- Create: `src/scripts/roadmap-arrangement.ts`

**Interfaces:**
- Consumes: `#rm-clip-data` JSON, the `.rm-arr` element, `roadmapWindow`/`quarterTicks` from `arrange.ts`, `positionIn`/`packRows`/`estimateLabelWidth` from `layout.ts`.
- Produces: zoom switching, playhead placement, and inspector close. No effect without JavaScript (the server-rendered `"span"` window and `:target` panels stand alone).

- [ ] **Step 1: Write the script**

Create `src/scripts/roadmap-arrangement.ts`. Model `apply(zoom)` on the home `src/scripts/timeline.ts` (read it for the pattern: read clips, compute a window, re-pack per lane, write `--x`/`--w`/`--y`, redraw ruler ticks, move the playhead, remember the choice). Scope it down: no canvas measuring beyond what `estimateLabelWidth` needs, no entrance animation.

```ts
import { roadmapWindow, quarterTicks, type RoadmapClip, type RoadmapZoom } from "../lib/roadmap/arrange";
import { positionIn, packRows, estimateLabelWidth, fraction } from "../lib/timeline/layout";

const ZOOM_KEY = "roadmap-zoom";
const arr = document.querySelector<HTMLElement>(".rm-arr");
const dataEl = document.getElementById("rm-clip-data");
if (arr && dataEl) {
  document.documentElement.classList.add("js");
  const now = new Date();
  const raw = JSON.parse(dataEl.textContent || "[]") as Array<{
    id: string; track: RoadmapClip["track"]; title: string; sublabel?: string;
    start: string; end: string; status: RoadmapClip["status"]; href: string;
  }>;
  const clips: RoadmapClip[] = raw.map((c) => ({
    ...c, kind: "span", start: new Date(c.start), end: new Date(c.end),
  }));
  const estimate = estimateLabelWidth();

  function apply(zoom: RoadmapZoom) {
    const win = roadmapWindow(zoom, now, clips);
    for (const track of ["build", "reading", "foundations"] as const) {
      const placed = clips.filter((c) => c.track === track).flatMap((c) => positionIn(c, win, now) ?? []);
      const rows = packRows(placed, estimate);
      const lane = arr!.querySelector<HTMLElement>(`.rm-clips[data-track="${track}"]`);
      if (!lane) continue;
      for (const p of rows) {
        const el = lane.querySelector<HTMLElement>(`.rm-clip[data-clip-id="${p.item.id}"]`);
        if (!el) continue;
        el.style.setProperty("--x", `${p.x * 100}%`);
        el.style.setProperty("--w", `${p.w * 100}%`);
        el.style.setProperty("--y", String(p.row));
      }
    }
    // redraw ruler
    const ruler = arr!.querySelector<HTMLElement>(".rm-ruler");
    if (ruler) {
      ruler.innerHTML = "";
      for (const t of quarterTicks(win)) {
        const s = document.createElement("span");
        s.className = "rm-tick";
        s.style.left = `${t.x * 100}%`;
        s.textContent = t.label;
        ruler.appendChild(s);
      }
    }
    const ph = arr!.querySelector<HTMLElement>("[data-rm-playhead]");
    if (ph) ph.style.setProperty("--ph", String(fraction(now, win)));
    for (const b of arr!.querySelectorAll<HTMLButtonElement>("[data-rm-zoom]")) {
      b.setAttribute("aria-pressed", String(b.dataset.rmZoom === zoom));
    }
    try { localStorage.setItem(ZOOM_KEY, zoom); } catch {}
  }

  for (const b of arr.querySelectorAll<HTMLButtonElement>("[data-rm-zoom]")) {
    b.addEventListener("click", () => apply(b.dataset.rmZoom as RoadmapZoom));
  }
  let initial: RoadmapZoom = "span";
  try { if (localStorage.getItem(ZOOM_KEY) === "all") initial = "all"; } catch {}
  apply(initial);
}
```

> If `estimateLabelWidth`, `packRows`, or their `RowPlaced` fields differ from what this sketch assumes, follow the real signatures in `layout.ts` — the home `timeline.ts` is the authoritative example of calling them from the browser. The `.rm-ruler` and clip styles must be `is:global` in Task 8's stylesheet, because this script creates ruler `<span>`s and Astro's scoped styles would not reach them (the same ruling that made the home timeline styles global).

---

### Task 8: Page assembly, retention restyle, and styles

**Files:**
- Rewrite: `src/pages/roadmap.astro`
- Modify: `src/components/roadmap/RetentionSection.astro`
- Modify: `src/styles/global.css`
- Delete: `src/components/roadmap/{RoadmapDashboard,Milestone,BookCard,FoundationsSection}.astro`

**Interfaces:**
- Consumes: `RoadmapMeters`, `RoadmapArrangement`, `RoadmapInspector`, `RetentionSection`, and the three scripts.

- [ ] **Step 1: Add the track tokens**

In `src/styles/global.css`, after the lane tokens, add:

```css
    /* Roadmap tracks (spec §6). Build equals the learning lane: the roadmap is
       the Learning lane up close. */
    --track-build: #60A5FA;
    --track-reading: #5FB3AC;
    --track-foundations: #9DB4D6;
```

- [ ] **Step 2: Rewrite the page**

Replace `src/pages/roadmap.astro` with the new composition. Keep the `Layout` title, description, and `ogImagePath("roadmap")` from the current file verbatim. Keep the hero eyebrow, `<h1>Building <em>engineering judgment</em></h1>`, and the thesis paragraph verbatim. Body:

```astro
---
import Layout from "../layouts/Layout.astro";
import TransportBar from "../components/TransportBar.astro";
import Footer from "../components/Footer.astro";
import RoadmapMeters from "../components/roadmap/RoadmapMeters.astro";
import RoadmapArrangement from "../components/roadmap/RoadmapArrangement.astro";
import RoadmapInspector from "../components/roadmap/RoadmapInspector.astro";
import RetentionSection from "../components/roadmap/RetentionSection.astro";
import { ogImagePath } from "../lib/og.mjs";
---

<Layout
  title="Roadmap — Building Engineering Judgment | Sean Campbell"
  description="A public learning roadmap: building real systems (CodeCrafters), reading deeply (DDIA & more), and DSA fundamentals (NeetCode) — building engineering judgment in the open."
  image={ogImagePath("roadmap")}
>
  <TransportBar active="learning" />
  <main class="roadmap-page">
    <div class="rm-wrap">
      <p class="rm-eyebrow">A learning roadmap · in progress</p>
      <h1 class="rm-title">Building <em>engineering judgment</em></h1>
      <p class="rm-thesis">Follow along with what I'm doing and the resources I'm using to become better at decision making &amp; problem solving as a Software Engineer. Building everything out in the open for anyone to see.</p>

      <RoadmapMeters />
      <RoadmapArrangement />
      <RoadmapInspector />
      <RetentionSection />

      <p class="rm-note">Progress is shared — what you see is the live, saved state. The owner can unlock edit mode to check items off.</p>
    </div>
  </main>
  <Footer />
</Layout>

<script>
  import "../scripts/roadmap.ts";
  import "../scripts/roadmap-arrangement.ts";
  import "../scripts/review.ts";
</script>

<style is:global>
  /* … see Step 3 … */
</style>
```

- [ ] **Step 3: Write the stylesheet**

The `<style is:global>` is the bulk of the work. Build it by adapting, not inventing:

- **Palette + page frame:** keep the current `.roadmap-page` rules (padding, `[hidden] { display:none !important }`, `.rm-wrap`, `.rm-eyebrow`, `.rm-title`, `.rm-thesis`, `.rm-note`) from the file you are replacing — read them before deleting. Swap the local `--build`/`--reading`/`--foundations` custom properties for the new global `--track-*` tokens.
- **Meters + controls:** adapt the current `.rm-bar`, `.rm-stat`, `.rm-controls`, `.rm-edit-btn`, `.rm-save-state`, `.rm-message` rules for the new `.rm-meters`/`.rm-meter`/`.rm-meter-head`/`.rm-mdot` markup. The bar fill is `.rm-bar > i { background: var(--c); width: 0; }`.
- **Arrangement, ruler, lanes, clips, playhead:** adapt from the home `Timeline.astro` `<style>` — the `.tl-lane`/`.tl-clips`/`.tl-clip`/`.tl-ruler`/`.tl-playhead` rules and their `--x`/`--w`/`--y` positioning — renaming to `.rm-lane`/`.rm-clips`/`.rm-clip`/`.rm-ruler`/`.rm-playhead` and using `var(--c)` per lane. Clip status: `.rm-clip.is-done` solid `color-mix(in srgb, var(--c) 22%, var(--panel-equivalent))` with a left border in `--c`; `.rm-clip.is-in-progress` the repeating-linear-gradient stripe + dashed right border; `.rm-clip.is-planned` transparent with a dashed outline in a muted `--c` — copy the exact treatments from the mockup's `.b-clip`/`.b-clip.live`/`.b-clip.plan` (`.superpowers/brainstorm/94902-1788329608/content/arrangement-v2.html`).
- **Inspector panels:** adapt from the home `Inspector.astro` — the `html:not(.js) .rm-insp` hidden-by-default, `html:not(.js) .rm-insp:target` / `.rm-insp[data-open]` shown, and `scroll-margin-top: 76px`. Reuse the existing decision-log and check-item styles from the current roadmap stylesheet (`.rm-check`, `.rm-log`, `.rm-phase`, etc.) verbatim — those components are unchanged, so their CSS moves over as-is.
- **Mobile graph:** below `@media (max-width: 899.98px)`, hide `.rm-arr` and show `.rm-graph` (a lane-gutter list); hide `.rm-graph` and show `.rm-arr` above it. Adapt the home graph gutter rules from `Timeline.astro`.
- **Retention:** its section styles largely carry over; see Step 4.

Keep the `[hidden] { display: none !important }` rule — the review runner relies on it.

- [ ] **Step 4: Restyle RetentionSection**

In `src/components/roadmap/RetentionSection.astro`, keep every `rv-*` id and `data-rv-*` attribute (the `review.ts` contract) and the markup structure; update only the classes/styles to the console palette so it sits below the arrangement as a distinct section. The retention numbers the old dashboard showed (`rv-dash-rotation`, `rv-dash-due`, `rv-dash-streak`, `rv-dash-private`) are gone from the page; `review.ts` still calls `setText` on them, which now no-ops harmlessly, and the section's own `rv-rotation-count`, `rv-streak`, `rv-due-count`, and `rv-runner` continue to update. Do not edit `review.ts`.

- [ ] **Step 5: Delete the retired components**

```bash
git rm src/components/roadmap/RoadmapDashboard.astro src/components/roadmap/Milestone.astro src/components/roadmap/BookCard.astro src/components/roadmap/FoundationsSection.astro
```

- [ ] **Step 6: Build and look**

Run: `npm run build`. Expected: succeeds. In `dist/roadmap/index.html`: three `rm-track-build`/`rm-track-reading`/`rm-track-foundations` lane heads; one `rm-clip` per milestone/book/foundation group with `is-in-progress`/`is-planned`/`is-done` classes; one `id="clip-<id>"` panel per clip; the meter ids `rm-build-bar` etc. present; the `#rm-clip-data` JSON present; the `rv-*` runner markup present.

Then `npm run preview` and screenshot `/roadmap` at 1280 and 390 (reuse a Playwright one-off under the gitignored SDD workspace, as sub-project 2 did). Check against the mockup: the quarter ruler, three lanes with clips, dashed planned clips to the right of the playhead, the meters filling once the page fetches progress (they read 0 without `netlify dev`, which is expected), the mobile graph below 900px, and a clip's inspector opening on click and via `/roadmap#clip-redis` with JavaScript disabled.

- [ ] **Step 7: Run the suite and commit the whole page**

Run: `npm test` — all pass (including the untouched `netlify/lib/__tests__/handlers/*`, which prove the stored-data contract held).

```bash
git add src/pages/roadmap.astro src/components/roadmap/RoadmapMeters.astro src/components/roadmap/RoadmapArrangement.astro src/components/roadmap/RoadmapInspector.astro src/components/roadmap/RetentionSection.astro src/scripts/roadmap-arrangement.ts src/styles/global.css
git rm src/components/roadmap/RoadmapDashboard.astro src/components/roadmap/Milestone.astro src/components/roadmap/BookCard.astro src/components/roadmap/FoundationsSection.astro
git commit -m "feat(roadmap): arrangement page with editable inspector and meters"
```

---

### Task 9: Screenshots and documentation

**Files:**
- Modify: `scripts/screenshots.mjs` (verify only), `CLAUDE.md`

- [ ] **Step 1: Confirm the roadmap is in the screenshot set**

`scripts/screenshots.mjs` already shoots `/roadmap` (added in sub-project 2). Confirm it lists `{ name: "roadmap", path: "/roadmap" }`; no change needed if so. If it is missing, add it after the writing entries.

- [ ] **Step 2: Update CLAUDE.md**

In the Architecture section, after the **Writing pages** paragraph, add:

```markdown
**Roadmap page:** `src/pages/roadmap.astro` renders the roadmap as an arrangement — three dated tracks (Build, Reading, Foundations) as clips on a quarter calendar, positioned by `src/lib/roadmap/arrange.ts` reusing `src/lib/timeline/layout.ts`. `RoadmapArrangement.astro` draws the lanes and a mobile graph; `RoadmapInspector.astro` server-renders one `:target` panel per clip, reusing `CheckItem` and `DecisionLog`; `RoadmapMeters.astro` shows live progress. Editing and the spaced-repetition review deck are unchanged: `src/scripts/roadmap.ts` and `review.ts` still drive them through preserved element ids and `data-*` hooks, backed by the token-gated Netlify functions and Blobs stores. `src/scripts/roadmap-arrangement.ts` handles only zoom and the playhead. `arrange.ts` also produces the home page's Learning-lane thread spans, so the roadmap is the single source and `src/data/learning.ts` was retired.
```

In the **Timeline data** paragraph, note that the Learning lane derives from the roadmap (no longer hand-authored).

- [ ] **Step 3: Run the suite and commit**

Run: `npm test` — all pass.

```bash
git add scripts/screenshots.mjs CLAUDE.md
git commit -m "docs: document the roadmap arrangement and derived Learning lane"
```

---

## Self-review notes

Spec coverage: §4 dated data model and foundations grouping (Task 1); §5 status, clips, thread spans, window, ticks (Task 2); §6 arrangement, meters, ruler, zoom, mobile graph, track tokens (Tasks 4, 6, 8); §7 editable inspector reusing CheckItem/DecisionLog (Task 5); §8 progress script preserved via the id contract (Tasks 4, 5, 8 — `roadmap.ts` unedited); §9 review surface restyle, `review.ts` unedited (Task 8); §10 home Learning derivation and parked 100Devs (Task 3); §11 files (all); §12 accessibility (Tasks 5, 6, 8: real lists, one link per clip, `:target` panels, `<time>`, focus, preserved labels); §13 testing (Tasks 1–3 unit tests, handler tests untouched, screenshots Task 8–9); §14 placeholder dates (Task 1).

Deviations from the spec, both simplifications in the good direction, called out for the reviewer: (1) `src/scripts/roadmap.ts` and `src/scripts/review.ts` are **not edited** — the spec said "rewired"; preserving the id/`data-*` contract achieves the same result with less churn and less risk, and the untouched handler+script code is the reason the stored-data contract provably holds. (2) The retention numbers move by *removing* the dashboard stats and letting `review.ts`'s null-safe writes no-op, rather than repointing the script.

Type consistency: `RoadmapClip` fields are defined once in Task 2 and consumed by Tasks 5–7; `Positionable` (Task 2) is what `positionIn`/`packRows` accept; `threadSpans`/`fromRoadmap` return `TimelineItem[]` (Tasks 2–3); the element-id contract (`rm-build-bar`, `rm-track-<track>`, `clip-<id>`, `data-milestone-pct`, `#rm-clip-data`, `data-rm-zoom`) is named identically across Tasks 4–8.
