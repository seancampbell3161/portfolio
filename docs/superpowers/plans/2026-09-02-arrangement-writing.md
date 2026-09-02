# Arrangement Sub-project 2: Writing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blog's card grid and centred post column with the Arrangement language: the writing index as a vertical track, the essay page with a track segment and a "Written while" sidebar computed from the timeline, and the newsletter restyled.

**Architecture:** A pure module `src/lib/timeline/track.ts` turns essays and timeline items into `TrackRow`s (index rows, the sidebar segment, the written-while list) and computes reading time; a UTC date module `src/lib/dates.ts` formats every date the blog prints. One Astro component, `Track.astro`, renders rows at two densities. The index page and the essay route feed it; the essay route also calls the existing `getTimeline()` for the sidebar. Nothing new runs in the browser.

**Tech Stack:** Astro 5 (legacy content collections: `entry.slug`, `entry.body`, `entry.render()`), TypeScript, Vitest 4, Playwright (screenshots only), CSS with the tokens in `src/styles/global.css`.

**Spec:** `docs/superpowers/specs/2026-09-02-arrangement-writing-design.md` (read it first; the section numbers below refer to it). The foundation spec `docs/superpowers/specs/2026-09-02-arrangement-foundation-home-design.md` defines the language and the timeline model this builds on.

## Global Constraints

- All calendar math and formatting is UTC. Content dates are UTC midnight. Never call `getFullYear`, `toLocaleDateString` without `timeZone: "UTC"`, or any local-time accessor on a content date. Use `src/lib/dates.ts`.
- Pure modules under `src/lib/` import siblings with the `.js` suffix (`import { effectiveEnd } from "./layout.js"`), as `sources.ts` does. Astro files import without a suffix.
- Only tokens from `src/styles/global.css` for colour, type, radius, and spacing; the one addition is `--color-text-reading: #DDDBD4` (Task 7). No `--color-accent` on these pages.
- The responsive breakpoint is 900px, written `@media (max-width: 899.98px)` as the home page does.
- No client-side JavaScript beyond the newsletter's existing submit script.
- Copy on the pages is verbatim from the spec; do not rephrase headings, blurbs, or the AI note.
- No new dependencies. Vitest tests live in `__tests__` directories matching the existing `include` glob.
- Commit messages: plain conventional prefixes (`feat`, `fix`, `test`, `docs`, `chore`). Do not add `Co-Authored-By` or any agent trailer.
- Before every commit, `npm test` passes. Before Tasks 6 to 8 are committed, `npm run build` passes.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/dates.ts` (new) | Six UTC formatters. No other module formats a date. |
| `src/lib/__tests__/dates.test.ts` (new) | Pins each formatter on two dates and a near-midnight instant. |
| `src/lib/timeline/track.ts` (new) | `Essay`, `TrackRow`, `readingMinutes`, `sortEssays`, `indexRows`, `segmentRows`, `writtenWhile`. Pure. |
| `src/lib/timeline/__tests__/track.test.ts` (new) | One `describe` per function. |
| `src/components/Track.astro` (new) | Renders `TrackRow[]` as an `<ol>` with a pseudo-element gutter at `index` or `segment` density. |
| `src/components/Newsletter.astro` | Styles replaced; markup, props, script untouched. |
| `src/pages/blog/index.astro` | Rewritten: head, `Track` at index density, `Newsletter`, `Footer`. |
| `src/pages/blog/[...slug].astro` | Keeps `getStaticPaths`; computes minutes, segment, written-while; passes to the layout. |
| `src/layouts/BlogPost.astro` | Rewritten: article column and sidebar, body typography. |
| `src/styles/global.css` | Adds `--color-text-reading`. |
| `scripts/screenshots.mjs` (renamed from `home-screenshots.mjs`) | Three pages at two widths. |
| `package.json`, `CLAUDE.md` | Script path; architecture note. |

---

### Task 1: UTC date formatters

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/__tests__/dates.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `longDate(d: Date): string` ("1 September 2026"), `shortDay(d): string` ("01 Sep"), `shortDate(d): string` ("01 Sep 2026"), `monthYear(d): string` ("Sep 2026"), `monthDayYear(d): string` ("Sep 2, 2026"), `isoDay(d): string` ("2026-09-01"). All read UTC fields.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { longDate, shortDay, shortDate, monthYear, monthDayYear, isoDay } from "../dates.js";

const sep1 = new Date("2026-09-01T00:00:00Z");
const dec31 = new Date("2025-12-31T00:00:00Z");

describe("dates (spec §11, always UTC)", () => {
  it("longDate", () => {
    expect(longDate(sep1)).toBe("1 September 2026");
    expect(longDate(dec31)).toBe("31 December 2025");
  });
  it("shortDay pads the day to two digits", () => {
    expect(shortDay(sep1)).toBe("01 Sep");
    expect(shortDay(dec31)).toBe("31 Dec");
  });
  it("shortDate", () => {
    expect(shortDate(sep1)).toBe("01 Sep 2026");
    expect(shortDate(dec31)).toBe("31 Dec 2025");
  });
  it("monthYear", () => {
    expect(monthYear(sep1)).toBe("Sep 2026");
    expect(monthYear(dec31)).toBe("Dec 2025");
  });
  it("monthDayYear", () => {
    expect(monthDayYear(sep1)).toBe("Sep 1, 2026");
    expect(monthDayYear(dec31)).toBe("Dec 31, 2025");
  });
  it("isoDay", () => {
    expect(isoDay(sep1)).toBe("2026-09-01");
    expect(isoDay(dec31)).toBe("2025-12-31");
  });
  it("ignores the machine's time zone", () => {
    // 23:30 UTC on Dec 31 is already Jan 1 in zones east of UTC+0:30.
    expect(longDate(new Date("2025-12-31T23:30:00Z"))).toBe("31 December 2025");
    expect(isoDay(new Date("2025-12-31T23:30:00Z"))).toBe("2025-12-31");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/dates.test.ts`
Expected: FAIL, the module `../dates.js` cannot be resolved.

- [ ] **Step 3: Write the module**

Create `src/lib/dates.ts`:

```ts
// src/lib/dates.ts
// Every content date is UTC midnight, so every formatter reads UTC fields
// (writing spec §11). Month names are spelled out here rather than taken from
// Intl so the output is identical on every machine and Node build.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "1 September 2026" */
export function longDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "01 Sep" */
export function shortDay(d: Date): string {
  return `${pad2(d.getUTCDate())} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "01 Sep 2026" */
export function shortDate(d: Date): string {
  return `${shortDay(d)} ${d.getUTCFullYear()}`;
}

/** "Sep 2026" */
export function monthYear(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Sep 2, 2026" */
export function monthDayYear(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "2026-09-01", for <time datetime>. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/dates.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/__tests__/dates.test.ts
git commit -m "feat(dates): UTC formatters for every date the blog prints"
```

---

### Task 2: Track rows: types, reading time, index rows

**Files:**
- Create: `src/lib/timeline/track.ts`
- Test: `src/lib/timeline/__tests__/track.test.ts`

**Interfaces:**
- Consumes: `monthDayYear` from Task 1.
- Produces: `interface Essay { id; href; title; date: Date; description?; tags?; minutes? }`, `type TrackRow` (now | year | more | essay), `type EssayRow`, `WORDS_PER_MINUTE = 220`, `readingMinutes(body: string): number`, `sortEssays(essays: readonly Essay[]): Essay[]` (newest first, ties by id ascending), `indexRows(essays: readonly Essay[], now: Date): TrackRow[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/timeline/__tests__/track.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readingMinutes, sortEssays, indexRows } from "../track.js";
import type { Essay, TrackRow } from "../track.js";

const d = (s: string) => new Date(s);
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

/** Short form of a row list for assertions: essay ids (starred when current), more labels, other kinds. */
const shape = (rows: TrackRow[]) =>
  rows.map((r) => {
    if (r.kind === "essay") return `${r.id}${r.current ? "*" : ""}`;
    if (r.kind === "more") return r.label;
    if (r.kind === "year") return r.label;
    return r.kind;
  });

const essays: Essay[] = [
  { id: "essay-b", href: "/blog/b", title: "B", date: d("2026-07-22"), description: "About B", tags: ["Redis"], minutes: 3 },
  { id: "essay-c", href: "/blog/c", title: "C", date: d("2026-09-01"), minutes: 5 },
  { id: "essay-a", href: "/blog/a", title: "A", date: d("2025-12-30"), minutes: 7 },
];

describe("readingMinutes (spec §10)", () => {
  it("floors at one minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("   \n ")).toBe(1);
  });
  it("rounds to the nearest minute at 220 words per minute", () => {
    expect(readingMinutes(words(330))).toBe(2);
    expect(readingMinutes(words(110))).toBe(1);
    expect(readingMinutes(words(1100))).toBe(5);
  });
  it("counts runs of whitespace as one separator", () => {
    expect(readingMinutes("one  two\n\nthree ")).toBe(1);
  });
});

describe("sortEssays", () => {
  it("sorts newest first and breaks ties by id", () => {
    const tie: Essay[] = [
      { id: "essay-z", href: "/blog/z", title: "Z", date: d("2026-01-01") },
      { id: "essay-y", href: "/blog/y", title: "Y", date: d("2026-01-01") },
      { id: "essay-x", href: "/blog/x", title: "X", date: d("2026-02-01") },
    ];
    expect(sortEssays(tie).map((e) => e.id)).toEqual(["essay-x", "essay-y", "essay-z"]);
  });
  it("does not mutate its input", () => {
    const copy = [...essays];
    sortEssays(essays);
    expect(essays).toEqual(copy);
  });
});

describe("indexRows (spec §6)", () => {
  const rows = indexRows(essays, d("2026-09-02"));

  it("starts with a now row carrying the build date", () => {
    expect(rows[0]).toEqual({ kind: "now", label: "Sep 2, 2026" });
  });
  it("orders essays newest first with a year row before the first essay of each year", () => {
    expect(shape(rows)).toEqual(["now", "2026", "essay-c", "essay-b", "2025", "essay-a"]);
  });
  it("carries the index fields on essay rows", () => {
    expect(rows[3]).toEqual({
      kind: "essay",
      id: "essay-b",
      href: "/blog/b",
      title: "B",
      date: d("2026-07-22"),
      minutes: 3,
      description: "About B",
      tags: ["Redis"],
    });
  });
  it("uses the UTC year for year rows", () => {
    // 2025-12-31T23:30Z is still 2025 in UTC even though it is 2026 east of UTC+0:30.
    const late: Essay[] = [{ id: "essay-l", href: "/blog/l", title: "L", date: d("2025-12-31T23:30:00Z") }];
    expect(shape(indexRows(late, d("2026-09-02")))).toEqual(["now", "2025", "essay-l"]);
  });
  it("yields only the now row when there are no essays", () => {
    expect(indexRows([], d("2026-09-02"))).toEqual([{ kind: "now", label: "Sep 2, 2026" }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `../track.js` cannot be resolved.

- [ ] **Step 3: Write the module**

Create `src/lib/timeline/track.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: 10 passed. (`toEqual` treats a property set to `undefined` the same as an absent one, which is why the essay-row assertion passes for rows built from essays without a description.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts
git commit -m "feat(track): essay rows for the writing index, reading time"
```

---

### Task 3: The sidebar segment

**Files:**
- Modify: `src/lib/timeline/track.ts` (append)
- Test: `src/lib/timeline/__tests__/track.test.ts` (append)

**Interfaces:**
- Consumes: `Essay`, `TrackRow`, `sortEssays`, `monthDayYear` from Tasks 1 and 2.
- Produces: `segmentRows(essays: readonly Essay[], currentId: string, now: Date): TrackRow[]`. Throws `Error("Unknown essay: <id>")` for an id not in the list.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/timeline/__tests__/track.test.ts` (add `segmentRows` to the import from `../track.js`):

```ts
describe("segmentRows (spec §7)", () => {
  const now = d("2026-09-02");
  const five: Essay[] = [
    { id: "essay-a", href: "/blog/a", title: "A", date: d("2025-12-21") },
    { id: "essay-b", href: "/blog/b", title: "B", date: d("2025-12-30") },
    { id: "essay-c", href: "/blog/c", title: "C", date: d("2026-05-16") },
    { id: "essay-d", href: "/blog/d", title: "D", date: d("2026-07-22") },
    { id: "essay-e", href: "/blog/e", title: "E", date: d("2026-09-01") },
  ];

  it("newest essay: now head, itself, the older neighbour, an older tail", () => {
    expect(shape(segmentRows(five, "essay-e", now))).toEqual(["now", "essay-e*", "essay-d", "3 older, all essays"]);
    expect(segmentRows(five, "essay-e", now)[0]).toEqual({ kind: "now", label: "Sep 2, 2026" });
  });
  it("second essay: singular newer head", () => {
    expect(shape(segmentRows(five, "essay-d", now))).toEqual([
      "1 newer, all essays", "essay-e", "essay-d*", "essay-c", "2 older, all essays",
    ]);
  });
  it("middle essay: both neighbours and both counts", () => {
    expect(shape(segmentRows(five, "essay-c", now))).toEqual([
      "2 newer, all essays", "essay-d", "essay-c*", "essay-b", "1 older, all essays",
    ]);
  });
  it("oldest essay: newer head, the newer neighbour, itself, no tail", () => {
    expect(shape(segmentRows(five, "essay-a", now))).toEqual(["4 newer, all essays", "essay-b", "essay-a*"]);
  });
  it("a single essay: now and itself", () => {
    expect(shape(segmentRows([five[0]], "essay-a", now))).toEqual(["now", "essay-a*"]);
  });
  it("more rows link to the index", () => {
    const rows = segmentRows(five, "essay-c", now);
    expect(rows[0]).toEqual({ kind: "more", label: "2 newer, all essays", href: "/blog" });
    expect(rows[4]).toEqual({ kind: "more", label: "1 older, all essays", href: "/blog" });
  });
  it("segment essay rows carry id, href, title, date only", () => {
    const rich: Essay[] = [{ ...five[4], description: "x", tags: ["t"], minutes: 9 }];
    expect(segmentRows(rich, "essay-e", now)[1]).toEqual({
      kind: "essay", id: "essay-e", href: "/blog/e", title: "E", date: d("2026-09-01"), current: true,
    });
  });
  it("throws for an unknown id", () => {
    expect(() => segmentRows(five, "essay-zzz", now)).toThrow("Unknown essay: essay-zzz");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `segmentRows` is not exported.

- [ ] **Step 3: Write the function**

Append to `src/lib/timeline/track.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: 18 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts
git commit -m "feat(track): sidebar segment with newer and older neighbours"
```

---

### Task 4: Written while

**Files:**
- Modify: `src/lib/timeline/track.ts` (append)
- Test: `src/lib/timeline/__tests__/track.test.ts` (append)

**Interfaces:**
- Consumes: `TimelineItem`, `Lane` from `./types.js`; `effectiveEnd(item, now)` from `./layout.js` (returns `item.end`, else `now` for a span, else `item.start`).
- Produces: `MOMENT_WINDOW_DAYS = 14`, `writtenWhile(items: readonly TimelineItem[], published: Date, now: Date): TimelineItem[]`.

**Execution note:** the session controller may reserve Step 3 for the human partner as a learning exercise (the tests in Step 1 are the contract). The code in Step 3 is the reference implementation the tests expect; use it when the exercise is declined or when the human's version needs a comparison.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/timeline/__tests__/track.test.ts` (add `writtenWhile` to the import from `../track.js`, and add `import type { TimelineItem } from "../types.js";` at the top):

```ts
describe("writtenWhile (spec §8)", () => {
  const now = d("2026-09-02");
  const published = d("2026-09-01");

  const item = (o: Partial<TimelineItem> & Pick<TimelineItem, "id" | "lane" | "start" | "kind">): TimelineItem => ({
    title: o.id,
    status: "done",
    href: `/#item-${o.id}`,
    ...o,
  });

  const daw = item({ id: "daw-engine", lane: "building", start: d("2026-06-01"), kind: "span", status: "in-progress" });
  const roaming = item({ id: "roaming-camp", lane: "building", start: d("2025-03-01"), end: d("2026-06-30"), kind: "span", status: "live" });
  const endsDayBefore = item({ id: "ends-before", lane: "building", start: d("2026-01-01"), end: d("2026-08-31"), kind: "span" });
  const ddia = item({ id: "ddia", lane: "learning", start: d("2026-01-10"), kind: "span", status: "in-progress" });
  const planned = item({ id: "planned", lane: "learning", start: d("2026-10-01"), end: d("2026-12-01"), kind: "span", status: "planned" });
  const talk14before = item({ id: "talk-14-before", lane: "community", start: d("2026-08-18"), kind: "moment" });
  const talk15before = item({ id: "talk-15-before", lane: "community", start: d("2026-08-17"), kind: "moment" });
  const talk14after = item({ id: "talk-14-after", lane: "community", start: d("2026-09-15"), kind: "moment" });
  const essay = item({ id: "essay-other", lane: "writing", start: d("2026-09-01"), kind: "moment", href: "/blog/other" });

  const all = [essay, talk14after, talk15before, talk14before, planned, ddia, endsDayBefore, roaming, daw];

  it("includes spans that contain the date, including in-progress spans with no end", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).toContain("daw-engine");
    expect(ids).toContain("ddia");
  });
  it("excludes spans that ended before the date or start after it", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).not.toContain("roaming-camp");
    expect(ids).not.toContain("ends-before");
    expect(ids).not.toContain("planned");
  });
  it("treats a span's start and end as inclusive", () => {
    expect(writtenWhile([roaming], d("2026-06-30"), now).map((i) => i.id)).toEqual(["roaming-camp"]);
    expect(writtenWhile([roaming], d("2025-03-01"), now).map((i) => i.id)).toEqual(["roaming-camp"]);
  });
  it("includes moments within 14 days either side, inclusive, and excludes the 15th day", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).toContain("talk-14-before");
    expect(ids).toContain("talk-14-after");
    expect(ids).not.toContain("talk-15-before");
  });
  it("never includes the writing lane", () => {
    expect(writtenWhile(all, published, now).map((i) => i.lane)).not.toContain("writing");
  });
  it("orders building, learning, community, then by start, then by id", () => {
    const ids = writtenWhile(all, published, now).map((i) => i.id);
    expect(ids).toEqual(["daw-engine", "ddia", "talk-14-before", "talk-14-after"]);
    const both = writtenWhile([daw, roaming], d("2026-06-15"), now).map((i) => i.id);
    expect(both).toEqual(["roaming-camp", "daw-engine"]);
  });
  it("returns an empty list when nothing overlaps", () => {
    expect(writtenWhile(all, d("2020-01-01"), now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timeline/__tests__/track.test.ts`
Expected: FAIL, `writtenWhile` is not exported.

- [ ] **Step 3: Write the function**

Add to the imports at the top of `src/lib/timeline/track.ts`:

```ts
import type { Lane, TimelineItem } from "./types.js";
import { effectiveEnd } from "./layout.js";
```

Append to the module:

```ts
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
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all pass (198 before this plan, plus 7 in Task 1 and 25 in this file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/track.ts src/lib/timeline/__tests__/track.test.ts
git commit -m "feat(track): written-while list from the other lanes"
```

---

### Task 5: Newsletter restyle

**Files:**
- Modify: `src/components/Newsletter.astro` (the `<style>` block only)

**Interfaces:**
- Consumes: tokens from `src/styles/global.css`.
- Produces: the same component, props `heading?`, `blurb?`, unchanged. It now fills its container; callers set the width.

- [ ] **Step 1: Replace the styles**

In `src/components/Newsletter.astro`, leave the frontmatter, the markup, and the `<script>` exactly as they are. Replace the entire `<style>` block with:

```astro
<style>
  /* Writing spec §9. The markup order is heading, blurb, form, message; the
     grid areas put the form beside the text at desktop and keep the status
     line under both. */
  .newsletter {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "heading form"
      "blurb form"
      "message message";
    column-gap: 32px;
    align-items: center;
    padding: 26px 28px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--lane-writing);
    border-radius: var(--radius-md);
  }

  .newsletter-heading {
    grid-area: heading;
    align-self: end;
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.015em;
    line-height: 1.2;
    margin-bottom: 6px;
    color: var(--color-text-primary);
  }

  .newsletter-blurb {
    grid-area: blurb;
    align-self: start;
    font-size: 15px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .newsletter-form {
    grid-area: form;
    display: flex;
    gap: 10px;
  }

  .newsletter-input {
    flex: 1 1 160px;
    min-width: 0;
    padding: 11px 14px;
    font: 15px var(--font-sans);
    color: var(--color-text-primary);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color var(--transition-base);
  }

  .newsletter-input:focus {
    border-color: var(--lane-writing);
  }

  .newsletter-input:focus-visible {
    outline: 2px solid var(--lane-writing);
    outline-offset: 2px;
  }

  .newsletter-button {
    padding: 11px 18px;
    font: 500 15px var(--font-sans);
    color: var(--color-bg);
    background: var(--lane-writing);
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-base);
  }

  .newsletter-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--lane-writing) 88%, white);
  }

  .newsletter-button:focus-visible {
    outline: 2px solid var(--lane-writing);
    outline-offset: 2px;
  }

  .newsletter-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Stays in flow while empty (zero height, no margin) so the aria-live
     region is in the accessibility tree before the script fills it. */
  .newsletter-message {
    grid-area: message;
    font-size: 14px;
    line-height: 1.4;
    color: var(--color-text-muted);
  }

  .newsletter-message:not(:empty) {
    margin-top: 12px;
  }

  .newsletter-message[data-state="success"] {
    color: var(--lane-writing);
  }

  .newsletter-message[data-state="error"] {
    color: #ff7676;
  }

  @media (max-width: 899.98px) {
    .newsletter {
      grid-template-columns: 1fr;
      grid-template-areas:
        "heading"
        "blurb"
        "form"
        "message";
      padding: 22px 20px;
    }
    .newsletter-form {
      flex-direction: column;
      margin-top: 16px;
    }
  }
</style>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: the build succeeds (the component is used by the blog pages that still exist at this point).

- [ ] **Step 3: Commit**

```bash
git add src/components/Newsletter.astro
git commit -m "feat(newsletter): console panel in the writing lane colour"
```

---

### Task 6: Track component and the writing index

**Files:**
- Create: `src/components/Track.astro`
- Rewrite: `src/pages/blog/index.astro`

**Interfaces:**
- Consumes: `TrackRow`, `Essay`, `indexRows`, `readingMinutes`, `sortEssays` from `src/lib/timeline/track`; `isoDay`, `shortDay`, `shortDate`, `monthYear` from `src/lib/dates`; `TransportBar` (`active`, `showZoom`), `Newsletter` (`heading`, `blurb`), `Footer`, `Layout` (`title`, `description`, `image`), `ogImagePath` from `src/lib/og.mjs`.
- Produces: `Track.astro` with props `{ rows: TrackRow[]; density: "index" | "segment" }`. Task 7 uses it at `segment` density.

- [ ] **Step 1: Create the component**

Create `src/components/Track.astro`:

```astro
---
// src/components/Track.astro
// The Writing lane as a vertical track (writing spec §6): one <ol>, a gutter
// drawn in pseudo-elements, one <li> per row. `index` density has a mono
// column for the day and reading time; `segment` density is the sidebar's
// short excerpt. There is exactly one link per essay row, stretched over the
// whole row with a pseudo-element.
import type { TrackRow } from "../lib/timeline/track";
import { isoDay, shortDate, shortDay } from "../lib/dates";

interface Props {
  rows: TrackRow[];
  density: "index" | "segment";
}

const { rows, density } = Astro.props;
const index = density === "index";
---

<ol class:list={["track", `track-${density}`]}>
  {
    rows.map((row) => {
      if (row.kind === "now") {
        return (
          <li class="tr tr-now">
            {index ? (
              <>
                <span class="tr-meta">now</span>
                <span class="tr-body">{row.label}</span>
              </>
            ) : (
              <span class="tr-body">now, {row.label}</span>
            )}
          </li>
        );
      }
      if (row.kind === "year") {
        return (
          <li class="tr tr-year">
            <span class="tr-meta">{row.label}</span>
          </li>
        );
      }
      if (row.kind === "more") {
        return (
          <li class="tr tr-more">
            <span class="tr-body">
              <a href={row.href}>{row.label}</a>
            </span>
          </li>
        );
      }
      return (
        <li class:list={["tr", "tr-essay", { "is-current": row.current }]}>
          {index && (
            <span class="tr-meta">
              <time datetime={isoDay(row.date)}>{shortDay(row.date)}</time>
              {row.minutes !== undefined && <small>{row.minutes} min</small>}
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
            {!index && <time class="tr-date" datetime={isoDay(row.date)}>{shortDate(row.date)}</time>}
            {row.description && <p class="tr-desc">{row.description}</p>}
            {row.tags && row.tags.length > 0 && <small class="tr-tags">{row.tags.join(", ")}</small>}
          </span>
        </li>
      );
    })
  }
</ol>

<style>
  .track {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .tr {
    position: relative;
    display: grid;
    --node-y: 4px;
  }
  .track-index .tr {
    grid-template-columns: 48px 120px 1fr;
  }
  .track-segment .tr {
    grid-template-columns: 28px 1fr;
    padding-bottom: 18px;
  }
  .track-segment .tr:last-child {
    padding-bottom: 0;
  }

  /* Gutter (spec §6, §13): decorative, so it lives in pseudo-elements. The
     line runs the full height of every row except the first (starts at its
     node) and the last (ends at its node). */
  .tr::before {
    content: "";
    position: absolute;
    left: 11px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: color-mix(in srgb, var(--lane-writing) 55%, var(--color-bg));
  }
  .tr:first-child::before {
    top: var(--node-y);
  }
  .tr:last-child::before {
    bottom: auto;
    height: var(--node-y);
  }
  .tr::after {
    content: "";
    position: absolute;
    left: 6px;
    top: var(--node-y);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--lane-writing);
    border: 2px solid var(--color-bg);
  }
  .tr-now::after {
    background: var(--color-text-primary);
  }
  .tr-more::after {
    background: transparent;
    border-color: color-mix(in srgb, var(--lane-writing) 55%, var(--color-bg));
  }
  .tr-year::after {
    content: none;
  }
  .is-current::after {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--lane-writing) 35%, transparent);
  }

  /* Index density */
  .track-index .tr-now {
    --node-y: 8px;
    padding: 6px 0 10px;
  }
  .track-index .tr-now .tr-meta,
  .track-index .tr-now .tr-body {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.8;
    color: var(--color-text-muted);
  }
  .track-index .tr-year {
    padding-top: 22px;
  }
  .track-index .tr-year .tr-meta {
    font-size: 12px;
    line-height: 1.5;
  }
  .track-index .tr-essay {
    --node-y: 30px;
  }
  .track-index .tr-essay > * {
    border-bottom: 1px solid var(--color-border);
  }
  .track-index .tr-essay:last-child > * {
    border-bottom: 0;
  }
  .track-index .tr-essay .tr-meta {
    padding-top: 28px;
  }
  .track-index .tr-essay .tr-body {
    padding: 22px 0 24px;
  }
  .tr-meta {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.8;
    color: var(--color-text-muted);
  }
  .tr-meta small {
    display: block;
    font-size: 11px;
    color: var(--color-text-faint);
  }

  /* Titles and text */
  .tr-title {
    margin: 0;
  }
  .track-index .tr-title {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.015em;
    max-width: 26ch;
    margin-bottom: 8px;
  }
  .track-segment .tr-title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }
  .tr-title a {
    color: var(--color-text-primary);
  }
  .tr-title a::after {
    content: "";
    position: absolute;
    inset: 0;
  }
  .tr-essay:hover .tr-title a,
  .is-current .tr-title a {
    color: var(--lane-writing);
  }
  .tr-title a:focus-visible,
  .tr-more a:focus-visible {
    outline: 2px solid var(--lane-writing);
    outline-offset: 2px;
  }
  .tr-desc {
    margin: 0 0 10px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--color-text-secondary);
    max-width: 60ch;
  }
  .tr-tags {
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .tr-date {
    display: block;
    margin-top: 2px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-muted);
  }

  /* Segment density */
  .track-segment .tr-now .tr-body {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }
  .track-segment .tr-more .tr-body {
    font-size: 13px;
    line-height: 1.6;
  }
  .tr-more a {
    color: var(--lane-writing);
    border-bottom: 1px solid color-mix(in srgb, var(--lane-writing) 40%, transparent);
  }

  @media (max-width: 899.98px) {
    .track-index .tr {
      grid-template-columns: 28px 1fr;
    }
    .track-index .tr-now {
      grid-template-columns: 28px auto 1fr;
    }
    .track-index .tr-now .tr-meta {
      grid-column: 2;
      padding-right: 8px;
    }
    .track-index .tr-now .tr-body {
      grid-column: 3;
    }
    .track-index .tr-year .tr-meta,
    .track-index .tr-essay .tr-meta,
    .track-index .tr-essay .tr-body {
      grid-column: 2;
    }
    .track-index .tr-essay {
      --node-y: 22px;
    }
    .track-index .tr-essay .tr-meta {
      display: flex;
      padding-top: 18px;
      line-height: 1.5;
      border-bottom: 0;
    }
    .track-index .tr-essay .tr-meta small {
      display: inline;
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .track-index .tr-essay .tr-meta small::before {
      content: ", ";
    }
    .track-index .tr-essay .tr-body {
      padding-top: 6px;
    }
    .track-index .tr-title {
      font-size: 22px;
    }
  }
</style>
```

- [ ] **Step 2: Rewrite the index page**

Replace the whole of `src/pages/blog/index.astro` with:

```astro
---
// src/pages/blog/index.astro
// The writing index (writing spec §4): page head, the Writing lane as a
// vertical track, the newsletter, the footer. Drafts show in development only.
import Layout from "../../layouts/Layout.astro";
import TransportBar from "../../components/TransportBar.astro";
import Track from "../../components/Track.astro";
import Newsletter from "../../components/Newsletter.astro";
import Footer from "../../components/Footer.astro";
import { getCollection } from "astro:content";
import { ogImagePath } from "../../lib/og.mjs";
import { indexRows, readingMinutes, sortEssays } from "../../lib/timeline/track";
import type { Essay } from "../../lib/timeline/track";
import { monthYear } from "../../lib/dates";

const includeDrafts = !import.meta.env.PROD;
const posts = await getCollection("blog", ({ data }) => includeDrafts || !data.draft);

const essays: Essay[] = posts.map((p) => ({
  id: `essay-${p.slug}`,
  href: `/blog/${p.slug}`,
  title: p.data.title,
  date: p.data.pubDate,
  description: p.data.description,
  tags: p.data.tags,
  minutes: readingMinutes(p.body),
}));

const now = new Date();
const rows = indexRows(essays, now);

const sorted = sortEssays(essays);
const count = `${sorted.length} ${sorted.length === 1 ? "essay" : "essays"}`;
let range = "";
if (sorted.length > 0) {
  const from = monthYear(sorted[sorted.length - 1].date);
  const to = monthYear(sorted[0].date);
  range = from === to ? from : `${from} to ${to}`;
}
---

<Layout
  title="Writing | Sean Campbell"
  description="Thoughts on software engineering, architecture patterns, and lessons from production systems."
  image={ogImagePath("blog")}
>
  <TransportBar active="writing" />

  <main class="writing">
    <header class="head">
      <div>
        <h1>Writing</h1>
        <p class="lede">Thoughts and lessons learned along my Software Engineering journey.</p>
        <p class="note">
          Note: Light AI usage in my blog posts. I do not let AI run rampant, and you are getting my voice and
          opinions in my posts.
        </p>
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
      <Track rows={rows} density="index" />
      <div class="subscribe">
        <Newsletter heading="Stay in the loop" blurb="Get new posts in your inbox. No spam, unsubscribe anytime." />
      </div>
    </div>
  </main>

  <Footer />
</Layout>

<style>
  .writing {
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
  .note {
    max-width: 60ch;
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-text-muted);
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
  .subscribe {
    margin-top: 40px;
  }

  @media (max-width: 899.98px) {
    .writing {
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
    .subscribe {
      margin-top: 32px;
    }
  }
</style>
```

- [ ] **Step 3: Build and look**

Run: `npm run build`
Expected: succeeds; `dist/blog/index.html` contains `<ol class="track track-index` and one `<li class="tr tr-essay` per published post (5 today).

Then, in one terminal, `npm run preview`, and in another `node scripts/home-screenshots.mjs` still works for the home page; open `http://localhost:4321/blog` in a browser or shoot it with Playwright (a one-off script is fine) at 1280 and 390 wide. Check: the now node is at the top, the gold line runs down the gutter, year labels sit in the mono column at desktop and above the title on the phone, every row is clickable across its width, and the newsletter is two columns at desktop and stacked on the phone.

- [ ] **Step 4: Run the suite and commit**

Run: `npm test`
Expected: all pass.

```bash
git add src/components/Track.astro src/pages/blog/index.astro
git commit -m "feat(writing): index as the Writing lane's vertical track"
```

---

### Task 7: Essay page

**Files:**
- Rewrite: `src/layouts/BlogPost.astro`
- Rewrite: `src/pages/blog/[...slug].astro`
- Modify: `src/styles/global.css` (one token)

**Interfaces:**
- Consumes: `Track.astro` (`rows`, `density="segment"`), `segmentRows(essays, currentId, now)`, `writtenWhile(items, published, now)`, `readingMinutes(body)`, `Essay` from `src/lib/timeline/track`; `getTimeline()` from `src/lib/timeline/astro` (returns `{ items, now, projects }`); `TimelineItem`, `Status` from `src/lib/timeline/types`; `isoDay`, `longDate` from `src/lib/dates`.
- Produces: `BlogPost.astro` props `{ entry: CollectionEntry<"blog">; minutes: number; segment: TrackRow[]; writtenWhile: TimelineItem[] }` with the rendered post in the default slot.

- [ ] **Step 1: Add the reading token**

In `src/styles/global.css`, directly after the line `--color-text-faint: #7A7D7A;`, add:

```css
    /* Long-form body text (writing spec §5): between primary and secondary. */
    --color-text-reading: #DDDBD4;
```

- [ ] **Step 2: Rewrite the route**

Replace the whole of `src/pages/blog/[...slug].astro` with:

```astro
---
// src/pages/blog/[...slug].astro
// One page per published essay. The sidebar's segment and written-while list
// come from the same timeline the home page renders (writing spec §5, §12).
import { type CollectionEntry, getCollection } from "astro:content";
import BlogPost from "../../layouts/BlogPost.astro";
import { getTimeline } from "../../lib/timeline/astro";
import { readingMinutes, segmentRows, writtenWhile } from "../../lib/timeline/track";
import type { Essay } from "../../lib/timeline/track";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { entry: post },
  }));
}

interface Props {
  entry: CollectionEntry<"blog">;
}

const { entry } = Astro.props;
const { Content } = await entry.render();

const { items, now } = await getTimeline();
const essays: Essay[] = items
  .filter((item) => item.lane === "writing")
  .map((item) => ({ id: item.id, href: item.href, title: item.title, date: item.start }));

const segment = segmentRows(essays, `essay-${entry.slug}`, now);
const around = writtenWhile(items, entry.data.pubDate, now);
const minutes = readingMinutes(entry.body);
---

<BlogPost entry={entry} minutes={minutes} segment={segment} writtenWhile={around}>
  <Content />
</BlogPost>
```

- [ ] **Step 3: Rewrite the layout**

Replace the whole of `src/layouts/BlogPost.astro` with:

```astro
---
// src/layouts/BlogPost.astro
// The essay page (writing spec §5): an article column with kicker, title,
// standfirst, tags, hero, body, newsletter; a sidebar with the track segment
// (§7) and the "Written while" list (§8). One column below 900px in the order
// article, newsletter, sidebar.
import type { CollectionEntry } from "astro:content";
import Layout from "./Layout.astro";
import TransportBar from "../components/TransportBar.astro";
import Track from "../components/Track.astro";
import Newsletter from "../components/Newsletter.astro";
import Footer from "../components/Footer.astro";
import type { TrackRow } from "../lib/timeline/track";
import type { Status, TimelineItem } from "../lib/timeline/types";
import { isoDay, longDate } from "../lib/dates";

interface Props {
  entry: CollectionEntry<"blog">;
  minutes: number;
  segment: TrackRow[];
  writtenWhile: TimelineItem[];
}

const { entry, minutes, segment, writtenWhile } = Astro.props;
const { title, description, pubDate, updatedDate, heroImage, tags } = entry.data;

const STATUS_WORD: Record<Status, string> = {
  done: "done",
  live: "live",
  "in-progress": "in progress",
  planned: "planned",
};
---

<Layout title={`${title} | Sean Campbell`} description={description} image={heroImage}>
  <TransportBar active="writing" />

  <main class="essay">
    <article class="article">
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
    </article>

    <aside class="aside">
      <p class="kicker">
        <i class="sq"></i>
        <span>Writing</span>
      </p>
      <Track rows={segment} density="segment" />
      {writtenWhile.length > 0 && (
        <section class="while">
          <p class="kicker">
            <i class="sq sq-muted"></i>
            <span>Written while</span>
          </p>
          <ul class="while-list">
            {writtenWhile.map((item) => (
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
    </aside>
  </main>

  <Footer />
</Layout>

<style>
  .essay {
    max-width: 1160px;
    margin: 0 auto;
    padding: 110px 40px var(--space-4xl);
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 56px;
    align-items: start;
  }

  .kicker {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .sq {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--lane-writing);
  }
  .sq-muted {
    background: var(--color-text-muted);
  }

  /* Article column */
  .article h1 {
    font-size: clamp(2.4rem, 4.8vw, 3.6rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.025em;
    margin: 0 0 16px;
  }
  .standfirst {
    font-size: 21px;
    line-height: 1.45;
    color: var(--color-text-secondary);
    margin: 0 0 12px;
  }
  .tags {
    font-size: 13px;
    color: var(--color-text-muted);
    margin: 0 0 36px;
  }
  .standfirst:last-of-type {
    margin-bottom: 36px;
  }
  .hero {
    width: 100%;
    border-radius: var(--radius-md);
    margin-bottom: 36px;
  }
  .subscribe {
    margin-top: 48px;
  }

  /* Body typography (spec §5) */
  .body {
    font-size: 17.5px;
    line-height: 1.65;
    color: var(--color-text-reading);
  }
  .body :global(p) {
    margin: 0 0 22px;
    max-width: 64ch;
  }
  .body :global(h2) {
    font-size: 26px;
    margin: 48px 0 16px;
    color: var(--color-text-primary);
  }
  .body :global(h3) {
    font-size: 20px;
    margin: 32px 0 12px;
    color: var(--color-text-primary);
  }
  .body :global(strong) {
    color: var(--color-text-primary);
  }
  .body :global(a) {
    color: var(--lane-writing);
    border-bottom: 1px solid color-mix(in srgb, var(--lane-writing) 40%, transparent);
  }
  .body :global(a:hover) {
    color: var(--color-text-primary);
  }
  .body :global(a:focus-visible) {
    outline: 2px solid var(--lane-writing);
    outline-offset: 2px;
  }
  .body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--color-bg-elevated);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }
  .body :global(pre) {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 24px;
    overflow-x: auto;
    margin: 0 0 22px;
  }
  .body :global(pre code) {
    background: none;
    padding: 0;
  }
  .body :global(blockquote) {
    margin: 0 0 22px;
    padding: 2px 0 2px 20px;
    border-left: 3px solid var(--lane-writing);
    font-size: 19px;
    line-height: 1.5;
    font-style: italic;
    color: var(--color-text-primary);
  }
  .body :global(ul),
  .body :global(ol) {
    margin: 0 0 22px;
    padding-left: 32px;
  }
  .body :global(li) {
    margin-bottom: 8px;
  }
  .body :global(img),
  .body :global(video) {
    width: 100%;
    border-radius: var(--radius-md);
    margin: 0 0 22px;
  }
  .body :global(hr) {
    border: 0;
    border-top: 1px solid var(--color-border);
    margin: 32px 0;
  }

  /* Sidebar */
  .aside {
    padding-top: 8px;
    font-size: 14px;
  }
  .aside .kicker {
    margin-bottom: 14px;
  }
  .while {
    margin-top: 30px;
  }
  .while-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .while-list li {
    display: grid;
    grid-template-columns: 10px 1fr;
    gap: 12px;
    align-items: start;
    padding: 10px 0;
    border-top: 1px solid var(--color-border);
  }
  .while-list .dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-top: 5px;
    background: var(--c);
  }
  .while-list a {
    display: block;
    font-weight: 500;
    color: var(--color-text-primary);
  }
  .while-list a:hover {
    color: var(--c);
  }
  .while-list a:focus-visible {
    outline: 2px solid var(--c);
    outline-offset: 2px;
  }
  .while-list small {
    display: block;
    font-size: 12.5px;
    color: var(--color-text-muted);
  }

  @media (max-width: 899.98px) {
    .essay {
      display: block;
      padding: 84px 20px var(--space-3xl);
    }
    .article h1 {
      font-size: 34px;
    }
    .standfirst {
      font-size: 18px;
    }
    .body {
      font-size: 16.5px;
    }
    .aside {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border);
    }
  }
</style>
```

- [ ] **Step 4: Build and look**

Run: `npm run build`
Expected: succeeds with one page per published post. In `dist/blog/i-wont-stop-coding/index.html`: the kicker reads `Essay, 1 September 2026, ` followed by the computed minutes; the sidebar contains `class="track track-segment"` with `is-current` on the essay's own row and `aria-current="page"` on its link; the "Written while" list holds the in-progress project and the in-progress learning items (their spans contain 2026-09-01).

Preview the page at 1280 and 390 wide. Check: no strip above the title; the sidebar's now node is white and the current node ringed; the body reads in the lighter reading colour; on the phone the order is article, newsletter, then the sidebar under a rule.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test`
Expected: all pass.

```bash
git add src/styles/global.css src/pages/blog/[...slug].astro src/layouts/BlogPost.astro
git commit -m "feat(writing): essay page with track segment and written-while sidebar"
```

---

### Task 8: Screenshots and documentation

**Files:**
- Rename: `scripts/home-screenshots.mjs` to `scripts/screenshots.mjs` (content replaced)
- Modify: `package.json` (the `shots` script)
- Modify: `CLAUDE.md` (two lines and one paragraph)

**Interfaces:**
- Consumes: the preview server at `http://localhost:4321` (or `SHOT_BASE_URL`).
- Produces: six files in `screenshots/`: `home-1280.png`, `home-390.png`, `writing-1280.png`, `writing-390.png`, `essay-1280.png`, `essay-390.png`.

- [ ] **Step 1: Replace the script**

```bash
git mv scripts/home-screenshots.mjs scripts/screenshots.mjs
```

Replace the whole of `scripts/screenshots.mjs` with:

```js
// scripts/screenshots.mjs
// Full-page screenshots of the home page, the writing index, and one essay at
// desktop and phone widths, for review. Run against `npm run preview`
// (default) or SHOT_BASE_URL. Output goes to screenshots/ (gitignored).
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = (process.env.SHOT_BASE_URL ?? "http://localhost:4321").replace(/\/$/, "");
const OUT_DIR = "screenshots";
const PAGES = [
  { name: "home", path: "/" },
  { name: "writing", path: "/blog" },
  { name: "essay", path: "/blog/i-wont-stop-coding" },
];
const WIDTHS = [
  { name: "1280", width: 1280, height: 900 },
  { name: "390", width: 390, height: 844 },
];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let failures = 0;
  for (const page of PAGES) {
    for (const size of WIDTHS) {
      const name = `${page.name}-${size.name}`;
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 2,
        colorScheme: "dark",
      });
      try {
        const tab = await context.newPage();
        await tab.goto(`${BASE_URL}${page.path}`, { waitUntil: "networkidle", timeout: 30000 });
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForTimeout(800);
        await tab.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
        console.log(`✓ ${name}`);
      } catch (err) {
        failures++;
        console.error(`✗ ${name}\n`, err);
      } finally {
        await context.close();
      }
    }
  }
  await browser.close();
  if (failures) process.exit(1);
}

run();
```

- [ ] **Step 2: Point the npm script at it**

In `package.json`, change the `shots` line to:

```json
    "shots": "node scripts/screenshots.mjs",
```

- [ ] **Step 3: Update CLAUDE.md**

Replace the `npm run shots` bullet under "Build & Development Commands" with:

```markdown
- `npm run shots` — Full-page screenshots of the home page, the writing index, and one essay at desktop and phone widths (`screenshots/`, gitignored). Needs `npm run preview` running.
```

In the "Architecture" section, after the **Timeline data** paragraph, add:

```markdown
**Writing pages:** `src/pages/blog/index.astro` renders the Writing lane as a vertical track (`src/components/Track.astro`, rows built by `src/lib/timeline/track.ts`). `src/pages/blog/[...slug].astro` renders an essay through `src/layouts/BlogPost.astro`, whose sidebar holds a short segment of the same track (newer and older neighbours) and a "Written while" list computed from the timeline (spans overlapping the publish date, moments within 14 days). Reading time is computed from the MDX body. Every date the blog prints goes through `src/lib/dates.ts`, which formats in UTC.
```

In the same **Timeline data** paragraph, change `layout.ts (zoom windows, positions, row packing, ruler ticks, graph layout).` to `layout.ts (zoom windows, positions, row packing, ruler ticks, graph layout), track.ts (the writing index rows, the essay sidebar segment, written-while, reading time).`

- [ ] **Step 4: Run it**

In one terminal: `npm run build && npm run preview`. In another: `npm run shots`.
Expected: six `✓` lines and six files in `screenshots/`. Open `writing-1280.png`, `writing-390.png`, `essay-1280.png`, and `essay-390.png` and check them against the spec's §4 to §6 descriptions. Stop the preview server afterwards.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test`
Expected: all pass.

```bash
git add scripts/screenshots.mjs package.json CLAUDE.md
git commit -m "chore: screenshot the writing pages; document the track"
```

---

## Self-review notes

Spec coverage: §4 index (Task 6), §5 essay page and body typography (Task 7), §6 track component and `indexRows` (Tasks 2, 6), §7 segment (Task 3), §8 written while (Task 4), §9 newsletter (Task 5), §10 reading time (Task 2), §11 dates (Task 1), §12 files (all), §13 accessibility (Tasks 6, 7: real list, one link per row, `aria-current`, `<time datetime>`, focus rings), §14 tests (Tasks 1 to 4) and screenshots (Task 8), §15 no inputs.

Type consistency: `segmentRows(essays, currentId, now)` takes `now` in Tasks 3 and 7 (the spec's §7 signature is amended to match). `Essay` and `TrackRow` are defined once in Task 2 and imported by name everywhere after. `Track.astro` props are `{ rows, density }` in Tasks 6 and 7.
