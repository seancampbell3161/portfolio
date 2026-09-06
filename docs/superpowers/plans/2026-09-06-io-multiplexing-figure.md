# The I/O Multiplexing Figure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static PNG at the end of the I/O multiplexing essay with an interactive figure that plays one event-loop wake at a time under select, poll or epoll and states the scan cost in words.

**Architecture:** A pure model (`src/lib/figures/io-multiplexing.ts`) owns every number and sentence: arrivals from a seeded generator, what each mechanism checks, tallies, the phase schedule of a wake and the frame at any elapsed time. An Astro component server-renders the figure in a no-JS still frame with the controls hidden; a re-runnable script reveals the controls and paints whatever frame the model says shows at the elapsed time on an animation-frame loop, holding no timers of its own.

**Tech Stack:** Astro 5 (MDX content, scoped styles, hoisted `<script>`), TypeScript, Vitest for the model and the dist-reading contract test, Playwright in `scripts/interactions.mjs` for the browser pass. Node 20.

**Spec:** `docs/superpowers/specs/2026-09-06-io-multiplexing-figure-design.md`

## Global Constraints

- Node 20. Run `npm test` for the unit suite, `npm run check` for build plus suite, `npm run e2e` against a running `npm run preview`.
- Unit tests live beside their module under `__tests__/` and import the module with a `.js` extension (`from "../io-multiplexing.js"`), like every test in `src/lib`.
- Commit messages carry no attribution trailer (Sean's global instruction; every commit on main follows it). Subject line in the `type(scope): what` form used on main.
- Copy is exact: the sentences in spec §4.6 and the figcaption in spec §5 are the strings the code prints. The tally dash is the em dash character `—`.
- The figure's internals are `div` and `span` (the tally is the one `dl`); never `p`, `ol` or `li` (spec §5). No `:global()` in the component's styles; the script clones the first cell so the scoped attribute survives.
- Timings in milliseconds exactly as spec §4.5: sweep 640 / 1280 / 2048 at 8 / 32 / 128; arrive 350, return 700, handle 450, still 2000, gap 500.
- Breakpoint 900px, written as `@media (max-width: 899.98px)` like `reader.css`.
- The site's `--c` (the writing lane's gold on the essay page) is the figure's accent; no other accent colour.
- Import Astro-free code from components and scripts with relative paths (`../../lib/figures/io-multiplexing`), as `RightNow.astro` and `src/scripts/timeline/now.ts` do.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/figures/io-multiplexing.ts` | The model: mechanisms and counts, seeded arrivals, a wake, tallies, schedule and frame, wording, the still frame. Pure. |
| `src/lib/figures/__tests__/io-multiplexing.test.ts` | Unit tests for the model. |
| `src/components/figures/IoMultiplexing.astro` | The figure's markup in its still frame, its scoped styles, the script import. |
| `src/scripts/figures/io-multiplexing.ts` | `initIoFigure()`: reveals the toolbar, runs wakes on an animation-frame loop, handles the controls. Re-runnable. |
| `src/content/blog/io-multiplexing.mdx` | Imports the component in place of the PNG figure. |
| `src/__tests__/figure-contract.test.ts` | Reads `dist/blog/*/index.html`; keeps the hooks and the no-JS state. |
| `scripts/interactions.mjs` | A new e2e section on the essay, desktop and phone. |
| `CLAUDE.md` | A "Figures" paragraph and the `npm run e2e` line. |

Tasks 1 to 3 build the model in three test-driven slices. Task 4 renders it. Task 5 animates it and proves it in the browser. Task 6 documents it and runs everything.

---

### Task 1: The model, part 1: mechanisms, counts, arrivals, wakes, tallies

**Files:**
- Create: `src/lib/figures/io-multiplexing.ts`
- Test: `src/lib/figures/__tests__/io-multiplexing.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (spec §4.1 to §4.4):
  - `MECHANISMS: readonly ["select", "poll", "epoll"]`, `type Mechanism`, `COUNTS: readonly [8, 32, 128]`, `type Count`, `CALL_NAME: Record<Mechanism, string>`
  - `columns(count: Count): 8 | 16`, `numbered(count: Count): boolean`
  - `isMechanism(s: string | null | undefined): s is Mechanism`, `isCount(n: number): n is Count`
  - `seeded(seed: number): () => number`, `seedFor(count: Count, n: number): number`, `ARRIVAL_CHANCE`, `arrivals(count: Count, random: () => number): number[]`
  - `interface Wake { n: number; mechanism: Mechanism; count: Count; ready: number[]; checked: number }`, `checked(mechanism, count, ready: number): number`, `wake(mechanism, count, n): Wake`
  - `interface Tally { wakes: number; checked: number; ready: number }`, `type Tallies = Record<Mechanism, Tally>`, `emptyTallies(): Tallies`, `addWake(tallies, w): Tallies`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/figures/__tests__/io-multiplexing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ARRIVAL_CHANCE,
  COUNTS,
  MECHANISMS,
  addWake,
  arrivals,
  checked,
  columns,
  emptyTallies,
  isCount,
  isMechanism,
  numbered,
  seedFor,
  seeded,
  wake,
} from "../io-multiplexing.js";

describe("mechanisms and counts (spec §4.1)", () => {
  it("names the three mechanisms and three counts in display order", () => {
    expect([...MECHANISMS]).toEqual(["select", "poll", "epoll"]);
    expect([...COUNTS]).toEqual([8, 32, 128]);
  });

  it("lays 8 sockets in one row and the rest in 16 columns", () => {
    expect(columns(8)).toBe(8);
    expect(columns(32)).toBe(16);
    expect(columns(128)).toBe(16);
  });

  it("numbers the cells at 8 and 32 only", () => {
    expect(numbered(8)).toBe(true);
    expect(numbered(32)).toBe(true);
    expect(numbered(128)).toBe(false);
  });

  it("guards strings and numbers read from the DOM", () => {
    expect(isMechanism("poll")).toBe(true);
    expect(isMechanism("kqueue")).toBe(false);
    expect(isMechanism(undefined)).toBe(false);
    expect(isCount(32)).toBe(true);
    expect(isCount(64)).toBe(false);
    expect(isCount(Number.NaN)).toBe(false);
  });
});

describe("the seeded generator (spec §4.2)", () => {
  it("repeats for a seed and differs across seeds", () => {
    const a = seeded(7);
    const b = seeded(7);
    const c = seeded(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it("stays in [0, 1)", () => {
    const r = seeded(123);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("seeds by count and wake number, never by mechanism", () => {
    expect(seedFor(32, 3)).not.toBe(seedFor(32, 4));
    expect(seedFor(32, 3)).not.toBe(seedFor(128, 3));
  });
});

describe("arrivals (spec §4.2)", () => {
  it("is never empty, ascending and within range", () => {
    for (const count of COUNTS) {
      for (let n = 1; n <= 200; n++) {
        const ready = arrivals(count, seeded(seedFor(count, n)));
        expect(ready.length).toBeGreaterThan(0);
        expect(ready).toEqual([...ready].sort((a, b) => a - b));
        expect(ready[0]).toBeGreaterThanOrEqual(0);
        expect(ready[ready.length - 1]).toBeLessThan(count);
        expect(new Set(ready).size).toBe(ready.length);
      }
    }
  });

  it("lands near one in twelve at 128, a few among many idle", () => {
    let total = 0;
    for (let n = 1; n <= 1000; n++) total += arrivals(128, seeded(seedFor(128, n))).length;
    const mean = total / 1000;
    expect(ARRIVAL_CHANCE).toBeCloseTo(1 / 12, 10);
    expect(mean).toBeGreaterThan(9.5);
    expect(mean).toBeLessThan(12);
  });

  it("forces one ready socket when the draw leaves none", () => {
    // A generator that never fires the chance, then picks socket 5 of 8.
    const never = [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 5 / 8];
    let i = 0;
    expect(arrivals(8, () => never[i++]!)).toEqual([5]);
  });
});

describe("a wake (spec §4.3)", () => {
  it("checked is the count for select and poll and the ready size for epoll", () => {
    expect(checked("select", 32, 3)).toBe(32);
    expect(checked("poll", 128, 10)).toBe(128);
    expect(checked("epoll", 128, 10)).toBe(10);
  });

  it("delivers the same data to every mechanism for the same count and number", () => {
    const s = wake("select", 32, 3);
    const p = wake("poll", 32, 3);
    const e = wake("epoll", 32, 3);
    expect(p.ready).toEqual(s.ready);
    expect(e.ready).toEqual(s.ready);
    expect(s.checked).toBe(32);
    expect(e.checked).toBe(s.ready.length);
    expect(s).toMatchObject({ n: 3, mechanism: "select", count: 32 });
  });

  it("differs between wake numbers", () => {
    const sets = [1, 2, 3, 4, 5].map((n) => JSON.stringify(wake("select", 32, n).ready));
    expect(new Set(sets).size).toBeGreaterThan(1);
  });
});

describe("tallies (spec §4.4)", () => {
  it("starts at zero for every mechanism", () => {
    expect(emptyTallies()).toEqual({
      select: { wakes: 0, checked: 0, ready: 0 },
      poll: { wakes: 0, checked: 0, ready: 0 },
      epoll: { wakes: 0, checked: 0, ready: 0 },
    });
  });

  it("accumulates one mechanism's wakes without touching the others, returning a new object", () => {
    const t0 = emptyTallies();
    const t1 = addWake(t0, { n: 1, mechanism: "select", count: 32, ready: [4, 19, 27], checked: 32 });
    const t2 = addWake(t1, { n: 2, mechanism: "select", count: 32, ready: [9], checked: 32 });
    expect(t0.select.wakes).toBe(0);
    expect(t1).not.toBe(t0);
    expect(t2.select).toEqual({ wakes: 2, checked: 64, ready: 4 });
    expect(t2.epoll).toEqual({ wakes: 0, checked: 0, ready: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/figures`
Expected: FAIL, the module `../io-multiplexing.js` cannot be resolved.

- [ ] **Step 3: Write the model, part 1**

Create `src/lib/figures/io-multiplexing.ts`:

```ts
// src/lib/figures/io-multiplexing.ts
// The model behind the I/O multiplexing figure (interactions 5, spec §4): which
// sockets have data on a wake, what each mechanism examines to find out, the
// running tallies, the phase schedule of one wake, and every sentence the
// figure prints. Pure, no DOM: the component imports it at build time for the
// still frame and the script at run time, so the two cannot disagree.

export const MECHANISMS = ["select", "poll", "epoll"] as const;
export type Mechanism = (typeof MECHANISMS)[number];
export const COUNTS = [8, 32, 128] as const;
export type Count = (typeof COUNTS)[number];

export const CALL_NAME: Record<Mechanism, string> = {
  select: "select()",
  poll: "poll()",
  epoll: "epoll_wait()",
};

/** Grid columns (spec §3): one row at 8, 16 columns above. */
export function columns(count: Count): 8 | 16 {
  return count === 8 ? 8 : 16;
}

/** Cells carry their fd number at 8 and 32; at 128 they are too small to. */
export function numbered(count: Count): boolean {
  return count !== 128;
}

export function isMechanism(s: string | null | undefined): s is Mechanism {
  return (MECHANISMS as readonly string[]).includes(s ?? "");
}

export function isCount(n: number): n is Count {
  return (COUNTS as readonly number[]).includes(n);
}

// ---- arrivals (spec §4.2) ----

/** mulberry32: a small seeded generator with values in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seed depends on the count and the wake number only, never on the
 * mechanism, so wake 3 at 32 sockets delivers the same data to select, poll
 * and epoll and the tally compares the mechanisms rather than their luck.
 */
export function seedFor(count: Count, n: number): number {
  return count * 1000 + n;
}

export const ARRIVAL_CHANCE = 1 / 12;

/**
 * Ascending fds with data this wake. Never empty: the call would not have
 * returned otherwise, so a draw that leaves none picks one socket instead.
 */
export function arrivals(count: Count, random: () => number): number[] {
  const ready: number[] = [];
  for (let fd = 0; fd < count; fd++) if (random() < ARRIVAL_CHANCE) ready.push(fd);
  if (ready.length === 0) ready.push(Math.floor(random() * count));
  return ready;
}

// ---- a wake (spec §4.3) ----

export interface Wake {
  /** 1-based wake number for this mechanism at this count. */
  n: number;
  mechanism: Mechanism;
  count: Count;
  ready: number[];
  checked: number;
}

/** The thesis in one line: select and poll examine every descriptor they were handed; epoll only what the kernel returns. */
export function checked(mechanism: Mechanism, count: Count, ready: number): number {
  return mechanism === "epoll" ? ready : count;
}

export function wake(mechanism: Mechanism, count: Count, n: number): Wake {
  const ready = arrivals(count, seeded(seedFor(count, n)));
  return { n, mechanism, count, ready, checked: checked(mechanism, count, ready.length) };
}

// ---- tallies (spec §4.4) ----

export interface Tally {
  wakes: number;
  checked: number;
  ready: number;
}
export type Tallies = Record<Mechanism, Tally>;

export function emptyTallies(): Tallies {
  return {
    select: { wakes: 0, checked: 0, ready: 0 },
    poll: { wakes: 0, checked: 0, ready: 0 },
    epoll: { wakes: 0, checked: 0, ready: 0 },
  };
}

/** Accumulates across mechanism switches; the caller resets on a count change. Returns a new object. */
export function addWake(tallies: Tallies, w: Wake): Tallies {
  const t = tallies[w.mechanism];
  return {
    ...tallies,
    [w.mechanism]: { wakes: t.wakes + 1, checked: t.checked + w.checked, ready: t.ready + w.ready.length },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/figures`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/figures/io-multiplexing.ts src/lib/figures/__tests__/io-multiplexing.test.ts
git commit -m "feat(figure): the I/O multiplexing model: seeded arrivals, what each mechanism checks, tallies"
```

---

### Task 2: The model, part 2: the schedule and the frame

**Files:**
- Modify: `src/lib/figures/io-multiplexing.ts` (append)
- Test: `src/lib/figures/__tests__/io-multiplexing.test.ts` (append)

**Interfaces:**
- Consumes: `Mechanism`, `Count` from Task 1.
- Produces (spec §4.5):
  - `type Phase = "idle" | "arrive" | "sweep" | "return" | "handle"`
  - `interface Step { phase: Phase; at: number }`, `interface Schedule { steps: Step[]; duration: number }`
  - `SWEEP_MS: Record<Count, number>` = `{ 8: 640, 32: 1280, 128: 2048 }`
  - `HOLD_MS` = `{ arrive: 350, return: 700, handle: 450, still: 2000, gap: 500 }`
  - `schedule(mechanism: Mechanism, count: Count, reduceMotion: boolean): Schedule`
  - `interface Frame { phase: Phase; scan: number | null }`
  - `frameAt(s: Schedule, count: Count, elapsed: number): Frame`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/figures/__tests__/io-multiplexing.test.ts` (extend the import at the top with `HOLD_MS, SWEEP_MS, frameAt, schedule`):

```ts
describe("the schedule (spec §4.5)", () => {
  it("runs select and poll through arrive, sweep, return, handle, idle", () => {
    const s = schedule("select", 32, false);
    expect(s.steps).toEqual([
      { phase: "arrive", at: 0 },
      { phase: "sweep", at: 350 },
      { phase: "return", at: 350 + 1280 },
      { phase: "handle", at: 350 + 1280 + 700 },
      { phase: "idle", at: 350 + 1280 + 700 + 450 },
    ]);
    expect(s.duration).toBe(2780);
    expect(schedule("poll", 128, false).steps.find((st) => st.phase === "return")?.at).toBe(350 + 2048);
    expect(schedule("poll", 8, false).steps.find((st) => st.phase === "return")?.at).toBe(350 + 640);
  });

  it("has no sweep for epoll", () => {
    const s = schedule("epoll", 32, false);
    expect(s.steps.map((st) => st.phase)).toEqual(["arrive", "return", "handle", "idle"]);
    expect(s.steps.map((st) => st.at)).toEqual([0, 350, 1050, 1500]);
    expect(s.duration).toBe(1500);
  });

  it("is a single held return frame under reduced motion", () => {
    for (const m of ["select", "epoll"] as const) {
      const s = schedule(m, 128, true);
      expect(s.steps).toEqual([{ phase: "return", at: 0 }]);
      expect(s.duration).toBe(HOLD_MS.still);
    }
  });

  it("makes 128 one socket per frame at 60Hz", () => {
    expect(SWEEP_MS[128] / 128).toBe(16);
    expect(SWEEP_MS).toEqual({ 8: 640, 32: 1280, 128: 2048 });
    expect(HOLD_MS).toEqual({ arrive: 350, return: 700, handle: 450, still: 2000, gap: 500 });
  });
});

describe("the frame at a time (spec §4.5)", () => {
  const s32 = schedule("select", 32, false);
  const s128 = schedule("poll", 128, false);

  it("is arrive before the sweep and idle at the end", () => {
    expect(frameAt(s32, 32, 0)).toEqual({ phase: "arrive", scan: null });
    expect(frameAt(s32, 32, 349)).toEqual({ phase: "arrive", scan: null });
    expect(frameAt(s32, 32, s32.duration)).toEqual({ phase: "idle", scan: null });
  });

  it("points at the middle socket halfway through the sweep and the last at its end", () => {
    expect(frameAt(s32, 32, 350 + 640)).toEqual({ phase: "sweep", scan: 16 });
    expect(frameAt(s32, 32, 350 + 1279)).toEqual({ phase: "sweep", scan: 31 });
    expect(frameAt(s32, 32, 350)).toEqual({ phase: "sweep", scan: 0 });
    expect(frameAt(s128, 128, 350 + 1024)).toEqual({ phase: "sweep", scan: 64 });
    expect(frameAt(s128, 128, 350 + 2047)).toEqual({ phase: "sweep", scan: 127 });
  });

  it("returns then handles with no scan", () => {
    expect(frameAt(s32, 32, 350 + 1280)).toEqual({ phase: "return", scan: null });
    expect(frameAt(s32, 32, 350 + 1280 + 700)).toEqual({ phase: "handle", scan: null });
  });

  it("holds the return frame under reduced motion", () => {
    const s = schedule("select", 8, true);
    expect(frameAt(s, 8, 0)).toEqual({ phase: "return", scan: null });
    expect(frameAt(s, 8, s.duration)).toEqual({ phase: "return", scan: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/figures`
Expected: FAIL, `schedule` is not exported.

- [ ] **Step 3: Append the schedule and the frame to the model**

Append to `src/lib/figures/io-multiplexing.ts`:

```ts
// ---- the schedule and the frame (spec §4.5) ----

export type Phase = "idle" | "arrive" | "sweep" | "return" | "handle";

export interface Step {
  phase: Phase;
  /** Milliseconds from the wake's start. */
  at: number;
}

export interface Schedule {
  steps: Step[];
  /** The loop ends here; the last step's phase is what stays on screen. */
  duration: number;
}

/** The whole sweep, so 128 is one socket per frame at 60Hz and visibly longer than 8. */
export const SWEEP_MS: Record<Count, number> = { 8: 640, 32: 1280, 128: 2048 };

export const HOLD_MS = { arrive: 350, return: 700, handle: 450, still: 2000, gap: 500 } as const;

/**
 * With motion: arrive, sweep (select and poll only), return, handle, idle.
 * Under reduced motion: a single return frame, held, so the trail and the
 * count checked are still visible; the next wake clears it.
 */
export function schedule(mechanism: Mechanism, count: Count, reduceMotion: boolean): Schedule {
  if (reduceMotion) return { steps: [{ phase: "return", at: 0 }], duration: HOLD_MS.still };
  const sweep = mechanism === "epoll" ? 0 : SWEEP_MS[count];
  const steps: Step[] = [{ phase: "arrive", at: 0 }];
  if (sweep > 0) steps.push({ phase: "sweep", at: HOLD_MS.arrive });
  const returned = HOLD_MS.arrive + sweep;
  const handle = returned + HOLD_MS.return;
  const idle = handle + HOLD_MS.handle;
  steps.push({ phase: "return", at: returned }, { phase: "handle", at: handle }, { phase: "idle", at: idle });
  return { steps, duration: idle };
}

export interface Frame {
  phase: Phase;
  /** During a sweep, the index of the socket under check; every socket up to it is seen. */
  scan: number | null;
}

export function frameAt(s: Schedule, count: Count, elapsed: number): Frame {
  let step = s.steps[0]!;
  for (const candidate of s.steps) if (candidate.at <= elapsed) step = candidate;
  if (step.phase !== "sweep") return { phase: step.phase, scan: null };
  const perSocket = SWEEP_MS[count] / count;
  return { phase: "sweep", scan: Math.min(count - 1, Math.floor((elapsed - step.at) / perSocket)) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/figures`
Expected: PASS, 23 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/figures/io-multiplexing.ts src/lib/figures/__tests__/io-multiplexing.test.ts
git commit -m "feat(figure): a wake's phase schedule and the frame at an elapsed time"
```

---

### Task 3: The model, part 3: wording and the still frame

**Files:**
- Modify: `src/lib/figures/io-multiplexing.ts` (append)
- Test: `src/lib/figures/__tests__/io-multiplexing.test.ts` (append)

**Interfaces:**
- Consumes: `Wake`, `Mechanism`, `Count`, `Frame`, `Tally` from Tasks 1 and 2.
- Produces (spec §4.6):
  - `fdList(ready: number[]): string`
  - `callStatus(w: Wake | null, mechanism: Mechanism, count: Count, frame: Frame): string`
  - `readyLine(w: Wake | null, frame: Frame): { title: string; note: string }`
  - `readoutText(w: Wake): string`, `resetText(count: Count): string`, `tallyText(t: Tally): string`
  - `STILL: Wake` = epoll, 32, ready `[4, 19, 27]`, checked 3, n 0; `stillText(): string`

- [ ] **Step 1: Write the failing tests**

Append to the test file (extend the import with `STILL, callStatus, fdList, readoutText, readyLine, resetText, stillText, tallyText`, and `type Frame`):

```ts
const at = (phase: Frame["phase"], scan: number | null = null): Frame => ({ phase, scan });
const w32 = (mechanism: "select" | "poll" | "epoll"): Wake => ({ n: 3, mechanism, count: 32, ready: [4, 19, 27], checked: mechanism === "epoll" ? 3 : 32 });
const w128: Wake = { n: 1, mechanism: "select", count: 128, ready: [4, 19, 27, 61, 77, 90, 102, 115, 121, 126, 127], checked: 128 };
const w1: Wake = { n: 1, mechanism: "epoll", count: 8, ready: [5], checked: 1 };

describe("wording (spec §4.6)", () => {
  it("lists up to four fds then counts the rest", () => {
    expect(fdList([4, 19, 27])).toBe("fd 4, 19, 27");
    expect(fdList([4, 19, 27, 61])).toBe("fd 4, 19, 27, 61");
    expect(fdList(w128.ready)).toBe("fd 4, 19, 27, 61 and 7 more");
    expect(fdList([5])).toBe("fd 5");
  });

  it("gives the call's status by phase and mechanism", () => {
    expect(callStatus(null, "select", 32, at("idle"))).toBe("blocked until a descriptor is ready");
    expect(callStatus(null, "epoll", 32, at("idle"))).toBe("blocked until the kernel has an event");
    expect(callStatus(w32("select"), "select", 32, at("arrive"))).toBe("blocked until a descriptor is ready");
    expect(callStatus(w32("select"), "select", 32, at("sweep", 13))).toBe("checking fd 13 of 32");
    expect(callStatus(w32("poll"), "poll", 32, at("sweep", 13))).toBe("checking entry 13 of 32");
    expect(callStatus(w32("select"), "select", 32, at("return"))).toBe("checked all 32");
    expect(callStatus(w32("poll"), "poll", 32, at("handle"))).toBe("checked all 32");
    expect(callStatus(w32("epoll"), "epoll", 32, at("return"))).toBe("returned 3 events");
    expect(callStatus(w1, "epoll", 8, at("return"))).toBe("returned 1 event");
  });

  it("fills the ready line from return on", () => {
    expect(readyLine(null, at("idle"))).toEqual({ title: "ready: nothing yet", note: "" });
    expect(readyLine(w32("select"), at("sweep", 3))).toEqual({ title: "ready: nothing yet", note: "" });
    expect(readyLine(w32("select"), at("return"))).toEqual({ title: "ready: fd 4, 19, 27", note: "29 checked for nothing" });
    expect(readyLine(w32("poll"), at("handle"))).toEqual({ title: "ready: fd 4, 19, 27", note: "29 checked for nothing" });
    expect(readyLine(w32("epoll"), at("return"))).toEqual({ title: "ready: fd 4, 19, 27", note: "the kernel kept the set; nothing else was touched" });
    expect(readyLine(w128, at("return")).title).toBe("ready: fd 4, 19, 27, 61 and 7 more");
  });

  it("states each wake in one sentence", () => {
    expect(readoutText(w32("select"))).toBe("Wake 3: select checked 32 descriptors to find 3 ready.");
    expect(readoutText(w32("poll"))).toBe("Wake 3: poll checked 32 entries to find 3 ready.");
    expect(readoutText(w32("epoll"))).toBe("Wake 3: epoll_wait returned the 3 ready descriptors without checking the other 29.");
    expect(readoutText(w1)).toBe("Wake 1: epoll_wait returned the 1 ready descriptor without checking the other 7.");
  });

  it("resets and tallies", () => {
    expect(resetText(128)).toBe("No wakes yet at 128 sockets. Press Next wake.");
    expect(tallyText({ wakes: 0, checked: 0, ready: 0 })).toBe("—");
    expect(tallyText({ wakes: 1, checked: 32, ready: 3 })).toBe("1 wake · 32 checked · 3 ready");
    expect(tallyText({ wakes: 3, checked: 96, ready: 9 })).toBe("3 wakes · 96 checked · 9 ready");
  });

  it("keeps the still frame and its sentence together", () => {
    expect(STILL).toEqual({ n: 0, mechanism: "epoll", count: 32, ready: [4, 19, 27], checked: 3 });
    expect(stillText()).toBe(
      "epoll_wait returned the 3 ready descriptors of 32 without checking the other 29. select or poll would have checked all 32.",
    );
  });
});
```

Add `type Wake` to the import line as well.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/figures`
Expected: FAIL, `fdList` is not exported.

- [ ] **Step 3: Append the wording to the model**

Append to `src/lib/figures/io-multiplexing.ts`:

```ts
// ---- wording (spec §4.6) ----

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "fd 4, 19, 27", or "fd 4, 19, 27, 61 and 7 more" past four. */
export function fdList(ready: number[]): string {
  const shown = ready.slice(0, 4);
  const rest = ready.length - shown.length;
  return `fd ${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
}

/** The call box's one-line status. `w` is null before the first wake. */
export function callStatus(w: Wake | null, mechanism: Mechanism, count: Count, frame: Frame): string {
  switch (frame.phase) {
    case "sweep":
      return `checking ${mechanism === "poll" ? "entry" : "fd"} ${frame.scan ?? 0} of ${count}`;
    case "return":
    case "handle":
      return mechanism === "epoll" ? `returned ${plural(w?.ready.length ?? 0, "event")}` : `checked all ${count}`;
    default:
      return mechanism === "epoll" ? "blocked until the kernel has an event" : "blocked until a descriptor is ready";
  }
}

/** The ready box: empty until the call returns. */
export function readyLine(w: Wake | null, frame: Frame): { title: string; note: string } {
  if (!w || (frame.phase !== "return" && frame.phase !== "handle")) return { title: "ready: nothing yet", note: "" };
  const note =
    w.mechanism === "epoll"
      ? "the kernel kept the set; nothing else was touched"
      : `${w.count - w.ready.length} checked for nothing`;
  return { title: `ready: ${fdList(w.ready)}`, note };
}

/** The live readout, one sentence per wake. */
export function readoutText(w: Wake): string {
  const ready = w.ready.length;
  switch (w.mechanism) {
    case "select":
      return `Wake ${w.n}: select checked ${plural(w.count, "descriptor")} to find ${ready} ready.`;
    case "poll":
      return `Wake ${w.n}: poll checked ${plural(w.count, "entry", "entries")} to find ${ready} ready.`;
    case "epoll":
      return `Wake ${w.n}: epoll_wait returned the ${plural(ready, "ready descriptor")} without checking the other ${w.count - ready}.`;
  }
}

/** After a count change. */
export function resetText(count: Count): string {
  return `No wakes yet at ${count} sockets. Press Next wake.`;
}

export function tallyText(t: Tally): string {
  if (t.wakes === 0) return "—";
  return `${plural(t.wakes, "wake")} · ${t.checked} checked · ${t.ready} ready`;
}

/** The no-JS frame (spec §5): epoll at 32 with three sockets ready, a completed wake. */
export const STILL: Wake = { n: 0, mechanism: "epoll", count: 32, ready: [4, 19, 27], checked: 3 };

export function stillText(): string {
  const ready = STILL.ready.length;
  return `epoll_wait returned the ${ready} ready descriptors of ${STILL.count} without checking the other ${STILL.count - ready}. select or poll would have checked all ${STILL.count}.`;
}
```

- [ ] **Step 4: Run the whole unit suite**

Run: `npm test`
Expected: PASS, every existing test plus 29 in `src/lib/figures`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/figures/io-multiplexing.ts src/lib/figures/__tests__/io-multiplexing.test.ts
git commit -m "feat(figure): every sentence the figure prints, and the still frame"
```

---

### Task 4: The component in the essay, and the contract test

**Files:**
- Create: `src/components/figures/IoMultiplexing.astro`
- Create: `src/scripts/figures/io-multiplexing.ts` (a stub, so the component's script import builds; Task 5 fills it)
- Modify: `src/content/blog/io-multiplexing.mdx` (the `<figure>` at the end)
- Delete: `public/images/io_multiplexing_select_poll_epoll.png`
- Create: `src/__tests__/figure-contract.test.ts`

**Interfaces:**
- Consumes from the model: `CALL_NAME`, `COUNTS`, `MECHANISMS`, `STILL`, `callStatus`, `columns`, `emptyTallies`, `numbered`, `readyLine`, `stillText`, `tallyText`, `type Frame`.
- Produces the hooks the script (Task 5) and the e2e query, exactly as spec §5: root `[data-io-figure]` with `data-mechanism`, `data-count`, `data-phase`; `[data-io-controls]` (hidden); buttons `[data-io-mechanism="select|poll|epoll"]`, `[data-io-count="8|32|128"]`, `[data-io-step]`, `[data-io-play]`; `[data-io-grid]` with `--cols` and `data-numbered`; cells `[data-io-cell][data-fd]` with `data-state`, `data-seen`, `data-scan`; `[data-io-call]` with `[data-io-call-name]` and `[data-io-call-status]`; `[data-io-ready]` with `[data-io-ready-title]` and `[data-io-ready-note]`; `[data-io-thread]`; `[data-io-readout]`; `[data-io-tally="select|poll|epoll"]`.

- [ ] **Step 1: Write the failing contract test**

Create `src/__tests__/figure-contract.test.ts`:

```ts
// The I/O multiplexing figure is server-rendered inside one essay, and
// src/scripts/figures/io-multiplexing.ts finds every part by data attribute.
// A markup change can break the figure with a green unit suite and a clean
// build, so this scans the built essays, finds the one that carries it (by
// hook, not by slug, so a rename cannot silently skip it), and asserts the
// hooks and the no-script state. It needs dist/, so it is skipped without
// one; `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "dist/blog";
const pages = existsSync(DIR)
  ? readdirSync(DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(DIR, d.name, "index.html"))
      .filter((p) => existsSync(p))
  : [];
const withFigure = pages.filter((p) => readFileSync(p, "utf8").includes("data-io-figure"));

describe.skipIf(pages.length === 0)("figure client contract (dist/blog/*)", () => {
  const html = withFigure[0] ? readFileSync(withFigure[0], "utf8") : "";

  it("exactly one essay carries the figure", () => {
    expect(withFigure).toHaveLength(1);
  });

  it("ships the still frame: epoll at 32, idle, not yet live", () => {
    expect(html).toMatch(/<figure class="iom[^"]*" data-io-figure data-mechanism="epoll" data-count="32" data-phase="idle"/);
    expect(html).not.toMatch(/<figure[^>]*data-live/);
  });

  it("ships the toolbar hidden, with every control", () => {
    expect(html).toMatch(/<div class="iom-bar[^"]*" data-io-controls hidden/);
    for (const hook of [
      'data-io-mechanism="select" aria-pressed="false"',
      'data-io-mechanism="epoll" aria-pressed="true"',
      'data-io-count="8" aria-pressed="false"',
      'data-io-count="32" aria-pressed="true"',
      'data-io-count="128" aria-pressed="false"',
      "data-io-step",
      'data-io-play aria-pressed="false"',
    ]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
  });

  // The inlined stylesheet names some attributes in its selectors, so the
  // cell counts match the elements, not the bare attribute.
  it("keeps the grid decorative, 16 columns, numbered, with 32 cells and three found", () => {
    expect(html).toMatch(/<div class="iom-grid[^"]*" data-io-grid aria-hidden="true" style="--cols:16;?" data-numbered/);
    expect(html.match(/<div class="iom-cell[^"]*" data-io-cell data-fd="\d+"/g)).toHaveLength(32);
    expect(html.match(/<div class="iom-cell[^"]*" data-io-cell data-fd="\d+" data-state="found"/g)).toHaveLength(3);
  });

  it("keeps the boxes the script writes into", () => {
    for (const hook of ["data-io-call-name", "data-io-call-status", "data-io-ready-title", "data-io-ready-note", "data-io-thread"]) {
      expect(html, `missing ${hook}`).toContain(hook);
    }
    expect(html).toContain("returned 3 events");
    expect(html).toContain("ready: fd 4, 19, 27");
  });

  it("keeps the readout live and stating the thesis, and a dash in every tally row", () => {
    expect(html).toMatch(/data-io-readout aria-live="polite"/);
    expect(html).toContain("epoll_wait returned the 3 ready descriptors of 32 without checking the other 29. select or poll would have checked all 32.");
    for (const m of ["select", "poll", "epoll"]) {
      expect(html).toMatch(new RegExp(`data-io-tally="${m}"[^>]*>—<`));
    }
  });

  it("no longer references the old PNG", () => {
    expect(html).not.toContain("io_multiplexing_select_poll_epoll.png");
  });
});
```

- [ ] **Step 2: Build and run the contract test to verify it fails**

Run: `npm run build && npx vitest run src/__tests__/figure-contract.test.ts`
Expected: FAIL on "exactly one essay carries the figure" (zero found).

- [ ] **Step 3: Stub the script so the component builds**

Create `src/scripts/figures/io-multiplexing.ts` with only:

```ts
// src/scripts/figures/io-multiplexing.ts
// Filled in by the next task.
export function initIoFigure(): void {}
initIoFigure();
```

- [ ] **Step 4: Write the component**

Create `src/components/figures/IoMultiplexing.astro`:

```astro
---
// src/components/figures/IoMultiplexing.astro
// The I/O multiplexing figure (interactions 5, spec §5): one event-loop wake
// at a time under select, poll or epoll. Server-rendered in its still frame
// (epoll at 32 with three sockets ready, a completed wake) with the toolbar
// hidden; src/scripts/figures/io-multiplexing.ts reveals it and runs wakes.
// The internals are div and span so the reader's prose rules never reach
// them, and the script rebuilds the grid by cloning the first cell so the
// scoped-style attribute survives on every cell.
import {
  CALL_NAME,
  COUNTS,
  MECHANISMS,
  STILL,
  callStatus,
  columns,
  emptyTallies,
  numbered,
  readyLine,
  stillText,
  tallyText,
  type Frame,
} from "../../lib/figures/io-multiplexing";

// The still frame reads as a completed wake (return wording) with no box lit (idle phase).
const returned: Frame = { phase: "return", scan: null };
const status = callStatus(STILL, STILL.mechanism, STILL.count, returned);
const ready = readyLine(STILL, returned);
const tallies = emptyTallies();
const fds = Array.from({ length: STILL.count }, (_, fd) => fd);
const found = new Set(STILL.ready);
---

<figure class="iom" data-io-figure data-mechanism={STILL.mechanism} data-count={STILL.count} data-phase="idle">
  <div class="iom-bar" data-io-controls hidden>
    <div class="iom-seg" role="group" aria-label="Mechanism">
      {MECHANISMS.map((m) => (
        <button type="button" data-io-mechanism={m} aria-pressed={m === STILL.mechanism ? "true" : "false"}>{m}</button>
      ))}
    </div>
    <div class="iom-seg" role="group" aria-label="Sockets">
      {COUNTS.map((c) => (
        <button type="button" data-io-count={c} aria-pressed={c === STILL.count ? "true" : "false"}>{c}</button>
      ))}
    </div>
    <div class="iom-run">
      <button type="button" class="iom-step" data-io-step>Next wake</button>
      <button type="button" class="iom-play" data-io-play aria-pressed="false">Play</button>
    </div>
  </div>

  <div class="iom-grid" data-io-grid aria-hidden="true" style={`--cols:${columns(STILL.count)}`} data-numbered={numbered(STILL.count)}>
    {fds.map((fd) => (
      <div class="iom-cell" data-io-cell data-fd={fd} data-state={found.has(fd) ? "found" : undefined}><span>{fd}</span></div>
    ))}
  </div>

  <div class="iom-arrow" aria-hidden="true">↓</div>
  <div class="iom-box iom-call" data-io-call>
    <b data-io-call-name>{CALL_NAME[STILL.mechanism]}</b>
    <span data-io-call-status>{status}</span>
  </div>
  <div class="iom-arrow" aria-hidden="true">↓</div>
  <div class="iom-box iom-ready" data-io-ready>
    <b data-io-ready-title>{ready.title}</b>
    <span data-io-ready-note>{ready.note}</span>
  </div>
  <div class="iom-arrow" aria-hidden="true">↓</div>
  <div class="iom-box iom-thread" data-io-thread>
    <b>one thread</b>
    <span>handles the ready descriptors, then loops back and blocks again</span>
  </div>

  <div class="iom-readout">
    <div class="iom-sentence" data-io-readout aria-live="polite">{stillText()}</div>
    <dl class="iom-tally">
      {MECHANISMS.map((m) => (
        <>
          <dt>{m}</dt>
          <dd data-io-tally={m}>{tallyText(tallies[m])}</dd>
        </>
      ))}
    </dl>
  </div>

  <figcaption>One thread, many sockets. Data lands on a few, the wait call reports which, the thread handles those and blocks again. select and poll check every descriptor to find out; epoll is told.</figcaption>
</figure>

<script>
  import "../../scripts/figures/io-multiplexing";
</script>

<style>
  .iom {
    margin: 8px 0 32px;
    font-size: 14px;
    line-height: 1.4;
    color: var(--color-text-secondary);
    /* A checked socket: darker than the page, so the trail reads as "touched". */
    --seen: color-mix(in srgb, var(--color-bg) 80%, black);
  }

  /* Toolbar: the zoom control's look (TransportBar.astro). display:flex would
     beat the hidden attribute, so the hidden state is restated. */
  .iom-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    margin-bottom: 16px;
  }
  .iom-bar[hidden] {
    display: none;
  }
  .iom-seg {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .iom-seg button {
    padding: 5px 11px;
    background: none;
    border: 0;
    border-right: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font: inherit;
    cursor: pointer;
  }
  .iom-seg button:last-child {
    border-right: 0;
  }
  .iom-seg button[aria-pressed="true"] {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
  .iom-run {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .iom-run button {
    padding: 5px 12px;
    border: 1px solid var(--color-border-hover);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .iom-step {
    border-color: var(--c);
    color: var(--c);
  }
  .iom-step[aria-disabled="true"] {
    opacity: 0.5;
    cursor: default;
  }
  .iom-play[aria-pressed="true"] {
    background: var(--color-bg-hover);
    border-color: var(--c);
  }
  .iom button:focus-visible {
    outline: 2px solid var(--c);
    outline-offset: 2px;
  }

  /* The grid: --cols from the model (8 at 8, else 16). */
  .iom-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 5px;
  }
  .iom-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: var(--color-bg-elevated);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-faint);
    transition:
      background-color 150ms,
      border-color 150ms;
  }
  .iom-grid:not([data-numbered]) .iom-cell span {
    display: none;
  }
  .iom-cell[data-state="ready"] {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, var(--color-bg-elevated));
    color: var(--c);
  }
  .iom-cell[data-seen] {
    border-color: var(--color-bg-hover);
    background: var(--seen);
  }
  .iom-cell[data-seen][data-state="ready"] {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 16%, var(--color-bg-elevated));
  }
  .iom-cell[data-state="found"],
  .iom-cell[data-seen][data-state="found"] {
    border-color: var(--c);
    background: var(--c);
    color: var(--color-bg);
  }
  .iom-cell[data-scan] {
    box-shadow: 0 0 0 2px var(--color-text-primary);
    color: var(--color-text-primary);
  }

  /* The pipeline under the grid. */
  .iom-arrow {
    text-align: center;
    color: var(--color-text-faint);
    line-height: 1;
    padding: 6px 0;
  }
  .iom-box {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    padding: 10px 14px;
    text-align: center;
    transition: border-color 150ms;
  }
  .iom-box b {
    display: block;
    color: var(--color-text-primary);
    font-weight: 600;
  }
  .iom-box span {
    display: block;
    color: var(--color-text-muted);
    font-size: 12.5px;
    min-height: 1.4em;
  }
  .iom[data-phase="sweep"] .iom-call,
  .iom[data-phase="return"] .iom-ready,
  .iom[data-phase="handle"] .iom-thread {
    border-color: var(--c);
  }

  /* The readout and the tally. */
  .iom-readout {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
  }
  .iom-sentence {
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }
  .iom-tally {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 16px;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .iom-tally dt {
    color: var(--color-text-muted);
  }
  .iom-tally dd {
    margin: 0;
  }

  @media (max-width: 899.98px) {
    .iom-grid {
      gap: 3px;
    }
    .iom-cell {
      border-radius: 2px;
      font-size: 10px;
    }
    .iom-run {
      margin-left: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .iom-cell,
    .iom-box {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 5: Place it in the essay and remove the PNG**

In `src/content/blog/io-multiplexing.mdx`, add the import on the line after the closing `---` of the frontmatter, leaving a blank line after it:

```mdx
import IoMultiplexing from "../../components/figures/IoMultiplexing.astro";
```

Replace the whole `<figure>...</figure>` block at the end of the file (the one wrapping `io_multiplexing_select_poll_epoll.png`) with:

```mdx
<IoMultiplexing />
```

Then delete the picture:

```bash
git rm public/images/io_multiplexing_select_poll_epoll.png
```

- [ ] **Step 6: Build and run the contract test to verify it passes**

Run: `npm run build && npx vitest run src/__tests__/figure-contract.test.ts`
Expected: PASS, 7 tests. If the `style="--cols:16"` assertion fails on a trailing semicolon or quoting, read the built attribute in `dist/blog/io-multiplexing/index.html` and adjust the regex to the exact serialization; do not change the component.

- [ ] **Step 7: Look at the still frame**

Start the preview in the background and screenshot the figure:

```bash
npm run preview &
sleep 2
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const p = await b.newPage({ viewport: vp, javaScriptEnabled: false });
    await p.goto("http://localhost:4321/blog/io-multiplexing", { waitUntil: "networkidle" });
    await p.locator("[data-io-figure]").screenshot({ path: `/private/tmp/claude-501/-Users-seancampbell-Documents-source-repos-portfolio/5830cbea-18e7-4d1a-83de-24ef837b1053/scratchpad/still-${name}.png` });
    await p.close();
  }
  await b.close();
})();
'
```

Open both PNGs with the Read tool. Expected: no toolbar; a 16-column grid of 32 numbered cells with 4, 19 and 27 solid gold; three boxes reading "epoll_wait()" / "returned 3 events", "ready: fd 4, 19, 27" / "the kernel kept the set; nothing else was touched", "one thread"; the readout sentence; three tally rows with dashes; the caption. On the phone the grid still has 16 columns and nothing overflows the viewport. Stop the preview afterwards (`kill %1` or the job's pid).

- [ ] **Step 8: Run the full suite and commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/components/figures/IoMultiplexing.astro src/scripts/figures/io-multiplexing.ts src/content/blog/io-multiplexing.mdx src/__tests__/figure-contract.test.ts
git commit -m "feat(figure): the I/O multiplexing figure's markup and still frame replace the PNG; a contract test"
```

(The `git rm` from Step 5 is already staged.)

---

### Task 5: The script, proven by the e2e section

**Files:**
- Modify: `src/scripts/figures/io-multiplexing.ts` (replace the stub)
- Modify: `scripts/interactions.mjs` (insert a section before `// ---- nothing threw anywhere ----`)

**Interfaces:**
- Consumes from the model: `CALL_NAME`, `HOLD_MS`, `MECHANISMS`, `addWake`, `callStatus`, `columns`, `emptyTallies`, `frameAt`, `isCount`, `isMechanism`, `numbered`, `readoutText`, `readyLine`, `resetText`, `schedule`, `tallyText`, `wake`, and the types `Count`, `Frame`, `Mechanism`, `Schedule`, `Tallies`, `Wake`. Consumes the hooks from Task 4.
- Produces: `initIoFigure(): void`, exported and called once at load; sub-project 6 will call it again after a view transition.

- [ ] **Step 1: Write the failing e2e section**

In `scripts/interactions.mjs`, insert the following immediately before the line `// ---- nothing threw anywhere ----`:

```js
// ---- the I/O multiplexing figure (interactions 5) ----
// The figure lives in one essay; a wrong path here fails loudly (no figure),
// unlike the contract test, which finds the page by hook.
const FIGURE = `${BASE}/blog/io-multiplexing`;
const phaseIs = (p, phase) => p.waitForSelector(`[data-io-figure][data-phase="${phase}"]`, { timeout: 8000 });
const cellsOf = (p) => p.evaluate(() => {
  const cells = [...document.querySelectorAll("[data-io-cell]")];
  const grid = document.querySelector("[data-io-grid]");
  return {
    total: cells.length,
    seen: cells.filter((c) => c.hasAttribute("data-seen")).length,
    scan: cells.filter((c) => c.hasAttribute("data-scan")).length,
    found: cells.filter((c) => c.dataset.state === "found").map((c) => Number(c.dataset.fd)),
    cols: getComputedStyle(grid).getPropertyValue("--cols").trim(),
    numbered: grid.hasAttribute("data-numbered"),
  };
});
const readoutOf = (p) => p.locator("[data-io-readout]").textContent();
const tallyOf = (p, m) => p.locator(`[data-io-tally="${m}"]`).textContent();
const stepDisabled = (p) => p.locator("[data-io-step]").getAttribute("aria-disabled");

const fig = await fresh(FIGURE);
check("the figure is live and its toolbar visible", (await fig.locator("[data-io-figure][data-live]").count()) === 1 && (await fig.locator("[data-io-controls]").isVisible()));
const still = await cellsOf(fig);
check("the still frame is epoll at 32 with three found", still.total === 32 && still.found.length === 3 && (await fig.locator('[data-io-figure][data-mechanism="epoll"]').count()) === 1);

// select at 32: the sweep leaves every cell seen, the readout names the cost, the wake ends clean
await fig.click('[data-io-mechanism="select"]');
await fig.click("[data-io-step]");
await phaseIs(fig, "sweep");
check("the step button is disabled during a wake", (await stepDisabled(fig)) === "true");
await phaseIs(fig, "return");
const selReturn = await cellsOf(fig);
const selReadout = await readoutOf(fig);
check("select's return frame has every cell seen and no scan ring", selReturn.seen === 32 && selReturn.scan === 0 && selReturn.found.length > 0);
check("select's readout names 32 checked and the found count", selReadout.includes("Wake 1: select checked 32 descriptors") && selReadout.includes(`find ${selReturn.found.length} ready`));
check("the ready box lists the found sockets", ((await fig.locator("[data-io-ready-title]").textContent()) ?? "").startsWith(`ready: fd ${selReturn.found[0]}`));
await phaseIs(fig, "idle");
const selIdle = await cellsOf(fig);
check("the wake ends with a clean grid and the button enabled", selIdle.seen === 0 && selIdle.found.length === 0 && selIdle.scan === 0 && (await stepDisabled(fig)) === null);
check("the select tally fills in; the others stay a dash", (await tallyOf(fig, "select")) === `1 wake · 32 checked · ${selReturn.found.length} ready` && (await tallyOf(fig, "poll")) === "—" && (await tallyOf(fig, "epoll")) === "—");

// epoll: no sweep, the same arrivals as select's first wake
await fig.click('[data-io-mechanism="epoll"]');
check("switching the mechanism renames the call at once", (await fig.locator("[data-io-call-name]").textContent()) === "epoll_wait()");
await fig.click("[data-io-step]");
await phaseIs(fig, "return");
const epReturn = await cellsOf(fig);
check("epoll's return frame has no seen cells", epReturn.seen === 0 && epReturn.scan === 0);
check("epoll's first wake sees the same sockets as select's", JSON.stringify(epReturn.found) === JSON.stringify(selReturn.found));
check("epoll's readout says returned without checking", ((await readoutOf(fig)) ?? "").startsWith("Wake 1: epoll_wait returned the"));
await phaseIs(fig, "idle");
check("the epoll tally counts only what was returned", (await tallyOf(fig, "epoll")) === `1 wake · ${epReturn.found.length} checked · ${epReturn.found.length} ready`);

// a count change rebuilds the grid and resets the tallies
await fig.click('[data-io-count="128"]');
const big = await cellsOf(fig);
check("128 rebuilds the grid in 16 unnumbered columns", big.total === 128 && big.cols === "16" && !big.numbered && big.found.length === 0);
check("a count change resets every tally", (await tallyOf(fig, "select")) === "—" && (await tallyOf(fig, "epoll")) === "—");
check("a count change writes the reset sentence", (await readoutOf(fig)) === "No wakes yet at 128 sockets. Press Next wake.");
await fig.click('[data-io-count="8"]');
const small = await cellsOf(fig);
check("8 is one numbered row", small.total === 8 && small.cols === "8" && small.numbered);

// play runs wakes back to back and stops when pressed again
await fig.click("[data-io-play]");
check("play reads pressed", (await fig.locator("[data-io-play]").getAttribute("aria-pressed")) === "true");
await phaseIs(fig, "return");
await phaseIs(fig, "idle");
await phaseIs(fig, "return");
await phaseIs(fig, "idle");
await fig.click("[data-io-play]");
check("play stops when pressed again", (await fig.locator("[data-io-play]").getAttribute("aria-pressed")) === "false");
const wakesAtStop = Number(((await tallyOf(fig, "epoll")) ?? "").match(/^(\d+) wake/)?.[1] ?? 0);
await fig.waitForTimeout(2600);
const wakesLater = Number(((await tallyOf(fig, "epoll")) ?? "").match(/^(\d+) wake/)?.[1] ?? 0);
check("no new wake starts after play stops", wakesAtStop >= 2 && wakesLater <= wakesAtStop + 1);
await phaseIs(fig, "idle");

// reduced motion: no sweep, the return frame with the trail, held
await fig.emulateMedia({ reducedMotion: "reduce" });
await fig.click('[data-io-mechanism="select"]');
await fig.click("[data-io-step]");
await phaseIs(fig, "return");
const rm = await cellsOf(fig);
check("reduced motion jumps to the return frame with the whole trail", rm.seen === 8 && rm.scan === 0 && rm.found.length > 0);
await fig.waitForTimeout(2300);
check("reduced motion holds the return frame and frees the button", (await fig.locator('[data-io-figure][data-phase="return"]').count()) === 1 && (await stepDisabled(fig)) === null);
await fig.click("[data-io-step]");
await phaseIs(fig, "return");
check("the next reduced-motion wake replaces the frame", ((await readoutOf(fig)) ?? "").startsWith("Wake 2: select"));
await fig.close();

// a phone keeps the columns and runs a wake
const phoneFig = watch(await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
await phoneFig.goto(FIGURE, { waitUntil: "networkidle" });
await phoneFig.click('[data-io-count="128"]');
const pf = await phoneFig.evaluate(() => {
  const g = document.querySelector("[data-io-grid]");
  return { cols: getComputedStyle(g).getPropertyValue("--cols").trim(), width: g.getBoundingClientRect().width, page: document.documentElement.scrollWidth, vw: innerWidth };
});
check("a phone keeps 16 columns at 128 and nothing overflows", pf.cols === "16" && pf.width <= pf.vw && pf.page <= pf.vw);
await phoneFig.click("[data-io-step]");
await phaseIs(phoneFig, "return");
check("a phone runs a wake", (await cellsOf(phoneFig)).found.length > 0);
await phoneFig.close();

```

- [ ] **Step 2: Build, preview, and run the e2e to verify the new checks fail**

Run `npm run build`, then start `npm run preview` in the background (the Bash tool's `run_in_background`, or `npm run preview &`), then `npm run e2e`.
Expected: the earlier sections pass; "the figure is live and its toolbar visible" FAILs and the section's later steps fail or time out on `phaseIs` (the stub reveals nothing). The run exits non-zero.

- [ ] **Step 3: Write the script**

Replace `src/scripts/figures/io-multiplexing.ts` with:

```ts
// src/scripts/figures/io-multiplexing.ts
// Progressive enhancement for the I/O multiplexing figure (interactions 5,
// spec §7). Without this the figure is its still frame with no controls. The
// script reveals the toolbar and runs wakes by painting whatever the model
// says shows at the elapsed time, on one animation-frame loop, so it holds no
// timers of its own and a hidden tab pauses a wake cleanly. Re-runnable:
// initIoFigure() tears the previous run down first, so a view transition can
// call it again.
import {
  CALL_NAME,
  HOLD_MS,
  MECHANISMS,
  addWake,
  callStatus,
  columns,
  emptyTallies,
  frameAt,
  isCount,
  isMechanism,
  numbered,
  readoutText,
  readyLine,
  resetText,
  schedule,
  tallyText,
  wake as makeWake,
  type Count,
  type Frame,
  type Mechanism,
  type Schedule,
  type Tallies,
  type Wake,
} from "../../lib/figures/io-multiplexing";

const IDLE: Frame = { phase: "idle", scan: null };

let current: AbortController | null = null;

export function initIoFigure(): void {
  current?.abort();
  const root = document.querySelector<HTMLElement>("[data-io-figure]");
  if (!root) return;
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const controls = q("[data-io-controls]");
  const grid = q("[data-io-grid]");
  const step = q<HTMLButtonElement>("[data-io-step]");
  const play = q<HTMLButtonElement>("[data-io-play]");
  const callName = q("[data-io-call-name]");
  const callStatusEl = q("[data-io-call-status]");
  const readyTitle = q("[data-io-ready-title]");
  const readyNote = q("[data-io-ready-note]");
  const readout = q("[data-io-readout]");
  if (!controls || !grid || !step || !play || !callName || !callStatusEl || !readyTitle || !readyNote || !readout) return;
  current = new AbortController();
  const { signal } = current;

  const mechanismAttr = root.dataset.mechanism;
  let mechanism: Mechanism = isMechanism(mechanismAttr) ? mechanismAttr : "epoll";
  const countAttr = Number(root.dataset.count);
  let count: Count = isCount(countAttr) ? countAttr : 32;
  let tallies: Tallies = emptyTallies();
  let cells: HTMLElement[] = Array.from(grid.querySelectorAll<HTMLElement>("[data-io-cell]"));

  // One wake at a time. `frame` is the pending animation frame, for a wake or
  // for Play's gap; `gapStart` is when the last wake ended.
  let run: { wake: Wake; plan: Schedule; start: number; last: Frame | null } | null = null;
  let frame = 0;
  let playing = false;
  let gapStart = 0;

  const clearFrame = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  const clearCells = (): void => {
    for (const c of cells) {
      c.removeAttribute("data-state");
      c.removeAttribute("data-seen");
      c.removeAttribute("data-scan");
    }
  };
  const pressGroup = (key: "ioMechanism" | "ioCount", value: string): void => {
    const sel = key === "ioMechanism" ? "[data-io-mechanism]" : "[data-io-count]";
    root.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[key] === value)));
  };
  const writeBoxes = (w: Wake | null, m: Mechanism, f: Frame): void => {
    callStatusEl.textContent = callStatus(w, m, count, f);
    const r = readyLine(w, f);
    readyTitle.textContent = r.title;
    readyNote.textContent = r.note;
  };

  function paintIdle(): void {
    root.dataset.phase = "idle";
    clearCells();
    callName.textContent = CALL_NAME[mechanism];
    writeBoxes(null, mechanism, IDLE);
  }

  /** Paints one frame of a wake. Idempotent per frame; the loop calls it only when the frame changes. */
  function paint(w: Wake, f: Frame): void {
    if (f.phase === "idle") {
      paintIdle();
      return;
    }
    root.dataset.phase = f.phase;
    writeBoxes(w, w.mechanism, f);
    switch (f.phase) {
      case "arrive":
        for (const fd of w.ready) cells[fd]?.setAttribute("data-state", "ready");
        break;
      case "sweep": {
        const scan = f.scan ?? 0;
        cells.forEach((c, i) => {
          c.toggleAttribute("data-seen", i <= scan);
          c.toggleAttribute("data-scan", i === scan);
        });
        break;
      }
      case "return":
        // The trail is complete for select and poll (and applied at once under
        // reduced motion, where no sweep ran); epoll touched nothing.
        cells.forEach((c, i) => {
          c.toggleAttribute("data-seen", w.mechanism !== "epoll");
          c.removeAttribute("data-scan");
          if (w.ready.includes(i)) c.setAttribute("data-state", "found");
        });
        break;
      case "handle":
        for (const c of cells) {
          c.removeAttribute("data-state");
          c.removeAttribute("data-seen");
        }
        break;
    }
  }

  function recordWake(w: Wake): void {
    tallies = addWake(tallies, w);
    const row = q(`[data-io-tally="${w.mechanism}"]`);
    if (row) row.textContent = tallyText(tallies[w.mechanism]);
    readout.textContent = readoutText(w);
  }

  function tick(now: number): void {
    frame = 0;
    if (!run) return;
    const elapsed = now - run.start;
    const f = frameAt(run.plan, run.wake.count, Math.min(elapsed, run.plan.duration));
    if (!run.last || f.phase !== run.last.phase || f.scan !== run.last.scan) {
      if (f.phase === "return" && run.last?.phase !== "return") recordWake(run.wake);
      paint(run.wake, f);
      run.last = f;
    }
    if (elapsed >= run.plan.duration) {
      endWake();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function startWake(): void {
    clearFrame();
    const w = makeWake(mechanism, count, tallies[mechanism].wakes + 1);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    run = { wake: w, plan: schedule(w.mechanism, w.count, reduce), start: performance.now(), last: null };
    step.setAttribute("aria-disabled", "true");
    // The previous wake's frame may still be up (a reduced-motion wake holds its return frame).
    clearCells();
    callName.textContent = CALL_NAME[w.mechanism];
    tick(run.start);
  }

  function endWake(): void {
    run = null;
    step.removeAttribute("aria-disabled");
    gapStart = performance.now();
    if (playing) waitGap();
  }

  /** Play's pause between wakes, on the same frame loop. */
  function waitGap(): void {
    clearFrame();
    frame = requestAnimationFrame((now) => {
      frame = 0;
      if (!playing || run) return;
      if (now - gapStart >= HOLD_MS.gap) startWake();
      else waitGap();
    });
  }

  function cancelWake(): void {
    clearFrame();
    if (run) {
      run = null;
      step.removeAttribute("aria-disabled");
    }
  }

  function stopPlay(): void {
    playing = false;
    play.setAttribute("aria-pressed", "false");
  }

  function setMechanism(m: Mechanism): void {
    mechanism = m;
    root.dataset.mechanism = m;
    pressGroup("ioMechanism", m);
    // A running wake keeps the mechanism it started with; otherwise the call box follows at once.
    if (!run) {
      callName.textContent = CALL_NAME[m];
      callStatusEl.textContent = callStatus(null, m, count, IDLE);
    }
  }

  function rebuildGrid(): void {
    const template = cells[0];
    if (!template) return;
    const next: HTMLElement[] = [];
    for (let fd = 0; fd < count; fd++) {
      // Cloning keeps Astro's scoped-style attribute on every new cell.
      const cell = template.cloneNode(true) as HTMLElement;
      cell.dataset.fd = String(fd);
      cell.removeAttribute("data-state");
      cell.removeAttribute("data-seen");
      cell.removeAttribute("data-scan");
      const num = cell.querySelector("span");
      if (num) num.textContent = String(fd);
      next.push(cell);
    }
    grid.replaceChildren(...next);
    grid.style.setProperty("--cols", String(columns(count)));
    grid.toggleAttribute("data-numbered", numbered(count));
    cells = next;
  }

  function setCount(c: Count): void {
    cancelWake();
    stopPlay();
    count = c;
    root.dataset.count = String(c);
    pressGroup("ioCount", String(c));
    rebuildGrid();
    tallies = emptyTallies();
    for (const m of MECHANISMS) {
      const row = q(`[data-io-tally="${m}"]`);
      if (row) row.textContent = tallyText(tallies[m]);
    }
    readout.textContent = resetText(c);
    paintIdle();
  }

  step.addEventListener(
    "click",
    () => {
      if (run) return;
      startWake();
    },
    { signal },
  );
  play.addEventListener(
    "click",
    () => {
      if (playing) {
        stopPlay();
        return;
      }
      playing = true;
      play.setAttribute("aria-pressed", "true");
      if (!run) startWake();
    },
    { signal },
  );
  controls.addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-io-mechanism],[data-io-count]");
      if (!b) return;
      const m = b.dataset.ioMechanism;
      if (isMechanism(m)) setMechanism(m);
      const n = Number(b.dataset.ioCount);
      if (b.dataset.ioCount !== undefined && isCount(n)) setCount(n);
    },
    { signal },
  );

  // Nothing animates unseen: Play turns off when the figure leaves the viewport.
  const visible = new IntersectionObserver((entries) => {
    if (playing && entries.some((entry) => !entry.isIntersecting)) stopPlay();
  });
  visible.observe(root);
  signal.addEventListener("abort", () => {
    visible.disconnect();
    cancelWake();
  });

  controls.hidden = false;
  root.toggleAttribute("data-live", true);
}

initIoFigure();
```

- [ ] **Step 4: Type-check and build**

Run: `npx astro check 2>&1 | tail -5` (if `@astrojs/check` is not installed, skip this and rely on the build) and `npm run build`.
Expected: no type errors in the new files; the build succeeds.

- [ ] **Step 5: Run the e2e to verify the section passes**

With `npm run preview` still running (restart it if the build replaced `dist/`): `npm run e2e`.
Expected: every check prints `ok`, including the new section, ending with `all checks passed`. If a `phaseIs` times out, run the check in a headed browser or screenshot at the failing point before changing timings; the schedule's durations are the spec's.

- [ ] **Step 6: Watch a sweep**

With the preview running, record the sweep to look at it:

```bash
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto("http://localhost:4321/blog/io-multiplexing", { waitUntil: "networkidle" });
  await p.click("[data-io-mechanism=select]");
  await p.click("[data-io-count=\"128\"]");
  await p.click("[data-io-step]");
  await p.waitForTimeout(350 + 1024);
  await p.locator("[data-io-figure]").screenshot({ path: "/private/tmp/claude-501/-Users-seancampbell-Documents-source-repos-portfolio/5830cbea-18e7-4d1a-83de-24ef837b1053/scratchpad/sweep-128.png" });
  await p.waitForSelector("[data-io-figure][data-phase=return]");
  await p.locator("[data-io-figure]").screenshot({ path: "/private/tmp/claude-501/-Users-seancampbell-Documents-source-repos-portfolio/5830cbea-18e7-4d1a-83de-24ef837b1053/scratchpad/return-128.png" });
  await b.close();
})();
'
```

Open both PNGs with the Read tool. Expected in `sweep-128.png`: the toolbar with select and 128 pressed, the top half of the 128 grid darkened with a white ring on one cell near the middle, gold-tinted cells among the rest, the call box lit and reading "checking fd 6x of 128". In `return-128.png`: every cell darkened, about ten solid gold, the ready box lit with "ready: fd … and N more" and "1xx checked for nothing", the readout sentence, the select tally row filled.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/figures/io-multiplexing.ts scripts/interactions.mjs
git commit -m "feat(figure): the script runs wakes on a frame loop, with play, counts and reduced motion; an e2e section"
```

---

### Task 6: Docs and the final pass

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the figure**

In `CLAUDE.md`, replace the `npm run e2e` bullet under "Build & Development Commands" with:

```markdown
- `npm run e2e` — Playwright pass over the home timeline's scrub and pan interactions at desktop and phone widths (hover, pin, drag, tap, keys, deep links), the hero readout's links and its pruning under a fixed clock past the build day, the reader frame's reading line and sticky sidebar on an essay, a short case study and a phone, and the I/O multiplexing figure's wakes, tallies, count changes, play and reduced motion. Needs `npm run preview` running.
```

In the Architecture intro paragraph, after the sentence ending "…without scripting the line stays hidden and the sidebar scrolls with the page.", add:

```markdown
The I/O multiplexing essay's figure (`src/components/figures/IoMultiplexing.astro`) is the same: without scripting it shows a completed epoll wake at 32 sockets and no controls.
```

After the "**Reader frame interactions:**" paragraph, add a new paragraph:

```markdown
**Figures:** interactive figures inside essays follow one shape, set by the I/O multiplexing figure: a pure model in `src/lib/figures/` (unit-tested; every number and sentence the figure prints), an Astro component in `src/components/figures/` that server-renders a meaningful still frame with its controls `hidden` and imports its script, and a re-runnable init in `src/scripts/figures/` that reveals the controls and animates by writing data attributes the scoped CSS styles. The MDX imports the component in place of a picture. `IoMultiplexing.astro` plays one event-loop wake at a time under select, poll or epoll at 8, 32 or 128 sockets: arrivals come from a generator seeded by count and wake number, so every mechanism sees the same data and the per-mechanism tally is an honest comparison; the wake's phases and the frame at any elapsed time come from the model (`schedule`, `frameAt`), so the script holds no timers, and one animation-frame loop paints only when the frame changes. select and poll leave a trail on every cell; epoll lights the ready ones alone. Under reduced motion a wake is a single held return frame. The grid is `aria-hidden` and the one live region is the readout sentence. The script rebuilds the grid on a count change by cloning the first cell, which keeps Astro's scoped-style attribute. `src/__tests__/figure-contract.test.ts` finds the essay that carries the figure by hook and keeps the hooks and the no-script state.
```

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: the build succeeds and every test passes, including the four contract suites and the 29 figure tests.

- [ ] **Step 3: Run the e2e once more against the fresh build**

Start `npm run preview` in the background, then `npm run e2e`.
Expected: `all checks passed`. Stop the preview.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: the I/O multiplexing figure, the figures convention, and the e2e section that covers it"
```

---

## Self-review

**Spec coverage.** §3 decisions: layout, trail, scaling and step-and-play are in Task 4's markup and styles and Task 5's script; the no-JS still frame is Task 4. §4.1 to §4.4 are Task 1, §4.5 Task 2, §4.6 Task 3 (every sentence appears verbatim in a test). §5 markup and both rulings (no prose elements, cloning) are Task 4 and Task 5's `rebuildGrid`. §6 styling is Task 4's `<style>`. §7's every bullet is in Task 5: the frame loop, the timings via the model, Play with the gap and the observer, `aria-disabled`, mechanism and count switching, reduced motion read per wake. §8 accessibility: `aria-pressed` on the groups and Play, `aria-hidden` on the grid, the single `aria-live` region, native buttons, focus rings. §9 files: all created or modified; the PNG is removed in Task 4. §10: unit tests in Tasks 1 to 3, the contract test in Task 4 (finds the page by hook), the e2e section in Task 5 covering every listed case, docs in Task 6. §11 inputs: the executor looks at the still frame and the sweep in Tasks 4 and 5, which is where wording or timing would be tuned; any such change goes into the model and its tests.

**Placeholders.** None; every step carries its content.

**Type consistency.** `Frame`, `Schedule`, `Wake`, `Tallies`, `Count`, `Mechanism` are defined in Tasks 1 and 2 with the names Tasks 3 to 5 import. `wake` is imported as `makeWake` in the script to free the local name. `callStatus(w, mechanism, count, frame)` and `readyLine(w, frame)` have the same argument order in Task 3, the component and the script. Hook names in the component, the contract test and the e2e match one another.
