# Arrangement sub-project 4 (everything else) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Arrangement redesign: give projects an index and a page each, move the testimonial to the contact block, redesign the 404 and newsletter pages, close the roadmap leftovers, and rewrite the docs.

**Architecture:** The writing track in `src/lib/timeline/track.ts` becomes lane-agnostic so the Building index and the project sidebar reuse its tested row math; `BlogPost.astro` splits into a shared `Reader` frame (layout + prose CSS in `src/styles/reader.css`) plus the essay content, and the project page fills the same frame. Everything else is page-level work over unchanged data.

**Tech Stack:** Astro 5, MDX content collections, zod, Vitest, plain CSS with custom properties, vanilla-JS progressive enhancement. Node 20.

**Spec:** `docs/superpowers/specs/2026-09-03-arrangement-everything-else-design.md`

## Global Constraints

- **Zero client-side JavaScript except the existing enhancement scripts.** No new framework, no islands. The only new script in this plan is two lines inline on the 404 page.
- **All calendar math is UTC.** Content dates are UTC midnight. Every user-visible date goes through `src/lib/dates.ts`. Never call `toLocaleDateString`.
- **The roadmap client contract is frozen.** `src/scripts/roadmap.ts` and `src/scripts/review.ts` are never edited. Every element id and `data-*` attribute they read must survive; Task 13 proves it.
- **Nothing under `netlify/` changes.** Handler tests stay green untouched.
- **The responsive breakpoint is 900px**, written as `@media (max-width: 899.98px)`.
- **Lane colors:** `--lane-writing` gold, `--lane-building` coral, `--lane-learning` blue, `--lane-community` violet. Roadmap tracks: `--track-build`, `--track-reading`, `--track-foundations`.
- **Radius is 3 to 4px** (`--radius-sm`, `--radius-md`); the pill radius `--radius-full` is used only by the roadmap's zoom and edit buttons.
- **Commit messages carry no co-author or agent trailer.** The repo owner's global instructions forbid it.
- **Placeholder content dates stay** unless the owner supplies real ones (spec §14). Do not invent dates.

---

### Task 1: Date and wording helpers

Two pure additions that later tasks build on: a long month-and-year formatter, and the two wording helpers that give the inspector, the project kicker, and the track one shared vocabulary for "when".

**Files:**
- Modify: `src/lib/dates.ts`
- Modify: `src/lib/__tests__/dates.test.ts`
- Modify: `src/lib/timeline/track.ts`
- Modify: `src/lib/timeline/__tests__/track.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `monthYearLong(d: Date): string` from `src/lib/dates.ts`; `rangeText(start: Date, end?: Date): string` and `whenText(o: { status: Status; start: Date; end?: Date }): string` from `src/lib/timeline/track.ts`.

- [ ] **Step 1: Write the failing date test**

Append to `src/lib/__tests__/dates.test.ts`, inside the existing `describe("dates (spec §11, always UTC)")` block, after the `monthYear` test:

```ts
  it("monthYearLong spells the month", () => {
    expect(monthYearLong(sep1)).toBe("September 2026");
    expect(monthYearLong(dec31)).toBe("December 2025");
  });
```

And add `monthYearLong` to the import list at the top of that file.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/__tests__/dates.test.ts`
Expected: FAIL, `monthYearLong is not a function` (or an import error).

- [ ] **Step 3: Implement `monthYearLong`**

In `src/lib/dates.ts`, add after `monthYear`:

```ts
/** "June 2026" */
export function monthYearLong(d: Date): string {
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `npx vitest run src/lib/__tests__/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing wording tests**

Append to `src/lib/timeline/__tests__/track.test.ts`:

```ts
describe("rangeText and whenText (spec §5.1)", () => {
  it("rangeText spans two months", () => {
    expect(rangeText(d("2024-03-01"), d("2024-09-01"))).toBe("March 2024 to September 2024");
  });
  it("rangeText collapses a start and end in the same month", () => {
    expect(rangeText(d("2024-03-01"), d("2024-03-28"))).toBe("March 2024");
  });
  it("rangeText without an end reads as open", () => {
    expect(rangeText(d("2024-03-01"))).toBe("since March 2024");
  });
  it("whenText: in progress", () => {
    expect(whenText({ status: "in-progress", start: d("2026-06-01") })).toBe("in progress since June 2026");
  });
  it("whenText: planned", () => {
    expect(whenText({ status: "planned", start: d("2026-06-01"), end: d("2026-09-30") })).toBe(
      "planned, June 2026 to September 2026",
    );
  });
  it("whenText: live", () => {
    expect(whenText({ status: "live", start: d("2024-03-01"), end: d("2024-09-01") })).toBe(
      "March 2024 to September 2024, live",
    );
  });
  it("whenText: done with an end is the bare range", () => {
    expect(whenText({ status: "done", start: d("2024-09-01"), end: d("2025-04-01") })).toBe(
      "September 2024 to April 2025",
    );
  });
  it("whenText: done without an end is the day itself", () => {
    expect(whenText({ status: "done", start: d("2026-09-01") })).toBe("1 September 2026");
  });
  it("whenText: an in-progress item ignores an end it does not have", () => {
    expect(whenText({ status: "in-progress", start: d("2026-06-01"), end: d("2026-12-01") })).toBe(
      "in progress since June 2026",
    );
  });
});
```

Add `rangeText, whenText` to the `../track.js` import at the top of that file.

- [ ] **Step 6: Run them to make sure they fail**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `rangeText is not a function`.

- [ ] **Step 7: Implement the wording helpers**

In `src/lib/timeline/track.ts`, change the dates import to include the two long forms and add the helpers near the top of the file, after the imports:

```ts
import { longDate, monthDayYear, monthYearLong } from "../dates.js";
import type { Lane, Status, TimelineItem } from "./types.js";
import { effectiveEnd } from "./layout.js";
```

All three lines together: only the first two change, but `effectiveEnd` must survive — `writtenWhile` below still calls it.

```ts
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
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts src/lib/__tests__/dates.test.ts`
Expected: PASS, no failures.

- [ ] **Step 9: Run the whole suite and commit**

Run: `npm test`
Expected: all files pass.

```bash
git add src/lib/dates.ts src/lib/__tests__/dates.test.ts src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts
git commit -m "feat(timeline): long month-year, range and when wording helpers"
```

---

### Task 2: Generalize the track from essays to entries

The row builders stop knowing about essays. This is a rename-plus-widen refactor: it touches the module, its test, the component, and both blog pages in one commit so the build is never broken.

**Files:**
- Modify: `src/lib/timeline/track.ts`
- Modify: `src/lib/timeline/__tests__/track.test.ts`
- Modify: `src/components/Track.astro`
- Modify: `src/pages/blog/index.astro`
- Modify: `src/pages/blog/[...slug].astro`

**Interfaces:**
- Consumes: `rangeText` (Task 1).
- Produces: `TrackEntry`, `EntryRow`, `TrackRow`, `TrackIndex`, `sortEntries(entries)`, `indexRows(entries, now)`, `segmentRows(entries, currentId, now, index)`. The `Essay`, `EssayRow` and `sortEssays` names are gone; rows of kind `"essay"` become kind `"entry"`; an entry's date field is `start`, not `date`.

- [ ] **Step 1: Rewrite the failing test file to the entry shape**

In `src/lib/timeline/__tests__/track.test.ts`:

Replace the import line and the `shape` helper:

```ts
import {
  readingMinutes, sortEntries, indexRows, segmentRows, writtenWhile, rangeText, whenText,
} from "../track.js";
import type { TrackEntry, TrackRow } from "../track.js";
```

```ts
/** Short form of a row list for assertions: entry ids (starred when current), labels for other kinds. */
const shape = (rows: TrackRow[]) =>
  rows.map((r) => {
    if (r.kind === "entry") return `${r.id}${r.current ? "*" : ""}`;
    if (r.kind === "more") return r.label;
    if (r.kind === "year") return r.label;
    return r.kind;
  });

const ESSAYS: TrackIndex = { href: "/blog", noun: "essays" };
```

Add `TrackIndex` to the type import. Then, throughout the file: rename `essays`/`Essay` to entries/`TrackEntry`, change every entry literal's `date:` to `start:`, add `status: "done"` to every entry literal, rename `sortEssays` to `sortEntries`, change every `kind: "essay"` expectation to `kind: "entry"`, and pass `ESSAYS` as the fourth argument to every `segmentRows` call. Two assertions need their expected object updated:

```ts
  it("carries the index fields on entry rows", () => {
    expect(rows[3]).toEqual({
      kind: "entry",
      id: "essay-b",
      href: "/blog/b",
      title: "B",
      start: d("2026-07-22"),
      status: "done",
      minutes: 3,
      description: "About B",
      tags: ["Redis"],
    });
  });
```

```ts
  it("segment entry rows carry id, href, title, start, status only", () => {
    const rich: TrackEntry[] = [{ ...five[4], description: "x", tags: ["t"], minutes: 9 }];
    expect(segmentRows(rich, "essay-e", now, ESSAYS)[1]).toEqual({
      kind: "entry", id: "essay-e", href: "/blog/e", title: "E", start: d("2026-09-01"),
      status: "done", current: true,
    });
  });
```

```ts
  it("throws for an unknown id", () => {
    expect(() => segmentRows(five, "essay-zzz", now, ESSAYS)).toThrow("Unknown track entry: essay-zzz");
  });
```

Then add the new coverage for the noun and for spans:

```ts
describe("segmentRows with another index (spec §5.1)", () => {
  const now = d("2026-09-02");
  const PROJECTS: TrackIndex = { href: "/building", noun: "projects" };
  const three: TrackEntry[] = [
    { id: "songle", href: "/building/songle", title: "Songle", start: d("2023-06-01"), end: d("2024-02-01"), status: "live" },
    { id: "rswebtwain", href: "/building/rswebtwain", title: "RSWebTWAIN", start: d("2024-09-01"), end: d("2025-04-01"), status: "done" },
    { id: "daw-engine", href: "/building/daw-engine", title: "Browser DAW engine", start: d("2026-06-01"), status: "in-progress" },
  ];
  it("names the index in the more rows and links to it", () => {
    const rows = segmentRows(three, "songle", now, PROJECTS);
    expect(shape(rows)).toEqual(["2 newer, all projects", "rswebtwain", "songle*"]);
    expect(rows[0]).toEqual({ kind: "more", label: "2 newer, all projects", href: "/building" });
  });
  it("carries end and status onto segment rows so the component can draw a bar", () => {
    const rows = segmentRows(three, "daw-engine", now, PROJECTS);
    expect(rows[1]).toMatchObject({ kind: "entry", id: "daw-engine", status: "in-progress", current: true });
    expect(rows[2]).toMatchObject({ id: "rswebtwain", end: d("2025-04-01"), status: "done" });
  });
});

describe("indexRows over spans", () => {
  const now = d("2026-09-02");
  const two: TrackEntry[] = [
    { id: "songle", href: "/building/songle", title: "Songle", start: d("2023-06-01"), end: d("2024-02-01"), status: "live" },
    { id: "daw-engine", href: "/building/daw-engine", title: "Browser DAW engine", start: d("2026-06-01"), status: "in-progress" },
  ];
  it("groups by start year, newest first, and keeps end and status", () => {
    const rows = indexRows(two, now);
    expect(shape(rows)).toEqual(["now", "2026", "daw-engine", "2023", "songle"]);
    expect(rows[2]).toMatchObject({ kind: "entry", status: "in-progress", end: undefined });
    expect(rows[4]).toMatchObject({ kind: "entry", status: "live", end: d("2024-02-01") });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `sortEntries is not a function`.

- [ ] **Step 3: Widen the module**

In `src/lib/timeline/track.ts`, replace the `Essay`, `EssayRow`, `TrackRow` block and the three builders with:

```ts
/** An entry on any lane's vertical track: an essay, a project, anything dated. */
export interface TrackEntry {
  /** The timeline id, e.g. `essay-<slug>` or a project slug. */
  id: string;
  href: string;
  title: string;
  start: Date;
  /** Set for a finished span; absent for a moment or an open-ended span. */
  end?: Date;
  status: Status;
  description?: string;
  /** Essay tags, or a project's stack. */
  tags?: string[];
  /** Essays only. */
  minutes?: number;
}

export type EntryRow = TrackEntry & { kind: "entry"; current?: boolean };

export type TrackRow =
  | { kind: "now"; label: string }
  | { kind: "year"; label: string }
  | { kind: "more"; label: string; href: string }
  | EntryRow;

/** The index a segment's "more" rows point back at. */
export interface TrackIndex {
  href: string;
  /** Plural, lowercase: "essays", "projects". */
  noun: string;
}
```

```ts
/** Newest first, ties by id, so every builder sees one order. Returns a copy. */
export function sortEntries(entries: readonly TrackEntry[]): TrackEntry[] {
  return [...entries].sort((a, b) => b.start.getTime() - a.start.getTime() || a.id.localeCompare(b.id));
}

/** Spec §6: a now row, then a year row before the first entry of each start year, then the entries. */
export function indexRows(entries: readonly TrackEntry[], now: Date): TrackRow[] {
  const rows: TrackRow[] = [{ kind: "now", label: monthDayYear(now) }];
  let year: number | undefined;
  for (const e of sortEntries(entries)) {
    const y = e.start.getUTCFullYear();
    if (y !== year) {
      rows.push({ kind: "year", label: String(y) });
      year = y;
    }
    rows.push({
      kind: "entry",
      id: e.id,
      href: e.href,
      title: e.title,
      start: e.start,
      end: e.end,
      status: e.status,
      minutes: e.minutes,
      description: e.description,
      tags: e.tags,
    });
  }
  return rows;
}

const briefRow = (e: TrackEntry): EntryRow => ({
  kind: "entry", id: e.id, href: e.href, title: e.title, start: e.start, end: e.end, status: e.status,
});

/**
 * Spec §7: the current entry ringed between its neighbours. The head is now for
 * the newest entry, otherwise "{n} newer"; the tail is "{n} older" when any
 * remain. It doubles as previous and next. `index` names the page they link to.
 */
export function segmentRows(
  entries: readonly TrackEntry[],
  currentId: string,
  now: Date,
  index: TrackIndex,
): TrackRow[] {
  const sorted = sortEntries(entries);
  const i = sorted.findIndex((e) => e.id === currentId);
  if (i < 0) throw new Error(`Unknown track entry: ${currentId}`);
  const n = sorted.length;
  const rows: TrackRow[] = [];

  if (i === 0) rows.push({ kind: "now", label: monthDayYear(now) });
  else rows.push({ kind: "more", label: `${i} newer, all ${index.noun}`, href: index.href });

  if (i > 0) rows.push(briefRow(sorted[i - 1]));
  rows.push({ ...briefRow(sorted[i]), current: true });
  if (i < n - 1) rows.push(briefRow(sorted[i + 1]));

  const older = n - i - 2;
  if (older > 0) rows.push({ kind: "more", label: `${older} older, all ${index.noun}`, href: index.href });

  return rows;
}
```

Delete the now-unused `INDEX_HREF` constant.

Note for the implementer: `briefRow` carries `end` and `status` but not `description`, `tags`, or `minutes`, which is what the segment test asserts. An entry with no end gets `end: undefined`; Vitest's `toEqual` ignores keys whose value is `undefined`, so the assertions that omit `end` still pass.

- [ ] **Step 4: Run the module test to make sure it passes**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the component and the two blog pages**

In `src/components/Track.astro`, change `row.kind === "essay"` to `row.kind === "entry"`, `row.date` to `row.start`, and the class `tr-essay` to `tr-entry` in both the markup and the stylesheet (nine CSS selectors mention `.tr-essay`). Also change the `.tr-essay:hover` selector accordingly. Nothing else in that file changes yet; Task 4 adds the range and the bar.

In `src/pages/blog/index.astro`, change the mapping and imports:

```ts
import { indexRows, readingMinutes, sortEntries } from "../../lib/timeline/track";
import type { TrackEntry } from "../../lib/timeline/track";

const essays: TrackEntry[] = posts.map((p) => ({
  id: `essay-${p.slug}`,
  href: `/blog/${p.slug}`,
  title: p.data.title,
  start: p.data.pubDate,
  status: "done",
  description: p.data.description,
  tags: p.data.tags,
  minutes: readingMinutes(p.body),
}));
```

and in the range computation below it, `sortEssays` becomes `sortEntries` and `sorted[i].date` becomes `sorted[i].start`:

```ts
const sorted = sortEntries(essays);
const count = `${sorted.length} ${sorted.length === 1 ? "essay" : "essays"}`;
let range = "";
if (sorted.length > 0) {
  const from = monthYear(sorted[sorted.length - 1].start);
  const to = monthYear(sorted[0].start);
  range = from === to ? from : `${from} to ${to}`;
}
```

In `src/pages/blog/[...slug].astro`:

```ts
import { readingMinutes, segmentRows, writtenWhile } from "../../lib/timeline/track";
import type { TrackEntry } from "../../lib/timeline/track";

const essays: TrackEntry[] = items
  .filter((item) => item.lane === "writing")
  .map((item) => ({ id: item.id, href: item.href, title: item.title, start: item.start, status: item.status }));

const segment = segmentRows(essays, `essay-${entry.slug}`, now, { href: "/blog", noun: "essays" });
```

- [ ] **Step 6: Build and eyeball the blog**

Run: `npm run build`
Expected: exit 0, 12 pages built, no type errors.

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts src/components/Track.astro src/pages/blog/index.astro "src/pages/blog/[...slug].astro"
git commit -m "refactor(timeline): make the vertical track lane-agnostic"
```

---

### Task 3: The `during` query

The project page's "While building" list: what else was happening across the life of a project. It is the span-shaped sibling of `writtenWhile`, and they share one overlap rule.

**Files:**
- Modify: `src/lib/timeline/track.ts`
- Modify: `src/lib/timeline/__tests__/track.test.ts`

**Interfaces:**
- Consumes: `TrackEntry` and friends (Task 2).
- Produces: `during(items: readonly TimelineItem[], span: DateSpan, now: Date, exclude: Lane): TimelineItem[]` and `export interface DateSpan { start: Date; end?: Date }`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/timeline/__tests__/track.test.ts`:

```ts
describe("during (spec §5.1)", () => {
  const now = d("2026-09-02");

  const item = (o: Partial<TimelineItem> & Pick<TimelineItem, "id" | "lane" | "start" | "kind">): TimelineItem => ({
    title: o.id,
    status: "done",
    href: `/#item-${o.id}`,
    ...o,
  });

  // The project under the page: Sep 2024 to Apr 2025.
  const project = { start: d("2024-09-01"), end: d("2025-04-01") };

  const inside = item({ id: "essay-inside", lane: "writing", start: d("2024-12-01"), kind: "moment" });
  const onStart = item({ id: "essay-on-start", lane: "writing", start: d("2024-09-01"), kind: "moment" });
  const onEnd = item({ id: "essay-on-end", lane: "writing", start: d("2025-04-01"), kind: "moment" });
  const before = item({ id: "essay-before", lane: "writing", start: d("2024-08-31"), kind: "moment" });
  const after = item({ id: "essay-after", lane: "writing", start: d("2025-04-02"), kind: "moment" });
  const overlapping = item({ id: "thread", lane: "learning", start: d("2024-01-01"), end: d("2026-01-01"), kind: "span" });
  const ongoing = item({ id: "ongoing", lane: "learning", start: d("2024-10-01"), kind: "span", status: "in-progress" });
  const disjoint = item({ id: "disjoint", lane: "learning", start: d("2025-05-01"), end: d("2025-06-01"), kind: "span" });
  const sibling = item({ id: "other-project", lane: "building", start: d("2024-10-01"), end: d("2024-11-01"), kind: "span" });
  const talk = item({ id: "talk", lane: "community", start: d("2025-01-15"), kind: "moment" });

  const all = [inside, onStart, onEnd, before, after, overlapping, ongoing, disjoint, sibling, talk];

  it("includes moments inside the span, inclusive of both ends", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).toContain("essay-inside");
    expect(ids).toContain("essay-on-start");
    expect(ids).toContain("essay-on-end");
  });
  it("excludes moments outside the span", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).not.toContain("essay-before");
    expect(ids).not.toContain("essay-after");
  });
  it("includes spans that intersect and excludes those that do not", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).toContain("thread");
    expect(ids).toContain("ongoing");
    expect(ids).not.toContain("disjoint");
  });
  it("excludes the lane it is asked to exclude", () => {
    expect(during(all, project, now, "building").map((i) => i.id)).not.toContain("other-project");
    expect(during(all, project, now, "writing").map((i) => i.id)).toContain("other-project");
  });
  it("runs an open-ended span to now", () => {
    const openProject = { start: d("2026-06-01") };
    const recent = item({ id: "recent", lane: "writing", start: d("2026-08-01"), kind: "moment" });
    const future = item({ id: "future", lane: "writing", start: d("2026-10-01"), kind: "moment" });
    const ids = during([recent, future], openProject, now, "building").map((i) => i.id);
    expect(ids).toEqual(["recent"]);
  });
  it("orders by lane in timeline order with the excluded lane dropped, then start, then id", () => {
    const ids = during(all, project, now, "building").map((i) => i.id);
    expect(ids).toEqual([
      "essay-on-start", "essay-inside", "essay-on-end", "thread", "ongoing", "talk",
    ]);
  });
  it("returns an empty list when nothing overlaps", () => {
    expect(during(all, { start: d("2019-01-01"), end: d("2019-02-01") }, now, "building")).toEqual([]);
  });
});
```

Add `during` to the `../track.js` import.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `during is not a function`.

- [ ] **Step 3: Implement it, sharing the overlap rule**

In `src/lib/timeline/track.ts`, add `LANES` to the types import (`import { LANES } from "./types.js";` alongside the existing type-only import; `LANES` is a value, so it needs a value import), then replace the `writtenWhile` section with:

```ts
const WHILE_LANES: readonly Lane[] = ["building", "learning", "community"];
export const MOMENT_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export interface DateSpan {
  start: Date;
  /** Absent means open-ended: the range runs to now. */
  end?: Date;
}

/** Whether a span item's own range touches [from, to]. Inclusive at both ends. */
function spanTouches(item: TimelineItem, from: number, to: number, now: Date): boolean {
  return item.start.getTime() <= to && effectiveEnd(item, now).getTime() >= from;
}

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
    if (item.kind === "span") return spanTouches(item, p, p, now);
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

/**
 * Spec §5.1: what else was happening across a span. Spans count when they
 * intersect it; moments count when they fall inside it, inclusive. An
 * open-ended span (an in-progress project) runs to now. Lanes keep timeline
 * order with `exclude` dropped, then start, then id.
 */
export function during(
  items: readonly TimelineItem[],
  span: DateSpan,
  now: Date,
  exclude: Lane,
): TimelineItem[] {
  const from = span.start.getTime();
  const to = (span.end ?? now).getTime();
  const lanes = LANES.filter((l) => l !== exclude);
  const overlaps = (item: TimelineItem): boolean => {
    if (!lanes.includes(item.lane)) return false;
    if (item.kind === "span") return spanTouches(item, from, to, now);
    const t = item.start.getTime();
    return t >= from && t <= to;
  };
  return items
    .filter(overlaps)
    .sort(
      (a, b) =>
        lanes.indexOf(a.lane) - lanes.indexOf(b.lane) ||
        a.start.getTime() - b.start.getTime() ||
        a.id.localeCompare(b.id),
    );
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: PASS, including the untouched `writtenWhile` block, which proves the shared helper did not change its behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts
git commit -m "feat(timeline): during() for what else was happening across a span"
```

---

### Task 4: The track draws spans

The component learns two things: which lane it is, and that an entry with an end (or in progress) is a span, which shows a date range and a bar in the gutter rather than a day and a dot.

**Files:**
- Modify: `src/components/Track.astro`

**Interfaces:**
- Consumes: `TrackRow`, `EntryRow` (Task 2); `deriveKind` from `src/lib/timeline/types.ts`.
- Produces: `<Track rows={...} density="index" | "segment" label="..." lane="building" />`. `lane` is optional and defaults to `"writing"`.

- [ ] **Step 1: Take the lane as a prop**

Replace the frontmatter of `src/components/Track.astro` with:

```astro
---
// src/components/Track.astro
// A lane played as a vertical track (writing spec §6, everything-else spec §4.2):
// one <ol>, a gutter drawn in pseudo-elements, one <li> per row. `index` density
// has a mono column for the date and reading time or the range; `segment` density
// is the sidebar's short excerpt. There is exactly one link per entry row,
// stretched over the whole row with a pseudo-element. A span entry (one with an
// end, or in progress) draws a bar in the gutter instead of a dot and prints a
// range instead of a day, so the track speaks the arrangement's clip vocabulary.
import type { TrackRow } from "../lib/timeline/track";
import { deriveKind, type Lane } from "../lib/timeline/types";
import { isoDay, monthYear, shortDate, shortDay } from "../lib/dates";

interface Props {
  rows: TrackRow[];
  density: "index" | "segment";
  label?: string;
  lane?: Lane;
}

const { rows, density, label, lane = "writing" } = Astro.props;
const index = density === "index";
---
```

and give the list its lane color:

```astro
<ol
  class:list={["track", `track-${density}`]}
  aria-label={label}
  style={`--c: var(--lane-${lane})`}
>
```

- [ ] **Step 2: Replace the entry row branch**

Replace the final `return (...)` inside the `rows.map` (the entry row) with:

```astro
      const span = deriveKind(row.status, row.end) === "span";
      return (
        <li
          class:list={[
            "tr",
            "tr-entry",
            { "is-current": row.current, "is-span": span, "is-progress": row.status === "in-progress" },
          ]}
        >
          {index && (
            <span class="tr-meta">
              {span ? (
                <>
                  <time datetime={isoDay(row.start)}>{monthYear(row.start)}</time>
                  <small>
                    {row.end ? (
                      <>to <time datetime={isoDay(row.end)}>{monthYear(row.end)}</time></>
                    ) : (
                      "to now"
                    )}
                  </small>
                </>
              ) : (
                <>
                  <time datetime={isoDay(row.start)}>{shortDay(row.start)}</time>
                  {row.minutes !== undefined && <small>{row.minutes} min</small>}
                </>
              )}
            </span>
          )}
          <span class="tr-body">
            {index ? (
              <h2 class="tr-title">
                <a href={row.href} aria-current={row.current ? "page" : undefined}>{row.title}</a>
              </h2>
            ) : (
              <span class="tr-title">
                <a href={row.href} aria-current={row.current ? "page" : undefined}>{row.title}</a>
              </span>
            )}
            {!index && (
              <span class="tr-date">
                {span ? (
                  <>
                    <time datetime={isoDay(row.start)}>{monthYear(row.start)}</time>
                    {" to "}
                    {row.end ? <time datetime={isoDay(row.end)}>{monthYear(row.end)}</time> : "now"}
                  </>
                ) : (
                  <time datetime={isoDay(row.start)}>{shortDate(row.start)}</time>
                )}
              </span>
            )}
            {row.description && <p class="tr-desc">{row.description}</p>}
            {row.tags && row.tags.length > 0 && <small class="tr-tags">{row.tags.join(", ")}</small>}
          </span>
        </li>
      );
```

- [ ] **Step 3: Move the stylesheet onto `--c` and add the bar**

In the `<style>` block of the same file, replace every `var(--lane-writing)` with `var(--c)`. There are ten of them: the gutter line, the node, the `.tr-more` node border, the current ring, the title hover and current color, the two focus outlines, and the `.tr-more a` color and border. Leave every other token alone.

Then add the bar node, immediately after the `.is-current::after` rule:

```css
  /* A span entry's node is a bar, not a dot: the clip vocabulary from the
     arrangement, carried into the vertical track (spec §4.2). In progress is
     hatched, as an in-progress clip is. */
  .is-span::after {
    left: 8px;
    width: 8px;
    height: 22px;
    border-radius: 2px;
  }
  .is-span.is-progress::after {
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--c) 45%, var(--color-bg)) 0 3px,
      var(--c) 3px 6px
    );
  }
```

- [ ] **Step 4: Stop the phone comma appearing inside a range**

Still in the `<style>` block, inside `@media (max-width: 899.98px)`, the rule that joins the reading time onto the date with a comma must not apply to a range, or a span row would read "Mar 2024, to Sep 2024". Change the selector:

```css
    .track-index .tr-entry:not(.is-span) .tr-meta small::before {
      content: ", ";
    }
```

- [ ] **Step 5: Build and check the writing index is unchanged**

Run: `npm run build`
Expected: exit 0. Essays are moments, so no essay row gains a bar or a range; the writing index and essay sidebars render exactly as before.

Run: `grep -c "is-span" dist/blog/index.html`
Expected: `0` — no essay is a span.

- [ ] **Step 6: Commit**

```bash
git add src/components/Track.astro
git commit -m "feat(track): lane prop, span ranges and bar nodes"
```

---

### Task 5: The reading frame

`BlogPost.astro` holds a two-column frame and 200 lines of prose CSS that the project page needs verbatim. Split the frame out so both pages fill it. The CSS moves to a plain stylesheet imported globally by the frame, because Astro's scoped styles do not reach slotted content — the same reason `Layout.astro` imports `global.css` this way.

**Files:**
- Create: `src/styles/reader.css`
- Create: `src/layouts/Reader.astro`
- Create: `src/components/WhileList.astro`
- Modify: `src/layouts/BlogPost.astro`

**Interfaces:**
- Consumes: `Track` (Task 4), `TimelineItem`.
- Produces: `<Reader title description image active={lane}>` with a default slot for the article and a named `aside` slot; `<WhileList label={string} items={TimelineItem[]} />`, which renders nothing when `items` is empty. Both rely on the global classes in `reader.css`: `.reader`, `.article`, `.aside`, `.kicker`, `.sq`, `.sq-muted`, `.standfirst`, `.tags`, `.hero`, `.body`, `.subscribe`, `.facts`, `.while`, `.while-list`. The lane color is `--c`, set on `.reader`.

- [ ] **Step 1: Create the stylesheet**

Create `src/styles/reader.css` with the contents of the `<style>` block currently in `src/layouts/BlogPost.astro`, with four changes: every rule is a descendant of `.reader`; `.essay` becomes `.reader`; every `var(--lane-writing)` becomes `var(--c)`; and a `.facts` block is added for the project page's sidebar list. Astro's `:global(...)` wrappers are dropped, since this file is already global.

```css
/* src/styles/reader.css
   The reading frame shared by the essay page and the project page
   (everything-else spec §5.2). Global, not scoped: Astro scopes a component's
   styles to the elements it renders itself, and the article and sidebar arrive
   through slots from the page, so scoped rules would not reach them. Every rule
   descends from .reader to keep the names out of the rest of the site.
   The lane color arrives as --c, set on .reader by Reader.astro. */

.reader {
  max-width: 1160px;
  margin: 0 auto;
  padding: 110px 40px var(--space-4xl);
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 56px;
  align-items: start;
}

.reader .kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-text-muted);
}
.reader .sq {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--c);
}
.reader .sq-muted {
  background: var(--color-text-muted);
}

/* Article column */
.reader .article h1 {
  font-size: clamp(2.4rem, 4.8vw, 3.6rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.025em;
  margin: 0 0 16px;
}
.reader .standfirst {
  font-size: 21px;
  line-height: 1.45;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
}
.reader .tags {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0 0 36px;
}
/* When there are no tags the standfirst is the last <p> before the body and takes the tags line's bottom margin, so the gap to the body stays 36px either way. */
.reader .standfirst:last-of-type {
  margin-bottom: 36px;
}
.reader .hero {
  width: 100%;
  border-radius: var(--radius-md);
  margin-bottom: 36px;
}
.reader .subscribe {
  margin-top: 48px;
}

/* Body typography (writing spec §5) */
.reader .body {
  font-size: 17.5px;
  line-height: 1.65;
  color: var(--color-text-reading);
}
.reader .body p {
  margin: 0 0 22px;
  max-width: 60ch;
}
.reader .body h2 {
  font-size: 26px;
  margin: 48px 0 16px;
  color: var(--color-text-primary);
}
.reader .body h3 {
  font-size: 20px;
  margin: 32px 0 12px;
  color: var(--color-text-primary);
}
.reader .body strong {
  color: var(--color-text-primary);
}
.reader .body a {
  color: var(--c);
  border-bottom: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
}
.reader .body a:hover {
  color: var(--color-text-primary);
}
.reader .body a:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 2px;
}
.reader .body code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--color-bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.reader .body pre {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px;
  overflow-x: auto;
  margin: 0 0 22px;
}
/* Shiki inlines the theme background on <pre>; only !important beats an inline style. */
.reader .body pre.astro-code {
  background-color: var(--color-bg-elevated) !important;
}
.reader .body pre code {
  background: none;
  padding: 0;
}
.reader .body blockquote {
  margin: 0 0 22px;
  padding: 2px 0 2px 20px;
  border-left: 3px solid var(--c);
  font-size: 19px;
  line-height: 1.5;
  font-style: italic;
  color: var(--color-text-primary);
}
.reader .body ul,
.reader .body ol {
  margin: 0 0 22px;
  padding-left: 32px;
}
.reader .body li {
  margin-bottom: 8px;
}
.reader .body img,
.reader .body video {
  width: 100%;
  border-radius: var(--radius-md);
  margin: 0 0 22px;
}
.reader .body hr {
  border: 0;
  border-top: 1px solid var(--color-border);
  margin: 32px 0;
}

/* Sidebar */
.reader .aside {
  padding-top: 8px;
  font-size: 14px;
}
.reader .aside .kicker {
  margin-bottom: 14px;
}
/* Facts list (project page, spec §4.3). */
.reader .facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 18px;
  margin: 0 0 26px;
  font-size: 13.5px;
}
.reader .facts dt {
  color: var(--color-text-muted);
}
.reader .facts dd {
  margin: 0;
}
.reader .facts a {
  color: var(--c);
  border-bottom: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
}
.reader .facts a:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 2px;
}
.reader .while {
  margin-top: 30px;
}
.reader .while-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
/* Each item overrides --c with its own lane color, so the dot, the hover and
   the focus ring below all speak that lane rather than the page's. */
.reader .while-list li {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 12px;
  align-items: start;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}
.reader .while-list .dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-top: 5px;
  background: var(--c);
}
.reader .while-list a {
  display: block;
  font-weight: 500;
  color: var(--color-text-primary);
}
.reader .while-list a:hover {
  color: var(--c);
}
.reader .while-list a:focus-visible {
  outline: 2px solid var(--c);
  outline-offset: 2px;
}
.reader .while-list small {
  display: block;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

@media (max-width: 899.98px) {
  .reader {
    display: block;
    padding: 84px 20px var(--space-3xl);
  }
  .reader .article h1 {
    font-size: 34px;
  }
  .reader .standfirst {
    font-size: 18px;
  }
  .reader .body {
    font-size: 16.5px;
  }
  .reader .aside {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid var(--color-border);
  }
}
```

- [ ] **Step 2: Create the frame**

Create `src/layouts/Reader.astro`:

```astro
---
// src/layouts/Reader.astro
// The two-column reading frame (everything-else spec §5.2): an article column
// and a sidebar, on one lane. The essay page and the project page both fill it.
// Its styles are in src/styles/reader.css, imported globally here for the reason
// given at the top of that file.
import Layout from "./Layout.astro";
import TransportBar from "../components/TransportBar.astro";
import Footer from "../components/Footer.astro";
import type { Lane } from "../lib/timeline/types";

interface Props {
  title: string;
  description?: string;
  image?: string;
  /** Colors the page and underlines its link in the transport bar. */
  active: Lane;
}

const { title, description, image, active } = Astro.props;
---

<Layout title={title} description={description} image={image}>
  <TransportBar active={active} />

  <main class="reader" style={`--c: var(--lane-${active})`}>
    <article class="article">
      <slot />
    </article>
    <aside class="aside">
      <slot name="aside" />
    </aside>
  </main>

  <Footer />
</Layout>

<style is:global>
  @import "../styles/reader.css";
</style>
```

- [ ] **Step 3: Create the while list**

Create `src/components/WhileList.astro`:

```astro
---
// src/components/WhileList.astro
// "Written while" on an essay, "While building" on a project (spec §4.3, §5.2).
// Renders nothing when the list is empty. Styling comes from src/styles/reader.css:
// this component is only ever used inside a Reader sidebar.
import type { Status, TimelineItem } from "../lib/timeline/types";

interface Props {
  label: string;
  items: TimelineItem[];
}

const { label, items } = Astro.props;

const STATUS_WORD: Record<Status, string> = {
  done: "done",
  live: "live",
  "in-progress": "in progress",
  planned: "planned",
};
---

{items.length > 0 && (
  <section class="while">
    <p class="kicker">
      <i class="sq sq-muted"></i>
      <span>{label}</span>
    </p>
    <ul class="while-list" aria-label={label}>
      {items.map((item) => (
        <li style={`--c: var(--lane-${item.lane})`}>
          <i class="dot"></i>
          <div>
            <a href={item.href}>{item.title}</a>
            <small>{item.lane}, {STATUS_WORD[item.status]}</small>
          </div>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 4: Rewrite the essay layout to fill the frame**

Replace all of `src/layouts/BlogPost.astro` with:

```astro
---
// src/layouts/BlogPost.astro
// The essay page (writing spec §5): the article column with kicker, title,
// standfirst, tags, hero, body and newsletter; the sidebar with the track
// segment (§7) and the "Written while" list (§8). The frame, the prose styles
// and the phone order live in Reader.astro and src/styles/reader.css.
import type { CollectionEntry } from "astro:content";
import Reader from "./Reader.astro";
import Track from "../components/Track.astro";
import WhileList from "../components/WhileList.astro";
import Newsletter from "../components/Newsletter.astro";
import type { TrackRow } from "../lib/timeline/track";
import type { TimelineItem } from "../lib/timeline/types";
import { isoDay, longDate } from "../lib/dates";
import { ogImagePath } from "../lib/og.mjs";

interface Props {
  entry: CollectionEntry<"blog">;
  minutes: number;
  segment: TrackRow[];
  writtenWhile: TimelineItem[];
}

const { entry, minutes, segment, writtenWhile } = Astro.props;
const { title, description, pubDate, updatedDate, heroImage, tags } = entry.data;
---

<Reader
  title={`${title} | Sean Campbell`}
  description={description}
  image={heroImage ?? ogImagePath("blog")}
  active="writing"
>
  <p class="kicker">
    <i class="sq"></i>
    <span>
      Essay, <time datetime={isoDay(pubDate)}>{longDate(pubDate)}</time>, {minutes} minute read{updatedDate && (
        <>
          , updated <time datetime={isoDay(updatedDate)}>{longDate(updatedDate)}</time>
        </>
      )}
    </span>
  </p>
  <h1>{title}</h1>
  <p class="standfirst">{description}</p>
  {tags.length > 0 && <p class="tags">{tags.join(", ")}</p>}
  {heroImage && <img src={heroImage} alt="" class="hero" />}
  <div class="body">
    <slot />
  </div>
  <div class="subscribe">
    <Newsletter heading="Like this? Subscribe." blurb="Get new posts in your inbox. No spam, unsubscribe anytime." />
  </div>

  <Fragment slot="aside">
    <p class="kicker">
      <i class="sq"></i>
      <span>Writing</span>
    </p>
    <Track rows={segment} density="segment" label="Nearby essays" />
    <WhileList label="Written while" items={writtenWhile} />
  </Fragment>
</Reader>
```

Note: the `image` now falls back to the writing share card instead of the home card when an essay has no hero, which is the one-liner in spec §4.5.

- [ ] **Step 5: Build and compare an essay against the old rendering**

Run: `npm run build`
Expected: exit 0.

Run: `npm run preview` in one terminal, then open `http://localhost:4321/blog/io-multiplexing` (an essay with code blocks) and `http://localhost:4321/blog/i-wont-stop-coding`. The two-column layout, the gold kicker squares, the prose, the code blocks, the sidebar track and the "Written while" list must look exactly as they did. Check one phone width too.

Run: `grep -o 'og:image" content="[^"]*"' dist/blog/i-wont-stop-coding/index.html`
Expected: the essay's hero if it has one, otherwise `https://seanthedeveloper.com/og/blog.png`.

- [ ] **Step 6: Commit**

```bash
git add src/styles/reader.css src/layouts/Reader.astro src/components/WhileList.astro src/layouts/BlogPost.astro
git commit -m "refactor(layouts): extract the shared reading frame from the essay page"
```

---

### Task 6: Data model changes

Three edits to the pure data layer: projects link to their page, community entries can label their link, and the learning schema that only 100Devs used is deleted.

**Files:**
- Modify: `src/lib/timeline/types.ts`
- Modify: `src/lib/timeline/__tests__/types.test.ts`
- Modify: `src/lib/timeline/sources.ts`
- Modify: `src/lib/timeline/__tests__/sources.test.ts`
- Modify: `src/data/community.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a project item's `href` is `/building/<slug>`; the community inspector body carries `linkLabel?: string`; `Testimonial`, `learningEntrySchema` and `LearningEntry` no longer exist.

- [ ] **Step 1: Write the failing tests**

In `src/lib/timeline/__tests__/types.test.ts`, remove `learningEntrySchema` from the import list and replace the whole `describe("communityEntrySchema and learningEntrySchema", ...)` block with:

```ts
describe("communityEntrySchema", () => {
  const ok = {
    id: "dsd-talk", title: "Talk", description: "d", org: "Dallas Software Developers",
    start: "2026-03-01", status: "done",
  };
  it("requires org", () => {
    const { org, ...withoutOrg } = ok;
    expect(communityEntrySchema.safeParse(withoutOrg).success).toBe(false);
  });
  it("accepts a url with a link label", () => {
    const r = communityEntrySchema.safeParse({ ...ok, url: "https://example.com/talk", linkLabel: "Watch the talk" });
    expect(r.success).toBe(true);
  });
  it("makes the link label optional", () => {
    expect(communityEntrySchema.safeParse(ok).success).toBe(true);
  });
  it("rejects a link label with no url to hang it on", () => {
    const r = communityEntrySchema.safeParse({ ...ok, linkLabel: "Watch the talk" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("linkLabel requires url");
  });
});
```

In `src/lib/timeline/__tests__/sources.test.ts`, change the project href expectation and the community body expectation, and add a link-label case:

```ts
    expect(roaming.href).toBe("/building/roaming-camp");
```

```ts
describe("fromCommunity", () => {
  it("community uses org as the subtitle when none is given", () => {
    const [talk] = fromCommunity([
      { id: "dsd-talk", title: "Talk", description: "d", org: "Dallas Software Developers", start: d("2026-03-01"), status: "done" },
    ]);
    expect(talk.lane).toBe("community");
    expect(talk.subtitle).toBe("Dallas Software Developers");
    expect(talk.kind).toBe("moment");
    expect(talk.href).toBe("/#item-dsd-talk");
    expect(talk.body).toEqual({
      lane: "community", org: "Dallas Software Developers", description: "d", url: undefined, linkLabel: undefined,
    });
  });
  it("carries a link label into the body", () => {
    const [talk] = fromCommunity([
      {
        id: "dsd-talk", title: "Talk", description: "d", org: "Dallas Software Developers",
        start: d("2026-03-01"), status: "done", url: "https://example.com/talk", linkLabel: "Watch the talk",
      },
    ]);
    expect(talk.body).toMatchObject({ url: "https://example.com/talk", linkLabel: "Watch the talk" });
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/lib/timeline/__tests__/types.test.ts src/lib/timeline/__tests__/sources.test.ts`
Expected: FAIL — the href assertion, the link-label assertions, and (once `learningEntrySchema` is dropped from the import) nothing else.

- [ ] **Step 3: Change the types**

In `src/lib/timeline/types.ts`:

Delete the `Testimonial` interface. In `InspectorBody`, drop `testimonial?: Testimonial` from the learning arm and add the label to the community arm:

```ts
export type InspectorBody =
  | { lane: "writing"; description: string; published: Date; href: string }
  | {
      lane: "building";
      description: string;
      stack: string[];
      started: Date;
      status: Status;
      url?: string;
      source?: string;
    }
  | { lane: "learning"; description: string; roadmapHref: string }
  | { lane: "community"; org: string; description: string; url?: string; linkLabel?: string };
```

Replace the community schema and delete the learning schema and its type entirely:

```ts
export const communityEntrySchema = timelineEntrySchema.innerType()
  .extend({
    org: z.string().min(1),
    /** What the inspector's link says; "Details" when absent. */
    linkLabel: z.string().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    entryRules(v, ctx);
    if (v.linkLabel && !v.url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "linkLabel requires url", path: ["linkLabel"] });
    }
  });
export type CommunityEntry = z.infer<typeof communityEntrySchema>;
```

- [ ] **Step 4: Change the sources**

In `src/lib/timeline/sources.ts`, in `fromProjects` change the href:

```ts
      href: `/building/${e.slug}`,
```

and in `fromCommunity` carry the label:

```ts
    body: { lane: "community", org: e.org, description: e.description, url: e.url, linkLabel: e.linkLabel },
```

- [ ] **Step 5: Note where the community links go**

In `src/data/community.ts`, replace the header comment's second sentence and add the field to the two talks so the shape is visible when the owner fills them in. Leave the placeholder dates and their comments exactly as they are — spec §14 forbids inventing them.

```ts
// src/data/community.ts
// Hand-authored Community lane entries (spec §6). Validated at module load so
// a bad entry fails the build with its id in the message. `url` plus `linkLabel`
// give the inspector a labelled link ("Watch the talk"); both are optional, and
// a label without a url is rejected. Dates marked placeholder are still to be
// confirmed by the owner (everything-else spec §14).
```

- [ ] **Step 6: Run the tests and the build**

Run: `npx vitest run`
Expected: all pass.

Run: `npm run build`
Expected: exit 0. The home page's project clips now point at `/building/<slug>`, which does not exist yet; Astro does not check links, and Task 9 creates the pages.

- [ ] **Step 7: Commit**

```bash
git add src/lib/timeline/types.ts src/lib/timeline/sources.ts src/lib/timeline/__tests__ src/data/community.ts
git commit -m "feat(timeline): project pages as clip targets, labelled community links"
```

---

### Task 7: The testimonial moves, the inspector slims

Leon Noel's quote lands at the hiring moment, 100Devs leaves the repo, and the home inspector stops carrying a whole case study.

**Files:**
- Create: `src/data/testimonial.ts`
- Delete: `src/data/parked/hundred-devs.ts`
- Modify: `src/components/ContactBlock.astro`
- Modify: `src/components/Inspector.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/lib/timeline/astro.ts`

**Interfaces:**
- Consumes: `whenText`, `rangeText` (Task 1), the type changes (Task 6).
- Produces: `<Inspector items={items} />` — the `projects` prop is gone; `getTimeline()` returns `{ items, now }`.

- [ ] **Step 1: Create the testimonial data**

Create `src/data/testimonial.ts`, copying the quote verbatim from `src/data/parked/hundred-devs.ts`:

```ts
// src/data/testimonial.ts
// The one testimonial on the site, shown in the contact block (everything-else
// spec §6.1). It came out of 100Devs, which is no longer on the timeline; the
// quote stands on its own at the hiring moment.
export const testimonial = {
  quote:
    "Talented developer and lightning fast learner. I had the pleasure of mentoring Sean at 100devs. No matter the challenge or how short the deadline, Sean always triumphed. He never settled for just what was due, but pushed boundaries and always delivered a product well above and beyond what was asked. Not only was Sean's work ethic unparalleled, but the speed at which he was able to learn new materials was astonishing. His hard work and ability to quickly understand complex topics made him into a great programmer.",
  author: "Leon Noel",
  role: "Managing Director of Engineering, Resilient Coders",
} as const;
```

- [ ] **Step 2: Delete the parked file**

```bash
git rm src/data/parked/hundred-devs.ts
```

The `src/data/parked/` directory is then empty; git removes it. Confirm nothing imports it:

Run: `grep -rn "hundred-devs\|hundredDevs" src netlify scripts`
Expected: no output.

- [ ] **Step 3: Render it in the contact block**

In `src/components/ContactBlock.astro`, import the data and add the figure after the links paragraph, inside the same `<div>`:

```astro
import { testimonial } from "../data/testimonial";
```

```astro
    <figure class="quote">
      <blockquote>{testimonial.quote}</blockquote>
      <figcaption>{testimonial.author}, {testimonial.role}</figcaption>
    </figure>
```

and add its styles to the component's `<style>` block, before the media query:

```css
  /* The quote came from a mentor, so it carries the learning lane's rule. */
  .quote {
    margin: 26px 0 0;
    padding: 2px 0 2px 18px;
    border-left: 3px solid var(--lane-learning);
    max-width: 60ch;
  }
  .quote blockquote {
    margin: 0;
    font-size: 15.5px;
    line-height: 1.55;
    font-style: italic;
    color: var(--color-text-primary);
  }
  .quote figcaption {
    margin-top: 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
```

and inside the existing `@media (max-width: 899.98px)` block:

```css
    .quote {
      margin-top: 20px;
      padding-left: 14px;
    }
```

- [ ] **Step 4: Slim the inspector**

In `src/components/Inspector.astro`, replace the frontmatter with:

```astro
---
import type { Lane, TimelineItem } from "../lib/timeline/types";
import { rangeText, whenText } from "../lib/timeline/track";
import { longDate, monthYearLong } from "../lib/dates";

interface Props {
  items: TimelineItem[];
}

const { items } = Astro.props;

const laneName = (lane: Lane) => lane[0].toUpperCase() + lane.slice(1);
const capitalized = (s: string) => (s === "in-progress" ? "In progress" : s[0].toUpperCase() + s.slice(1));
---
```

In the markup: delete the `const CaseStudy = ...` line and the whole `{CaseStudy && (...)}` block; delete the `{b?.lane === "learning" && b.testimonial && (...)}` figure; change the kicker and the four fact lists:

```astro
          <p class="insp-k"><i aria-hidden="true"></i>{laneName(item.lane)}, {whenText(item)}</p>
```

```astro
            {b?.lane === "building" && <a href={item.href}>Read the case study</a>}
            {b?.lane === "building" && b.url && (
              <a href={b.url} target="_blank" rel="noopener noreferrer">Visit the site</a>
            )}
            {b?.lane === "building" && b.source && (
              <a href={b.source} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
            )}
            {b?.lane === "learning" && <a href={b.roadmapHref}>See it on the roadmap</a>}
            {b?.lane === "community" && b.url && (
              <a href={b.url} target="_blank" rel="noopener noreferrer">{b.linkLabel ?? "Details"}</a>
            )}
```

```astro
          {b?.lane === "building" && (
            <dl class="insp-facts">
              <dt>Stack</dt><dd>{b.stack.join(", ")}</dd>
              <dt>Started</dt><dd>{monthYearLong(b.started)}</dd>
              <dt>Status</dt><dd>{capitalized(b.status)}</dd>
            </dl>
          )}
          {b?.lane === "writing" && (
            <dl class="insp-facts">
              <dt>Published</dt><dd>{longDate(b.published)}</dd>
            </dl>
          )}
          {b?.lane === "community" && (
            <dl class="insp-facts">
              <dt>With</dt><dd>{b.org}</dd>
            </dl>
          )}
          {b?.lane === "learning" && (
            <dl class="insp-facts">
              <dt>When</dt><dd>{rangeText(item.start, item.end)}</dd>
            </dl>
          )}
```

Delete the `.insp-quote`, `.insp-quote blockquote`, `.insp-quote figcaption`, `.insp-body`, `.insp-body :global(h2)` and `.insp-body :global(p)` rules from the `<style>` block. Delete the `monthYear`, `longDate` and `statusText` helpers that the frontmatter no longer defines.

- [ ] **Step 5: Drop the projects prop**

In `src/pages/index.astro`:

```ts
const { items, now } = await getTimeline();
```

```astro
    <Inspector items={items} />
```

In `src/lib/timeline/astro.ts`, drop the now-unused collection from the returned data:

```ts
import { getCollection } from "astro:content";
import community from "../../data/community";
import { fromBlog, fromCommunity, fromProjects, fromRoadmap, mergeTimeline } from "./sources";
import type { TimelineItem } from "./types";

export interface TimelineData {
  items: TimelineItem[];
  /** Build time. The client script nudges the playhead to the real date. */
  now: Date;
}

export async function getTimeline(): Promise<TimelineData> {
  const includeDrafts = !import.meta.env.PROD;
  const blog = await getCollection("blog", ({ data }) => includeDrafts || !data.draft);
  const projects = await getCollection("projects");
  const now = new Date();
  const items = mergeTimeline(
    fromBlog(blog, { includeDrafts }),
    fromProjects(projects),
    fromCommunity(community),
    fromRoadmap(now),
  );
  return { items, now };
}
```

- [ ] **Step 6: Build and check the home page**

Run: `npm run build`
Expected: exit 0.

Run: `grep -c "Read the case study" dist/index.html`
Expected: `4` — one per project.

Run: `grep -c "Leon Noel" dist/index.html`
Expected: `1` — in the contact block, not in an inspector panel.

Run: `npm run preview`, open the home page, click a project clip and confirm the panel shows the description, the facts and the three links with no case-study prose; click a community clip and a learning clip and confirm their kickers read as sentences.

- [ ] **Step 7: Commit**

```bash
git add src/data/testimonial.ts src/components/ContactBlock.astro src/components/Inspector.astro src/pages/index.astro src/lib/timeline/astro.ts
git commit -m "feat(home): testimonial in the contact block, inspector links to case studies"
```

---

### Task 8: The Building index

The Building lane played vertically at `/building`, and its share image joins the shot list.

**Files:**
- Create: `src/pages/building/index.astro`
- Modify: `src/lib/og.mjs`
- Modify: `src/lib/__tests__/og.test.ts`

**Interfaces:**
- Consumes: `indexRows`, `sortEntries`, `TrackEntry` (Task 2), `Track` with `lane` (Task 4), `getTimeline` without `projects` (Task 7).
- Produces: the page at `/building`; `ogImagePath("building")` resolves to `/og/building.png`.

- [ ] **Step 1: Write the failing OG test**

In `src/lib/__tests__/og.test.ts`, add to the last `it` block:

```ts
    expect(names).toContain("building");
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/__tests__/og.test.ts`
Expected: FAIL, the array does not contain "building".

- [ ] **Step 3: Add the shot**

In `src/lib/og.mjs`:

```js
export const OG_SHOTS = [
  { route: "/", name: "home" },
  { route: "/roadmap", name: "roadmap" },
  { route: "/blog", name: "blog" },
  { route: "/building", name: "building" },
];
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `npx vitest run src/lib/__tests__/og.test.ts`
Expected: PASS.

Note: `public/og/building.png` does not exist yet, so the meta tag points at a 404 until Task 15 regenerates the images against the deployed site. That is the same order sub-project 3 used.

- [ ] **Step 5: Create the index page**

Create `src/pages/building/index.astro`:

```astro
---
// src/pages/building/index.astro
// The Building lane as a vertical track (everything-else spec §4.2): the head
// with a count and range, the track, the footer. Mirrors the writing index; no
// newsletter block, because the projects are not a subscription.
import Layout from "../../layouts/Layout.astro";
import TransportBar from "../../components/TransportBar.astro";
import Track from "../../components/Track.astro";
import Footer from "../../components/Footer.astro";
import { getTimeline } from "../../lib/timeline/astro";
import { ogImagePath } from "../../lib/og.mjs";
import { indexRows, sortEntries } from "../../lib/timeline/track";
import type { TrackEntry } from "../../lib/timeline/track";
import { monthYear } from "../../lib/dates";

const { items, now } = await getTimeline();

const projects: TrackEntry[] = items
  .filter((item) => item.lane === "building")
  .map((item) => ({
    id: item.id,
    href: item.href,
    title: item.title,
    start: item.start,
    end: item.end,
    status: item.status,
    description: item.body?.lane === "building" ? item.body.description : undefined,
    tags: item.body?.lane === "building" ? item.body.stack : undefined,
  }));

const rows = indexRows(projects, now);

// "4 projects, Jun 2023 to now" — the earliest start, and now if anything is
// still open, otherwise the latest end.
const sorted = sortEntries(projects);
const count = `${sorted.length} ${sorted.length === 1 ? "project" : "projects"}`;
let range = "";
if (sorted.length > 0) {
  const from = monthYear(sorted[sorted.length - 1].start);
  const open = sorted.some((p) => !p.end);
  let latest: Date | undefined;
  for (const p of sorted) if (p.end && (!latest || p.end.getTime() > latest.getTime())) latest = p.end;
  const to = open ? "now" : latest ? monthYear(latest) : from;
  range = from === to ? from : `${from} to ${to}`;
}
---

<Layout
  title="Building | Sean Campbell"
  description="Case studies: what I built, why, what it cost, and what it changed."
  image={ogImagePath("building")}
>
  <TransportBar active="building" />

  <main class="building">
    <header class="head">
      <div>
        <h1>Building</h1>
        <p class="lede">What I've built, in the order it happened. Each one has a problem, a solution, and a bill.</p>
      </div>
      <p class="count">
        {count}
        {range && (
          <>
            <br />
            {range}
          </>
        )}
      </p>
    </header>

    <div class="column">
      <Track rows={rows} density="index" label="Projects" lane="building" />
    </div>
  </main>

  <Footer />
</Layout>

<style>
  .building {
    padding-top: 110px;
    padding-bottom: var(--space-4xl);
  }

  .head {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 40px 28px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 40px;
    align-items: end;
  }
  .head h1 {
    font-size: 56px;
    line-height: 1;
    margin: 0 0 14px;
  }
  .lede {
    max-width: 44ch;
    margin: 0;
    font-size: 17px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }
  .count {
    margin: 0 0 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.7;
    color: var(--color-text-muted);
    text-align: right;
  }

  .column {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 40px;
  }

  @media (max-width: 899.98px) {
    .building {
      padding-top: 84px;
    }
    .head {
      display: block;
      padding: 0 20px 16px;
    }
    .head h1 {
      font-size: 36px;
      margin-bottom: 10px;
    }
    .count {
      margin-top: 14px;
      text-align: left;
    }
    .column {
      padding: 0 20px;
    }
  }
</style>
```

- [ ] **Step 6: Build and check the page**

Run: `npm run build`
Expected: exit 0, 13 pages built.

Run: `grep -o "4 projects" dist/building/index.html`
Expected: `4 projects`.

Run: `grep -c "is-span" dist/building/index.html`
Expected: `4` — every project is a span, so every row has a bar.

Run: `npm run preview` and open `/building` at both widths. Rows are newest first, the coral bar sits in the gutter with the in-progress one hatched, the mono column reads "Jun 2026 / to now", and the stack sits under the description.

- [ ] **Step 7: Commit**

```bash
git add src/pages/building/index.astro src/lib/og.mjs src/lib/__tests__/og.test.ts
git commit -m "feat(building): the Building lane as an index page"
```

---

### Task 9: Project pages

One page per case study, in the shared reading frame, with the track segment and the "While building" list in its sidebar. The transport bar starts pointing at the section.

**Files:**
- Create: `src/layouts/ProjectPage.astro`
- Create: `src/pages/building/[...slug].astro`
- Modify: `src/components/TransportBar.astro`

**Interfaces:**
- Consumes: `Reader` and `WhileList` (Task 5), `Track` with `lane` (Task 4), `segmentRows` with a `TrackIndex` (Task 2), `during` (Task 3), `whenText` (Task 1).
- Produces: pages at `/building/<slug>` for every entry in the `projects` collection.

- [ ] **Step 1: Create the layout**

Create `src/layouts/ProjectPage.astro`:

```astro
---
// src/layouts/ProjectPage.astro
// A case study (everything-else spec §4.3) in the shared reading frame: the
// kicker says where it sits in time, the body is the MDX, and the sidebar
// carries the facts, the neighbouring projects, and what else was happening.
import type { CollectionEntry } from "astro:content";
import Reader from "./Reader.astro";
import Track from "../components/Track.astro";
import WhileList from "../components/WhileList.astro";
import { whenText } from "../lib/timeline/track";
import type { TrackRow } from "../lib/timeline/track";
import type { TimelineItem } from "../lib/timeline/types";
import { monthYearLong } from "../lib/dates";
import { ogImagePath } from "../lib/og.mjs";

interface Props {
  entry: CollectionEntry<"projects">;
  segment: TrackRow[];
  alongside: TimelineItem[];
}

const { entry, segment, alongside } = Astro.props;
const { title, description, start, end, status, stack, url, source } = entry.data;

const capitalized = (s: string) => (s === "in-progress" ? "In progress" : s[0].toUpperCase() + s.slice(1));
// Build-time only: the schema already validated these as absolute URLs.
const host = (u: string) => new URL(u).host.replace(/^www\./, "");
---

<Reader
  title={`${title} | Sean Campbell`}
  description={description}
  image={ogImagePath("building")}
  active="building"
>
  <p class="kicker">
    <i class="sq"></i>
    <span>Building, {whenText({ status, start, end })}</span>
  </p>
  <h1>{title}</h1>
  <p class="standfirst">{description}</p>
  <div class="body">
    <slot />
  </div>

  <Fragment slot="aside">
    <p class="kicker">
      <i class="sq"></i>
      <span>Building</span>
    </p>
    <dl class="facts">
      <dt>Stack</dt><dd>{stack.join(", ")}</dd>
      <dt>Started</dt><dd>{monthYearLong(start)}</dd>
      {end ? (
        <>
          <dt>Ended</dt><dd>{monthYearLong(end)}</dd>
        </>
      ) : (
        <>
          <dt>Status</dt><dd>{capitalized(status)}</dd>
        </>
      )}
      {url && (
        <>
          <dt>Site</dt>
          <dd><a href={url} target="_blank" rel="noopener noreferrer">{host(url)}</a></dd>
        </>
      )}
      {source && (
        <>
          <dt>Source</dt>
          <dd><a href={source} target="_blank" rel="noopener noreferrer">GitHub</a></dd>
        </>
      )}
    </dl>
    <Track rows={segment} density="segment" label="Nearby projects" lane="building" />
    <WhileList label="While building" items={alongside} />
  </Fragment>
</Reader>
```

- [ ] **Step 2: Create the route**

Create `src/pages/building/[...slug].astro`:

```astro
---
// src/pages/building/[...slug].astro
// One page per project. The sidebar's segment and "While building" list come
// from the same timeline the home page renders (everything-else spec §4.3).
import { type CollectionEntry, getCollection } from "astro:content";
import ProjectPage from "../../layouts/ProjectPage.astro";
import { getTimeline } from "../../lib/timeline/astro";
import { during, segmentRows } from "../../lib/timeline/track";
import type { TrackEntry } from "../../lib/timeline/track";

export async function getStaticPaths() {
  const projects = await getCollection("projects");
  return projects.map((project) => ({
    params: { slug: project.slug },
    props: { entry: project },
  }));
}

interface Props {
  entry: CollectionEntry<"projects">;
}

const { entry } = Astro.props;
const { Content } = await entry.render();

const { items, now } = await getTimeline();
const projects: TrackEntry[] = items
  .filter((item) => item.lane === "building")
  .map((item) => ({
    id: item.id,
    href: item.href,
    title: item.title,
    start: item.start,
    end: item.end,
    status: item.status,
  }));

// The project id is its slug (src/lib/timeline/sources.ts).
const segment = segmentRows(projects, entry.slug, now, { href: "/building", noun: "projects" });
const alongside = during(items, { start: entry.data.start, end: entry.data.end }, now, "building");
---

<ProjectPage entry={entry} segment={segment} alongside={alongside}>
  <Content />
</ProjectPage>
```

- [ ] **Step 3: Point the transport bar at the index**

In `src/components/TransportBar.astro`, change the Building link:

```ts
  { key: "building", label: "Building", href: "/building" },
```

Leave Community pointing at `/#lane-community`: spec §3 declined a community page.

- [ ] **Step 4: Build and check the pages**

Run: `npm run build`
Expected: exit 0, 17 pages built (13 plus the four projects).

Run: `grep -o "Building, [^<]*" dist/building/rswebtwain/index.html | head -1`
Expected: `Building, September 2024 to April 2025`.

Run: `grep -o "Building, [^<]*" dist/building/daw-engine/index.html | head -1`
Expected: `Building, in progress since June 2026`.

Run: `grep -c "aria-label=\"While building\"" dist/building/roaming-camp/index.html`
Expected: `1` — Roaming.Camp's span overlaps essays and roadmap threads. If a project genuinely overlaps nothing the section is omitted and this returns `0`; check the dates before treating that as a bug.

Run: `npm run preview` and open each project page at 1280px and 390px. The article reads like an essay, the sidebar shows the facts then "Nearby projects" with the current project ringed then "While building", and below 900px the sidebar drops under the article behind a rule.

Keyboard pass: tab from the transport bar through the sidebar links; the ringed current project carries `aria-current="page"`; the "N older, all projects" link reaches `/building`.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/ProjectPage.astro "src/pages/building/[...slug].astro" src/components/TransportBar.astro
git commit -m "feat(building): a page per project with a track segment and overlap list"
```

---

### Task 10: The 404 as an empty position

An empty fragment of the console, then a heading, the path that was asked for, and one link per section.

**Files:**
- Modify: `src/pages/404.astro`

**Interfaces:**
- Consumes: `Lane` from `src/lib/timeline/types.ts`.
- Produces: nothing other tasks use.

- [ ] **Step 1: Replace the page**

Replace all of `src/pages/404.astro` with:

```astro
---
// src/pages/404.astro
// An empty position on the arrangement (everything-else spec §7): a decorative
// ruler and four empty lanes, then the heading, the path that was asked for,
// and a link per section. The path is filled by the inline script below and
// stays hidden without JavaScript, so the page reads either way.
import Layout from "../layouts/Layout.astro";
import TransportBar from "../components/TransportBar.astro";
import Footer from "../components/Footer.astro";
import type { Lane } from "../lib/timeline/types";

const lanes: { key: Lane; label: string; href: string }[] = [
  { key: "writing", label: "Writing", href: "/blog" },
  { key: "building", label: "Building", href: "/building" },
  { key: "learning", label: "Learning", href: "/roadmap" },
  { key: "community", label: "Community", href: "/#lane-community" },
];
---

<Layout
  title="Nothing recorded here | Sean Campbell"
  description="That page isn't on the timeline."
>
  <TransportBar />

  <main class="lost">
    <figure class="empty" aria-hidden="true">
      <div class="ruler"><span class="tag">now</span></div>
      {lanes.map((l) => (
        <div class="lane" style={`--c: var(--lane-${l.key})`}>
          <span class="lane-name">{l.label}</span>
          <span class="lane-track"></span>
        </div>
      ))}
      <span class="playhead"></span>
    </figure>

    {/* TODO(owner): heading and line in Sean's voice (spec §14). Placeholder below. */}
    <h1>Nothing recorded here.</h1>
    <p class="line">This position is empty. The page either moved or never existed.</p>

    <p class="path" hidden data-lost-path><code></code></p>

    <ul class="jump">
      <li><a class="home" href="/">Home</a></li>
      {lanes.map((l) => (
        <li><a href={l.href} style={`--c: var(--lane-${l.key})`}>{l.label}</a></li>
      ))}
    </ul>
  </main>

  <Footer />
</Layout>

<script is:inline>
  const lost = document.querySelector("[data-lost-path]");
  if (lost) {
    lost.querySelector("code").textContent = location.pathname;
    lost.hidden = false;
  }
</script>

<style>
  .lost {
    max-width: 720px;
    margin: 0 auto;
    padding: 150px 40px var(--space-4xl);
  }

  /* The empty console fragment. Decorative: aria-hidden, no dates on the ruler,
     because nothing is recorded at this position. */
  .empty {
    position: relative;
    margin: 0 0 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    overflow: hidden;
  }
  .ruler {
    position: relative;
    height: 30px;
    margin-left: 96px;
    border-bottom: 1px solid var(--color-border);
  }
  .tag {
    position: absolute;
    top: 7px;
    left: calc(62% - 34px);
    padding: 1px 5px;
    border-radius: 2px;
    background: var(--color-text-primary);
    color: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
  }
  .lane {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: center;
    height: 34px;
    border-bottom: 1px solid var(--color-border);
  }
  .lane:last-of-type {
    border-bottom: 0;
  }
  .lane-name {
    padding-left: 16px;
    font-size: 12px;
    color: var(--color-text-muted);
    border-right: 1px solid var(--color-border);
    line-height: 34px;
  }
  .lane-track {
    height: 2px;
    margin: 0 14px;
    border-radius: 1px;
    background: color-mix(in srgb, var(--c) 22%, transparent);
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(96px + (100% - 96px) * 0.62);
    width: 2px;
    background: var(--color-text-primary);
  }

  h1 {
    font-size: clamp(2.2rem, 5vw, 3.2rem);
    line-height: 1.02;
    margin: 0 0 14px;
  }
  .line {
    font-size: 18px;
    line-height: 1.5;
    color: var(--color-text-secondary);
    margin: 0;
    max-width: 46ch;
  }
  .path {
    margin: 18px 0 0;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }
  .path[hidden] {
    display: none;
  }

  .jump {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    margin: 32px 0 0;
    padding: 0;
    font-size: 15px;
  }
  .jump a {
    padding-bottom: 2px;
    color: var(--color-text-primary);
    border-bottom: 2px solid var(--c, var(--color-border-hover));
  }
  .jump a:hover {
    color: var(--c, var(--color-text-primary));
  }
  .jump a:focus-visible {
    outline: 2px solid var(--c, var(--color-text-primary));
    outline-offset: 3px;
  }

  @media (max-width: 899.98px) {
    .lost {
      padding: 104px 20px var(--space-3xl);
    }
    .ruler,
    .lane {
      margin-left: 0;
      grid-template-columns: 78px 1fr;
    }
    .ruler {
      margin-left: 78px;
    }
    .playhead {
      left: calc(78px + (100% - 78px) * 0.62);
    }
    .jump {
      gap: 10px 18px;
    }
  }
</style>
```

- [ ] **Step 2: Build and check both states**

Run: `npm run build`
Expected: exit 0.

Run: `grep -c 'class="path" hidden' dist/404.html`
Expected: `1` — the paragraph ships hidden.

Run: `npm run preview`, then visit `http://localhost:4321/nope/not-here`. The console fragment shows four empty lanes and a playhead, the path line reads `/nope/not-here`, and the five links carry their lane underlines. Disable JavaScript and reload: everything but the path line stays.

Keyboard pass: tab reaches Home and the four section links in order; focus rings are visible against the console background.

- [ ] **Step 3: Commit**

```bash
git add src/pages/404.astro
git commit -m "feat(404): an empty position on the arrangement"
```

---

### Task 11: The newsletter result panel and the retired accent

Three near-identical pages become one component plus copy, and the last four uses of the old blue accent go with them.

**Files:**
- Create: `src/components/ResultPanel.astro`
- Modify: `src/pages/newsletter/confirmed.astro`
- Modify: `src/pages/newsletter/error.astro`
- Modify: `src/pages/newsletter/unsubscribed.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<ResultPanel kicker? title link={{ href, label }}>` with the body paragraph in the default slot.

- [ ] **Step 1: Create the panel**

Create `src/components/ResultPanel.astro`:

```astro
---
// src/components/ResultPanel.astro
// A one-message page in the inspector's idiom (everything-else spec §8): a
// panel with a lane rule along its top, a kicker, the message, and one link
// back. Used by the three newsletter result pages.
interface Props {
  /** "{Section}, {what happened}". */
  kicker?: string;
  title: string;
  link: { href: string; label: string };
}

const { kicker = "Writing, newsletter", title, link } = Astro.props;
---

<main class="result">
  <section class="panel">
    <p class="kicker"><i aria-hidden="true"></i>{kicker}</p>
    <h1>{title}</h1>
    <div class="text"><slot /></div>
    <p class="back"><a href={link.href}>{link.label}</a></p>
  </section>
</main>

<style>
  .result {
    max-width: 560px;
    margin: 0 auto;
    padding: 160px 20px var(--space-4xl);
  }
  .panel {
    padding: 26px 28px 24px;
    border: 1px solid var(--color-border);
    border-top: 3px solid var(--lane-writing);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .kicker i {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--lane-writing);
  }
  h1 {
    margin: 0 0 12px;
    font-size: 34px;
    line-height: 1.05;
  }
  .text :global(p) {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }
  .back {
    margin: 20px 0 0;
    font-size: 14px;
  }
  .back a {
    padding-bottom: 1px;
    color: var(--lane-writing);
    border-bottom: 1px solid color-mix(in srgb, var(--lane-writing) 40%, transparent);
  }
  .back a:focus-visible {
    outline: 2px solid var(--lane-writing);
    outline-offset: 2px;
  }

  @media (max-width: 899.98px) {
    .result {
      padding: 104px 18px var(--space-3xl);
    }
    h1 {
      font-size: 26px;
    }
  }
</style>
```

- [ ] **Step 2: Rewrite the three pages**

Replace all of `src/pages/newsletter/confirmed.astro`:

```astro
---
import Layout from "../../layouts/Layout.astro";
import TransportBar from "../../components/TransportBar.astro";
import ResultPanel from "../../components/ResultPanel.astro";
import Footer from "../../components/Footer.astro";
---

<Layout title="You're subscribed | Sean Campbell" description="Subscription confirmed.">
  <TransportBar active="writing" />
  <ResultPanel title="You're in." link={{ href: "/blog", label: "Back to the essays" }}>
    <p>Thanks for confirming. New blog posts will land in your inbox as soon as they go up.</p>
  </ResultPanel>
  <Footer />
</Layout>
```

Replace all of `src/pages/newsletter/error.astro`:

```astro
---
import Layout from "../../layouts/Layout.astro";
import TransportBar from "../../components/TransportBar.astro";
import ResultPanel from "../../components/ResultPanel.astro";
import Footer from "../../components/Footer.astro";
---

<Layout title="Link not valid | Sean Campbell" description="That link didn't work.">
  <TransportBar active="writing" />
  <ResultPanel title="That link didn't work." link={{ href: "/blog", label: "Back to the essays" }}>
    <p>
      The link is missing or invalid. If you were trying to confirm a subscription, head back to the
      blog and try signing up again.
    </p>
  </ResultPanel>
  <Footer />
</Layout>
```

Replace all of `src/pages/newsletter/unsubscribed.astro`:

```astro
---
import Layout from "../../layouts/Layout.astro";
import TransportBar from "../../components/TransportBar.astro";
import ResultPanel from "../../components/ResultPanel.astro";
import Footer from "../../components/Footer.astro";
---

<Layout title="Unsubscribed | Sean Campbell" description="You've been unsubscribed.">
  <TransportBar active="writing" />
  <ResultPanel title="You're unsubscribed." link={{ href: "/blog", label: "Back to the essays" }}>
    <p>
      No more newsletter emails will be sent to you. If this was a mistake, you can resubscribe from
      the blog page anytime.
    </p>
  </ResultPanel>
  <Footer />
</Layout>
```

- [ ] **Step 3: Prove the accent tokens have no readers left**

Run: `grep -rn "color-accent" src netlify scripts public`
Expected: only the four definitions in `src/styles/global.css`. If anything else appears, convert it to a lane token before continuing — do not delete a token that is still read.

- [ ] **Step 4: Delete the tokens**

In `src/styles/global.css`, delete these five lines:

```css
    /* Accent is the learning blue; kept for pages not yet redesigned. */
    --color-accent: #60A5FA;
    --color-accent-secondary: #A78BFA;
    --color-accent-bg: rgba(96, 165, 250, 0.12);
    --color-accent-border: rgba(96, 165, 250, 0.35);
```

- [ ] **Step 5: Build and check**

Run: `npm run build`
Expected: exit 0.

Run: `grep -rc "color-accent" dist/_astro/*.css`
Expected: `0` for every file.

Run: `npm run preview` and open `/newsletter/confirmed`, `/newsletter/error`, `/newsletter/unsubscribed` at both widths. Each is a single gold-ruled panel with the transport bar showing Writing underlined.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultPanel.astro src/pages/newsletter src/styles/global.css
git commit -m "feat(newsletter): one result panel; retire the old accent tokens"
```

---

### Task 12: The roadmap contract test

Before touching the roadmap markup, put a net under it. This test reads the built page and asserts every hook the two frozen scripts look for is present, so Task 13 cannot silently break saved progress.

**Files:**
- Create: `src/__tests__/roadmap-contract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `allIds`, `logIds`, `build`, `reading` from `src/data/roadmap.ts`.
- Produces: `npm run check` — an Astro build followed by the whole Vitest suite.

- [ ] **Step 1: Re-derive the hook list from the scripts**

Run: `grep -oE 'getElementById\("[a-z-]+"\)|querySelector(All)?[^(]*\("[^"]+"\)|data-[a-z-]+' src/scripts/roadmap.ts src/scripts/review.ts | sort -u`

Compare the result with the `FIXED_IDS` and selector lists in Step 2. The scripts are the source of truth: if the grep turns up a hook the test does not name, add it before writing the test.

- [ ] **Step 2: Write the test**

Create `src/__tests__/roadmap-contract.test.ts`:

```ts
// The roadmap page is server-rendered markup driven by two client scripts that
// this redesign never edits (src/scripts/roadmap.ts, src/scripts/review.ts).
// They find their targets by id and data attribute, so a markup change can break
// saved progress with a green unit suite and a clean build. This test reads the
// built page and asserts every hook is still there.
//
// It needs dist/, so it is skipped when there is none. `npm run check` builds
// first and then runs the suite; plain `npm test` still works on its own.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { allIds, logIds, build, reading } from "../data/roadmap";

const PAGE = "dist/roadmap/index.html";
const built = existsSync(PAGE);

describe.skipIf(!built)("roadmap client contract (dist/roadmap/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  // Fixed ids, derived from the two scripts. roadmap.ts: setText/setWidth targets,
  // the edit button, the message line, the save state, and the page root class.
  const ROADMAP_IDS = [
    "rm-edit", "rm-message", "rm-save-state",
    "rm-build-stages", "rm-build-courses", "rm-build-bar",
    "rm-read-ch", "rm-read-books", "rm-read-bar",
    "rm-fnd-done", "rm-fnd-bar", "rm-logs-done",
  ];
  // review.ts: the runner, the card faces, the counters and the message line.
  const REVIEW_IDS = [
    "rv-runner", "rv-runner-done", "rv-runner-locked", "rv-card", "rv-front", "rv-back",
    "rv-reveal", "rv-ratings", "rv-message", "rv-save-state", "rv-thread",
    "rv-due-count", "rv-streak", "rv-rotation-count", "rv-rotation-summary", "rv-rotation-empty",
  ];

  it("keeps the page root the script hangs edit mode on", () => {
    expect(html).toContain('class="roadmap-page');
  });

  it("keeps every fixed element id", () => {
    for (const id of [...ROADMAP_IDS, ...REVIEW_IDS]) {
      expect(html, `missing id ${id}`).toContain(`id="${id}"`);
    }
  });

  it("keeps a checkbox for every leaf id, because progress is stored by id", () => {
    for (const id of allIds) {
      expect(html, `missing data-id ${id}`).toContain(`data-id="${id}"`);
    }
  });

  it("keeps a percentage hook for every milestone and every book", () => {
    for (const m of build) expect(html, `missing milestone ${m.id}`).toContain(`data-milestone-pct="${m.id}"`);
    for (const b of reading) expect(html, `missing book ${b.id}`).toContain(`data-book-pct="${b.id}"`);
  });

  it("keeps every decision log with its four fields and its status line", () => {
    for (const id of logIds) {
      expect(html, `missing log ${id}`).toContain(`data-log-id="${id}"`);
    }
    for (const field of ["prediction", "confrontation", "verdict", "confidence"]) {
      expect(html, `missing log field ${field}`).toContain(`data-log-field="${field}"`);
    }
    expect(html).toContain("data-log-status");
  });

  it("keeps the review deck's rating buttons and per-thread counters", () => {
    for (const rating of [0, 1, 2, 3]) {
      expect(html, `missing rating ${rating}`).toContain(`data-rv-rate="${rating}"`);
    }
    for (const thread of ["build", "reading", "foundations", "judgment", "behavioral"]) {
      expect(html, `missing thread count ${thread}`).toContain(`data-rv-thread-count="${thread}"`);
    }
  });
});
```

- [ ] **Step 3: Run it against a stale dist to see it pass, then against none to see it skip**

Run: `npm run build && npx vitest run src/__tests__/roadmap-contract.test.ts`
Expected: PASS, six tests.

Run: `rm -rf dist && npx vitest run src/__tests__/roadmap-contract.test.ts`
Expected: the suite is reported as skipped, exit 0.

- [ ] **Step 4: Add the check script**

In `package.json`, add to `scripts`, after `"build"`:

```json
    "check": "astro build && vitest run",
```

Do not add a `postbuild` hook: Netlify runs `npm run build`, and the deploy must not depend on Vitest.

- [ ] **Step 5: Run the full check**

Run: `npm run check`
Expected: the build completes, then every test file passes including the contract test.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/roadmap-contract.test.ts package.json
git commit -m "test(roadmap): assert the built page keeps every client-script hook"
```

---

### Task 13: The roadmap leftovers

Five changes to the roadmap page, guarded by the contract test from Task 12. The two frozen scripts are not edited; `roadmap-arrangement.ts` is.

**Files:**
- Modify: `src/components/roadmap/RoadmapArrangement.astro`
- Modify: `src/components/roadmap/RoadmapMeters.astro`
- Modify: `src/pages/roadmap.astro`
- Modify: `src/scripts/roadmap-arrangement.ts`

**Interfaces:**
- Consumes: `roadmapWindow`, `packRows`, `positionIn` (unchanged).
- Produces: `.rm-toolbar` above the arrangement, visible at every width, holding the zoom group (desktop only), the save state and the Edit button. `.rm-lane` carries `--rows`.

- [ ] **Step 1: Move the owner controls out of the meters**

In `src/components/roadmap/RoadmapMeters.astro`, delete the trailing `.rm-controls` div and the `#rm-message` paragraph. Update the file's header comment: it should still say the meter ids are a contract with `src/scripts/roadmap.ts`, and note that the edit controls moved to the arrangement toolbar.

- [ ] **Step 2: Build the toolbar and hide the zoom when it does nothing**

In `src/components/roadmap/RoadmapArrangement.astro`, add to the frontmatter after `const nowX = ...`:

```ts
// Spec §9: the "All" zoom is only worth showing once a clip falls outside the
// default window. While they are the same window the control is a no-op, so it
// is not rendered at all and the script no-ops with it.
const allWin = roadmapWindow("all", now, clips);
const showZoom =
  allWin.from.getTime() !== win.from.getTime() || allWin.to.getTime() !== win.to.getTime();
```

and in the `lanes` map, count the packed rows:

```ts
const lanes = TRACKS.map((t) => {
  const placed = clips.filter((c) => c.track === t.key).flatMap((c) => positionIn(c, win, now) ?? []);
  const rows = packRows(placed, estimate);
  // The lane grows with its packed rows rather than sitting at a fixed height,
  // so a third row is drawn instead of overflowing (spec §9).
  const rowCount = rows.reduce((max, p) => Math.max(max, p.row + 1), 1);
  return { ...t, rows, rowCount };
});
```

Replace the opening of the markup — the `.rm-arr` div with its data attributes and its `.rm-arr-head` — with:

```astro
{/* Above the arrangement and outside it, because the arrangement is hidden
    below 900px while edit mode still works on the mobile graph. The ids here
    are a contract with src/scripts/roadmap.ts — do not rename them. */}
<div class="rm-toolbar">
  {showZoom && (
    <div class="rm-zoom" role="group" aria-label="Zoom">
      <button type="button" data-rm-zoom="span" aria-pressed="true">2026–2027</button>
      <button type="button" data-rm-zoom="all" aria-pressed="false">All</button>
    </div>
  )}
  <span id="rm-save-state" class="rm-save-state" role="status" aria-live="polite"></span>
  <button id="rm-edit" type="button" class="rm-edit-btn">Edit</button>
</div>
<p id="rm-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>

<div class="rm-arr">
  <div class="rm-arr-body">
```

The `data-window-from` and `data-window-to` attributes go: nothing reads them. Verify before deleting:

Run: `grep -rn "window-from\|window-to\|windowFrom\|windowTo" src netlify`
Expected: no output once they are gone; if a reader exists, keep them.

Then give each lane its row count:

```astro
      <div class="rm-lane" style={`--c: var(--track-${lane.key}); --rows: ${lane.rowCount}`}>
```

- [ ] **Step 3: Restyle the toolbar, the lane height and the now tag**

In `src/pages/roadmap.astro`'s global style block:

Replace the `.rm-controls` rule with the toolbar, which now also carries the zoom:

```css
  /* ---- toolbar: zoom (desktop) on the left, owner controls on the right ---- */
  .rm-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
    margin: 20px 0 0;
  }
  .rm-zoom {
    display: inline-flex;
    gap: 4px;
    margin-right: auto;
  }
```

and delete the old standalone `.rm-zoom { display: inline-flex; gap: 4px; }` rule and the whole `.rm-arr-head` rule.

In `.rm-arr`, delete the `--lane-h: 108px;` line. Replace the `.rm-lane` height:

```css
  .rm-lane {
    display: grid;
    grid-template-columns: var(--head-w) 1fr;
    height: calc(var(--row-top) * 2 + var(--clip-h) + (var(--rows, 1) - 1) * var(--row-pitch));
    border-bottom: 1px solid var(--color-border);
  }
```

Give the now tag a background halo so a hatched clip no longer shows through its corners:

```css
  .rm-playhead span {
    position: absolute;
    /* Below the ruler line: at top:7px the chip sat on top of a quarter label. */
    top: calc(var(--ruler-h) + 7px);
    right: 6px;
    padding: 1px 5px;
    border-radius: 2px;
    background: var(--color-text-primary);
    /* The chip sits over the first lane; the halo keeps a clip's hatch from
       showing through its rounded corners (spec §9). */
    box-shadow: 0 0 0 3px var(--color-bg-elevated);
    color: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
  }
```

In the `@media (max-width: 899.98px)` block, hide the zoom with the arrangement it controls and keep the toolbar:

```css
    .rm-arr { display: none; }
    /* The zoom only moves the arrangement, which is hidden here; the Edit
       button stays, because edit mode works on the graph below. */
    .rm-zoom { display: none; }
    .rm-toolbar { justify-content: flex-end; }
```

- [ ] **Step 4: Teach the script about an absent zoom and the row count**

In `src/scripts/roadmap-arrangement.ts`:

The zoom buttons now live outside `.rm-arr`, so query them from the document, and set `--rows` after each re-lay. Replace the body of `apply` and the tail of the file:

```ts
  const zoomButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-rm-zoom]"));

  function apply(zoom: RoadmapZoom) {
    const win = roadmapWindow(zoom, now, clips);
    for (const track of ["build", "reading", "foundations"] as const) {
      const placed = clips.filter((c) => c.track === track).flatMap((c) => positionIn(c, win, now) ?? []);
      const rows = packRows(placed, estimate);
      const lane = arr!.querySelector<HTMLElement>(`.rm-clips[data-track="${track}"]`);
      if (!lane) continue;
      let rowCount = 1;
      for (const p of rows) {
        const el = lane.querySelector<HTMLElement>(`.rm-clip[data-clip-id="${p.item.id}"]`);
        if (!el) continue;
        el.style.setProperty("--x", `${p.x * 100}%`);
        el.style.setProperty("--w", `${p.w * 100}%`);
        el.style.setProperty("--y", String(p.row));
        rowCount = Math.max(rowCount, p.row + 1);
      }
      // The lane's height follows its packed rows (spec §9), so a zoom that
      // packs an extra row grows the lane instead of overflowing it.
      lane.closest<HTMLElement>(".rm-lane")?.style.setProperty("--rows", String(rowCount));
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
    for (const b of zoomButtons) {
      b.setAttribute("aria-pressed", String(b.dataset.rmZoom === zoom));
    }
    try { localStorage.setItem(ZOOM_KEY, zoom); } catch {}
  }

  // No zoom control means the default window already covers every clip, so the
  // server-rendered layout stands and a stored preference is meaningless.
  if (zoomButtons.length > 0) {
    for (const b of zoomButtons) {
      b.addEventListener("click", () => apply(b.dataset.rmZoom as RoadmapZoom));
    }
    let initial: RoadmapZoom = "span";
    try { if (localStorage.getItem(ZOOM_KEY) === "all") initial = "all"; } catch {}
    apply(initial);
  }
```

Update the file's header comment to say the toolbar lives outside `.rm-arr` and that the control is absent while the two windows match.

- [ ] **Step 5: Remove the dead hooks and CSS**

Check each candidate has no reader, then remove it:

Run: `grep -rn "data-clip\b" src netlify | grep -v "data-clip-id"`
The only hits should be the three `data-clip` attributes on `.rm-insp` sections in `src/components/roadmap/RoadmapInspector.astro`. No script or stylesheet reads them; delete the attribute from all three. **Keep `data-clip-id` on the arrangement clips** — the zoom script positions by it.

Run: `grep -n "rm-insp\[data-open\]" src/pages/roadmap.astro`
The roadmap inspector is `:target`-driven and no script sets `data-open` on it, so delete that rule. (The home inspector's `.insp[data-open]` rule is set by `src/scripts/timeline.ts` and stays.)

Then sweep for CSS with no markup:

Run: `for c in $(grep -oE '\.rm-[a-z-]+' src/pages/roadmap.astro | sort -u | tr -d .); do grep -q "$c" dist/roadmap/index.html || echo "unused: $c"; done`

Remove each reported class's rules after confirming by eye that it is not generated at runtime by one of the three scripts. Two known false positives to keep: classes the roadmap scripts add at runtime. Check `grep -n "classList" src/scripts/roadmap.ts src/scripts/review.ts` before deleting anything the sweep reports.

- [ ] **Step 6: Verify the contract, the build and the page**

Run: `npm run check`
Expected: build succeeds; every test passes, including the six contract assertions. If a contract test fails, a hook was lost in Step 1 or 2 — restore it before continuing.

Run: `grep -c 'data-rm-zoom' dist/roadmap/index.html`
Expected: `0` today, because every roadmap clip falls inside 2026 to 2027, so the control is correctly absent.

Run: `grep -o 'style="--c: var(--track-[a-z]*); --rows: [0-9]*"' dist/roadmap/index.html`
Expected: three lanes, each with its own row count.

Run: `npm run preview` and open `/roadmap`. At 1280px: the Edit button and the save-state sit on a row above the arrangement, right-aligned, with no zoom control; the now tag has a clean edge over the hatched clip; each lane is exactly as tall as its rows need. At 390px: the arrangement is gone, the graph shows, and the Edit button is still there.

Click Edit and enter the admin token, tick one checkbox, confirm it saves and the meters move, then untick it. This is the only manual proof that the preserved ids still drive the stored data.

- [ ] **Step 7: Commit**

```bash
git add src/components/roadmap src/pages/roadmap.astro src/scripts/roadmap-arrangement.ts
git commit -m "fix(roadmap): toolbar with edit, row-sized lanes, now-tag halo, conditional zoom"
```

---

### Task 14: Docs and the screenshot script

The README still documents components deleted two sub-projects ago. Rewrite it for a human, update the agent instructions, and add the new pages to the review screenshots.

**Files:**
- Modify: `README.md`
- Delete: `public/images/README.md`
- Modify: `CLAUDE.md`
- Modify: `scripts/screenshots.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing other tasks use.

- [ ] **Step 1: Rewrite the README**

Replace all of `README.md` with:

```markdown
# seanthedeveloper.com

A portfolio built as an arrangement: every essay, project, roadmap milestone and
community entry carries a lane and a date range, and the site draws them on one
time axis. Cross-references fall out of that — an essay knows what was being
built when it was written, a project knows what else was going on across its life.

Static [Astro](https://astro.build) 5. Everything renders at build time; the only
client-side JavaScript is progressive enhancement over markup that already works.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest unit suite |
| `npm run check` | Build, then the full suite (includes the roadmap contract test) |
| `npm run shots` | Review screenshots of the main pages at two widths, into `screenshots/` (needs `npm run preview` running) |
| `npm run og` | Regenerate the Open Graph share images against the live site |

Node 20.

## Pages

| Path | What it is |
|---|---|
| `/` | The arrangement: four lanes on one time axis, with an inspector panel per clip |
| `/blog` | The Writing lane played vertically; `/blog/<slug>` for each essay |
| `/building` | The Building lane played vertically; `/building/<slug>` for each case study |
| `/roadmap` | The learning roadmap as an arrangement, with live progress and a review deck |

## Adding content

**An essay.** Create `src/content/blog/<slug>.mdx`:

```yaml
---
title: "Post title"
description: "One sentence; it becomes the standfirst and the meta description."
pubDate: 2026-09-03
tags: ["Rust", "WASM"]   # optional
heroImage: "/images/blog/<slug>/hero.png"   # optional
updatedDate: 2026-10-01   # optional
draft: false   # true hides it from production
---
```

It appears on the writing index, on the home timeline, and in the RSS feed. Reading
time is computed from the body.

**A project.** Create `src/content/projects/<slug>.mdx`. The slug is the URL and the
timeline id, so do not rename it after launch:

```yaml
---
title: "Project name"
description: "One sentence."
start: 2024-09-01
end: 2025-04-01        # required for done and live; omit while in progress
status: done            # done | live | in-progress
stack: ["Rust", "Tauri v2"]
url: "https://example.com"              # optional
source: "https://github.com/..."        # optional
---
```

The body is free-form MDX. The convention is `## Problem`, `## Solution`,
`## Tradeoffs`, `## Impact`.

**A community entry.** Add an object to `src/data/community.ts` with `id`, `title`,
`org`, `description`, `start`, `status`, and optionally `end`, `url` and `linkLabel`
(what the inspector's link says; `url` is required if you set it). It is validated at
build time and a bad entry fails the build with its id in the message.

**A roadmap milestone, book or foundation group.** Edit `src/data/roadmap.ts`.
**Leaf ids are load-bearing**: progress is stored by id in Netlify Blobs, so renaming
one loses its saved state. Adding and reordering are safe. `npm run check` asserts the
built page still carries every id the client scripts look for.

## Roadmap operations

`/roadmap` has a shared, persisted progress state and a spaced-repetition review deck.

- **Content** lives in `src/data/roadmap.ts`.
- **Progress** is stored in Netlify Blobs (store `roadmap`, key `progress`) through
  `netlify/functions/progress.ts`. `GET /api/progress` is public; `POST` needs a bearer token.
- **Edit mode**: click **Edit** on the page and enter `ROADMAP_ADMIN_TOKEN`. The token is
  kept in `sessionStorage` and sent only to the API; it never ships in the client bundle.

Set `ROADMAP_ADMIN_TOKEN` (a long random secret) in the Netlify site environment
variables and in a local `.env` (see `.env.example`).

Blobs need the Netlify environment, so develop that page through the Netlify CLI:

```bash
netlify dev
```

Plain `npm run dev` serves the page, but `/api/progress` calls fail.

## Images

The profile photo at `public/images/profile.jpg` is 640x760 and appears in the contact
block. Essay images live under `public/images/blog/<slug>/`. Share images in `public/og/`
are generated by `npm run og` and committed.

## Deployment

Netlify, configured in `netlify.toml`. Pushing to `main` deploys.

## License

MIT
```

- [ ] **Step 2: Delete the stale image guide**

```bash
git rm public/images/README.md
```

Its one live fact, the profile photo size, is in the README's Images section above.

- [ ] **Step 3: Update the agent instructions**

In `CLAUDE.md`:

In **Build & Development Commands**, add `npm run check` between `build` and `preview`:
`- \`npm run check\` — Production build followed by the full Vitest suite, including the roadmap client-contract test that reads \`dist/roadmap/index.html\`` — and update the `npm run shots` line to say it also covers the Building index, a project page, the 404 and a newsletter page.

In **Component composition**, add a sentence: the home `Inspector` links to a project's page rather than rendering its case study, and the contact block carries the site's one testimonial from `src/data/testimonial.ts`.

In **Timeline data**, replace the description of `track.ts` with: `track.ts` is lane-agnostic (`TrackEntry`, `indexRows`, `segmentRows` with a `TrackIndex`, `writtenWhile`, `during`, `rangeText`, `whenText`, reading time) and serves the writing and building indexes, both sidebars, and the inspector's wording.

Add a **Building pages** paragraph after **Writing pages**: `src/pages/building/index.astro` renders the Building lane as a vertical track; `src/pages/building/[...slug].astro` renders a case study through `src/layouts/ProjectPage.astro`. Both that layout and `src/layouts/BlogPost.astro` fill `src/layouts/Reader.astro`, whose frame and prose styles are the global `src/styles/reader.css`, because Astro's scoped styles do not reach slotted content. `src/components/WhileList.astro` renders "Written while" and "While building".

In **Roadmap page**, note that the owner controls sit in a toolbar above the arrangement so they survive below 900px, lanes size to their packed rows, and the zoom control is only rendered when the all-time window differs from the default.

Add a line to **Styling**: the old `--color-accent*` tokens are gone; use a lane or track token.

- [ ] **Step 4: Add the new pages to the screenshots**

In `scripts/screenshots.mjs`, extend `PAGES` and the header comment:

```js
const PAGES = [
  { name: "home", path: "/" },
  { name: "writing", path: "/blog" },
  { name: "building", path: "/building" },
  { name: "roadmap", path: "/roadmap" },
  { name: "essay", path: "/blog/i-wont-stop-coding" },
  { name: "essay-code", path: "/blog/composition-over-inheritance-angular" },
  { name: "project", path: "/building/rswebtwain" },
  { name: "not-found", path: "/nope" },
  { name: "newsletter", path: "/newsletter/confirmed" },
];
```

Note for the implementer: `npm run preview` serves `dist/404.html` for `/nope`, so that row captures the real 404.

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: everything passes.

Run: `npm run preview` in one terminal, then `npm run shots` in another.
Expected: 18 screenshots written to `screenshots/`, no failures.

- [ ] **Step 6: Commit**

```bash
git add README.md CLAUDE.md scripts/screenshots.mjs
git commit -m "docs: rewrite the README for the arrangement; cover the new pages in shots"
```

---

### Task 15: Final verification, owner inputs, and the share images

Nothing new is built here. This task proves the whole sub-project and closes the two things that can only happen with the owner and after a deploy.

**Files:**
- Modify: `src/content/projects/*.mdx`, `src/data/community.ts`, `src/data/roadmap.ts` (only if the owner supplies dates)
- Modify: `src/pages/404.astro` (only when the owner supplies the copy)
- Modify: `public/og/*.png` (regenerated)

**Interfaces:**
- Consumes: every task above.
- Produces: a verified branch ready to merge.

- [ ] **Step 1: Run the whole check**

Run: `npm run check`
Expected: build succeeds, every test file passes. Paste the summary line into the task notes — a claim of success without this output is not evidence.

- [ ] **Step 2: Review the screenshots at both widths**

Run: `npm run preview`, then `npm run shots`.

Look at all 18 images. What must be true: the writing index and essay pages are visually unchanged from before this sub-project; the Building index shows coral bars in the gutter with the in-progress project hatched; a project page reads like an essay with a facts list, "Nearby projects" and "While building" in its sidebar; the 404 shows four empty lanes; the newsletter page is a single gold-ruled panel; the roadmap's Edit button sits above the arrangement at both widths.

- [ ] **Step 3: Keyboard and no-JavaScript pass**

With JavaScript disabled: the home page's clips are plain links to essays and project pages; the roadmap's `:target` panels still open; the 404's path line is absent and everything else reads.

With the keyboard: tab through the Building index rows (one stop per project), a project page's sidebar, the 404's five links, and the roadmap toolbar. Every focus ring must be visible, and the ringed current project must announce `aria-current="page"`.

- [ ] **Step 4: Ask the owner for the four inputs**

Spec §14. Post them as one message and apply whatever comes back:

1. Start and end dates with status for the four projects (`src/content/projects/*.mdx`), replacing the `# placeholder` comments.
2. The DSD cohort lead dates, which talks actually happened and in which month, and a `url` plus `linkLabel` for any entry that has one (`src/data/community.ts`).
3. Whether the roadmap milestone and book dates in `src/data/roadmap.ts` should be corrected now.
4. The 404 heading and line, replacing the `TODO(owner)` placeholder.

If an answer does not come, leave the placeholder and its comment in place. Do not invent a date.

- [ ] **Step 5: Commit any content the owner supplied**

```bash
git add src/content/projects src/data/community.ts src/data/roadmap.ts src/pages/404.astro
git commit -m "content: confirmed dates and 404 copy"
```

Skip this step entirely if nothing came back.

- [ ] **Step 6: Merge and deploy**

Follow `superpowers:finishing-a-development-branch`. The previous three sub-projects merged to `main` and deployed through Netlify on push.

- [ ] **Step 7: Regenerate the share images against the live site**

Only after the deploy is live, because the script screenshots the real pages:

Run: `npm run og`
Expected: four PNGs written to `public/og/`, including the new `building.png`.

Check each image opens and shows the page it names. Then:

```bash
git add public/og
git commit -m "chore: regenerate Open Graph share images for the Building pages"
```

Push, which redeploys with the images in place.

- [ ] **Step 8: Confirm live progress still works**

Open the deployed `/roadmap`, confirm the meters show the same numbers as before the deploy, and that Edit still saves. The contract test guards the markup; this proves the stored data path end to end, which is what sub-project 3 did after its merge.

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| §4.1 URLs and navigation | 6 (href), 9 (routes, transport bar) |
| §4.2 The index | 8 |
| §4.3 The project page | 9 |
| §4.4 The home inspector | 7 |
| §4.5 Share images | 5 (essay fallback), 8 (shot list), 15 (regenerate) |
| §5.1 `track.ts` | 1, 2, 3 |
| §5.2 Components and layouts | 4, 5, 8, 9 |
| §6.1 Testimonial | 7 |
| §6.2 100Devs | 6 (schema), 7 (file) |
| §6.3 Community | 6 |
| §7 The 404 page | 10 |
| §8 Newsletter panel and retired tokens | 11 |
| §9 Roadmap leftovers | 12 (contract test, `check`), 13 (the rest) |
| §10 README and docs | 14 |
| §11 Files | all |
| §12 Accessibility | 4, 5, 8, 9, 10, 11, 13, 15 |
| §13 Testing | 1, 2, 3, 6, 8, 12, 15 |
| §14 Inputs needed | 15 |
