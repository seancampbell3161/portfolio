# Retention Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth `/roadmap` track — a spaced-repetition **Retention** surface that reviews already-completed roadmap items (SM-2 scheduling, private) alongside the existing completion tracks.

**Architecture:** Card content lives in a new companion file `src/data/review-cards.ts`, keyed to the roadmap's existing stable IDs — `roadmap.ts` is never touched. Pure, I/O-free SM-2 + due-selection logic lives in `src/lib/review/`. A card is "in rotation" only once its `sourceId` is marked complete in the existing **public** progress state; the per-card SM-2 schedule and streak are **private**, stored in a new token-gated `review` Netlify Blobs store behind `/api/review` (both GET and POST gated). The UI mirrors the existing Astro-static-shell + vanilla-hydration island pattern (`src/scripts/roadmap.ts` → `src/scripts/review.ts`).

**Tech Stack:** Astro 5 (static output, zero-JS shell), TypeScript (strict), Netlify Functions + `@netlify/blobs`, Vitest.

## Global Constraints

- **Never modify `src/data/roadmap.ts`.** IDs are permanent; we only *read* them. (Reconciled: 4 seed `sourceId`s in the handoff were wrong/suboptimal — corrected in Task 2.)
- **No new env var.** `ROADMAP_ADMIN_TOKEN` (already set in Netlify) gates the review endpoint.
- **No new auth mechanism.** Reuse the exact edit-mode token: `sessionStorage` key `"roadmap-admin-token"`, transported as `Authorization: Bearer <token>`, verified with `constantTimeEquals`.
- **Tests must live under a `__tests__/` directory** — `vitest.config.ts` `include` is `["netlify/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.ts"]`. (This overrides the handoff's co-located `sm2.test.ts` paths.)
- **Import extension convention:** `netlify/**` relative imports use a `.js` extension (incl. into `src`, e.g. `../../src/lib/review/types.js`); `src/**` relative imports use **no** extension. Match each side.
- **`src/lib/review/sm2.ts` and `generator.ts` stay I/O-free** (pure) so they remain unit-testable and reusable by both the client bundle and the Netlify handler.
- Keep the progress endpoint's error-shape: `new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })`, `{ error: "..." }` bodies, `401` unauthorized / `400` invalid / `405` method.
- UI quality floor matching the rest of the page: keyboard-focusable controls (real `<button>`s), `prefers-reduced-motion` respected (page already has a global reduce rule), responsive to mobile.
- Work on a feature branch. Frequent commits (one per task minimum).

## Reconciliation with the real codebase (done during orientation)

Verified against `src/data/roadmap.ts`, `netlify/lib/handlers/progress.ts`, `netlify/lib/roadmap-store.ts`, `netlify/lib/tokens.ts`, `src/scripts/roadmap.ts`, the roadmap components, `netlify.toml`, `tsconfig.json`, `vitest.config.ts`. Deviations from the handoff, all in favor of the real code (surface these in the PR):

1. **Corrected 4 `sourceId`s** in the seed (Task 2). Real IDs differ from the handoff's guesses:
   - `redis.repl` → **`redis.replication`**
   - `sqlite.log.btree` → **`sqlite.log.engine`**
   - `dns.log.binary` → **`dns.log.protocol`**
   - `ostep.c1` → **`ostep.c3`** (both exist; `ostep.c3` = "Concurrency — common bugs & deadlock" is the exact chapter that card tests, so it's the correct unlock anchor).
   The handoff's TODO-marked `http.persistent`, `fd.nc.graphs`, `fd.nc.sliding`, `fd.nc.backtracking`, `kafka.consume`, `ddia.ch5`, `dbint.ch7`, `aposd.s2`, `aposd.s3` all turned out **correct**.
   A validation test (Task 2) enforces every `sourceId ∈ allIds`, so the 3 truly-invalid ones would fail the build if left uncorrected.
2. **Progress model is a flat `completed: string[]`** (all groups, chapters, patterns, and "marked logged" decision-log IDs live in one array). So `completedIdsFromProgress` is `new Set(progress.completed)` — a one-liner, as intended.
3. **Extracted a shared auth helper** (`bearerToken` + `isAuthorized`) into `netlify/lib/tokens.ts` and refactored `handlers/progress.ts` to use it, so `handlers/review.ts` reuses the same check instead of forking the regex (Task 4).
4. **Tests moved under `__tests__/`** (see Global Constraints).
5. **Persistence = Netlify Blobs** (handoff D5 recommendation; acceptance requires a `401`-gated `/api/review`, which implies the endpoint). The pure logic is storage-agnostic, so the localStorage fallback remains a clean swap if ever wanted — not implemented here.
6. **Dashboard grid → 5 columns** (was `repeat(4, 1fr)`) to fit the new Retention stat; mobile keeps 2 columns with the retention cell spanning full width (Task 6).
7. **`behavioral` thread accent = warm gold `#d9b45f`** (`--behavioral`), added alongside the existing `--build/--reading/--foundations/--judgment` custom props. Not previously a thread color.
8. **Deferred content:** the handoff notes 8 decision logs total but seeds only 4 judgment cards. Ship the 4; the other 4 logs (`redis.log.replication`, `http.log.versioning`, `kafka.log.consistency`, `kafka.log.capstone`) get cards later — their backs are the owner's interview answers and shouldn't be invented here.

## File Structure

**New**
- `src/lib/review/types.ts` — `CardSchedule`, `ReviewState`, `Rating`, `emptyReviewState()`. Shared by sm2, generator, handler, client.
- `src/lib/review/sm2.ts` — pure SM-2 (`schedule`) + date helpers (`todayStr`, `addDays`) + streak (`updateStreak`, `displayStreak`).
- `src/lib/review/generator.ts` — `unlockedCards`, `dueCards`, `completedIdsFromProgress`, `DueCard`. Pure.
- `src/lib/review/__tests__/sm2.test.ts`, `src/lib/review/__tests__/generator.test.ts`.
- `src/data/review-cards.ts` — `ReviewThread`, `ReviewCard`, `reviewCards[]` content.
- `src/data/__tests__/review-cards.test.ts` — ID-discipline invariants (guards the corrections).
- `netlify/lib/review-store.ts` — `ReviewStore` interface + `blobsReviewStore()` (store `review`, key `state`).
- `netlify/lib/handlers/review.ts` — `handleReview(req, deps)`, `ReviewDeps`. Both methods token-gated.
- `netlify/functions/review.ts` — wires env token + Blobs store into the handler.
- `netlify/lib/__tests__/handlers/review.test.ts` — handler tests mirroring `progress.test.ts`.
- `src/components/roadmap/RetentionSection.astro` — self-contained fourth `<section class="rm-track">` (summary + runner shell).
- `src/scripts/review.ts` — client hydration.

**Modified**
- `netlify/lib/tokens.ts` — add `bearerToken`, `isAuthorized`.
- `netlify/lib/handlers/progress.ts` — use the shared helper (behavior identical).
- `netlify/lib/__tests__/tokens.test.ts` — add helper tests.
- `src/components/roadmap/RoadmapDashboard.astro` — 5th "Retention" stat cell + legend entry.
- `src/pages/roadmap.astro` — render `<RetentionSection />`, include `review.ts`, add `--behavioral` + `.d-behavioral`/`.f-behavioral`, retention styles, 5-col dashboard grid.

**Not modified:** `src/data/roadmap.ts`, `netlify.toml` (the existing `/api/*` → `/.netlify/functions/:splat` redirect already routes `/api/review`), `astro.config.mjs`.

---

### Task 1: SM-2 core, date + streak helpers (pure)

**Files:**
- Create: `src/lib/review/types.ts`
- Create: `src/lib/review/sm2.ts`
- Test: `src/lib/review/__tests__/sm2.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `CardSchedule { ease: number; interval: number; due: string; reps: number; lapses: number; lastReviewed?: string }`
  - `ReviewState { schedules: Record<string, CardSchedule>; streak: number; lastReviewDate: string | null }`
  - `type Rating = 0 | 1 | 2 | 3`
  - `emptyReviewState(): ReviewState`
  - `todayStr(d?: Date): string` → `"YYYY-MM-DD"`
  - `addDays(dateStr: string, n: number): string`
  - `schedule(s: CardSchedule, rating: Rating, today?: string): CardSchedule`
  - `updateStreak(state: ReviewState, today?: string): { streak: number; lastReviewDate: string }`
  - `displayStreak(state: ReviewState, today?: string): number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/review/__tests__/sm2.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addDays, schedule, updateStreak, displayStreak } from "../sm2";
import type { CardSchedule, ReviewState } from "../types";

const newCard = (): CardSchedule => ({ ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-07-01" });
const TODAY = "2026-07-01";

describe("addDays", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });
  it("subtracts days with a negative n", () => {
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });
});

describe("schedule — Again (0)", () => {
  it("resets interval/reps, increments lapses, drops ease by 0.2, due today", () => {
    const s = schedule({ ease: 2.5, interval: 12, reps: 3, lapses: 0, due: TODAY }, 0, TODAY);
    expect(s.interval).toBe(0);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3, 5);
    expect(s.due).toBe(TODAY);
    expect(s.lastReviewed).toBe(TODAY);
  });
  it("floors ease at 1.3", () => {
    const s = schedule({ ease: 1.4, interval: 5, reps: 2, lapses: 4, due: TODAY }, 0, TODAY);
    expect(s.ease).toBe(1.3);
  });
});

describe("schedule — Good (2) on a new card", () => {
  it("interval 1 on first rep", () => {
    expect(schedule(newCard(), 2, TODAY).interval).toBe(1);
  });
  it("interval 3 on second rep", () => {
    const first = schedule(newCard(), 2, TODAY); // reps 1
    expect(schedule(first, 2, TODAY).interval).toBe(3);
  });
  it("interval round(interval*ease) from the third rep on", () => {
    const first = schedule(newCard(), 2, TODAY);   // reps 1, interval 1
    const second = schedule(first, 2, TODAY);      // reps 2, interval 3
    const third = schedule(second, 2, TODAY);      // reps 3
    expect(third.interval).toBe(Math.round(3 * second.ease)); // 3 * 2.5 = 8
    expect(third.due).toBe(addDays(TODAY, third.interval));
  });
});

describe("schedule — Hard (1) and Easy (3)", () => {
  it("Hard lowers ease by 0.15 and keeps interval >= 1", () => {
    const s = schedule(newCard(), 1, TODAY);
    expect(s.ease).toBeCloseTo(2.35, 5);
    expect(s.interval).toBeGreaterThanOrEqual(1);
  });
  it("Easy grows faster than Good and raises ease", () => {
    const easy = schedule(newCard(), 3, TODAY);
    const good = schedule(newCard(), 2, TODAY);
    expect(easy.ease).toBeCloseTo(2.65, 5);
    expect(easy.interval).toBeGreaterThan(good.interval);
  });
});

describe("updateStreak / displayStreak", () => {
  const state = (streak: number, last: string | null): ReviewState => ({ schedules: {}, streak, lastReviewDate: last });

  it("first-ever review sets streak 1", () => {
    expect(updateStreak(state(0, null), TODAY)).toEqual({ streak: 1, lastReviewDate: TODAY });
  });
  it("reviewing again the same day is a no-op on the count", () => {
    expect(updateStreak(state(4, TODAY), TODAY)).toEqual({ streak: 4, lastReviewDate: TODAY });
  });
  it("reviewing the day after increments", () => {
    expect(updateStreak(state(4, addDays(TODAY, -1)), TODAY)).toEqual({ streak: 5, lastReviewDate: TODAY });
  });
  it("a gap resets to 1", () => {
    expect(updateStreak(state(9, addDays(TODAY, -3)), TODAY)).toEqual({ streak: 1, lastReviewDate: TODAY });
  });
  it("displayStreak is 0 when the last review is neither today nor yesterday (without mutating)", () => {
    const s = state(9, addDays(TODAY, -3));
    expect(displayStreak(s, TODAY)).toBe(0);
    expect(s.streak).toBe(9); // unchanged
  });
  it("displayStreak shows the count when last review is today or yesterday", () => {
    expect(displayStreak(state(6, TODAY), TODAY)).toBe(6);
    expect(displayStreak(state(6, addDays(TODAY, -1)), TODAY)).toBe(6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/review/__tests__/sm2.test.ts`
Expected: FAIL — `Cannot find module '../sm2'` / `'../types'`.

- [ ] **Step 3: Write `src/lib/review/types.ts`**

```ts
// Private review-state types (SM-2 schedule + streak). Storage-agnostic: the
// same shapes serialize to Netlify Blobs on the server and hydrate the client.

export interface CardSchedule {
  ease: number; // default 2.5, floor 1.3, no ceiling
  interval: number; // days until next due; 0 => due again this session
  due: string; // "YYYY-MM-DD" (local)
  reps: number; // consecutive successful reps
  lapses: number;
  lastReviewed?: string;
}

export interface ReviewState {
  schedules: Record<string, CardSchedule>; // keyed by ReviewCard.id
  streak: number;
  lastReviewDate: string | null; // "YYYY-MM-DD"
}

export type Rating = 0 | 1 | 2 | 3; // Again · Hard · Good · Easy

export const emptyReviewState = (): ReviewState => ({
  schedules: {},
  streak: 0,
  lastReviewDate: null,
});
```

- [ ] **Step 4: Write `src/lib/review/sm2.ts`**

```ts
import type { CardSchedule, Rating, ReviewState } from "./types";

export const todayStr = (d: Date = new Date()): string => d.toISOString().slice(0, 10);

export const addDays = (dateStr: string, n: number): string => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const EASE_FLOOR = 1.3;

// Deterministic SM-2 variant. Ratings: 0 Again · 1 Hard · 2 Good · 3 Easy.
// Again => interval 0 => due today, so the card re-queues in the same session.
export function schedule(s: CardSchedule, rating: Rating, today: string = todayStr()): CardSchedule {
  let { ease, interval, reps, lapses } = s;
  if (rating === 0) {
    ease = Math.max(EASE_FLOOR, ease - 0.2);
    interval = 0;
    reps = 0;
    lapses += 1;
  } else if (rating === 1) {
    ease = Math.max(EASE_FLOOR, ease - 0.15);
    interval = Math.max(1, Math.round((interval || 1) * 1.2));
    reps += 1;
  } else if (rating === 2) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round((interval || 1) * ease);
    reps += 1;
  } else {
    ease = ease + 0.15;
    interval = Math.round((interval || 1) * ease * 1.3);
    reps += 1;
  }
  return { ease, interval, reps, lapses, due: addDays(today, interval), lastReviewed: today };
}

// Streak, pure. Caller assigns the result back onto the state.
export function updateStreak(
  state: ReviewState,
  today: string = todayStr(),
): { streak: number; lastReviewDate: string } {
  if (state.lastReviewDate === today) {
    return { streak: state.streak, lastReviewDate: today };
  }
  const yesterday = addDays(today, -1);
  const streak = state.lastReviewDate === yesterday ? state.streak + 1 : 1;
  return { streak, lastReviewDate: today };
}

// A broken streak reads as 0 without mutating stored state.
export function displayStreak(state: ReviewState, today: string = todayStr()): number {
  if (state.lastReviewDate === today || state.lastReviewDate === addDays(today, -1)) {
    return state.streak;
  }
  return 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/review/__tests__/sm2.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/lib/review/types.ts src/lib/review/sm2.ts src/lib/review/__tests__/sm2.test.ts
git commit -m "feat(review): pure SM-2 scheduling, date + streak helpers"
```

---

### Task 2: Review-card content + ID-discipline test

**Files:**
- Create: `src/data/review-cards.ts`
- Test: `src/data/__tests__/review-cards.test.ts`

**Interfaces:**
- Consumes: `allIds` from `../roadmap` (read-only).
- Produces:
  - `type ReviewThread = "build" | "reading" | "foundations" | "judgment" | "behavioral"`
  - `interface ReviewCard { id: string; sourceId?: string; thread: ReviewThread; front: string; back: string }`
  - `reviewCards: ReviewCard[]`

- [ ] **Step 1: Write the failing test**

Create `src/data/__tests__/review-cards.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reviewCards } from "../review-cards";
import { allIds } from "../roadmap";

describe("reviewCards", () => {
  it("has unique card ids", () => {
    const ids = reviewCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every sourceId references a real roadmap id", () => {
    const bad = reviewCards
      .filter((c) => c.sourceId && !allIds.has(c.sourceId))
      .map((c) => `${c.id} -> ${c.sourceId}`);
    expect(bad).toEqual([]);
  });

  it("behavioral cards have no sourceId (always unlocked)", () => {
    for (const c of reviewCards) {
      if (c.thread === "behavioral") expect(c.sourceId).toBeUndefined();
    }
  });

  it("non-behavioral cards all have a sourceId", () => {
    for (const c of reviewCards) {
      if (c.thread !== "behavioral") expect(typeof c.sourceId).toBe("string");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/__tests__/review-cards.test.ts`
Expected: FAIL — `Cannot find module '../review-cards'`.

- [ ] **Step 3: Write `src/data/review-cards.ts`** (sourceIds already corrected vs. handoff)

```ts
// Companion to roadmap.ts: spaced-repetition card content keyed to the roadmap's
// existing stable ids. roadmap.ts is never modified — a card unlocks only when its
// sourceId is marked complete in the public progress state. Behavioral cards have
// no sourceId (always unlocked). Card `id` is independent and permanent, same
// discipline as roadmap ids. `thread` drives the chip color.

export type ReviewThread =
  | "build" // CodeCrafters milestones (blue)
  | "reading" // the systems books (teal)
  | "foundations" // NeetCode patterns (purple)
  | "judgment" // capstone decision logs (terracotta)
  | "behavioral"; // interview gap the roadmap doesn't cover (gold)

export interface ReviewCard {
  id: string; // this card's own stable id, e.g. "card.redis.resp"
  sourceId?: string; // roadmap item id that unlocks it. Omit => always unlocked.
  thread: ReviewThread;
  front: string;
  back: string;
}

export const reviewCards: ReviewCard[] = [
  // ---- Build (blue) ----
  {
    id: "card.redis.resp",
    sourceId: "redis.core",
    thread: "build",
    front: "Redis · RESP — why length-prefixed framing?",
    back: "Bulk strings carry a byte count ($5\\r\\nhello\\r\\n), so the parser reads exactly N bytes — no delimiter scanning, binary-safe. Why you don't just newline-split.",
  },
  {
    id: "card.redis.persist",
    sourceId: "redis.rdb",
    thread: "build",
    front: "Redis · RDB vs AOF (mechanism)",
    back: "RDB = point-in-time binary snapshot: compact, fast restart, loses writes since last save. AOF = append every write, fsync ~1s: durable + replayable but larger/slower to load. Often both.",
  },
  {
    id: "card.redis.repl",
    sourceId: "redis.replication",
    thread: "build",
    front: "Redis · how does replication stay (eventually) consistent?",
    back: "Master streams its write feed to replicas, async by default — replicas lag, replica reads can be stale. New replica: full resync (RDB + backlog), then incremental. The Graphs ↔ replication hint lives here.",
  },
  {
    id: "card.sqlite.btree",
    sourceId: "sqlite.base",
    thread: "build",
    front: "SQLite · why a B-tree for tables and indexes?",
    back: "Sorted, high fan-out → shallow tree → O(log n) point + range lookups with few page reads (page = unit of I/O). This is the Trees / Binary Search ↔ SQLite hint made literal.",
  },
  {
    id: "card.sqlite.format",
    sourceId: "sqlite.base",
    thread: "build",
    front: "SQLite · what does parsing the file format teach?",
    back: "A .db is pages: header → sqlite_schema → B-tree pages of cells. By hand it shows how an indexed query walks root → interior → leaf without loading the whole file.",
  },
  {
    id: "card.http.keepalive",
    sourceId: "http.persistent",
    thread: "build",
    front: "HTTP · what do persistent connections buy?",
    back: "Keep-alive reuses one TCP connection across many request/response pairs, dropping a handshake per request. Needs correct framing (Content-Length or chunked) to know where each response ends.",
  },
  {
    id: "card.http.compress",
    sourceId: "http.compression",
    thread: "build",
    front: "HTTP · when is compression worth it?",
    back: "gzip shrinks text payloads on the wire (bandwidth win) at CPU cost, negotiated via Accept-Encoding / Content-Encoding. Skip it for tiny or already-compressed bodies.",
  },
  {
    id: "card.dns.binary",
    sourceId: "dns.base",
    thread: "build",
    front: "DNS · why binary packets over UDP?",
    back: "Fixed-layout binary is compact and fast to parse; UDP skips handshake latency for tiny queries and tolerates loss via retry. Header + question + answer sections, names compressed with pointers.",
  },
  {
    id: "card.kafka.partition",
    sourceId: "kafka.base",
    thread: "build",
    front: "Kafka · what does partitioning give you?",
    back: "Partitions are the unit of parallelism and ordering — order holds within a partition, not across. More partitions → more consumer parallelism; key→partition map decides co-location.",
  },
  {
    id: "card.kafka.consume",
    sourceId: "kafka.consume",
    thread: "build",
    front: "Kafka · consuming vs producing model",
    back: "Producers append to a partition log (offset assigned). Consumers track their own offset and pull; the broker holds little per-consumer state beyond committed offsets. Replay = reset the offset.",
  },

  // ---- Reading (teal) ----
  {
    id: "card.ddia.replag",
    sourceId: "ddia.ch5",
    thread: "reading",
    front: "DDIA · the three replication-lag anomalies",
    back: "Read-after-write (see your own writes), monotonic reads (don't move backward in time), consistent prefix (causal order preserved). Async replication breaks all three unless you add a guarantee.",
  },
  {
    id: "card.ddia.batchstream",
    sourceId: "ddia.ch10",
    thread: "reading",
    front: "DDIA · batch vs stream — where's the line?",
    back: "Batch: bounded input, run to completion. Stream: unbounded, process events as they arrive; windowing carves streams into bounded chunks. Same logic, different assumptions about time.",
  },
  {
    id: "card.dbint.btreelsm",
    sourceId: "dbint.ch7",
    thread: "reading",
    front: "Database Internals · B-tree vs LSM write path",
    back: "B-tree updates in place (write amplification from page rewrites, read-optimized). LSM buffers in memory, flushes sorted runs, compacts later (write-optimized; reads check runs + bloom filters). Feeds the SQLite decision log.",
  },
  {
    id: "card.ostep.concurbugs",
    sourceId: "ostep.c3",
    thread: "reading",
    front: "OSTEP · the concurrency bug classes",
    back: "Atomicity violations (assumed-atomic sequence interleaved), order violations (A must precede B but didn't), deadlock (circular wait). Locks fix the first two; lock ordering fixes the third.",
  },
  {
    id: "card.aposd.deep",
    sourceId: "aposd.s2",
    thread: "reading",
    front: "APoSD · what makes a module 'deep'?",
    back: "A simple interface hiding significant implementation — high functionality-to-interface ratio. Shallow modules add cognitive cost without earning it. Complexity is the enemy.",
  },
  {
    id: "card.aposd.errors",
    sourceId: "aposd.s3",
    thread: "reading",
    front: "APoSD · 'define errors out of existence'",
    back: "Shape APIs so error conditions can't arise instead of forcing every caller to handle them (e.g. a substring that clamps rather than throws). Fewer special cases = less propagated complexity.",
  },

  // ---- Foundations (purple) ----
  {
    id: "card.nc.arrays",
    sourceId: "fd.nc.arrays",
    thread: "foundations",
    front: "Arrays & Hashing — pattern + build echo",
    back: "O(1) membership/frequency via hash map; trade space for time. The Redis hash store is the same idea. Reps: two-sum, group anagrams, top-k frequent.",
  },
  {
    id: "card.nc.trees",
    sourceId: "fd.nc.trees",
    thread: "foundations",
    front: "Trees / Binary Search — pattern + build echo",
    back: "Sorted structure → O(log n) traversal — literally SQLite's B-tree walk. Reps: validate BST, search rotated array, kth-smallest.",
  },
  {
    id: "card.nc.graphs",
    sourceId: "fd.nc.graphs",
    thread: "foundations",
    front: "Graphs — pattern + build echo",
    back: "BFS/DFS over nodes + edges: topological order, components, shortest path. Maps to Kafka/Redis replication & partitioning topology. Reps: clone graph, course schedule, number of islands.",
  },
  {
    id: "card.nc.sliding",
    sourceId: "fd.nc.sliding",
    thread: "foundations",
    front: "Sliding window — recall the trigger",
    back: "Contiguous subarray/substring optimizing a running quantity. Expand right, shrink left when a constraint breaks. O(n).",
  },
  {
    id: "card.nc.backtrack",
    sourceId: "fd.nc.backtracking",
    thread: "foundations",
    front: "Backtracking — recall the shape",
    back: "Build a candidate incrementally, undo on dead ends (choose → explore → un-choose). Subsets, permutations, combination sum, N-queens. Prune early.",
  },

  // ---- Judgment: rehearse the capstone decision logs (these ARE interview answers) (terracotta) ----
  {
    id: "card.log.resp",
    sourceId: "redis.log.resp",
    thread: "judgment",
    front: "Decision log · RESP vs JSON — make the call",
    back: "RESP: length-prefixed, binary-safe, cheap incremental parse — for a hot in-memory server you own both ends of. JSON: readable, self-describing, ubiquitous tooling — at parse cost + ambiguity. RESP when latency/throughput dominate.",
  },
  {
    id: "card.log.durability",
    sourceId: "redis.log.durability",
    thread: "judgment",
    front: "Decision log · RDB vs AOF — when each?",
    back: "RDB when fast restart + compact backups matter and losing seconds of writes is fine. AOF when durability leads (replay every command). Honest answer: usually both — RDB base + AOF tail.",
  },
  {
    id: "card.log.btree",
    sourceId: "sqlite.log.engine",
    thread: "judgment",
    front: "Decision log · B-tree vs LSM — pick by workload",
    back: "Read-heavy, range scans, in-place updates → B-tree. Write-heavy, high ingest, tolerant of read amplification → LSM. A write-vs-read amplification tradeoff, not 'which is better.'",
  },
  {
    id: "card.log.binary",
    sourceId: "dns.log.protocol",
    thread: "judgment",
    front: "Decision log · binary vs text protocols",
    back: "Binary (DNS, RESP): compact, fast, unambiguous framing — but opaque and harder to version. Text (HTTP/1.1): debuggable, extensible, tooling-rich — at parse + size cost. Binary at the performance-critical edges you control.",
  },

  // ---- Behavioral: no sourceId => always unlocked (gold) ----
  {
    id: "card.beh.star",
    thread: "behavioral",
    front: "STAR — recall the frame",
    back: "Situation (context + constraints), Task (your charge), Action (what YOU did + tradeoffs), Result (measurable + what you'd change). Lead with the decision, not the backstory.",
  },
  {
    id: "card.beh.leave",
    thread: "behavioral",
    front: "'Why did you leave your last role?'",
    back: "Neutral, forward-looking: role eliminated / seeking more senior scope. Pivot fast to what you want next. Never litigate the ex-employer.",
  },
  {
    id: "card.beh.conflict",
    thread: "behavioral",
    front: "'Tell me about a conflict'",
    back: "A real disagreement resolved with data, not drama. Sought the other view, found the shared goal, committed once decided. No villains.",
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/data/__tests__/review-cards.test.ts`
Expected: PASS (all 4). If `sourceId references a real roadmap id` fails, a `sourceId` is wrong — cross-check against `src/data/roadmap.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/data/review-cards.ts src/data/__tests__/review-cards.test.ts
git commit -m "feat(review): seed review-cards keyed to roadmap ids (corrected sourceIds)"
```

---

### Task 3: Unlock/due generator + progress adapter (pure)

**Files:**
- Create: `src/lib/review/generator.ts`
- Test: `src/lib/review/__tests__/generator.test.ts`

**Interfaces:**
- Consumes: `ReviewCard` from `../../data/review-cards`; `CardSchedule`, `ReviewState` from `./types`; `todayStr` from `./sm2`.
- Produces:
  - `interface DueCard { card: ReviewCard; sched: CardSchedule }`
  - `unlockedCards(cards: ReviewCard[], completedIds: Set<string>): ReviewCard[]`
  - `dueCards(cards: ReviewCard[], completedIds: Set<string>, state: ReviewState, today?: string): DueCard[]`
  - `completedIdsFromProgress(progress: { completed?: string[] } | null | undefined): Set<string>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/review/__tests__/generator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { unlockedCards, dueCards, completedIdsFromProgress } from "../generator";
import type { ReviewCard } from "../../../data/review-cards";
import type { ReviewState } from "../types";

const cards: ReviewCard[] = [
  { id: "c.a", sourceId: "src.a", thread: "build", front: "A", back: "a" },
  { id: "c.b", sourceId: "src.b", thread: "reading", front: "B", back: "b" },
  { id: "c.beh", thread: "behavioral", front: "Beh", back: "beh" }, // no sourceId
];

const emptyState = (): ReviewState => ({ schedules: {}, streak: 0, lastReviewDate: null });
const TODAY = "2026-07-01";

describe("unlockedCards", () => {
  it("excludes a card whose sourceId isn't complete", () => {
    const out = unlockedCards(cards, new Set(["src.a"]));
    expect(out.map((c) => c.id).sort()).toEqual(["c.a", "c.beh"]);
  });
  it("always includes behavioral (no sourceId) cards", () => {
    const out = unlockedCards(cards, new Set());
    expect(out.map((c) => c.id)).toEqual(["c.beh"]);
  });
});

describe("dueCards", () => {
  it("treats an unlocked card with no schedule as due immediately", () => {
    const out = dueCards(cards, new Set(["src.a"]), emptyState(), TODAY);
    expect(out.map((d) => d.card.id).sort()).toEqual(["c.a", "c.beh"]);
  });
  it("excludes a card scheduled in the future", () => {
    const state: ReviewState = {
      schedules: { "c.a": { ease: 2.5, interval: 5, reps: 2, lapses: 0, due: "2026-07-10" } },
      streak: 0,
      lastReviewDate: null,
    };
    const out = dueCards(cards, new Set(["src.a"]), state, TODAY);
    expect(out.map((d) => d.card.id)).not.toContain("c.a");
  });
  it("sorts by due date ascending", () => {
    const state: ReviewState = {
      schedules: {
        "c.beh": { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-06-30" },
        "c.a": { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: "2026-06-25" },
      },
      streak: 0,
      lastReviewDate: null,
    };
    const out = dueCards(cards, new Set(["src.a"]), state, TODAY);
    expect(out.map((d) => d.card.id)).toEqual(["c.a", "c.beh"]);
  });
});

describe("completedIdsFromProgress", () => {
  it("returns the completed ids as a set", () => {
    expect([...completedIdsFromProgress({ completed: ["x", "y"] })].sort()).toEqual(["x", "y"]);
  });
  it("handles null/undefined/missing", () => {
    expect(completedIdsFromProgress(null).size).toBe(0);
    expect(completedIdsFromProgress(undefined).size).toBe(0);
    expect(completedIdsFromProgress({}).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/review/__tests__/generator.test.ts`
Expected: FAIL — `Cannot find module '../generator'`.

- [ ] **Step 3: Write `src/lib/review/generator.ts`**

```ts
import type { ReviewCard } from "../../data/review-cards";
import type { CardSchedule, ReviewState } from "./types";
import { todayStr } from "./sm2";

export interface DueCard {
  card: ReviewCard;
  sched: CardSchedule;
}

// A card absent from state.schedules is new: due the moment it unlocks.
const defaultSchedule = (today: string): CardSchedule => ({
  ease: 2.5,
  interval: 0,
  reps: 0,
  lapses: 0,
  due: today,
});

export function unlockedCards(cards: ReviewCard[], completedIds: Set<string>): ReviewCard[] {
  return cards.filter((c) => !c.sourceId || completedIds.has(c.sourceId));
}

export function dueCards(
  cards: ReviewCard[],
  completedIds: Set<string>,
  state: ReviewState,
  today: string = todayStr(),
): DueCard[] {
  return unlockedCards(cards, completedIds)
    .map((card) => ({ card, sched: state.schedules[card.id] ?? defaultSchedule(today) }))
    .filter((x) => x.sched.due <= today)
    .sort((a, b) => a.sched.due.localeCompare(b.sched.due));
}

// The single point that knows the public progress shape ({ completed: string[] }).
export function completedIdsFromProgress(
  progress: { completed?: string[] } | null | undefined,
): Set<string> {
  return new Set(progress?.completed ?? []);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/review/__tests__/generator.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/generator.ts src/lib/review/__tests__/generator.test.ts
git commit -m "feat(review): unlock/due card generator + progress adapter"
```

---

### Task 4: Shared bearer-token auth helper (+ refactor progress)

**Files:**
- Modify: `netlify/lib/tokens.ts`
- Modify: `netlify/lib/handlers/progress.ts`
- Test: `netlify/lib/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: `constantTimeEquals` (already in `tokens.ts`).
- Produces (in `netlify/lib/tokens.ts`):
  - `bearerToken(req: Request): string | null`
  - `isAuthorized(req: Request, expected: string): boolean`

- [ ] **Step 1: Add failing tests to `netlify/lib/__tests__/tokens.test.ts`**

Append these describe-blocks (keep the existing tests; add the import of the new helpers to the existing import line):

```ts
import { bearerToken, isAuthorized } from "../tokens.js";

const reqWith = (auth?: string) =>
  new Request("http://x/api/review", auth ? { headers: { authorization: auth } } : undefined);

describe("bearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(bearerToken(reqWith("Bearer abc123"))).toBe("abc123");
  });
  it("returns null when the header is missing or malformed", () => {
    expect(bearerToken(reqWith())).toBeNull();
    expect(bearerToken(reqWith("Token abc"))).toBeNull();
    expect(bearerToken(reqWith("Bearer "))).toBeNull();
  });
});

describe("isAuthorized", () => {
  it("is true only for the exact expected token", () => {
    expect(isAuthorized(reqWith("Bearer secret"), "secret")).toBe(true);
    expect(isAuthorized(reqWith("Bearer wrong"), "secret")).toBe(false);
  });
  it("is false when no token is provided", () => {
    expect(isAuthorized(reqWith(), "secret")).toBe(false);
  });
  it("is false when the expected token is empty (writes disabled)", () => {
    expect(isAuthorized(reqWith("Bearer anything"), "")).toBe(false);
  });
});
```

Note: `bearerToken` must return `null` for `"Bearer "` (empty token). The regex `/^Bearer (.+)$/` requires ≥1 char after the space, so `"Bearer "` → no match → `null`. Good.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run netlify/lib/__tests__/tokens.test.ts`
Expected: FAIL — `bearerToken`/`isAuthorized` not exported.

- [ ] **Step 3: Add the helpers to `netlify/lib/tokens.ts`**

Append:

```ts
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

export function isAuthorized(req: Request, expected: string): boolean {
  const provided = bearerToken(req);
  return !!provided && !!expected && constantTimeEquals(provided, expected);
}
```

- [ ] **Step 4: Refactor `netlify/lib/handlers/progress.ts` to use the shared helper**

Replace the top-of-file import and the local `bearer` function + POST auth check.

Change the import line:

```ts
import { isAuthorized } from "../tokens.js";
```

(remove `import { constantTimeEquals } from "../tokens.js";`)

Delete the local `bearer` function (lines defining `function bearer(req: Request)...`).

Replace the POST auth block:

```ts
  if (req.method === "POST") {
    if (!isAuthorized(req, deps.token)) {
      return json(401, { error: "unauthorized" });
    }
```

(was: `const token = bearer(req); if (!token || !deps.token || !constantTimeEquals(...)) ...`)

- [ ] **Step 5: Run the full netlify suite to verify nothing regressed**

Run: `npx vitest run netlify/`
Expected: PASS — all existing progress tests (auth 401s, validation, success) plus the new token tests.

- [ ] **Step 6: Commit**

```bash
git add netlify/lib/tokens.ts netlify/lib/handlers/progress.ts netlify/lib/__tests__/tokens.test.ts
git commit -m "refactor(auth): extract shared bearerToken/isAuthorized helper"
```

---

### Task 5: Review store, handler, function + handler tests

**Files:**
- Create: `netlify/lib/review-store.ts`
- Create: `netlify/lib/handlers/review.ts`
- Create: `netlify/functions/review.ts`
- Test: `netlify/lib/__tests__/handlers/review.test.ts`

**Interfaces:**
- Consumes: `isAuthorized` from `../tokens.js`; `ReviewState` from `../../src/lib/review/types.js`; `getStore` from `@netlify/blobs`.
- Produces:
  - `interface ReviewStore { getState(): Promise<ReviewState | null>; setState(state: ReviewState): Promise<void> }`
  - `blobsReviewStore(): ReviewStore`
  - `interface ReviewDeps { store: ReviewStore; token: string }`
  - `handleReview(req: Request, deps: ReviewDeps): Promise<Response>` — 401 unauth (both methods), GET → `ReviewState` (default `{ schedules:{}, streak:0, lastReviewDate:null }`), POST → validate + persist → `{ ok: true }`, else 405.

- [ ] **Step 1: Write the failing handler test**

Create `netlify/lib/__tests__/handlers/review.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { handleReview, type ReviewDeps } from "../../handlers/review.js";
import type { ReviewStore } from "../../review-store.js";
import type { ReviewState } from "../../../../src/lib/review/types.js";

function fakeStore(initial: ReviewState | null = null) {
  let state = initial;
  const store: ReviewStore & { current: () => ReviewState | null } = {
    async getState() {
      return state;
    },
    async setState(s) {
      state = s;
    },
    current: () => state,
  };
  return store;
}

function deps(over: Partial<ReviewDeps> = {}): ReviewDeps {
  return { store: fakeStore(), token: "secret", ...over };
}

const sampleState: ReviewState = {
  schedules: { "card.beh.star": { ease: 2.5, interval: 1, reps: 1, lapses: 0, due: "2026-07-02" } },
  streak: 3,
  lastReviewDate: "2026-07-01",
};

const get = (auth?: string) =>
  new Request("http://x/api/review", auth ? { headers: { authorization: auth } } : undefined);
const post = (body: unknown, auth?: string) =>
  new Request("http://x/api/review", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("handleReview auth", () => {
  it("GET without a token is 401", async () => {
    expect((await handleReview(get(), deps())).status).toBe(401);
  });
  it("GET with a bad token is 401", async () => {
    expect((await handleReview(get("Bearer wrong"), deps())).status).toBe(401);
  });
  it("POST without a token is 401", async () => {
    expect((await handleReview(post(sampleState), deps())).status).toBe(401);
  });
});

describe("handleReview GET", () => {
  it("returns the empty default when nothing is stored", async () => {
    const res = await handleReview(get("Bearer secret"), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ schedules: {}, streak: 0, lastReviewDate: null });
  });
  it("returns stored state when present", async () => {
    const store = fakeStore(sampleState);
    const res = await handleReview(get("Bearer secret"), deps({ store }));
    expect(await res.json()).toEqual(sampleState);
  });
});

describe("handleReview POST", () => {
  it("persists a valid ReviewState and returns ok", async () => {
    const store = fakeStore();
    const res = await handleReview(post(sampleState, "Bearer secret"), deps({ store }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(store.current()).toEqual(sampleState);
  });
  it("rejects malformed JSON with 400", async () => {
    const res = await handleReview(post("{not json", "Bearer secret"), deps());
    expect(res.status).toBe(400);
  });
  it("rejects a body missing schedules/streak with 400", async () => {
    const res = await handleReview(post({ streak: 1 }, "Bearer secret"), deps());
    expect(res.status).toBe(400);
  });
  it("rejects a bad lastReviewDate type with 400", async () => {
    const res = await handleReview(
      post({ schedules: {}, streak: 0, lastReviewDate: 5 }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });
});

describe("handleReview other methods", () => {
  it("returns 405 for DELETE (after auth)", async () => {
    const req = new Request("http://x/api/review", {
      method: "DELETE",
      headers: { authorization: "Bearer secret" },
    });
    expect((await handleReview(req, deps())).status).toBe(405);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run netlify/lib/__tests__/handlers/review.test.ts`
Expected: FAIL — modules `../../handlers/review.js` / `../../review-store.js` not found.

- [ ] **Step 3: Write `netlify/lib/review-store.ts`**

```ts
import { getStore } from "@netlify/blobs";
import type { ReviewState } from "../../src/lib/review/types.js";

export interface ReviewStore {
  getState(): Promise<ReviewState | null>;
  setState(state: ReviewState): Promise<void>;
}

export function blobsReviewStore(): ReviewStore {
  // `consistency: 'strong'` so the owner sees their own write immediately.
  const store = getStore({ name: "review", consistency: "strong" });
  return {
    async getState() {
      const v = await store.get("state", { type: "json" });
      return (v as ReviewState | null) ?? null;
    },
    async setState(state) {
      await store.setJSON("state", state);
    },
  };
}
```

- [ ] **Step 4: Write `netlify/lib/handlers/review.ts`**

```ts
import { isAuthorized } from "../tokens.js";
import type { ReviewStore } from "../review-store.js";
import type { ReviewState } from "../../../src/lib/review/types.js";

export interface ReviewDeps {
  store: ReviewStore;
  token: string; // expected admin token (from env)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const EMPTY: ReviewState = { schedules: {}, streak: 0, lastReviewDate: null };

function isReviewState(x: unknown): x is ReviewState {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  if (typeof s.schedules !== "object" || s.schedules === null) return false;
  if (typeof s.streak !== "number") return false;
  if (!(s.lastReviewDate === null || typeof s.lastReviewDate === "string")) return false;
  return true;
}

// Difference from progress: GET is gated too — the schedule is private.
export async function handleReview(req: Request, deps: ReviewDeps): Promise<Response> {
  if (!isAuthorized(req, deps.token)) {
    return json(401, { error: "unauthorized" });
  }

  if (req.method === "GET") {
    const state = await deps.store.getState();
    return json(200, state ?? EMPTY);
  }

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid body" });
    }
    if (!isReviewState(body)) {
      return json(400, { error: "invalid body" });
    }
    await deps.store.setState(body);
    return json(200, { ok: true });
  }

  return json(405, { error: "method not allowed" });
}
```

- [ ] **Step 5: Write `netlify/functions/review.ts`**

```ts
import { handleReview } from "../lib/handlers/review.js";
import { blobsReviewStore } from "../lib/review-store.js";

const token = process.env.ROADMAP_ADMIN_TOKEN ?? "";

export default async (req: Request) =>
  handleReview(req, {
    store: blobsReviewStore(),
    token,
  });
```

- [ ] **Step 6: Run to verify the tests pass**

Run: `npx vitest run netlify/lib/__tests__/handlers/review.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add netlify/lib/review-store.ts netlify/lib/handlers/review.ts netlify/functions/review.ts netlify/lib/__tests__/handlers/review.test.ts
git commit -m "feat(review): token-gated /api/review endpoint (Blobs, GET+POST gated)"
```

---

### Task 6: Retention UI shell (static) + dashboard stat + page wiring

**Files:**
- Create: `src/components/roadmap/RetentionSection.astro`
- Modify: `src/components/roadmap/RoadmapDashboard.astro`
- Modify: `src/pages/roadmap.astro`

**Interfaces (DOM contract the client in Task 7 depends on):**
- Rotation summary: `#rv-rotation-count`, `[data-rv-thread-count="<thread>"]` (×5), `#rv-rotation-summary`, `#rv-rotation-empty`.
- Dashboard: `#rv-dash-rotation`, `#rv-dash-private` (hidden), `#rv-dash-due`, `#rv-dash-streak`.
- Runner: `#rv-runner` (hidden), `#rv-due-count`, `#rv-streak`, `#rv-save-state`, `#rv-runner-locked`, `#rv-runner-done`, `#rv-card` (hidden), `#rv-thread`, `#rv-front`, `#rv-reveal`, `#rv-back` (hidden), `#rv-ratings` (hidden), `[data-rv-rate="0..3"]`, `#rv-message` (hidden).

- [ ] **Step 1: Create `src/components/roadmap/RetentionSection.astro`**

```astro
---
import { reviewCards } from "../../data/review-cards";

const threads = [
  { key: "build", label: "Build" },
  { key: "reading", label: "Reading" },
  { key: "foundations", label: "Foundations" },
  { key: "judgment", label: "Judgment" },
  { key: "behavioral", label: "Behavioral" },
] as const;

// Build-time hint only; review.ts recomputes real counts against live progress.
const authored = reviewCards.length;
---

<section class="rm-track" aria-labelledby="rm-track-retention">
  <h2 id="rm-track-retention" class="rm-track-h">
    <span class="rm-dot d-behavioral"></span>Retention — spaced review
  </h2>
  <p class="rm-track-note">
    The other tracks ask “have I done it?” This one asks “do I still know it?” A card enters
    rotation once its milestone is checked off, then resurfaces on an SM-2 schedule. The count
    is public; the schedule is private.
  </p>

  <div class="rm-retention">
    <div id="rv-rotation-summary" class="rv-summary">
      <div class="rv-rotation">
        <span id="rv-rotation-count" class="rv-rotation-n">0</span>
        <span class="rv-rotation-l">
          cards in rotation<span class="rv-of"> · {authored} authored</span>
        </span>
      </div>
      <div class="rv-breakdown">
        {
          threads.map((t) => (
            <span class={`rv-chip rv-chip-${t.key}`}>
              {t.label} <b data-rv-thread-count={t.key}>0</b>
            </span>
          ))
        }
      </div>
    </div>
    <p id="rv-rotation-empty" class="rv-empty" hidden>
      Complete a milestone to put its cards in rotation.
    </p>

    <!-- Review runner — revealed only when the admin token is present -->
    <div id="rv-runner" class="rv-runner" hidden>
      <div class="rv-runner-head">
        <span class="rv-runner-title">Review</span>
        <span class="rv-runner-meta">
          <b id="rv-due-count">0</b> due · <b id="rv-streak">0</b> day streak
          <span id="rv-save-state" class="rv-save-state" role="status" aria-live="polite"></span>
        </span>
      </div>

      <p id="rv-runner-locked" class="rv-empty" hidden>
        Complete a milestone to put its cards in rotation.
      </p>
      <p id="rv-runner-done" class="rv-empty" hidden>All caught up.</p>

      <div id="rv-card" class="rv-card" hidden>
        <span id="rv-thread" class="rv-chip rv-chip-build">build</span>
        <p id="rv-front" class="rv-front"></p>
        <button id="rv-reveal" type="button" class="rv-reveal">Show answer</button>
        <p id="rv-back" class="rv-back" hidden></p>
        <div id="rv-ratings" class="rv-ratings" hidden role="group" aria-label="Rate your recall">
          <button type="button" class="rv-rate rv-rate-again" data-rv-rate="0">Again</button>
          <button type="button" class="rv-rate rv-rate-hard" data-rv-rate="1">Hard</button>
          <button type="button" class="rv-rate rv-rate-good" data-rv-rate="2">Good</button>
          <button type="button" class="rv-rate rv-rate-easy" data-rv-rate="3">Easy</button>
        </div>
      </div>

      <p id="rv-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add the Retention stat to `src/components/roadmap/RoadmapDashboard.astro`**

Add a 5th `.rm-stat` cell immediately after the Decision-logs stat (after the block ending `<div class="rm-l">Decision logs</div></div>`, before the closing `</div>` of `.rm-dash`):

```astro
  <div class="rm-stat rm-stat-retention">
    <div class="rm-n"><span id="rv-dash-rotation">0</span><small> in rotation</small></div>
    <div class="rm-l">
      Retention<span id="rv-dash-private" hidden> · <span id="rv-dash-due">0</span> due · <span id="rv-dash-streak">0</span> streak</span>
    </div>
  </div>
```

Then add a Retention entry to the legend (inside `.rm-legend`, after the Judgment span):

```astro
    <span><i class="rm-dot d-behavioral"></i><b>Retention</b> — spaced review</span>
```

- [ ] **Step 3: Wire the page — `src/pages/roadmap.astro`**

3a. Add the import (after the `FoundationsSection` import):

```ts
import RetentionSection from "../components/roadmap/RetentionSection.astro";
```

3b. Render the track — insert `<RetentionSection />` immediately after the closing `</section>` of the Foundations track and before the `<p class="rm-note">`:

```astro
      <RetentionSection />
```

3c. Include the client script — change the existing `<script>` block to also import `review.ts`:

```astro
<script>
  import "../scripts/roadmap.ts";
  import "../scripts/review.ts";
</script>
```

3d. Add the behavioral color — in the `.roadmap-page { ... }` custom-property block, add after `--judgment: #d98b6f;`:

```css
    --behavioral: #d9b45f;
```

3e. Add dot/fill colors — after the `.d-judgment { background: var(--judgment); }` line:

```css
  .d-behavioral { background: var(--behavioral); }
  .f-behavioral { background: var(--behavioral); }
```

3f. Make the dashboard grid fit 5 stats — change:

```css
  .rm-dash {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
```

(was `repeat(4, 1fr)`), and update the mobile rule so the 5th stat spans full width:

```css
  @media (max-width: 640px) {
    .rm-dash { grid-template-columns: repeat(2, 1fr); }
    .rm-stat-retention { grid-column: 1 / -1; }
  }
```

3g. Add the retention styles — append inside the `<style is:global>` block (before the closing `</style>`):

```css
  /* ---- retention track ---- */
  .rm-retention {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-elevated);
    padding: 18px 22px;
  }
  .rv-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 10px 22px;
    justify-content: space-between;
  }
  .rv-rotation { display: flex; align-items: baseline; gap: 10px; }
  .rv-rotation-n { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
  .rv-rotation-l { font-size: 13px; color: var(--color-text-secondary); }
  .rv-of { color: var(--color-text-faint); }
  .rv-breakdown { display: flex; flex-wrap: wrap; gap: 8px; }
  .rv-chip {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    padding: 3px 9px;
    border-radius: var(--radius-full);
    border: 1px solid color-mix(in srgb, var(--chip) 40%, transparent);
    background: color-mix(in srgb, var(--chip) 8%, transparent);
    color: color-mix(in srgb, var(--chip) 80%, var(--color-text-primary));
    white-space: nowrap;
  }
  .rv-chip b { font-weight: 700; color: var(--color-text-primary); }
  .rv-chip-build { --chip: var(--build); }
  .rv-chip-reading { --chip: var(--reading); }
  .rv-chip-foundations { --chip: var(--foundations); }
  .rv-chip-judgment { --chip: var(--judgment); }
  .rv-chip-behavioral { --chip: var(--behavioral); }

  .rv-empty {
    font-size: 13.5px;
    color: var(--color-text-secondary);
    margin: 14px 0 0;
  }

  .rv-runner { margin-top: 18px; border-top: 1px solid var(--color-border); padding-top: 16px; }
  .rv-runner-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .rv-runner-title {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--behavioral);
  }
  .rv-runner-meta { font-family: var(--font-mono); font-size: 11.5px; color: var(--color-text-secondary); }
  .rv-runner-meta b { color: var(--color-text-primary); font-weight: 600; }
  .rv-save-state { margin-left: 10px; color: var(--color-text-faint); }

  .rv-card {
    margin-top: 14px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    padding: 18px 20px;
  }
  .rv-card .rv-chip { --chip: var(--behavioral); display: inline-block; margin-bottom: 12px; }
  .rv-front { font-size: 16px; font-weight: 600; line-height: 1.5; margin: 0; }
  .rv-back {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    margin: 14px 0 0;
    padding-top: 14px;
    border-top: 1px dashed var(--color-border-hover);
    animation: rv-reveal var(--transition-base);
  }
  @keyframes rv-reveal { from { opacity: 0; } to { opacity: 1; } }
  .rv-reveal {
    margin-top: 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-accent);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 7px 18px;
    cursor: pointer;
    transition: all var(--transition-base);
  }
  .rv-reveal:hover { border-color: var(--color-accent); background: var(--color-accent-bg); }
  .rv-ratings { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .rv-rate {
    flex: 1 1 auto;
    min-width: 72px;
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 9px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all var(--transition-base);
  }
  .rv-rate:hover { border-color: var(--color-text-secondary); }
  .rv-rate:focus-visible { outline: 2px solid var(--behavioral); outline-offset: 2px; }
  .rv-rate-again:hover { border-color: #f4a896; color: #f4a896; }
  .rv-rate-easy:hover { border-color: var(--reading); color: var(--reading); }
```

- [ ] **Step 4: Build to verify the static shell renders**

Run: `npm run build`
Expected: build succeeds; no TypeScript/Astro errors. (`review.ts` doesn't exist yet — 3c imports it, so **do Step 3c last, or** temporarily create an empty `src/scripts/review.ts` now. Recommended: create `src/scripts/review.ts` with a single line `export {};` in this task so the build passes, then flesh it out in Task 7.)

To keep the build green, create the placeholder now:

```bash
printf 'export {};\n' > src/scripts/review.ts
```

Re-run: `npm run build` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmap/RetentionSection.astro src/components/roadmap/RoadmapDashboard.astro src/pages/roadmap.astro src/scripts/review.ts
git commit -m "feat(review): retention track UI shell, dashboard stat, page wiring"
```

---

### Task 7: Client hydration — `src/scripts/review.ts`

**Files:**
- Modify (replace placeholder): `src/scripts/review.ts`

**Interfaces:**
- Consumes: `reviewCards`, `ReviewCard` from `../data/review-cards`; `unlockedCards`, `dueCards`, `completedIdsFromProgress` from `../lib/review/generator`; `schedule`, `updateStreak`, `displayStreak`, `todayStr` from `../lib/review/sm2`; `emptyReviewState`, `ReviewState`, `Rating` from `../lib/review/types`. The DOM ids from Task 6. The shared token key `"roadmap-admin-token"` and endpoints `/api/progress`, `/api/review`.

- [ ] **Step 1: Replace `src/scripts/review.ts` with the full client**

```ts
import { reviewCards, type ReviewCard } from "../data/review-cards";
import { unlockedCards, dueCards, completedIdsFromProgress } from "../lib/review/generator";
import { schedule, updateStreak, displayStreak, todayStr } from "../lib/review/sm2";
import { emptyReviewState, type ReviewState, type Rating } from "../lib/review/types";

const PROGRESS_API = "/api/progress";
const REVIEW_API = "/api/review";
const TOKEN_KEY = "roadmap-admin-token";
const SAVE_DEBOUNCE_MS = 500;

const THREADS: ReviewCard["thread"][] = [
  "build",
  "reading",
  "foundations",
  "judgment",
  "behavioral",
];

let completedIds = new Set<string>();
let state: ReviewState = emptyReviewState();
let queue: string[] = []; // due card ids, in session order
let authed = false;
let revealed = false;
let saveTimer: number | undefined;

const byId = (id: string) => document.getElementById(id);
const setText = (id: string, v: string) => {
  const el = byId(id);
  if (el) el.textContent = v;
};
const setHidden = (id: string, hidden: boolean) => {
  const el = byId(id);
  if (el) el.hidden = hidden;
};
const cardById = (id: string) => reviewCards.find((c) => c.id === id);

// ---- public rotation summary (no token needed) ----
function renderRotation() {
  const unlocked = unlockedCards(reviewCards, completedIds);
  setText("rv-rotation-count", String(unlocked.length));
  setText("rv-dash-rotation", String(unlocked.length));
  for (const t of THREADS) {
    const el = document.querySelector<HTMLElement>(`[data-rv-thread-count="${t}"]`);
    if (el) el.textContent = String(unlocked.filter((c) => c.thread === t).length);
  }
  const none = unlocked.length === 0;
  setHidden("rv-rotation-empty", !none);
  setHidden("rv-rotation-summary", none);
}

// ---- private runner (token present) ----
function setRevealed(on: boolean) {
  revealed = on;
  setHidden("rv-back", !on);
  setHidden("rv-reveal", on);
  setHidden("rv-ratings", !on);
}

function renderRunner() {
  setHidden("rv-runner", !authed);
  if (!authed) return;

  const unlocked = unlockedCards(reviewCards, completedIds);
  const streak = String(displayStreak(state));
  setText("rv-streak", streak);
  setText("rv-dash-streak", streak);
  setText("rv-due-count", String(queue.length));
  setText("rv-dash-due", String(queue.length));
  setHidden("rv-dash-private", false);

  const noUnlocked = unlocked.length === 0;
  const nothingDue = !noUnlocked && queue.length === 0;

  setHidden("rv-runner-locked", !noUnlocked);
  setHidden("rv-runner-done", !nothingDue);
  if (nothingDue) {
    setText("rv-runner-done", `All caught up — ${unlocked.length} cards in rotation.`);
  }
  setHidden("rv-card", queue.length === 0);
  if (queue.length === 0) return;

  const card = cardById(queue[0]);
  if (!card) return;
  const chip = byId("rv-thread");
  if (chip) {
    chip.textContent = card.thread;
    chip.className = `rv-chip rv-chip-${card.thread}`;
  }
  setText("rv-front", card.front);
  setText("rv-back", card.back);
  setRevealed(false);
}

function onRate(rating: Rating) {
  if (!authed || queue.length === 0) return;
  const today = todayStr();
  const id = queue[0];
  const prev =
    state.schedules[id] ?? { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: today };
  state.schedules[id] = schedule(prev, rating, today);
  const st = updateStreak(state, today);
  state.streak = st.streak;
  state.lastReviewDate = st.lastReviewDate;

  queue.shift();
  if (rating === 0) queue.push(id); // Again → re-queue behind the rest (still due today)

  renderRunner();
  scheduleSave();
}

// ---- data load ----
async function loadProgress() {
  try {
    const res = await fetch(PROGRESS_API);
    const data = (await res.json()) as { completed?: string[] };
    completedIds = completedIdsFromProgress(data);
  } catch {
    completedIds = new Set();
  }
  renderRotation();
}

async function loadReview() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    authed = false;
    renderRunner();
    return;
  }
  try {
    const res = await fetch(REVIEW_API, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      authed = false;
      renderRunner();
      return;
    }
    if (!res.ok) throw new Error(`review load failed: ${res.status}`);
    state = (await res.json()) as ReviewState;
  } catch {
    authed = false;
    renderRunner();
    return;
  }
  authed = true;
  queue = dueCards(reviewCards, completedIds, state).map((d) => d.card.id);
  renderRunner();
}

// ---- persistence (mirror progress's Saving…/Saved + revert) ----
function setSaveState(text: string) {
  setText("rv-save-state", text);
}
function showMessage(text: string) {
  const el = byId("rv-message");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

async function save() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    authed = false;
    renderRunner();
    return;
  }
  setSaveState("Saving…");
  try {
    const res = await fetch(REVIEW_API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(state),
    });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      authed = false;
      setSaveState("");
      showMessage("That token didn't work.");
      renderRunner();
      return;
    }
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    showMessage("");
    setSaveState("Saved");
  } catch {
    setSaveState("");
    showMessage("Couldn't save — reloading your saved reviews.");
    await loadReview();
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setSaveState("Saving…");
  saveTimer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
}

// ---- wiring ----
function init() {
  byId("rv-reveal")?.addEventListener("click", () => setRevealed(true));
  for (const btn of document.querySelectorAll<HTMLElement>("[data-rv-rate]")) {
    btn.addEventListener("click", () => onRate(Number(btn.dataset.rvRate) as Rating));
  }

  // The progress "Edit" button collects the shared token via a synchronous
  // window.prompt. Re-check for it right after any click and light up the runner.
  byId("rm-edit")?.addEventListener("click", () => {
    window.setTimeout(() => {
      if (!authed && sessionStorage.getItem(TOKEN_KEY)) void loadReview();
    }, 0);
  });

  // Keyboard: space reveals, 1–4 rate (ignore while focus is in a form field).
  document.addEventListener("keydown", (e) => {
    if (!authed || (byId("rv-runner")?.hidden ?? true)) return;
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === " " && !revealed) {
      e.preventDefault();
      setRevealed(true);
    } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      onRate((Number(e.key) - 1) as Rating);
    }
  });

  void (async () => {
    await loadProgress(); // completedIds first…
    await loadReview(); // …then the queue depends on it
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

- [ ] **Step 2: Build + typecheck**

Run: `npm run build`
Expected: PASS — no TS errors, bundle emitted. (Astro type-checks the imported TS during build.)

- [ ] **Step 3: Run the full unit suite (nothing should regress)**

Run: `npm test`
Expected: PASS — all sm2, generator, review-cards, tokens, review-handler, and pre-existing progress/subscribe/etc. tests green.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/review.ts
git commit -m "feat(review): client hydration — rotation count, review runner, persistence"
```

---

## Manual verification (`netlify dev` — Blobs need the Netlify env)

Run `npx netlify dev` and open `/roadmap`:

1. **Visitor, no token:** the Retention track and "N cards in rotation" show (N = count of unlocked cards for the current public progress), per-thread chips populate, **no** review runner, **no** due/streak. Dashboard shows "N in rotation" with the private `· due · streak` segment hidden.
2. **Authenticate (edit-mode flow):** click **Edit**, enter the admin token. The review runner appears (same page load, via the `rm-edit` re-check). Rate a card (Again/Hard/Good/Easy) → "Saving…→Saved". Reload → schedule persisted; the rated card's next due reflects the rating (Again keeps it due today and re-queued; Good/Hard/Easy push it out).
3. **Unlock-on-completion:** pick a card whose milestone is unchecked — it is **not** in rotation. Check that milestone (edit mode) → reload → its card enters rotation (rotation count +1, appears in the runner queue once due).
4. **Save-failure path:** stop the functions server mid-review (or block `/api/review`), rate a card → message "Couldn't save — reloading your saved reviews." and state reloads from the last save.
5. **Auth boundary:** `curl -i http://localhost:8888/api/review` (no token) → **401**; `curl -i -H "Authorization: Bearer $ROADMAP_ADMIN_TOKEN" http://localhost:8888/api/review` → **200** with `{"schedules":{},"streak":0,"lastReviewDate":null}` (or stored state).

**Acceptance:** all four manual checks + the auth boundary pass; `npm test` green; `src/data/roadmap.ts` and its IDs untouched (`git diff --stat` shows no change to it); no private schedule data reachable without the token.

## Self-review notes (done)

- **Spec coverage:** §3 data model → Tasks 1–2; §4 API → Task 5 (+ shared helper Task 4); §5 SM-2 → Task 1; §6 generator → Task 3; §7 seed → Task 2 (sourceIds corrected); §8 UI → Tasks 6–7; §9 file plan → File Structure; §10 tests → per-task TDD + Manual section.
- **Type consistency:** `CardSchedule`/`ReviewState`/`Rating` defined once in `types.ts`, imported everywhere (client, generator, sm2, handler, store). `schedule`/`updateStreak`/`displayStreak`/`dueCards`/`unlockedCards`/`completedIdsFromProgress` signatures match between producers and consumers. DOM ids in Task 6 markup exactly match the selectors in Task 7.
- **No placeholders:** every code step is complete. The only intentional temporary is the one-line `export {};` placeholder in Task 6 Step 4, replaced wholesale in Task 7.
```
