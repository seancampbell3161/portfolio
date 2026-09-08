# The roadmap schedule, folded into `/roadmap`

Design, 2026-09-08.

## 1. Context

`roadmap/roadmap-schedule.html` is a standalone mockup: a 23-week, seven-phase
plan that says which CodeCrafters milestone runs when, and — the part the site
has never had — *which chapters and NeetCode patterns hang off each milestone,
and why*. "OSTEP Persistence P1–P4, alongside RDB/AOF" is the thesis of the
whole plan in one line: not three tracks run in parallel, but one skill, with
the reading placed where it explains the build.

The live `/roadmap` page cannot say that. It renders coarse clips on a quarter
calendar with progress checkboxes. It knows DDIA has twelve chapters; it has no
way to express that Ch. 3 is what you read during Redis.

The two also drifted, badly and silently. The mockup was re-dated twice — Jun 22,
then Jul 20, then Sep 7 — while `src/data/roadmap.ts` sat on placeholder dates
carrying the comment `Sean to confirm`. By 2026-09-08 they disagreed by months,
and OSTEP was dated to start eight months *after* the chapters it explains.
Nothing caught it: no test, no build error. Two hand-maintained copies of one
plan is the actual bug, and this design's first job is to make it impossible
rather than to detect it.

## 2. Scope

In:

- A phase table in `src/data/roadmap.ts` with one `WEEK_ONE` constant. Every
  milestone, book and foundation-group span **derives** from it.
- Pairings: each phase names the chapters and patterns it carries, with the
  schedule's own reason for each.
- A "this week" readout on `/roadmap`, computed from `now`.
- The phase-arc ribbon, and the practice prose (the 2-hour day, the five notes).
- Narrowing `roadmapWindow`'s default zoom, which is now two-thirds empty.

Out:

- **Week-level progress.** Spec v1 had a `Week` interface with `hours` and
  `goal`; v2 dropped it deliberately, and stored progress is keyed by
  CodeCrafters checkpoint. Reintroducing weeks as progress atoms would orphan
  every stored id. Weeks are a *dating* and *narrative* device here, nothing more.
- Any new progress id. §5 is explicit that pairings only reference ids that
  already exist.
- The review deck, `RetentionSection.astro`, and the progress API.
- A second page. Everything lands on `/roadmap`.

## 3. Decisions from brainstorming

1. **Both public and personal.** One page that reads as evidence of how Sean
   plans, and is also what he opens to know what today is.
2. **Extend `/roadmap`,** rather than adding `/roadmap/schedule`. A second page
   would re-create the two-copies condition that caused the drift.
3. **Derive dates from one Week 1 constant,** rather than keeping literals plus
   a guard test. A guard test turns drift into a failing build; derivation turns
   it into a thing that cannot be expressed.
4. **All four parts of the mockup earn their place** — pairings, the "this week"
   readout, the arc ribbon, and the practice prose.
5. **Database Internals and OSTEP both trail to 2027-04-30** — one quarter past
   the capstone, symmetric, and short of stretching the calendar into a
   near-empty late 2027.

## 4. The week is the atom

```ts
/** Monday of Week 1. Move this and the entire plan moves with it. */
export const WEEK_ONE = new Date("2026-09-07T00:00:00Z");

/** Monday of week n; week 0 is the ramp, the week before Week 1. */
export const weekStart = (n: number): Date => shiftDays(WEEK_ONE, (n - 1) * 7);
/** Saturday of week n — the plan works Mon–Sat, and Saturday ships the log. */
export const weekEnd = (n: number): Date => shiftDays(weekStart(n), 5);
```

`shiftDays` is new and local, built on `setUTCDate` so it carries across month
and year boundaries. It is deliberately **not** `addDays` from
`src/lib/review/sm2.ts`: that one takes and returns `YYYY-MM-DD` strings for the
review deck's scheduling, and reusing it here would mean stringifying a `Date`
and parsing it back on every call.

Dates are UTC throughout, matching `src/lib/dates.ts`, which formats in UTC so
the site never shows a date that shifts with the reader's zone.

Re-dating the plan becomes a one-line edit. That is not a hypothetical
convenience: it is exactly the task that opened the session this design came
from, and it cost eight hand-edited strings in the mockup plus nine spans in
`roadmap.ts`, with two tests failing on hardcoded copies of the old dates.

## 5. Phases and pairings

```ts
export interface Pairing {
  ref: string;       // an id that already exists in this file
  note: string;      // the schedule's own reason, verbatim
  optional?: boolean; // excluded from span derivation — see §6
}

export interface Phase {
  id: string;          // "ramp" | "m1" … | "capstone"
  label: string;       // "M1 · Storage"
  name: string;        // "Redis — how bytes become a database"
  fromWeek: number;
  toWeek: number;
  milestone?: string;  // build id this phase drives; the ramp has none
  reading: Pairing[];
  foundations: Pairing[];
}
```

**Every `ref` resolves to an id that exists today.** Verified against the mockup:
the chapters it names map onto `ddia.ch1`–`ch12`, `dbint.ch1`–`ch14`,
`ostep.c1`–`c3` / `p1`–`p4`, and `aposd.s1`–`s5`; the patterns onto the eighteen
`fd.nc.*` ids and the four `fd.*` course ids. So `allIds` is unchanged and **no
stored progress is orphaned** — the one unrecoverable mistake this file's header
warns about.

Phases are declared *before* `build`, `reading` and `foundations`, because those
three now read from them at module-init time.

## 6. Spans derive from the phase table

A build milestone spans the phases that name it; a book or foundation group
spans the phases that reference any of its children:

```ts
const milestoneSpan = (id: string) => weeksToSpan(phases.filter((p) => p.milestone === id));
const refSpan = (owns: (ref: string) => boolean) =>
  weeksToSpan(phases.filter((p) => [...p.reading, ...p.foundations]
    .some((x) => !x.optional && owns(x.ref))));
```

Three details are load-bearing, and each was found by running the derivation
against the eleven hand-derived spans before this design was written:

1. **`optional` changes an answer.** The capstone lists "Advanced Algorithms
   course (35) — optional, deferred". `fd.advanced` belongs to the `fd.courses`
   group, so counting it would stretch that group from W0–7 to W0–22 — from
   "finished during Redis" to "runs the whole plan". Optional pairings render in
   the panel but do not extend a span.
2. **Kafka spans W15–22, not W15–19,** because two phases name it: `m5` and
   `capstone`, whose card says "Kafka tail — close any remaining produce/consume
   stages". Its `kafka.log.capstone` decision log would otherwise sit outside
   its own clip.
3. **An empty phase list must not produce an Invalid Date.** `Math.min(...[])`
   is `Infinity`, and `arrange.ts` already carries a comment about this exact
   hazard poisoning the whole home-page timeline window. `weeksToSpan` throws on
   an empty list rather than returning a span; a milestone no phase references
   is a data error, not a clip.

The two trailing books override only their end:

```ts
{ id: "dbint", ...refSpan(isDbint), end: new Date("2027-04-30") }, // trails one quarter
```

Running this against the plan reproduces all eleven spans exactly, including
`ddia` W0–22, `aposd` W0–19 and `fd.courses` W0–7.

## 7. This week

`src/lib/roadmap/schedule.ts`, pure TypeScript — no Astro, no DOM — so Vitest
loads it and both the page and a client script call it, mirroring
`src/lib/timeline/now.ts`:

```ts
export interface ThisWeek {
  week: number;              // 0 for the ramp, 1–22 thereafter
  phase: Phase;
  milestone?: BuildMilestone;
  reading: Pairing[];        // the phase's, optional ones included — they still read
  foundations: Pairing[];
}

export function weekOf(now: Date): number | null;      // null outside the plan
export function currentPhase(now: Date): Phase | null;
export function thisWeek(now: Date): ThisWeek | null;  // everything the band prints
```

Weeks are numbered 0–22: week 0 is the ramp, and the band counts the build weeks
as "Week n of 22". Five states, and what the band says in each:

| State | Band |
|---|---|
| Before week 0 | The plan starts *date*, in *n* weeks. |
| Week 0, the ramp | Ramp week — no build milestone, so no "Week n of 22". |
| Inside a phase | Week *n* of 22 · *phase name* · what to read and drill. |
| A Sunday between phases | The week about to start, not the one that ended. |
| Past the capstone | Finished — no week number, no pretending. |

A Sunday resolves forward because the plan works Mon–Sat: Sunday belongs to no
week, and the useful answer on a Sunday evening is what starts tomorrow.

The page server-renders the true state at build time; a small re-runnable init
under `onPage()` recomputes it on load, so a deploy that goes stale over a
weekend never claims the wrong week.

This band is the one enhancement on the site that **rewrites** rather than
narrows. `src/scripts/timeline/now.ts` may only remove, because the hero's
readout depends on the full timeline and nothing new can appear without a
rebuild. The week band is different: its inputs are `WEEK_ONE` and the static
phase table, both of which the client bundle already holds, so recomputing is
exactly as trustworthy on the client as on the server — and a band that could
only shrink would be stuck saying "Week 1" in week 3.

## 8. Components

| Component | Job |
|---|---|
| `RoadmapArc.astro` | The seven-phase ribbon, week numbers and dates. Static, no script. |
| `ThisWeek.astro` | The band from §7. Server-rendered, upgraded under `onPage()`. |
| `RoadmapPractice.astro` | The 2-hour day and the five notes. Prose, no data. |

`RoadmapInspector.astro` gains a pairing list per clip. This is not new UI:
`WhileList.astro` already renders "Written while" and "While building" in this
exact shape, so the pairing list follows it rather than inventing a second idiom.

Lane colours come from the existing `--lane-*` tokens; the ribbon carries no new
palette.

## 9. The window fix

`roadmapWindow`'s `span` zoom is hardcoded `2026-01-01 → 2027-12-31`. With clips
now running Aug 2026 – Apr 2027, eight months of empty calendar sit on each side
of the work. Narrow it to `2026-07-01 → 2027-06-30`. `quarterTicks` already
handles a window that starts on a quarter boundary; both new bounds are ones.

## 10. Testing

Unit — `src/lib/roadmap/__tests__/schedule.test.ts`:

- `weekStart`/`weekEnd` land on Monday and Saturday for weeks 0, 1 and 22.
- Each of §7's five states at a fixed clock, including the Sunday boundary.
- `weeksToSpan` throws on an empty phase list rather than returning Invalid Date.

Unit — extending `arrange.test.ts`:

- Every derived span equals its known-good value (the eleven of §6). This is the
  one place literal dates belong: it is a fixture asserting the derivation, not
  a logic test restating data.
- An optional pairing does not extend a span (`fd.courses` ends W7).

Contract — extending the existing test that reads `dist/roadmap/index.html`: the
`ThisWeek` hooks are present, and the band has real text before any script runs.

Note the tests fixed on the way in: two assertions in `arrange.test.ts`
hardcoded placeholder dates into what were really logic tests, and failed on a
legitimate data edit. They now derive their expectations from the data and
assert the rule instead.

## 11. Files

Added:

- `src/lib/roadmap/schedule.ts`, `src/lib/roadmap/__tests__/schedule.test.ts`
- `src/components/roadmap/RoadmapArc.astro`, `ThisWeek.astro`, `RoadmapPractice.astro`
- `src/scripts/roadmap-schedule.ts`

Changed:

- `src/data/roadmap.ts` — phases, `WEEK_ONE`, derived spans
- `src/lib/roadmap/arrange.ts` — the §9 window
- `src/components/roadmap/RoadmapInspector.astro` — pairings
- `src/pages/roadmap.astro` — the three new sections
- `src/lib/roadmap/__tests__/arrange.test.ts`, the roadmap contract test
- `CLAUDE.md` — the roadmap paragraph

## 12. After the merge

`roadmap/roadmap-schedule.html` becomes a second copy of the plan the moment
`/roadmap` carries all four of its parts — precisely the condition that produced
the drift in §1. The owner keeps it, alongside `roadmap-preview.html`, as a
design artifact; so it is pinned by a test rather than trusted.

The mockup prints a start date bare and an end date with `, YYYY` only when that
end leaves 2026. `src/__tests__/schedule-mockup-contract.test.ts` formats the
*derived* dates that way and asserts the file contains the result — a direction
that cannot be fooled, since a date the mockup lacks fails and a date it carries
that the plan no longer implies fails too. It reads a repo source file, not
`dist/`, so it needs no build. It also pins the plan's stated length at 23 weeks,
which `roadmap/study-guide.html` had already drifted from.
