# Roadmap Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the 23-week roadmap schedule into `/roadmap`, deriving every date from one `WEEK_ONE` constant so the plan can never again drift from the page that renders it.

**Architecture:** A leaf module `src/lib/roadmap/weeks.ts` owns week arithmetic and imports nothing. `src/data/roadmap.ts` gains a phase table and derives every milestone, book and foundation-group span from it. `src/lib/roadmap/schedule.ts` answers "what week is it" for a new `ThisWeek` band. Three new Astro components render the band, the phase ribbon and the practice prose; the existing inspector gains a pairing list.

**Tech Stack:** Astro 5, TypeScript (strict, ESM with `.js` import specifiers), Vitest, no client framework.

**Spec:** `docs/superpowers/specs/2026-09-08-roadmap-schedule-design.md`

## Global Constraints

- **Import direction is one-way: `lib/` → `data/`, never back.** `src/lib/roadmap/arrange.ts:6` imports from `src/data/roadmap.ts`. `weeks.ts` therefore imports **nothing**, so `roadmap.ts` can use it without creating a cycle.
- **All dates are UTC.** Construct with `Date.UTC` or a `Z`-suffixed ISO string; shift with `setUTCDate`. `src/lib/dates.ts` formats in UTC and the site must never print a date that moves with the reader's zone.
- **Never invent, rename or remove a progress id.** `src/data/roadmap.ts`'s header warns that changing an id orphans stored progress in Netlify Blobs. Every `Pairing.ref` in this plan references an id that already exists. `allIds` must be unchanged at the end.
- **ESM import specifiers carry `.js`** even for `.ts` files — match the existing `import { … } from "../arrange.js"` style.
- **Every enhancement registers through `onPage(init)`** from `src/scripts/lifecycle.ts` and passes `signal` to every listener. Nothing initialises at module import.
- **Plan runs Mon–Sat.** Week *n* starts Monday (`weekStart`) and ends Saturday (`weekEnd`). Sunday belongs to no week.
- **Roadmap components carry NO `<style>` block.** All six existing components in
  `src/components/roadmap/` have zero; every `rm-*` rule lives in one
  `<style is:global>` block in `src/pages/roadmap.astro` (lines 50–950). New
  components follow that: markup only, rules appended to the page's global block.
- **Use the project's real design tokens.** They are `--color-border`,
  `--color-border-hover`, `--color-bg`, `--color-bg-elevated`, `--color-bg-hover`,
  `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`,
  `--color-text-faint`, `--font-mono`, `--font-sans`, `--font-display`,
  `--lane-learning`, `--track-build`, `--track-reading`, `--track-foundations`,
  `--radius-sm|md|lg|xl|full`, `--space-xs|sm|md|lg|xl|2xl|3xl|4xl|5xl`.
  `--border`, `--panel`, `--text-2` and similar belong to the standalone mockup's
  own `:root` and DO NOT EXIST in this project — using one renders transparent,
  silently.
- **Verify before claiming done.** Run the stated command and read the output. `npm test` for units; `npm run check` (build + full suite) before any commit that touches built markup.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/roadmap/weeks.ts` | **New.** Week arithmetic and `weeksToSpan`. Imports nothing. |
| `src/data/roadmap.ts` | **Modified.** Phase table, pairings; spans derived, not typed. |
| `src/lib/roadmap/schedule.ts` | **New.** `weekOf`, `currentPhase`, `thisWeek`. |
| `src/lib/roadmap/arrange.ts` | **Modified.** Narrow the default window. |
| `src/components/roadmap/ThisWeek.astro` | **New.** The "this week" band. |
| `src/components/roadmap/RoadmapArc.astro` | **New.** The seven-phase ribbon. |
| `src/components/roadmap/RoadmapPractice.astro` | **New.** The 2-hour day and the notes. |
| `src/components/roadmap/PairingList.astro` | **New.** One phase's reading or foundations list. |
| `src/components/roadmap/RoadmapInspector.astro` | **Modified.** Renders pairings per clip. |
| `src/scripts/roadmap-schedule.ts` | **New.** Recomputes the band under `onPage()`. |
| `src/pages/roadmap.astro` | **Modified.** Mounts the three new sections. |

---

### Task 1: Week arithmetic

**Files:**
- Create: `src/lib/roadmap/weeks.ts`
- Test: `src/lib/roadmap/__tests__/weeks.test.ts`

**Interfaces:**
- Consumes: nothing. This module must stay import-free (see Global Constraints).
- Produces: `WEEK_ONE: Date`, `LAST_WEEK: number`, `shiftDays(d: Date, n: number): Date`, `weekStart(n: number): Date`, `weekEnd(n: number): Date`, `weeksToSpan(ranges: readonly {fromWeek: number; toWeek: number}[]): {start: Date; end: Date}`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/roadmap/__tests__/weeks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WEEK_ONE, weekStart, weekEnd, shiftDays, weeksToSpan } from "../weeks.js";

describe("week arithmetic", () => {
  it("starts week 1 on the Monday named by WEEK_ONE", () => {
    expect(weekStart(1)).toEqual(WEEK_ONE);
    expect(weekStart(1).getUTCDay()).toBe(1); // Monday
  });

  it("puts week 0 — the ramp — in the week before week 1", () => {
    expect(weekStart(0)).toEqual(new Date("2026-08-31T00:00:00Z"));
    expect(weekEnd(0)).toEqual(new Date("2026-09-05T00:00:00Z"));
  });

  it("ends every week on the Saturday, five days after its Monday", () => {
    for (const n of [0, 1, 7, 22]) {
      expect(weekEnd(n).getUTCDay(), `week ${n}`).toBe(6); // Saturday
      expect(weekEnd(n).getTime() - weekStart(n).getTime()).toBe(5 * 86400000);
    }
  });

  it("carries across month and year boundaries", () => {
    expect(weekStart(15)).toEqual(new Date("2026-12-14T00:00:00Z"));
    expect(weekEnd(22)).toEqual(new Date("2027-02-06T00:00:00Z")); // into 2027
  });

  it("does not mutate the date it shifts", () => {
    const d = new Date("2026-09-07T00:00:00Z");
    shiftDays(d, 40);
    expect(d).toEqual(new Date("2026-09-07T00:00:00Z"));
  });

  it("spans the widest week range given", () => {
    expect(weeksToSpan([{ fromWeek: 8, toWeek: 9 }, { fromWeek: 15, toWeek: 19 }]))
      .toEqual({ start: weekStart(8), end: weekEnd(19) });
  });

  it("throws on an empty range list rather than returning an Invalid Date", () => {
    // Math.min(...[]) is Infinity; arrange.ts:104 documents how an Invalid Date
    // here poisons the whole home-page timeline window.
    expect(() => weeksToSpan([])).toThrow(/no weeks/i);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/roadmap/__tests__/weeks.test.ts`
Expected: FAIL — `Failed to resolve import "../weeks.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/roadmap/weeks.ts`:

```ts
// src/lib/roadmap/weeks.ts
// Week arithmetic for the roadmap schedule. The plan works Mon–Sat: week n
// starts on its Monday and ends on its Saturday, and Sunday belongs to no week.
//
// This module imports NOTHING on purpose. src/data/roadmap.ts derives its spans
// from it, and src/lib/roadmap/{arrange,schedule}.ts import that data file — so
// anything this module reached for would close an import cycle.

/** Monday of Week 1. Move this and the entire plan moves with it. */
export const WEEK_ONE = new Date("2026-09-07T00:00:00Z");

/** The last numbered week. Week 0 is the ramp; 1–22 are the build weeks. */
export const LAST_WEEK = 22;

/** A new Date n days on, via setUTCDate so it carries across months and years. */
export function shiftDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Monday of week n. Week 0 is the ramp, the week before Week 1. */
export const weekStart = (n: number): Date => shiftDays(WEEK_ONE, (n - 1) * 7);

/** Saturday of week n — the plan works Mon–Sat, and Saturday ships the log. */
export const weekEnd = (n: number): Date => shiftDays(weekStart(n), 5);

export interface WeekRange {
  fromWeek: number;
  toWeek: number;
}

/** The span covering every range given. Throws when given none. */
export function weeksToSpan(ranges: readonly WeekRange[]): { start: Date; end: Date } {
  if (ranges.length === 0) {
    throw new Error("weeksToSpan: no weeks — a clip with no phase is a data error");
  }
  return {
    start: weekStart(Math.min(...ranges.map((r) => r.fromWeek))),
    end: weekEnd(Math.max(...ranges.map((r) => r.toWeek))),
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/lib/roadmap/__tests__/weeks.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmap/weeks.ts src/lib/roadmap/__tests__/weeks.test.ts
git commit -m "feat(roadmap): week arithmetic anchored on one WEEK_ONE constant"
```

---

### Task 2: The phase table, and spans derived from it

**Files:**
- Modify: `src/data/roadmap.ts`
- Test: `src/lib/roadmap/__tests__/arrange.test.ts`

**Interfaces:**
- Consumes: `weekStart`, `weekEnd`, `weeksToSpan`, `WEEK_ONE`, `LAST_WEEK` from Task 1.
- Produces: `Pairing { ref: string; note: string; optional?: boolean }`, `Phase { id; label; name; fromWeek; toWeek; milestone?; reading: Pairing[]; foundations: Pairing[] }`, and `phases: Phase[]`. `build`, `reading` and `foundations` keep their existing exported types — only how their `start`/`end` are produced changes.

- [ ] **Step 1: Write the failing test**

In `src/lib/roadmap/__tests__/arrange.test.ts`, extend the **existing**
`import { build } from "../../../data/roadmap.js";` line rather than adding a
second import from the same module:

```ts
import { build, reading as books, foundations as fnd, phases, allIds } from "../../../data/roadmap.js";
```

Then append the new block (note it uses `build`, the name already bound):

```ts

describe("spans derive from the phase table", () => {
  // The eleven known-good spans. Literal dates belong here and only here: this
  // is a fixture asserting the derivation, not a logic test restating data.
  const EXPECTED: Record<string, [string, string]> = {
    redis: ["2026-09-07", "2026-10-24"],
    sqlite: ["2026-10-26", "2026-11-07"],
    http: ["2026-11-09", "2026-11-28"],
    dns: ["2026-11-30", "2026-12-12"],
    kafka: ["2026-12-14", "2027-02-06"],
    ddia: ["2026-08-31", "2027-02-06"],
    aposd: ["2026-08-31", "2027-01-16"],
    dbint: ["2026-10-26", "2027-04-30"],
    ostep: ["2026-09-07", "2027-04-30"],
    "fd.courses": ["2026-08-31", "2026-10-24"],
    "fd.neetcode": ["2026-08-31", "2027-02-06"],
  };

  const byId = new Map<string, { start: Date; end: Date }>(
    [...build, ...books, ...fnd].map((x) => [x.id, { start: x.start, end: x.end }]),
  );

  it("reproduces every known-good span", () => {
    for (const [id, [start, end]] of Object.entries(EXPECTED)) {
      const got = byId.get(id);
      expect(got, `no clip ${id}`).toBeDefined();
      expect(got!.start.toISOString().slice(0, 10), `${id} start`).toBe(start);
      expect(got!.end.toISOString().slice(0, 10), `${id} end`).toBe(end);
    }
  });

  it("excludes an optional pairing from span derivation", () => {
    // fd.advanced is listed in the capstone as "optional, deferred". Counting it
    // would stretch fd.courses from W0–7 to W0–22 — from "finished during Redis"
    // to "runs all year".
    const capstone = phases.find((p) => p.id === "capstone")!;
    expect(capstone.foundations.find((x) => x.ref === "fd.advanced")?.optional).toBe(true);
    expect(byId.get("fd.courses")!.end).toEqual(new Date("2026-10-24T00:00:00Z"));
  });

  it("spans Kafka across both phases that name it", () => {
    const owning = phases.filter((p) => p.milestone === "kafka").map((p) => p.id);
    expect(owning).toEqual(["m5", "capstone"]);
  });

  it("references only ids that already exist, so no progress is orphaned", () => {
    for (const p of phases) {
      for (const pair of [...p.reading, ...p.foundations]) {
        expect(allIds.has(pair.ref), `unknown ref ${pair.ref} in phase ${p.id}`).toBe(true);
      }
    }
  });

  it("gives every phase a contiguous, ordered week range", () => {
    expect(phases.map((p) => p.id)).toEqual(["ramp", "m1", "m2", "m3", "m4", "m5", "capstone"]);
    phases.forEach((p, i) => {
      expect(p.toWeek, `phase ${p.id}`).toBeGreaterThanOrEqual(p.fromWeek);
      if (i > 0) expect(p.fromWeek, `phase ${p.id} follows`).toBe(phases[i - 1].toWeek + 1);
    });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/roadmap/__tests__/arrange.test.ts`
Expected: FAIL — `phases` is not exported from `src/data/roadmap.ts`.

- [ ] **Step 3: Add the phase table to `src/data/roadmap.ts`**

Add the import at the top of the file, directly under the existing header comment:

```ts
import { weekStart, weekEnd, weeksToSpan, type WeekRange } from "../lib/roadmap/weeks.js";
```

Do **not** re-export the week helpers from here. Every consumer imports them
from `weeks.js` directly, so a re-export would be dead on arrival.

Add the types and the table **above** `export const build`, because `build`,
`reading` and `foundations` read from it at module-init time:

```ts
// --- The schedule ---
// The plan as seven dated phases. This is the single source of every date on
// the roadmap: milestone, book and foundation-group spans are all derived from
// it below, so re-dating the plan is one edit to WEEK_ONE.

export interface Pairing {
  ref: string;         // an id that already exists in this file
  note: string;        // why this lands here, in the schedule's own words
  optional?: boolean;  // rendered, but never extends a span
}

export interface Phase {
  id: string;
  label: string;       // "M1 · Storage"
  name: string;        // "Redis — how bytes become a database"
  fromWeek: number;
  toWeek: number;
  milestone?: string;  // build id this phase drives; the ramp has none
  reading: Pairing[];
  foundations: Pairing[];
}

const ddiaCh = (n: number, note: string): Pairing => ({ ref: `ddia.ch${n}`, note });
const dbintCh = (n: number, note: string): Pairing => ({ ref: `dbint.ch${n}`, note });

export const phases: Phase[] = [
  {
    id: "ramp", label: "Phase 0 · ramp", name: "Foundations ramp — get fluent before the first socket",
    fromWeek: 0, toWeek: 0,
    reading: [
      { ref: "aposd.s1", note: "Complexity & its symptoms — the judgment lens" },
      ddiaCh(1, "Reliable, scalable, maintainable — the rubric for every later call"),
    ],
    foundations: [
      { ref: "fd.pyci", note: "40 lessons — the refresher" },
      { ref: "fd.dsab", note: "35 lessons — start it" },
      { ref: "fd.nc.arrays", note: "Arrays & Hashing begins — Redis hash store" },
    ],
  },
  {
    id: "m1", label: "M1 · Storage", name: "Redis — how bytes become a database",
    fromWeek: 1, toWeek: 7, milestone: "redis",
    reading: [
      ddiaCh(3, "Storage & retrieval — log-structured hash indexes"),
      { ref: "ostep.p1", note: "disks — alongside RDB/AOF" },
      { ref: "ostep.p2", note: "files & directories — alongside RDB/AOF" },
      { ref: "ostep.p3", note: "crash consistency — alongside RDB/AOF" },
      { ref: "ostep.p4", note: "log-structured file systems — alongside RDB/AOF" },
      { ref: "ostep.c1", note: "threads & locks — alongside replication" },
      { ref: "ostep.c2", note: "condition variables — alongside replication" },
      { ref: "ostep.c3", note: "deadlock — alongside replication" },
      ddiaCh(5, "Replication"),
      { ref: "aposd.s2", note: "light: modules should be deep" },
    ],
    foundations: [
      { ref: "fd.dsab", note: "finish it" },
      { ref: "fd.coreskills", note: "20 — implement the data structures" },
      { ref: "fd.nc.arrays", note: "Redis hash store" },
      { ref: "fd.nc.twopointers", note: "5" },
      { ref: "fd.nc.sliding", note: "6" },
      { ref: "fd.nc.stack", note: "7" },
      { ref: "fd.nc.linkedlist", note: "11" },
    ],
  },
  {
    id: "m2", label: "M2 · Engines", name: "SQLite — B-trees vs LSM",
    fromWeek: 8, toWeek: 9, milestone: "sqlite",
    reading: [
      ddiaCh(2, "Data models"),
      ddiaCh(3, "Storage & retrieval, deep — B-trees vs LSM-trees"),
      dbintCh(1, "Introduction — the exact match for this build"),
      dbintCh(2, "B-tree basics"),
      dbintCh(3, "File formats"),
      dbintCh(4, "Implementing B-trees"),
    ],
    foundations: [
      { ref: "fd.nc.binsearch", note: "SQLite B-tree" },
      { ref: "fd.nc.trees", note: "SQLite B-tree" },
      { ref: "fd.nc.tries", note: "3" },
    ],
  },
  {
    id: "m3", label: "M3 · Encoding", name: "HTTP server — encoding & the wire",
    fromWeek: 10, toWeek: 12, milestone: "http",
    reading: [
      ddiaCh(4, "Encoding & evolution — JSON, Protobuf, Avro, schema migrations"),
      dbintCh(5, "trailing: transaction processing & recovery"),
      dbintCh(6, "trailing: B-tree variants"),
      dbintCh(7, "trailing: log-structured storage"),
      { ref: "aposd.s3", note: "light: information hiding & general-purpose design" },
    ],
    foundations: [
      { ref: "fd.nc.heap", note: "7" },
      { ref: "fd.nc.backtracking", note: "9" },
    ],
  },
  {
    id: "m4", label: "M4 · The packet", name: "DNS server — the binary packet",
    fromWeek: 13, toWeek: 14, milestone: "dns",
    reading: [
      ddiaCh(6, "Partitioning — sets up M5"),
      { ref: "aposd.s4", note: "light: comments & naming" },
    ],
    foundations: [
      { ref: "fd.nc.greedy", note: "8" },
      { ref: "fd.nc.intervals", note: "6" },
    ],
  },
  {
    id: "m5", label: "M5 · Consensus", name: "Kafka — consistency & consensus",
    fromWeek: 15, toWeek: 19, milestone: "kafka",
    reading: [
      ddiaCh(7, "Transactions"),
      ddiaCh(8, "The trouble with distributed systems"),
      ddiaCh(9, "Consistency & consensus"),
      dbintCh(8, "the distributed half begins"),
      dbintCh(9, "Failure detection"),
      dbintCh(10, "Leader election"),
      dbintCh(11, "Replication & consistency"),
      dbintCh(12, "Anti-entropy & dissemination"),
      dbintCh(13, "Distributed transactions"),
      dbintCh(14, "Consensus"),
      { ref: "aposd.s5", note: "light: consistency & obvious code — finishes the book" },
    ],
    foundations: [
      { ref: "fd.nc.graphs", note: "replication & partitioning" },
      { ref: "fd.nc.advgraphs", note: "6" },
      { ref: "fd.nc.dp1", note: "12" },
      { ref: "fd.nc.dp2", note: "11" },
    ],
  },
  {
    id: "capstone", label: "Capstone", name: "Systems in the wild — the writeup",
    fromWeek: 20, toWeek: 22, milestone: "kafka",
    reading: [
      ddiaCh(10, "Batch processing"),
      ddiaCh(11, "Stream processing"),
      ddiaCh(12, "The future of data systems — finishes DDIA"),
    ],
    foundations: [
      { ref: "fd.nc.mathgeo", note: "8" },
      { ref: "fd.nc.bits", note: "7" },
      { ref: "fd.advanced", note: "35 — optional, deferred", optional: true },
    ],
  },
];

// --- Derived spans ---
// A milestone spans the phases that name it; a book or group spans the phases
// that reference any of its children. An optional pairing renders but never
// extends a span.
const rangeOf = (p: Phase): WeekRange => ({ fromWeek: p.fromWeek, toWeek: p.toWeek });

const milestoneSpan = (id: string) =>
  weeksToSpan(phases.filter((p) => p.milestone === id).map(rangeOf));

const refSpan = (owns: (ref: string) => boolean) =>
  weeksToSpan(
    phases
      .filter((p) => [...p.reading, ...p.foundations].some((x) => !x.optional && owns(x.ref)))
      .map(rangeOf),
  );

const byPrefix = (prefix: string) => (ref: string) => ref.startsWith(prefix);
```

- [ ] **Step 4: Replace every typed `start`/`end` with its derivation**

In `build`, replace each milestone's two date lines with a single spread. For example, `redis` becomes:

```ts
  {
    id: "redis",
    no: "M1",
    course: "Redis",
    goal: "Build a Redis server from raw sockets to replication — defend choosing an in-memory store over disk, and name exactly when that choice breaks.",
    ...milestoneSpan("redis"),
    groups: [
```

Do the same for `sqlite`, `http`, `dns` and `kafka` with their own ids.

In `reading`, replace the date lines the same way — and keep the two trailing books' explicit end, which is not a week boundary:

```ts
  { id: "ddia",  /* … */ ...refSpan(byPrefix("ddia.")),  /* … */ },
  { id: "dbint", /* … */ ...refSpan(byPrefix("dbint.")), end: new Date("2027-04-30T00:00:00Z"), /* … */ },
  { id: "ostep", /* … */ ...refSpan(byPrefix("ostep.")), end: new Date("2027-04-30T00:00:00Z"), /* … */ },
  { id: "aposd", /* … */ ...refSpan(byPrefix("aposd.")), /* … */ },
```

The `end` override must come **after** the spread or it will be overwritten.

In `foundations`:

```ts
  { id: "fd.courses",  /* … */ ...refSpan((r) => r.startsWith("fd.") && !r.startsWith("fd.nc.")), /* … */ },
  { id: "fd.neetcode", /* … */ ...refSpan(byPrefix("fd.nc.")), /* … */ },
```

Delete every `// placeholder dates (mockup); Sean to confirm` comment and the two `// W…` provenance comments added earlier — the derivation now states the provenance.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `npm test`
Expected: PASS. All previous tests still green, plus five new ones in `arrange.test.ts`. If "reproduces every known-good span" fails, the phase table's week numbers are wrong — fix the table, never the fixture.

- [ ] **Step 6: Commit**

```bash
git add src/data/roadmap.ts src/lib/roadmap/__tests__/arrange.test.ts
git commit -m "feat(roadmap): derive every span from the phase table"
```

---

### Task 3: What week is it

**Files:**
- Create: `src/lib/roadmap/schedule.ts`
- Test: `src/lib/roadmap/__tests__/schedule.test.ts`

**Interfaces:**
- Consumes: `phases`, `Phase`, `Pairing`, `build` from Task 2; `weekStart`, `weekEnd`, `LAST_WEEK` from Task 1.
- Produces: `ThisWeek { week: number; phase: Phase; milestone?: BuildMilestone; reading: Pairing[]; foundations: Pairing[] }`, `weekOf(now: Date): number | null`, `currentPhase(now: Date): Phase | null`, `thisWeek(now: Date): ThisWeek | null`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/roadmap/__tests__/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { weekOf, currentPhase, thisWeek } from "../schedule.js";
import { weekStart, weekEnd } from "../weeks.js";

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("weekOf", () => {
  it("is null before the ramp begins", () => {
    expect(weekOf(at("2026-08-20"))).toBeNull();
  });
  it("is 0 during the ramp week", () => {
    expect(weekOf(at("2026-09-02"))).toBe(0);
  });
  it("is 1 on the Monday the plan starts", () => {
    expect(weekOf(weekStart(1))).toBe(1);
  });
  it("is 1 on that week's Saturday", () => {
    expect(weekOf(weekEnd(1))).toBe(1);
  });
  it("still says week 1 on that week's Saturday afternoon", () => {
    // weekEnd(1) is Saturday 00:00. Saturday is the ship day, not the next week.
    expect(weekOf(at("2026-09-12"))).toBe(1);
  });
  it("still says week 22 on the capstone's final Saturday", () => {
    expect(weekOf(at("2027-02-06"))).toBe(22);
  });
  it("resolves a Sunday forward to the week about to start", () => {
    // The plan works Mon–Sat, so Sunday belongs to no week. On a Sunday evening
    // the useful answer is what starts tomorrow.
    expect(weekOf(at("2026-09-13"))).toBe(2); // the Sunday between W1 and W2
  });
  it("is null after the capstone's last Saturday", () => {
    expect(weekOf(at("2027-02-08"))).toBeNull();
  });
});

describe("currentPhase", () => {
  it("names the phase covering the week", () => {
    expect(currentPhase(at("2026-09-09"))?.id).toBe("m1");   // W1
    expect(currentPhase(at("2026-11-10"))?.id).toBe("m3");   // W10
    expect(currentPhase(at("2027-01-20"))?.id).toBe("capstone"); // W20
  });
  it("is the ramp during week 0", () => {
    expect(currentPhase(at("2026-09-02"))?.id).toBe("ramp");
  });
  it("is null outside the plan", () => {
    expect(currentPhase(at("2027-06-01"))).toBeNull();
  });
});

describe("thisWeek", () => {
  it("carries the phase, its milestone, and what to read and drill", () => {
    const w = thisWeek(at("2026-09-09"))!;
    expect(w.week).toBe(1);
    expect(w.phase.id).toBe("m1");
    expect(w.milestone?.id).toBe("redis");
    expect(w.reading.map((p) => p.ref)).toContain("ddia.ch3");
    expect(w.foundations.map((p) => p.ref)).toContain("fd.nc.twopointers");
  });
  it("has no milestone during the ramp", () => {
    const w = thisWeek(at("2026-09-02"))!;
    expect(w.week).toBe(0);
    expect(w.milestone).toBeUndefined();
  });
  it("includes an optional pairing — it is still read, just not span-extending", () => {
    const w = thisWeek(at("2027-01-20"))!; // capstone
    expect(w.foundations.map((p) => p.ref)).toContain("fd.advanced");
  });
  it("is null once the plan is finished", () => {
    expect(thisWeek(at("2027-02-08"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/roadmap/__tests__/schedule.test.ts`
Expected: FAIL — `Failed to resolve import "../schedule.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/roadmap/schedule.ts`:

```ts
// src/lib/roadmap/schedule.ts
// "What week is it" for the roadmap's this-week band. Pure — no Astro, no DOM —
// so Vitest loads it and both the page and src/scripts/roadmap-schedule.ts call
// it, the same shape as src/lib/timeline/now.ts.
import { build, phases, type BuildMilestone, type Pairing, type Phase } from "../../data/roadmap.js";
import { weekStart, weekEnd, shiftDays, LAST_WEEK } from "./weeks.js";

export interface ThisWeek {
  week: number;              // 0 is the ramp; 1–22 are the build weeks
  phase: Phase;
  milestone?: BuildMilestone;
  reading: Pairing[];
  foundations: Pairing[];
}

/**
 * The week `now` falls in, or null outside the plan. A Sunday belongs to no
 * week — the plan works Mon–Sat — so it resolves forward to the week that is
 * about to start, which is the useful answer on a Sunday evening.
 */
export function weekOf(now: Date): number | null {
  // A week runs from its Monday 00:00 up to (not including) the following
  // Sunday 00:00. Comparing against weekEnd(n) directly would be an off-by-one:
  // weekEnd(n) is Saturday at midnight, so any Saturday *afternoon* would roll
  // forward a week — and the capstone's final Saturday, its ship day, would
  // report the plan finished.
  const t = now.getTime();
  const sundayAfter = (n: number) => shiftDays(weekEnd(n), 1).getTime();
  if (t < weekStart(0).getTime()) return null;
  if (t >= sundayAfter(LAST_WEEK)) return null;
  for (let n = 0; n <= LAST_WEEK; n++) {
    if (t < sundayAfter(n)) return n; // Mon–Sat of week n; a Sunday falls through
  }
  return null;
}

export function currentPhase(now: Date): Phase | null {
  const n = weekOf(now);
  if (n === null) return null;
  return phases.find((p) => n >= p.fromWeek && n <= p.toWeek) ?? null;
}

export function thisWeek(now: Date): ThisWeek | null {
  const week = weekOf(now);
  const phase = currentPhase(now);
  if (week === null || phase === null) return null;
  return {
    week,
    phase,
    milestone: build.find((m) => m.id === phase.milestone),
    reading: phase.reading,
    foundations: phase.foundations,
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run src/lib/roadmap/__tests__/schedule.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmap/schedule.ts src/lib/roadmap/__tests__/schedule.test.ts
git commit -m "feat(roadmap): weekOf, currentPhase and thisWeek"
```

---

### Task 4: The this-week band

**Files:**
- Create: `src/components/roadmap/ThisWeek.astro`, `src/scripts/roadmap-schedule.ts`
- Modify: `src/pages/roadmap.astro`, `src/__tests__/roadmap-contract.test.ts`

**Interfaces:**
- Consumes: `thisWeek`, `ThisWeek` from Task 3; `LAST_WEEK`, `weekStart` from Task 1; `onPage` from `src/scripts/lifecycle.ts`.
- Produces: the DOM hooks `[data-this-week]`, `[data-week-label]`, `[data-week-phase]`, `[data-week-reading]`, `[data-week-foundations]`.

- [ ] **Step 1: Write the failing contract test**

Append to `src/__tests__/roadmap-contract.test.ts`, inside the existing `describe.skipIf(!built)` block:

```ts
  it("renders the this-week band with real text before any script runs", () => {
    expect(html).toContain("data-this-week");
    // One of the five band states from spec §7. Asserted by text, not by
    // attribute adjacency: Astro injects scoped data-astro-cid-* attributes
    // whose position in the tag is not guaranteed.
    expect(html).toMatch(/Week \d+ of 22|Ramp week|The plan (starts|is finished)/);
  });

  it("keeps the hooks the band's script writes into", () => {
    for (const hook of ["data-week-label", "data-week-phase", "data-week-reading", "data-week-foundations"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run check`
Expected: FAIL on both new assertions — the band is not rendered yet.

- [ ] **Step 3: Write the component**

Create `src/components/roadmap/ThisWeek.astro`:

```astro
---
// The "this week" band (spec §7). Server-rendered from the build clock, then
// recomputed on load by src/scripts/roadmap-schedule.ts — this is the one
// enhancement that rewrites rather than narrows, because its inputs are the
// static phase table the client bundle already holds.
import { thisWeek } from "../../lib/roadmap/schedule";
import { LAST_WEEK, weekStart } from "../../lib/roadmap/weeks";
import { longDate } from "../../lib/dates";

const now = new Date();
const w = thisWeek(now);
const before = now.getTime() < weekStart(0).getTime();

const label = w === null
  ? (before ? `The plan starts ${longDate(weekStart(0))}` : "The plan is finished")
  : (w.week === 0 ? "Ramp week" : `Week ${w.week} of ${LAST_WEEK}`);
---

<section class="rm-week" data-this-week>
  <p class="rm-week-label" data-week-label>{label}</p>
  <p class="rm-week-phase" data-week-phase>{w?.phase.name ?? ""}</p>
  <div class="rm-week-lists">
    <ul data-week-reading aria-label="Reading this phase">
      {(w?.reading ?? []).map((p) => <li>{p.ref} — {p.note}</li>)}
    </ul>
    <ul data-week-foundations aria-label="Foundations this phase">
      {(w?.foundations ?? []).map((p) => <li>{p.ref} — {p.note}</li>)}
    </ul>
  </div>
</section>


<script>
  import "../../scripts/roadmap-schedule";
</script>
```

Note for the implementer: the `{p.ref} — {p.note}` rendering is a placeholder for *ids*, which are not reader-facing. Task 6 introduces `PairingList.astro`, which resolves a ref to its real title; swap this markup to use it once that component exists.

- [ ] **Step 4: Write the client script**

Create `src/scripts/roadmap-schedule.ts`:

```ts
// src/scripts/roadmap-schedule.ts
// Keeps the this-week band honest when a deploy goes stale — a build shipped on
// a Friday would still claim "Week 1" three weeks later. Unlike the hero's
// readout (src/scripts/timeline/now.ts), which may only remove, this one
// rewrites: its inputs are WEEK_ONE and the static phase table, both already in
// this bundle, so recomputing on the client is exactly as trustworthy.
import { onPage } from "./lifecycle";
import { thisWeek } from "../lib/roadmap/schedule";
import { LAST_WEEK, weekStart } from "../lib/roadmap/weeks";
import { longDate } from "../lib/dates";

onPage(() => {
  const band = document.querySelector<HTMLElement>("[data-this-week]");
  if (!band) return;

  const now = new Date();
  const w = thisWeek(now);
  const before = now.getTime() < weekStart(0).getTime();

  const set = (sel: string, text: string) => {
    const el = band.querySelector<HTMLElement>(sel);
    if (el) el.textContent = text;
  };

  set("[data-week-label]", w === null
    ? (before ? `The plan starts ${longDate(weekStart(0))}` : "The plan is finished")
    : (w.week === 0 ? "Ramp week" : `Week ${w.week} of ${LAST_WEEK}`));
  set("[data-week-phase]", w?.phase.name ?? "");
});
```

- [ ] **Step 5: Add its styles to the page's global block**

`ThisWeek.astro` carries no `<style>`. Append these rules inside the existing
`<style is:global>` in `src/pages/roadmap.astro`, before its closing `</style>`:

```css
  .rm-week {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-xl);
  }
  .rm-week-label {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--lane-learning);
    margin: 0;
  }
  .rm-week-phase {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
    margin: 6px 0 0;
  }
  .rm-week-lists { display: grid; gap: var(--space-lg); margin-top: var(--space-md); }
  @media (min-width: 900px) {
    .rm-week-lists { grid-template-columns: 1fr 1fr; }
  }
```

- [ ] **Step 6: Mount it on the page**

In `src/pages/roadmap.astro`, add the import beside the other roadmap components and render it directly above `<RoadmapMeters />`:

```astro
import ThisWeek from "../components/roadmap/ThisWeek.astro";
```

```astro
      <ThisWeek />
      <RoadmapMeters />
```

- [ ] **Step 6: Run the full check and make sure it passes**

Run: `npm run check`
Expected: PASS — build clean, every test green including the two new contract assertions.

- [ ] **Step 7: Commit**

```bash
git add src/components/roadmap/ThisWeek.astro src/scripts/roadmap-schedule.ts src/pages/roadmap.astro src/__tests__/roadmap-contract.test.ts
git commit -m "feat(roadmap): a this-week band that recomputes on load"
```

---

### Task 5: The phase-arc ribbon

**Files:**
- Create: `src/components/roadmap/RoadmapArc.astro`
- Modify: `src/pages/roadmap.astro`, `src/__tests__/roadmap-contract.test.ts`

**Interfaces:**
- Consumes: `phases` from Task 2; `weekStart`, `weekEnd` from Task 1.
- Produces: the hook `[data-roadmap-arc]`. No script.

- [ ] **Step 1: Write the failing contract test**

Append inside the same `describe.skipIf(!built)` block:

```ts
  it("renders the phase arc with one segment per phase", () => {
    expect(html).toContain("data-roadmap-arc");
    const segments = html.match(/data-arc-phase="/g) ?? [];
    expect(segments).toHaveLength(7); // ramp + M1–M5 + capstone
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run check`
Expected: FAIL — `expected [] to have a length of 7 but got 0`.

- [ ] **Step 3: Write the component**

Create `src/components/roadmap/RoadmapArc.astro`:

```astro
---
// The seven-phase ribbon (spec §8). Static: no script, no :target, no state.
// Each segment grows in proportion to its week count, so the ribbon reads as a
// real timeline rather than seven equal boxes.
import { phases } from "../../data/roadmap";
import { weekStart, weekEnd } from "../../lib/roadmap/weeks";
import { shortDate, isoDay } from "../../lib/dates";

const weeks = (p: { fromWeek: number; toWeek: number }) => p.toWeek - p.fromWeek + 1;
const label = (p: { fromWeek: number; toWeek: number }) =>
  p.fromWeek === p.toWeek ? `W${p.fromWeek}` : `W${p.fromWeek}–${p.toWeek}`;
---

<section class="rm-arc" data-roadmap-arc aria-label="The arc — seven phases across 23 weeks">
  <ol>
    {phases.map((p) => (
      <li data-arc-phase={p.id} style={`flex-grow: ${weeks(p)}`}>
        <span class="rm-arc-wk">{label(p)}</span>
        <span class="rm-arc-nm">{p.label}</span>
        <span class="rm-arc-dt">
          <time datetime={isoDay(weekStart(p.fromWeek))}>{shortDate(weekStart(p.fromWeek))}</time>
          {" – "}
          <time datetime={isoDay(weekEnd(p.toWeek))}>{shortDate(weekEnd(p.toWeek))}</time>
        </span>
      </li>
    ))}
  </ol>
</section>

```

- [ ] **Step 4: Add its styles to the page's global block**

`RoadmapArc.astro` carries no `<style>`. Append inside the existing
`<style is:global>` in `src/pages/roadmap.astro`:

```css
  .rm-arc ol {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-xl);
  }
  .rm-arc li {
    flex-basis: 0;
    min-width: 8rem;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
    display: grid;
    gap: 2px;
  }
  .rm-arc-wk {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--lane-learning);
  }
  .rm-arc-nm { font-size: 14px; font-weight: 600; line-height: 1.3; }
  .rm-arc-dt { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted); }
```

- [ ] **Step 5: Mount it on the page**

In `src/pages/roadmap.astro`, import it and render it directly below `<ThisWeek />`:

```astro
import RoadmapArc from "../components/roadmap/RoadmapArc.astro";
```

```astro
      <ThisWeek />
      <RoadmapArc />
      <RoadmapMeters />
```

- [ ] **Step 5: Run the full check and make sure it passes**

Run: `npm run check`
Expected: PASS, including the new seven-segment assertion.

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/RoadmapArc.astro src/pages/roadmap.astro src/__tests__/roadmap-contract.test.ts
git commit -m "feat(roadmap): the seven-phase arc ribbon"
```

---

### Task 6: Pairings in the inspector

**Files:**
- Create: `src/components/roadmap/PairingList.astro`
- Modify: `src/components/roadmap/RoadmapInspector.astro`, `src/components/roadmap/ThisWeek.astro`, `src/__tests__/roadmap-contract.test.ts`

**Interfaces:**
- Consumes: `phases`, `Pairing`, `reading`, `foundations` from Task 2.
- Produces: `PairingList.astro` with props `{ label: string; items: Pairing[] }`, rendering `[data-pairing-list]`.

- [ ] **Step 1: Write the failing contract test**

Append inside the same `describe.skipIf(!built)` block:

```ts
  it("names, in the Redis panel, the chapters read alongside it", () => {
    const panel = html.slice(html.indexOf('id="clip-redis"'), html.indexOf('id="clip-sqlite"'));
    expect(panel).toContain("data-pairing-list");
    expect(panel).toContain("alongside RDB/AOF");     // the schedule's own reason
    expect(panel).toMatch(/Storage and Retrieval/i);  // a resolved chapter title, not an id
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run check`
Expected: FAIL — `data-pairing-list` is not in the Redis panel.

- [ ] **Step 3: Write the component**

Create `src/components/roadmap/PairingList.astro`. It resolves a ref to a
reader-facing title, because ids are internal:

```astro
---
// One phase's reading or foundations list (spec §8). Follows the shape of
// src/components/WhileList.astro — kicker, then a list of linked rows — rather
// than inventing a second idiom for the same job. Renders nothing when empty.
import { reading, foundations, type Pairing } from "../../data/roadmap";

interface Props {
  label: string;
  items: Pairing[];
}
const { label, items } = Astro.props;

// Refs are internal ids; readers see titles. Built once per render.
const titles = new Map<string, string>();
for (const b of reading) {
  for (const c of b.chapters) titles.set(c.id, `${b.title} — ${c.no}. ${c.title}`);
}
for (const g of foundations) {
  for (const i of g.items) titles.set(i.id, i.label);
}
const titleOf = (ref: string) => titles.get(ref) ?? ref;
---

{items.length > 0 && (
  <section class="rm-pairs" data-pairing-list>
    <p class="rm-pairs-k">{label}</p>
    <ul>
      {items.map((p) => (
        <li class:list={[{ optional: p.optional }]}>
          <span class="rm-pairs-t">{titleOf(p.ref)}</span>
          <small>{p.note}</small>
        </li>
      ))}
    </ul>
  </section>
)}

```

- [ ] **Step 3b: Add its styles to the page's global block**

`PairingList.astro` carries no `<style>`. Append inside the existing
`<style is:global>` in `src/pages/roadmap.astro`:

```css
  .rm-pairs { margin-top: var(--space-md); }
  .rm-pairs-k {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin: 0 0 6px;
  }
  .rm-pairs ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
  .rm-pairs li { display: grid; font-size: 14px; }
  .rm-pairs li.optional { color: var(--color-text-muted); }
  .rm-pairs small { color: var(--color-text-muted); font-size: 12px; }
```

- [ ] **Step 4: Render it in the build panels**

In `src/components/roadmap/RoadmapInspector.astro`, add to the imports:

```astro
import PairingList from "./PairingList.astro";
import { phases } from "../../data/roadmap";
```

and, in the `build.map(...)` block, immediately after the `<div class="rm-insp-checks">` element:

```astro
      {phases.filter((p) => p.milestone === m.id).map((p) => (
        <>
          <PairingList label={`Reading · ${p.label}`} items={p.reading} />
          <PairingList label={`Foundations · ${p.label}`} items={p.foundations} />
        </>
      ))}
```

Kafka has two phases (`m5` and `capstone`), so its panel correctly shows two pairs of lists.

- [ ] **Step 5: Swap the band's interim markup for the component**

Task 4's fix round restructured `ThisWeek.astro`: it now maps over `phases` and
server-renders one `hidden` panel each, rather than rendering a single `w?.reading`
list. So the swap happens *inside* the map, where `p` is the phase.

In `src/components/roadmap/ThisWeek.astro`, add
`import PairingList from "./PairingList.astro";` and replace the `.rm-week-lists`
div inside the `phases.map(...)` block:

```astro
      <div class="rm-week-lists">
        <PairingList label="Reading" items={p.reading} />
        <PairingList label="Foundations" items={p.foundations} />
      </div>
```

This drops the `data-week-reading` and `data-week-foundations` hooks, which is
correct: the script has not touched them since Task 4's fix — it reveals whole
panels by `data-week-panel` and rewrites only `data-week-label`. Leave
`src/scripts/roadmap-schedule.ts` alone.

Update the hook assertion added in Task 4 to name the hooks the script actually
uses now:

```ts
  it("keeps the hooks the band's script writes into", () => {
    for (const hook of ["data-week-label", "data-week-panel"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });
```

Keep Task 4's other contract assertions untouched — in particular the one
checking that exactly one panel is visible, which is what stops the band going
stale.

- [ ] **Step 6: Run the full check and make sure it passes**

Run: `npm run check`
Expected: PASS — build clean, every test green including the two new contract assertions.

- [ ] **Step 7: Commit**

```bash
git add src/components/roadmap/ThisWeek.astro src/scripts/roadmap-schedule.ts src/pages/roadmap.astro src/__tests__/roadmap-contract.test.ts
git commit -m "feat(roadmap): a this-week band that recomputes on load"
```

---

### Task 7: Narrow the default window

**Files:**
- Modify: `src/lib/roadmap/arrange.ts:140-141`, `src/lib/roadmap/__tests__/arrange.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change — `roadmapWindow("span", …)` returns different bounds.

- [ ] **Step 1: Update the failing test**

In `src/lib/roadmap/__tests__/arrange.test.ts`, the existing test `"span zoom is the fixed 2026-to-2027 calendar"` asserts the old bounds. Replace it:

```ts
  it("span zoom is a window sized to the plan, not the calendar", () => {
    const w = roadmapWindow("span", now, []);
    expect(w.from).toEqual(new Date("2026-07-01T00:00:00Z"));
    expect(w.to).toEqual(new Date("2027-06-30T23:59:59.999Z"));
  });

  it("holds every clip inside the span window", () => {
    // The window exists to frame the work; a clip outside it would be clipped.
    const clips = roadmapClips(new Set<string>(), now);
    const w = roadmapWindow("span", now, []);
    for (const c of clips) {
      expect(c.start.getTime(), `${c.id} starts before the window`).toBeGreaterThanOrEqual(w.from.getTime());
      expect(c.end.getTime(), `${c.id} ends after the window`).toBeLessThanOrEqual(w.to.getTime());
    }
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/lib/roadmap/__tests__/arrange.test.ts`
Expected: FAIL — `expected 2026-01-01… to deeply equal 2026-07-01…`.

- [ ] **Step 3: Change the bounds**

In `src/lib/roadmap/arrange.ts`, inside `roadmapWindow`:

```ts
  // Sized to the plan (Aug 2026 – Apr 2027) plus a quarter of air either side,
  // not to the 2026–2027 calendar, which left two-thirds of the ruler empty.
  // Both bounds are quarter boundaries, which is what quarterTicks expects.
  const spanFrom = utc(2026, 6, 1);
  const spanTo = utc(2027, 5, 30, 23, 59, 59, 999);
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test`
Expected: PASS. If "holds every clip inside the span window" fails, a trailing book now ends past Jun 2027 — widen `spanTo` to the next quarter boundary rather than shrinking the book.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmap/arrange.ts src/lib/roadmap/__tests__/arrange.test.ts
git commit -m "fix(roadmap): size the default window to the plan, not the calendar"
```

---

### Task 8: The practice prose, and pinning the mockup

**Files:**
- Create: `src/components/roadmap/RoadmapPractice.astro`, `src/__tests__/schedule-mockup-contract.test.ts`
- Modify: `src/pages/roadmap.astro`, `CLAUDE.md`, `roadmap/study-guide.html:576`
- Keep: `roadmap/roadmap-schedule.html` — guarded by a test, not deleted

**Interfaces:**
- Consumes: nothing. Static prose.
- Produces: the hook `[data-roadmap-practice]`.

- [ ] **Step 1: Write the component**

Create `src/components/roadmap/RoadmapPractice.astro`. The copy is lifted verbatim from the mockup's "The repeating 2-hour day" and "How to read this schedule" sections:

```astro
---
// The 2-hour day and the five principles (spec §8). Pure prose — no data, no
// script, no state. This is the last of roadmap-schedule.html's four parts, and
// carrying it here is what lets that mockup be retired.
const weekday = [
  ["0:00–0:25", "Foundations warm-up — one course lesson early on, then one NeetCode problem in the week's pattern."],
  ["0:25–1:45", "Build — the current CodeCrafters stage. The anchor; most of the hour goes here."],
  ["1:45–2:00", "Read — a few pages of the week's anchor chapter; jot one note toward the log."],
];
const saturday = [
  ["0:00–1:00", "Close the week's build — finish or refactor the current stage; clear anything stuck."],
  ["1:00–1:30", "Reading catch-up — the “light” book (APoSD, then OSTEP / Database Internals)."],
  ["1:30–2:00", "Write the decision log — the real artifact. This is what turns three tracks into one skill."],
];
const notes = [
  ["It's loose on dates, strict on order.", "Build hours are CodeCrafters' own estimates — if a stage takes longer, slip the dates and keep the sequence."],
  ["Build is the spine; everything else hangs off it.", "On any given day, most of the 2 hours is the build."],
  ["Saturday ships the artifact.", "The decision log is the deliverable. Miss a build stage and recover; don't skip the log."],
  ["Database Internals & OSTEP can trail the build.", "DDIA and APoSD finish within the 23 weeks; the rest carries past it."],
  ["Foundations is front-loaded.", "The courses cluster in the ramp and M1, so from SQLite onward more of each day goes to the build."],
];
---

<section class="rm-practice" data-roadmap-practice>
  <h2>The repeating 2-hour day</h2>
  <div class="rm-practice-days">
    <div>
      <h3>Mon–Fri · build days</h3>
      <dl>{weekday.map(([t, d]) => (<><dt>{t}</dt><dd>{d}</dd></>))}</dl>
    </div>
    <div>
      <h3>Saturday · ship day</h3>
      <dl>{saturday.map(([t, d]) => (<><dt>{t}</dt><dd>{d}</dd></>))}</dl>
    </div>
  </div>

  <h2>How to read this schedule</h2>
  <ul>
    {notes.map(([b, rest]) => (<li><b>{b}</b> {rest}</li>))}
  </ul>
</section>

```

- [ ] **Step 1b: Add its styles to the page's global block**

`RoadmapPractice.astro` carries no `<style>`. Append inside the existing
`<style is:global>` in `src/pages/roadmap.astro`:

```css
  .rm-practice { margin-top: var(--space-3xl); }
  .rm-practice h2 {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    margin: var(--space-xl) 0 var(--space-md);
  }
  .rm-practice h3 {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--lane-learning);
    margin: 0 0 var(--space-sm);
  }
  .rm-practice-days { display: grid; gap: var(--space-xl); }
  @media (min-width: 900px) {
    .rm-practice-days { grid-template-columns: 1fr 1fr; }
  }
  .rm-practice dt { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted); }
  .rm-practice dd { margin: 0 0 var(--space-md); font-size: 14px; }
  .rm-practice ul { display: grid; gap: var(--space-sm); padding-left: 18px; font-size: 14px; }
```

- [ ] **Step 2: Mount it on the page**

In `src/pages/roadmap.astro`, import it and render it after `<RetentionSection />`:

```astro
import RoadmapPractice from "../components/roadmap/RoadmapPractice.astro";
```

```astro
      <RetentionSection />
      <RoadmapPractice />
```

- [ ] **Step 3: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Guard the mockup against drift**

The owner keeps `roadmap/roadmap-schedule.html` as a design artifact, alongside
`roadmap-preview.html`. Keeping it re-creates the two-copies condition from
spec §1 — so pin it with a test instead of trusting it.

The mockup's own format supplies the assertion. It prints a start date bare and
an end date with `, YYYY` only when that end is not in 2026:

```
Weeks 1–7 · Sep 7 – Oct 24
Weeks 15–19 · Dec 14 – Jan 16, 2027
```

Format the *derived* dates that way and assert the file contains the result.
That direction cannot be fooled: a date the mockup does not carry fails, and a
date it carries that the plan no longer implies fails too.

Create `src/__tests__/schedule-mockup-contract.test.ts`:

```ts
// roadmap/roadmap-schedule.html is a hand-maintained design artifact that
// prints the same plan src/data/roadmap.ts derives. They drifted badly once —
// by months, with OSTEP dated to start after the chapters it explains, and
// nothing caught it. This test is what catches it now.
//
// It reads a repo source file, not dist/, so it needs no build.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { phases } from "../data/roadmap";
import { weekStart, weekEnd } from "../lib/roadmap/weeks";
import { monthDayYear } from "../lib/dates";

const html = readFileSync("roadmap/roadmap-schedule.html", "utf8");

/** "Sep 7" — the mockup's bare form, used for a start date. */
const bare = (d: Date) => monthDayYear(d).replace(/, \d{4}$/, "");
/** The mockup shows the year on an end date only when it leaves 2026. */
const endForm = (d: Date) => (d.getUTCFullYear() === 2026 ? bare(d) : monthDayYear(d));

describe("the schedule mockup still agrees with the derived plan", () => {
  // The ramp's card reads "Week 0 · complete" and carries no dates.
  const dated = phases.filter((p) => p.id !== "ramp");

  it.each(dated.map((p) => [p.id, p] as const))("phase %s prints its derived dates", (_id, p) => {
    const expected = `Weeks ${p.fromWeek}–${p.toWeek} · ${bare(weekStart(p.fromWeek))} – ${endForm(weekEnd(p.toWeek))}`;
    expect(html, `mockup is missing: ${expected}`).toContain(expected);
  });

  it("prints the full span in the masthead chip and the footer", () => {
    const from = monthDayYear(weekStart(1));
    const to = monthDayYear(weekEnd(22));
    expect(html, "masthead chip").toContain(`${from} → ${to}`);
    expect(html, "footer").toContain(`${from} – ${to}`);
  });

  it("states the plan's real length", () => {
    // Week 0 plus weeks 1–22.
    expect(html).toContain("23-week");
    expect(html).not.toContain("24-week");
  });
});
```

- [ ] **Step 4b: Fix the stale link text in the field guide**

`roadmap/study-guide.html:576` still calls it a 24-week schedule — a third stale
copy of the plan's length. Keep the link, correct the count:

```html
<span>A field guide · companion to the <a href="roadmap-schedule.html">23-week schedule</a></span>
```

Run: `npx vitest run src/__tests__/schedule-mockup-contract.test.ts`
Expected: PASS, 8 tests (6 phases + chip/footer + length).

- [ ] **Step 5: Update `CLAUDE.md`**

In the **Roadmap page** paragraph, add after the first sentence:

> The schedule is the source of every roadmap date: `src/lib/roadmap/weeks.ts` holds the week arithmetic and one `WEEK_ONE` constant, `src/data/roadmap.ts` carries the seven-phase table with its per-phase reading and foundations pairings, and every milestone, book and foundation-group span derives from it — so re-dating the whole plan is one edit. `src/lib/roadmap/schedule.ts` answers which week it is for `ThisWeek.astro`, the one enhancement on the site that rewrites rather than narrows on the client, because its inputs are static data the bundle already holds. `RoadmapArc.astro` draws the phase ribbon and `RoadmapPractice.astro` the 2-hour day; `PairingList.astro` names, in each clip's panel, what to read alongside it.

- [ ] **Step 6: Run the full check one last time**

Run: `npm run check`
Expected: PASS — build clean, all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/components/roadmap/RoadmapPractice.astro src/__tests__/schedule-mockup-contract.test.ts src/pages/roadmap.astro CLAUDE.md roadmap/study-guide.html
git commit -m "feat(roadmap): the practice prose, and pin the mockup against drift"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §4 The week is the atom | 1 |
| §5 Phases and pairings | 2 |
| §6 Spans derive from the phase table | 2 |
| §7 This week (five states) | 3, 4 |
| §8 Components | 4, 5, 6, 8 |
| §9 The window fix | 7 |
| §10 Testing | every task (TDD) |
| §11 Files | matches the File Structure table |
| §12 Keep the mockup, guarded by a test | 8 |

**One deviation from the spec, deliberate:** §11 lists week arithmetic inside
`src/data/roadmap.ts`. This plan puts it in a new leaf module
`src/lib/roadmap/weeks.ts` instead, because `schedule.ts` needs the same
arithmetic and imports the data file — the spec's placement would have closed an
import cycle (`data → lib → data`). The constant and its behaviour are unchanged.

**Placeholder scan:** no TBDs. Task 4 Step 3 carries a deliberate,
clearly-labelled interim rendering that Task 6 Step 5 replaces, with both the
markup swap and the matching contract-test change written out.

**Type consistency:** `Pairing`, `Phase`, `ThisWeek`, `WeekRange`, `weekStart`,
`weekEnd`, `weeksToSpan`, `shiftDays`, `weekOf`, `currentPhase`, `thisWeek`,
`milestoneSpan`, `refSpan`, `byPrefix` are each defined once and used with the
same signature throughout. `LAST_WEEK` is defined in Task 1 and consumed in
Tasks 3 and 4.
