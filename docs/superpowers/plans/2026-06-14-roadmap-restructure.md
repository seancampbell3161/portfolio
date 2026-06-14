# Roadmap v2 (build-anchored restructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/roadmap` from the v1 DDIA-chapter "braid" into a build-anchored page: a Build spine (5 CodeCrafters course-milestones with checkable stage-groups + capstone decision logs) plus two parallel tracks — Reading (4 books, checkable chapters) and Foundations (NeetCode courses + 150 patterns).

**Architecture:** Pure-TS content module (`src/data/roadmap.ts`) drives three tracks; a static Astro page renders them; a vanilla-TS island hydrates progress + dashboard. The Netlify Blobs progress API is **ID-agnostic and reused untouched** — only the content (and therefore the valid ID set) changes.

**Tech Stack:** Astro 5.16, TypeScript (strict), vitest, Netlify Functions + Blobs.

**Reference:** Design `docs/superpowers/specs/2026-06-14-roadmap-restructure-design.md`. Decisions locked: build-anchored (5 milestones), pragmatic Redis scope, Python, ~12.5h/wk, keep "engineering judgment" framing with logs re-homed as capstones.

**Branch:** create `feat/roadmap-v2` off `main` before Task 1.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/data/roadmap.ts` | **rewrite** | 3-track content (`build`/`reading`/`foundations`), `allIds`, `deriveStats` |
| `src/data/__tests__/roadmap.test.ts` | **rewrite** | tests for new content + stats |
| `src/components/roadmap/CheckItem.astro` | **create** | one checkable row (shared by all tracks) |
| `src/components/roadmap/Milestone.astro` | **rewrite** | a build course card (groups + capstone logs) |
| `src/components/roadmap/BookCard.astro` | **create** | a reading book card (chapters) |
| `src/components/roadmap/FoundationsSection.astro` | **create** | courses + NeetCode patterns |
| `src/components/roadmap/RoadmapDashboard.astro` | **rewrite** | 3-track dashboard + edit controls |
| `src/components/roadmap/DecisionLog.astro` | **copy update** | dashed capstone log block (header text only) |
| `src/components/roadmap/Week.astro` | **delete** | v1 only |
| `src/components/roadmap/TaskList.astro` | **delete** | v1 only |
| `src/pages/roadmap.astro` | **rewrite** | 3-track layout + global stylesheet |
| `src/scripts/roadmap.ts` | **rewrite** | hydrate + edit (mechanism kept, wiring updated) |
| `docs/roadmap-guide.md` | **update** | reflect v2 structure |
| `netlify/**` (progress API), `src/components/Nav.astro` | **unchanged** | ID-agnostic API; nav link stays |

---

## Task 1: Rewrite content module + tests (TDD)

**Files:**
- Rewrite: `src/data/roadmap.ts`
- Rewrite: `src/data/__tests__/roadmap.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/data/__tests__/roadmap.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  build,
  reading,
  foundations,
  allIds,
  deriveStats,
} from "../roadmap.js";

describe("build track", () => {
  it("has 5 course-milestones", () => {
    expect(build).toHaveLength(5);
  });
  it("has 14 stage-groups summing to 98 stages", () => {
    const groups = build.flatMap((m) => m.groups);
    expect(groups).toHaveLength(14);
    expect(groups.reduce((s, g) => s + g.stages, 0)).toBe(98);
  });
  it("has 8 capstone decision logs", () => {
    expect(build.flatMap((m) => m.logs ?? [])).toHaveLength(8);
  });
  it("starts with Redis and ends with Kafka", () => {
    expect(build[0].course).toBe("Redis");
    expect(build[4].course).toBe("Kafka");
  });
});

describe("reading track", () => {
  it("has the 4 core books", () => {
    expect(reading).toHaveLength(4);
    expect(reading.map((b) => b.id).sort()).toEqual(
      ["aposd", "dbint", "ddia", "ostep"],
    );
  });
  it("has 38 chapters total", () => {
    expect(reading.reduce((s, b) => s + b.chapters.length, 0)).toBe(38);
  });
});

describe("foundations track", () => {
  it("has 22 items (4 courses + 18 patterns)", () => {
    expect(foundations).toHaveLength(22);
    expect(foundations.filter((i) => i.kind === "course")).toHaveLength(4);
    expect(foundations.filter((i) => i.kind === "pattern")).toHaveLength(18);
  });
});

describe("allIds", () => {
  it("is the union of every checkable id (14+8+38+22 = 82), all unique", () => {
    expect(allIds.size).toBe(82);
  });
  it("contains known ids from each track", () => {
    expect(allIds.has("redis.core")).toBe(true);
    expect(allIds.has("redis.log.resp")).toBe(true);
    expect(allIds.has("ddia.ch1")).toBe(true);
    expect(allIds.has("fd.nc.arrays")).toBe(true);
  });
});

describe("deriveStats", () => {
  it("reports zeros for an empty completed list", () => {
    const s = deriveStats([]);
    expect(s.build.stagesDone).toBe(0);
    expect(s.build.stagesTotal).toBe(98);
    expect(s.build.coursesDone).toBe(0);
    expect(s.build.coursesTotal).toBe(5);
    expect(s.reading.chaptersTotal).toBe(38);
    expect(s.foundations.itemsTotal).toBe(22);
    expect(s.logsTotal).toBe(8);
  });
  it("counts a completed build group toward stages and milestone %", () => {
    const s = deriveStats(["redis.core"]);
    expect(s.build.stagesDone).toBe(7);
    expect(s.build.perMilestone.redis).toBeGreaterThan(0);
    expect(s.build.coursesDone).toBe(0); // redis not fully done
  });
  it("marks a course done only when all its groups are checked", () => {
    const s = deriveStats(["sqlite.base"]);
    expect(s.build.coursesDone).toBe(1);
  });
  it("tracks reading per-book and book completion", () => {
    const s = deriveStats(["ddia.ch1", "ddia.ch2"]);
    expect(s.reading.chaptersDone).toBe(2);
    expect(s.reading.perBook.ddia.done).toBe(2);
    expect(s.reading.booksDone).toBe(0);
  });
  it("counts foundations items and decision logs, ignoring unknown ids", () => {
    const s = deriveStats(["fd.nc.arrays", "redis.log.resp", "nope.unknown"]);
    expect(s.foundations.itemsDone).toBe(1);
    expect(s.logsDone).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/data/__tests__/roadmap.test.ts`
Expected: FAIL — the new exports (`build`, `reading`, `foundations`) don't exist yet.

- [ ] **Step 3: Rewrite the content module**

Replace the entire contents of `src/data/roadmap.ts` with:

```ts
// Single source of roadmap content (v2 — build-anchored). Pure, framework-agnostic
// TS so the Netlify function can import the id set. Stable string ids everywhere —
// progress is stored by id, so renaming a label is safe but changing an id orphans
// its stored progress.

export type Track = "build" | "reading" | "foundations";

export interface DecisionLog {
  id: string;
  prompt: string;
  intro?: string;
}

// --- Build track ---
export interface BuildGroup {
  id: string;
  label: string;
  stages: number;
  hours?: number;
}
export interface BuildMilestone {
  id: string;
  no: string;
  course: string;
  goal: string;
  groups: BuildGroup[];
  logs?: DecisionLog[];
}

// --- Reading track ---
export interface Chapter {
  id: string;
  no: string;
  title: string;
}
export interface Book {
  id: string;
  title: string;
  author: string;
  url?: string;
  free?: boolean;
  scopeNote?: string;
  chapters: Chapter[];
}

// --- Foundations track ---
export interface FoundationItem {
  id: string;
  label: string;
  kind: "course" | "pattern";
  total?: number; // lessons (course) or problems (pattern); display hint
  pairsWith?: string; // build-thread hint
}

export const build: BuildMilestone[] = [
  {
    id: "redis",
    no: "M1",
    course: "Redis",
    goal: "Build a Redis server from raw sockets to replication — defend choosing an in-memory store over disk, and name exactly when that choice breaks.",
    groups: [
      { id: "redis.core", label: "Core server — TCP sockets, RESP, PING/ECHO, SET/GET, expiry", stages: 7, hours: 11 },
      { id: "redis.rdb", label: "RDB persistence — read the snapshot file", stages: 6, hours: 9 },
      { id: "redis.aof", label: "AOF persistence — append-only log + replay", stages: 10, hours: 15 },
      { id: "redis.replication", label: "Replication — leader/follower handshake, command propagation", stages: 18, hours: 27 },
    ],
    logs: [
      { id: "redis.log.resp", prompt: "“RESP vs JSON for a wire protocol: what Redis traded away, and the workload where I’d make the opposite call.”" },
      { id: "redis.log.durability", prompt: "“RDB vs AOF: the durability/latency/recovery trade I’d default to, and the workload that flips it.”" },
      { id: "redis.log.replication", prompt: "“Single-leader vs multi-leader: where I draw the line, and what each costs.”" },
    ],
  },
  {
    id: "sqlite",
    no: "M2",
    course: "SQLite",
    goal: "Read a real SQLite database by hand — page headers, the B-tree, an indexed query — and predict which storage engine wins a query pattern before benchmarking.",
    groups: [
      { id: "sqlite.base", label: "Read the file format, walk the B-tree, run an indexed query", stages: 9, hours: 14 },
    ],
    logs: [
      { id: "sqlite.log.engine", prompt: "“B-tree vs LSM for this workload: which I’d reach for, and the read/write ratio that flips the call.”" },
    ],
  },
  {
    id: "http",
    no: "M3",
    course: "HTTP server",
    goal: "Build an HTTP/1.1 server — requests, responses, headers, compression, keep-alive — and reason about encoding and evolution on the wire.",
    groups: [
      { id: "http.base", label: "Base server — bind, parse requests, respond, headers, body", stages: 8, hours: 12 },
      { id: "http.compression", label: "HTTP compression — gzip, multiple schemes", stages: 3, hours: 5 },
      { id: "http.persistent", label: "Persistent connections — keep-alive, concurrency, closure", stages: 3, hours: 4 },
    ],
    logs: [
      { id: "http.log.versioning", prompt: "“Versioning an API without breaking last year’s clients — the migration I’d never ship.”" },
    ],
  },
  {
    id: "dns",
    no: "M4",
    course: "DNS server",
    goal: "Build a DNS server — construct and parse the binary packet format, handle name compression, forward queries — and appreciate compact wire encoding.",
    groups: [
      { id: "dns.base", label: "UDP server — write/parse header, question, answer; name compression; forwarding", stages: 8, hours: 12 },
    ],
    logs: [
      { id: "dns.log.protocol", prompt: "“Compact binary protocols: where DNS’s choices (name compression, UDP) pay off and where they bite.”" },
    ],
  },
  {
    id: "kafka",
    no: "M5",
    course: "Kafka",
    goal: "Build a Kafka broker — the partitioned log, offsets, fetch and produce — and name the consistency model a system needs versus the one it secretly relies on.",
    groups: [
      { id: "kafka.base", label: "Base — bind, correlation IDs, API versions", stages: 5, hours: 8 },
      { id: "kafka.concurrent", label: "Concurrent clients", stages: 2, hours: 3 },
      { id: "kafka.partitions", label: "Listing partitions (DescribeTopicPartitions)", stages: 5, hours: 7 },
      { id: "kafka.consume", label: "Consuming messages (Fetch from disk)", stages: 6, hours: 9 },
      { id: "kafka.produce", label: "Producing messages (Produce records)", stages: 8, hours: 12 },
    ],
    logs: [
      { id: "kafka.log.consistency", prompt: "“Which consistency model a feature needs — and the one it’s secretly relying on.”" },
      { id: "kafka.log.capstone", prompt: "“Capstone: a published system-design writeup distilled from these decision logs.”" },
    ],
  },
];

export const reading: Book[] = [
  {
    id: "ddia",
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    url: "https://dataintensive.net",
    chapters: [
      { id: "ddia.ch1", no: "1", title: "Reliable, Scalable, Maintainable Applications" },
      { id: "ddia.ch2", no: "2", title: "Data Models and Query Languages" },
      { id: "ddia.ch3", no: "3", title: "Storage and Retrieval" },
      { id: "ddia.ch4", no: "4", title: "Encoding and Evolution" },
      { id: "ddia.ch5", no: "5", title: "Replication" },
      { id: "ddia.ch6", no: "6", title: "Partitioning" },
      { id: "ddia.ch7", no: "7", title: "Transactions" },
      { id: "ddia.ch8", no: "8", title: "The Trouble with Distributed Systems" },
      { id: "ddia.ch9", no: "9", title: "Consistency and Consensus" },
      { id: "ddia.ch10", no: "10", title: "Batch Processing" },
      { id: "ddia.ch11", no: "11", title: "Stream Processing" },
      { id: "ddia.ch12", no: "12", title: "The Future of Data Systems" },
    ],
  },
  {
    id: "dbint",
    title: "Database Internals",
    author: "Alex Petrov",
    chapters: [
      { id: "dbint.ch1", no: "1", title: "Introduction and Overview" },
      { id: "dbint.ch2", no: "2", title: "B-Tree Basics" },
      { id: "dbint.ch3", no: "3", title: "File Formats" },
      { id: "dbint.ch4", no: "4", title: "Implementing B-Trees" },
      { id: "dbint.ch5", no: "5", title: "Transaction Processing and Recovery" },
      { id: "dbint.ch6", no: "6", title: "B-Tree Variants" },
      { id: "dbint.ch7", no: "7", title: "Log-Structured Storage" },
      { id: "dbint.ch8", no: "8", title: "Introduction and Overview (Distributed)" },
      { id: "dbint.ch9", no: "9", title: "Failure Detection" },
      { id: "dbint.ch10", no: "10", title: "Leader Election" },
      { id: "dbint.ch11", no: "11", title: "Replication and Consistency" },
      { id: "dbint.ch12", no: "12", title: "Anti-Entropy and Dissemination" },
      { id: "dbint.ch13", no: "13", title: "Distributed Transactions" },
      { id: "dbint.ch14", no: "14", title: "Consensus" },
    ],
  },
  {
    id: "ostep",
    title: "Operating Systems: Three Easy Pieces",
    author: "Remzi & Andrea Arpaci-Dusseau",
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
    free: true,
    scopeNote: "Concurrency + Persistence parts only",
    chapters: [
      { id: "ostep.c1", no: "C1", title: "Concurrency — threads & locks" },
      { id: "ostep.c2", no: "C2", title: "Concurrency — condition variables & semaphores" },
      { id: "ostep.c3", no: "C3", title: "Concurrency — common bugs & deadlock" },
      { id: "ostep.p1", no: "P1", title: "Persistence — I/O devices & disks" },
      { id: "ostep.p2", no: "P2", title: "Persistence — files & directories" },
      { id: "ostep.p3", no: "P3", title: "Persistence — crash consistency (fsck/journaling)" },
      { id: "ostep.p4", no: "P4", title: "Persistence — log-structured file systems" },
    ],
  },
  {
    id: "aposd",
    title: "A Philosophy of Software Design",
    author: "John Ousterhout",
    chapters: [
      { id: "aposd.s1", no: "1–3", title: "Complexity & its symptoms" },
      { id: "aposd.s2", no: "4–6", title: "Modules should be deep" },
      { id: "aposd.s3", no: "7–10", title: "Information hiding & general-purpose design" },
      { id: "aposd.s4", no: "11–16", title: "Comments & naming" },
      { id: "aposd.s5", no: "17–21", title: "Consistency, obvious code, trends" },
    ],
  },
];

// NeetCode-150 pattern problem counts are display hints (standard breakdown,
// ~150 total); they may drift from the live site. Course lesson counts likewise.
export const foundations: FoundationItem[] = [
  { id: "fd.pyci", label: "Python for Coding Interviews", kind: "course", total: 40 },
  { id: "fd.dsab", label: "Algorithms & Data Structures for Beginners", kind: "course", total: 35 },
  { id: "fd.coreskills", label: "Core Skills — implement the data structures", kind: "course", total: 20 },
  { id: "fd.advanced", label: "Advanced Algorithms (optional, later)", kind: "course", total: 35 },
  { id: "fd.nc.arrays", label: "Arrays & Hashing", kind: "pattern", total: 9, pairsWith: "Redis hash store" },
  { id: "fd.nc.twopointers", label: "Two Pointers", kind: "pattern", total: 5 },
  { id: "fd.nc.sliding", label: "Sliding Window", kind: "pattern", total: 6 },
  { id: "fd.nc.stack", label: "Stack", kind: "pattern", total: 7 },
  { id: "fd.nc.binsearch", label: "Binary Search", kind: "pattern", total: 7, pairsWith: "SQLite B-tree" },
  { id: "fd.nc.linkedlist", label: "Linked List", kind: "pattern", total: 11 },
  { id: "fd.nc.trees", label: "Trees", kind: "pattern", total: 15, pairsWith: "SQLite B-tree" },
  { id: "fd.nc.heap", label: "Heap / Priority Queue", kind: "pattern", total: 7 },
  { id: "fd.nc.backtracking", label: "Backtracking", kind: "pattern", total: 9 },
  { id: "fd.nc.tries", label: "Tries", kind: "pattern", total: 3 },
  { id: "fd.nc.graphs", label: "Graphs", kind: "pattern", total: 13, pairsWith: "replication & partitioning" },
  { id: "fd.nc.advgraphs", label: "Advanced Graphs", kind: "pattern", total: 6 },
  { id: "fd.nc.dp1", label: "1-D Dynamic Programming", kind: "pattern", total: 12 },
  { id: "fd.nc.dp2", label: "2-D Dynamic Programming", kind: "pattern", total: 11 },
  { id: "fd.nc.greedy", label: "Greedy", kind: "pattern", total: 8 },
  { id: "fd.nc.intervals", label: "Intervals", kind: "pattern", total: 6 },
  { id: "fd.nc.mathgeo", label: "Math & Geometry", kind: "pattern", total: 8 },
  { id: "fd.nc.bits", label: "Bit Manipulation", kind: "pattern", total: 7 },
];

export const allIds: Set<string> = new Set([
  ...build.flatMap((m) => [...m.groups.map((g) => g.id), ...(m.logs ?? []).map((l) => l.id)]),
  ...reading.flatMap((b) => b.chapters.map((c) => c.id)),
  ...foundations.map((i) => i.id),
]);

export interface RoadmapStats {
  build: {
    stagesDone: number;
    stagesTotal: number;
    coursesDone: number;
    coursesTotal: number;
    pct: number;
    perMilestone: Record<string, number>;
  };
  reading: {
    chaptersDone: number;
    chaptersTotal: number;
    booksDone: number;
    booksTotal: number;
    pct: number;
    perBook: Record<string, { done: number; total: number }>;
  };
  foundations: { itemsDone: number; itemsTotal: number; pct: number };
  logsDone: number;
  logsTotal: number;
}

export function deriveStats(completed: string[]): RoadmapStats {
  const done = new Set(completed);

  let stagesDone = 0;
  let stagesTotal = 0;
  let coursesDone = 0;
  const perMilestone: Record<string, number> = {};
  for (const m of build) {
    let mDone = 0;
    let mTotal = 0;
    for (const g of m.groups) {
      mTotal += g.stages;
      if (done.has(g.id)) mDone += g.stages;
    }
    stagesTotal += mTotal;
    stagesDone += mDone;
    perMilestone[m.id] = mTotal ? Math.round((mDone / mTotal) * 100) : 0;
    if (m.groups.every((g) => done.has(g.id))) coursesDone++;
  }

  let chaptersDone = 0;
  let chaptersTotal = 0;
  let booksDone = 0;
  const perBook: Record<string, { done: number; total: number }> = {};
  for (const b of reading) {
    const total = b.chapters.length;
    const d = b.chapters.filter((c) => done.has(c.id)).length;
    chaptersTotal += total;
    chaptersDone += d;
    perBook[b.id] = { done: d, total };
    if (total > 0 && d === total) booksDone++;
  }

  const itemsTotal = foundations.length;
  const itemsDone = foundations.filter((i) => done.has(i.id)).length;

  const logIds = build.flatMap((m) => (m.logs ?? []).map((l) => l.id));

  return {
    build: {
      stagesDone,
      stagesTotal,
      coursesDone,
      coursesTotal: build.length,
      pct: stagesTotal ? Math.round((stagesDone / stagesTotal) * 100) : 0,
      perMilestone,
    },
    reading: {
      chaptersDone,
      chaptersTotal,
      booksDone,
      booksTotal: reading.length,
      pct: chaptersTotal ? Math.round((chaptersDone / chaptersTotal) * 100) : 0,
      perBook,
    },
    foundations: {
      itemsDone,
      itemsTotal,
      pct: itemsTotal ? Math.round((itemsDone / itemsTotal) * 100) : 0,
    },
    logsDone: logIds.filter((id) => done.has(id)).length,
    logsTotal: logIds.length,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/data/__tests__/roadmap.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Run the full suite (the Netlify handler test imports nothing from here, but confirm no regressions)**

Run: `npm run test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/data/roadmap.ts src/data/__tests__/roadmap.test.ts
git commit -m "feat(roadmap): rewrite content model as build/reading/foundations tracks"
```

---

## Task 2: Presentational components

Markup-only (all CSS lives in the page, Task 3). Reuse the shared `data-id` checkbox contract.

**Files:**
- Create: `src/components/roadmap/CheckItem.astro`
- Rewrite: `src/components/roadmap/Milestone.astro`
- Create: `src/components/roadmap/BookCard.astro`
- Create: `src/components/roadmap/FoundationsSection.astro`
- Rewrite: `src/components/roadmap/RoadmapDashboard.astro`
- Delete: `src/components/roadmap/Week.astro`, `src/components/roadmap/TaskList.astro`
- Update (copy only): `src/components/roadmap/DecisionLog.astro`

- [ ] **Step 1: Delete the two v1-only components**

```bash
git rm src/components/roadmap/Week.astro src/components/roadmap/TaskList.astro
```

- [ ] **Step 2: Create `CheckItem.astro`**

```astro
---
interface Props {
  id: string;
  label: string;
  meta?: string;
  hint?: string;
}
const { id, label, meta, hint } = Astro.props;
---

<div class="rm-check">
  <input type="checkbox" id={id} data-id={id} disabled />
  <label for={id}>
    <span class="rm-check-label">{label}</span>
    {meta && <span class="rm-check-meta">{meta}</span>}
    {hint && <span class="rm-check-hint">↔ {hint}</span>}
  </label>
</div>
```

- [ ] **Step 3: Rewrite `Milestone.astro`**

```astro
---
import type { BuildMilestone } from "../../data/roadmap";
import CheckItem from "./CheckItem.astro";
import DecisionLog from "./DecisionLog.astro";

interface Props {
  milestone: BuildMilestone;
  open?: boolean;
}
const { milestone, open = false } = Astro.props;
---

<details class="rm-m" open={open} data-milestone={milestone.id}>
  <summary>
    <span class="rm-m-no">{milestone.no}</span>
    <span class="rm-m-mid">
      <p class="rm-m-title">{milestone.course}</p>
      <p class="rm-m-goal">{milestone.goal}</p>
      <span class="rm-threads">
        <span class="rm-dot d-build"></span>
        <span class="rm-dot d-judgment"></span>
      </span>
    </span>
    <span class="rm-m-right">
      <span class="rm-pct" data-milestone-pct={milestone.id}>0%</span>
      <span class="rm-ring">+</span>
    </span>
  </summary>
  <div class="rm-m-body">
    {
      milestone.groups.map((g) => (
        <CheckItem
          id={g.id}
          label={g.label}
          meta={`${g.stages} stages${g.hours ? ` · ~${g.hours}h` : ""}`}
        />
      ))
    }
    {(milestone.logs ?? []).map((log) => <DecisionLog log={log} />)}
  </div>
</details>
```

- [ ] **Step 4: Create `BookCard.astro`**

```astro
---
import type { Book } from "../../data/roadmap";
import CheckItem from "./CheckItem.astro";

interface Props {
  book: Book;
  open?: boolean;
}
const { book, open = false } = Astro.props;
---

<details class="rm-book" open={open} data-book={book.id}>
  <summary>
    <span class="rm-m-mid">
      <p class="rm-book-title">
        {book.url ? <a href={book.url} target="_blank" rel="noopener" onclick="event.stopPropagation()">{book.title}</a> : book.title}
        {book.free && <span class="rm-badge">free</span>}
      </p>
      <p class="rm-book-author">{book.author}{book.scopeNote ? ` · ${book.scopeNote}` : ""}</p>
    </span>
    <span class="rm-m-right">
      <span class="rm-pct" data-book-pct={book.id}>0/{book.chapters.length}</span>
      <span class="rm-ring">+</span>
    </span>
  </summary>
  <div class="rm-m-body">
    {book.chapters.map((c) => <CheckItem id={c.id} label={`${c.no}. ${c.title}`} />)}
  </div>
</details>
```

- [ ] **Step 5: Create `FoundationsSection.astro`**

```astro
---
import type { FoundationItem } from "../../data/roadmap";
import CheckItem from "./CheckItem.astro";

interface Props {
  foundations: FoundationItem[];
}
const { foundations } = Astro.props;
const courses = foundations.filter((i) => i.kind === "course");
const patterns = foundations.filter((i) => i.kind === "pattern");
---

<div class="rm-foundations">
  <h4 class="rm-track-sub">Courses</h4>
  {courses.map((i) => <CheckItem id={i.id} label={i.label} meta={i.total ? `${i.total} lessons` : undefined} />)}
  <h4 class="rm-track-sub">NeetCode 150 — patterns</h4>
  {patterns.map((i) => <CheckItem id={i.id} label={i.label} meta={i.total ? `${i.total} problems` : undefined} hint={i.pairsWith} />)}
</div>
```

- [ ] **Step 6: Rewrite `RoadmapDashboard.astro`**

```astro
---
import { deriveStats } from "../../data/roadmap";
const s = deriveStats([]); // zeroed defaults; the island overwrites on load
---

<div class="rm-dash">
  <div class="rm-stat">
    <div class="rm-n"><span id="rm-build-stages">0</span><small> / {s.build.stagesTotal} stages</small></div>
    <div class="rm-l">Build · <span id="rm-build-courses">0</span>/{s.build.coursesTotal} courses</div>
    <div class="rm-bar"><i id="rm-build-bar" class="f-build"></i></div>
  </div>
  <div class="rm-stat">
    <div class="rm-n"><span id="rm-read-ch">0</span><small> / {s.reading.chaptersTotal} chapters</small></div>
    <div class="rm-l">Reading · <span id="rm-read-books">0</span>/{s.reading.booksTotal} books</div>
    <div class="rm-bar"><i id="rm-read-bar" class="f-reading"></i></div>
  </div>
  <div class="rm-stat">
    <div class="rm-n"><span id="rm-fnd-done">0</span><small> / {s.foundations.itemsTotal} items</small></div>
    <div class="rm-l">Foundations</div>
    <div class="rm-bar"><i id="rm-fnd-bar" class="f-foundations"></i></div>
  </div>
  <div class="rm-stat">
    <div class="rm-n"><span id="rm-logs-done">0</span><small> / {s.logsTotal}</small></div>
    <div class="rm-l">Decision logs</div>
  </div>
</div>

<div class="rm-controls">
  <div class="rm-legend">
    <span><i class="rm-dot d-build"></i><b>Build</b> — CodeCrafters</span>
    <span><i class="rm-dot d-reading"></i><b>Reading</b> — DDIA &amp; more</span>
    <span><i class="rm-dot d-foundations"></i><b>Foundations</b> — NeetCode</span>
    <span><i class="rm-dot d-judgment"></i><b>Judgment</b> — decision log</span>
  </div>
  <div class="rm-edit-wrap">
    <span id="rm-save-state" class="rm-save-state" role="status" aria-live="polite"></span>
    <button id="rm-edit" type="button" class="rm-edit-btn">Edit</button>
  </div>
</div>
<p id="rm-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>
```

- [ ] **Step 7: Update `DecisionLog.astro` header copy (logs are now capstones, not weekly)**

The component is otherwise kept. In `src/components/roadmap/DecisionLog.astro`, change the header text so it no longer says "the week's artifact". Make the `rm-log-head` line read:

```astro
  <div class="rm-log-head">
    <span class="rm-dot d-judgment"></span>Decision log — capstone
  </div>
```

(Leave the rest — `rm-log-intro`, `rm-log-prompt`, and the `rm-mark` "Mark logged" checkbox with `id={log.id}` / `data-id={log.id}` — unchanged.)

- [ ] **Step 8: Commit**

```bash
git add src/components/roadmap/
git commit -m "feat(roadmap): three-track presentational components"
```

---

## Task 3: Rewrite the page + stylesheet

**Files:**
- Rewrite: `src/pages/roadmap.astro`

- [ ] **Step 1: Replace `src/pages/roadmap.astro` entirely**

Preserve the owner's current thesis copy verbatim (do not revert it).

```astro
---
import Layout from "../layouts/Layout.astro";
import Nav from "../components/Nav.astro";
import Footer from "../components/Footer.astro";
import RoadmapDashboard from "../components/roadmap/RoadmapDashboard.astro";
import Milestone from "../components/roadmap/Milestone.astro";
import BookCard from "../components/roadmap/BookCard.astro";
import FoundationsSection from "../components/roadmap/FoundationsSection.astro";
import { build, reading, foundations } from "../data/roadmap";
---

<Layout
  title="Roadmap — Building Engineering Judgment | Sean Campbell"
  description="A public learning roadmap: building real systems (CodeCrafters), reading deeply (DDIA & more), and DSA fundamentals (NeetCode) — building engineering judgment in the open."
>
  <Nav />

  <main class="roadmap-page">
    <div class="rm-wrap">
      <p class="rm-eyebrow">A learning roadmap · in progress</p>
      <h1 class="rm-title">Building <em>engineering judgment</em></h1>
      <p class="rm-thesis">
        Follow along with what I'm doing and the resources I'm using to become better at
        decision making &amp; problem solving as a Software Engineer. Building everything out in
        the open for anyone to see.
      </p>

      <RoadmapDashboard />

      <section class="rm-track" aria-labelledby="rm-track-build">
        <h2 id="rm-track-build" class="rm-track-h"><span class="rm-dot d-build"></span>Build — CodeCrafters</h2>
        <p class="rm-track-note">One milestone per course, taken to (pragmatic) completion, in order. Sub-checkpoints are the CodeCrafters stage-groups; each milestone ends in a capstone decision log.</p>
        <div class="rm-milestones">
          {build.map((m, i) => <Milestone milestone={m} open={i === 0} />)}
        </div>
      </section>

      <section class="rm-track" aria-labelledby="rm-track-reading">
        <h2 id="rm-track-reading" class="rm-track-h"><span class="rm-dot d-reading"></span>Reading — interleaved</h2>
        <p class="rm-track-note">Read ~1–2 chapters/week, interleaved with the builds: one "anchor" chapter (DDIA / Database Internals) plus one "light" read (A Philosophy of Software Design, then OSTEP). DDIA + APoSD finish within the build; the rest carries past it.</p>
        <div class="rm-books">
          {reading.map((b, i) => <BookCard book={b} open={i === 0} />)}
        </div>
      </section>

      <section class="rm-track" aria-labelledby="rm-track-foundations">
        <h2 id="rm-track-foundations" class="rm-track-h"><span class="rm-dot d-foundations"></span>Foundations — NeetCode</h2>
        <p class="rm-track-note">Course-first, then problems: finish the courses, then work NeetCode 150 pattern by pattern. The patterns line up with the builds (shown as ↔ hints).</p>
        <FoundationsSection foundations={foundations} />
      </section>

      <p class="rm-note">
        Progress is shared — what you see is the live, saved state. The owner can unlock edit
        mode to check items off.
      </p>
    </div>
  </main>

  <Footer />
</Layout>

<script>
  import "../scripts/roadmap.ts";
</script>

<style is:global>
  /* ---- four-thread palette (site-native) ---- */
  .roadmap-page {
    --build: #60a5fa;
    --reading: #5fb3ac;
    --foundations: #a78bfa;
    --judgment: #d98b6f;
    position: relative;
    z-index: 1;
    padding-top: 80px;
  }
  .roadmap-page .rm-wrap {
    max-width: 920px;
    margin: 0 auto;
    padding: var(--space-3xl) var(--space-lg) var(--space-4xl);
  }

  /* ---- header ---- */
  .rm-eyebrow {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin: 0 0 18px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .rm-eyebrow::before {
    content: "";
    width: 28px;
    height: 1px;
    background: var(--color-border-hover);
  }
  .rm-title {
    font-size: clamp(34px, 6vw, 56px);
    line-height: 1.02;
    margin: 0 0 20px;
  }
  .rm-title em {
    font-style: normal;
    color: var(--build);
  }
  .rm-thesis {
    font-size: clamp(16px, 2.4vw, 19px);
    color: var(--color-text-secondary);
    max-width: 62ch;
    margin: 0;
  }

  /* ---- dashboard ---- */
  .rm-dash {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--color-border);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin: 44px 0 14px;
  }
  .rm-stat {
    background: var(--color-bg-elevated);
    padding: 18px 20px;
  }
  .rm-n {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .rm-n small {
    font-size: 13px;
    color: var(--color-text-faint);
    font-weight: 500;
  }
  .rm-l {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-top: 6px;
  }
  .rm-bar {
    height: 4px;
    background: var(--color-bg-hover);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-top: 12px;
  }
  .rm-bar > i {
    display: block;
    height: 100%;
    width: 0;
    border-radius: var(--radius-full);
    transition: width var(--transition-slow);
  }
  .f-build { background: var(--build); }
  .f-reading { background: var(--reading); }
  .f-foundations { background: var(--foundations); }

  /* ---- controls / legend ---- */
  .rm-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: space-between;
    align-items: center;
    margin: 26px 0 8px;
  }
  .rm-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--color-text-secondary);
  }
  .rm-legend span { display: inline-flex; align-items: center; gap: 8px; }
  .rm-legend b { color: var(--color-text-primary); font-weight: 500; }
  .rm-dot { width: 9px; height: 9px; border-radius: var(--radius-full); flex: none; display: inline-block; }
  .d-build { background: var(--build); }
  .d-reading { background: var(--reading); }
  .d-foundations { background: var(--foundations); }
  .d-judgment { background: var(--judgment); }

  .rm-edit-wrap { display: flex; align-items: center; gap: 12px; }
  .rm-save-state { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-faint); }
  .rm-edit-btn {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-accent);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 6px 16px;
    cursor: pointer;
    transition: all var(--transition-base);
  }
  .rm-edit-btn:hover { border-color: var(--color-accent); background: var(--color-accent-bg); }
  .rm-message { font-size: 13px; color: #f4a896; margin: 12px 0 0; }

  /* ---- track sections ---- */
  .rm-track { margin-top: var(--space-3xl); }
  .rm-track-h {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 6px;
  }
  .rm-track-h .rm-dot { width: 11px; height: 11px; }
  .rm-track-note {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0 0 14px;
    max-width: 70ch;
  }

  /* ---- milestone / book cards (shared) ---- */
  .rm-m, .rm-book {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-elevated);
    margin-top: 12px;
    overflow: hidden;
  }
  .rm-m > summary, .rm-book > summary {
    list-style: none;
    cursor: pointer;
    padding: 20px 22px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    outline: none;
  }
  .rm-m > summary::-webkit-details-marker,
  .rm-book > summary::-webkit-details-marker { display: none; }
  .rm-m > summary:focus-visible,
  .rm-book > summary:focus-visible { box-shadow: inset 0 0 0 2px var(--reading); }
  .rm-m-no {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-faint);
    padding-top: 4px;
    min-width: 28px;
    letter-spacing: 0.05em;
  }
  .rm-m-mid { flex: 1; min-width: 0; }
  .rm-m-title, .rm-book-title {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .rm-m-goal {
    color: var(--color-text-secondary);
    font-size: 14px;
    margin: 0;
  }
  .rm-m-goal::before {
    content: "Goal — ";
    color: var(--judgment);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .rm-book-author { color: var(--color-text-muted); font-size: 13px; margin: 0; }
  .rm-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--reading);
    border: 1px solid color-mix(in srgb, var(--reading) 40%, transparent);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
  }
  .rm-threads { display: flex; gap: 6px; margin-top: 12px; }
  .rm-threads .rm-dot { width: 7px; height: 7px; opacity: 0.9; }
  .rm-m-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; padding-top: 2px; }
  .rm-pct {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-secondary);
    min-width: 44px;
    text-align: right;
    white-space: nowrap;
  }
  .rm-ring {
    font-family: var(--font-mono);
    color: var(--color-text-faint);
    font-size: 18px;
    transition: transform var(--transition-base);
  }
  .rm-m[open] > summary .rm-ring,
  .rm-book[open] > summary .rm-ring { transform: rotate(45deg); }
  .rm-m-body { padding: 4px 22px 22px; border-top: 1px solid var(--color-border); }

  /* ---- checkable rows (shared by all tracks) ---- */
  .rm-check {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding: 9px 0;
    border-top: 1px solid var(--color-border);
  }
  .rm-check:first-child { border-top: none; }
  /* checkbox styling shared by track rows (.rm-check) and decision logs (.rm-mark) */
  .rm-check input,
  .rm-mark input {
    appearance: none;
    width: 17px;
    height: 17px;
    border: 1.5px solid var(--color-border-hover);
    border-radius: 5px;
    flex: none;
    margin-top: 2px;
    cursor: pointer;
    position: relative;
    transition: var(--transition-fast);
  }
  .rm-check input:disabled,
  .rm-mark input:disabled { cursor: default; }
  .roadmap-page.rm-editing .rm-check input:hover,
  .roadmap-page.rm-editing .rm-mark input:hover { border-color: var(--color-text-secondary); }
  .rm-check input:checked,
  .rm-mark input:checked { background: var(--build); border-color: var(--build); }
  .rm-check input:checked::after,
  .rm-mark input:checked::after {
    content: "";
    position: absolute;
    left: 5px;
    top: 1.5px;
    width: 4px;
    height: 8px;
    border: solid var(--color-bg);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }
  .rm-check input:focus-visible,
  .rm-mark input:focus-visible { outline: 2px solid var(--reading); outline-offset: 2px; }
  .rm-check label { cursor: default; font-size: 14px; line-height: 1.5; }
  .roadmap-page.rm-editing .rm-check label { cursor: pointer; }
  .rm-check input:checked + label .rm-check-label {
    color: var(--color-text-faint);
    text-decoration: line-through;
    text-decoration-color: var(--color-border-hover);
  }
  .rm-check-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-faint);
    margin-left: 8px;
  }
  .rm-check-hint {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--foundations);
    margin-left: 8px;
  }

  /* ---- decision log (the signature) ---- */
  .rm-log {
    margin-top: 16px;
    border: 1px dashed color-mix(in srgb, var(--judgment) 45%, transparent);
    border-radius: var(--radius-md);
    padding: 16px 18px;
    background: color-mix(in srgb, var(--judgment) 6%, transparent);
  }
  .rm-log-head {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--judgment);
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .rm-log-intro { margin: 0 0 12px; font-size: 13.5px; color: var(--color-text-secondary); }
  .rm-log-prompt {
    font-size: 14px;
    color: var(--color-text-primary);
    font-weight: 500;
    border-left: 2px solid var(--judgment);
    padding-left: 12px;
    margin: 0 0 14px;
  }
  .rm-mark {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    cursor: default;
  }
  .roadmap-page.rm-editing .rm-mark { cursor: pointer; }

  /* ---- foundations ---- */
  .rm-foundations {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-elevated);
    padding: 6px 22px 18px;
  }
  .rm-track-sub {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-faint);
    margin: 18px 0 4px;
  }

  .rm-note {
    font-size: 12.5px;
    color: var(--color-text-faint);
    text-align: center;
    margin-top: 46px;
    font-family: var(--font-mono);
    line-height: 1.7;
  }

  @media (max-width: 640px) {
    .rm-dash { grid-template-columns: repeat(2, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    .roadmap-page * { transition: none !important; }
  }
</style>
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: success.

Run: `test -f dist/roadmap/index.html && echo OK`
Expected: `OK`

Run: `grep -c 'data-id=' dist/roadmap/index.html`
Expected: `82` (14 build groups + 8 logs + 38 chapters + 22 foundations).

- [ ] **Step 3: Commit**

```bash
git add src/pages/roadmap.astro
git commit -m "feat(roadmap): three-track page + stylesheet"
```

---

## Task 4: Rewrite the client island

**Files:**
- Rewrite: `src/scripts/roadmap.ts`

The page already imports it via `<script>import "../scripts/roadmap.ts"`. The fetch/edit/optimistic-save mechanism is unchanged from v1; only `render()` (the dashboard/per-card wiring) changes for the 3-track model.

- [ ] **Step 1: Replace `src/scripts/roadmap.ts` entirely**

```ts
import { deriveStats } from "../data/roadmap";

const API = "/api/progress";
const TOKEN_KEY = "roadmap-admin-token";
const SAVE_DEBOUNCE_MS = 500;

const completed = new Set<string>();
let editing = false;
let saveTimer: number | undefined;

const boxes = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>("input[data-id]"));

function setText(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setWidth(id: string, pct: number) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function render() {
  for (const box of boxes()) box.checked = completed.has(box.dataset.id!);

  const s = deriveStats([...completed]);

  setText("rm-build-stages", String(s.build.stagesDone));
  setText("rm-build-courses", String(s.build.coursesDone));
  setWidth("rm-build-bar", s.build.pct);

  setText("rm-read-ch", String(s.reading.chaptersDone));
  setText("rm-read-books", String(s.reading.booksDone));
  setWidth("rm-read-bar", s.reading.pct);

  setText("rm-fnd-done", String(s.foundations.itemsDone));
  setWidth("rm-fnd-bar", s.foundations.pct);

  setText("rm-logs-done", String(s.logsDone));

  for (const el of document.querySelectorAll<HTMLElement>("[data-milestone-pct]")) {
    el.textContent = `${s.build.perMilestone[el.dataset.milestonePct!] ?? 0}%`;
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-book-pct]")) {
    const b = s.reading.perBook[el.dataset.bookPct!];
    if (b) el.textContent = `${b.done}/${b.total}`;
  }
}

function setSaveState(text: string) {
  setText("rm-save-state", text);
}
function showMessage(text: string) {
  const el = document.getElementById("rm-message");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

function setEditable(on: boolean) {
  editing = on;
  for (const box of boxes()) box.disabled = !on;
  document.querySelector(".roadmap-page")?.classList.toggle("rm-editing", on);
  const btn = document.getElementById("rm-edit");
  if (btn) btn.textContent = on ? "Done" : "Edit";
}

async function load() {
  try {
    const res = await fetch(API);
    const data = (await res.json()) as { completed?: string[] };
    completed.clear();
    for (const id of data.completed ?? []) completed.add(id);
  } catch {
    // leave as-is; render shows zeros on first failure
  }
  render();
}

async function save() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    setEditable(false);
    return;
  }
  setSaveState("Saving…");
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ completed: [...completed] }),
    });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setEditable(false);
      setSaveState("");
      showMessage("That token didn't work.");
      await load();
      return;
    }
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    showMessage("");
    setSaveState("Saved");
  } catch {
    setSaveState("");
    showMessage("Couldn't save — your last change was undone.");
    await load();
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  setSaveState("Saving…");
  saveTimer = window.setTimeout(save, SAVE_DEBOUNCE_MS);
}

function onToggle(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.matches?.("input[data-id]") || !editing) return;
  const id = input.dataset.id!;
  if (input.checked) completed.add(id);
  else completed.delete(id);
  render();
  scheduleSave();
}

function onEditClick() {
  if (editing) {
    setEditable(false);
    return;
  }
  const token = window.prompt("Enter the admin token to edit progress");
  if (!token) return;
  sessionStorage.setItem(TOKEN_KEY, token);
  showMessage("");
  setEditable(true);
}

function init() {
  document.addEventListener("change", onToggle);
  document.getElementById("rm-edit")?.addEventListener("click", onEditClick);
  if (sessionStorage.getItem(TOKEN_KEY)) setEditable(true);
  void load();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

- [ ] **Step 2: Build and verify the token is absent from the bundle**

Run: `npm run build`
Expected: success.

Run: `grep -rn "ROADMAP_ADMIN_TOKEN" dist/ || echo "token absent from client bundle"`
Expected: `token absent from client bundle`

Run: `grep -rl "/api/progress" dist/_astro/*.js`
Expected: prints a bundle file (the island shipped).

- [ ] **Step 3: Manual verification with `netlify dev` (owner runs this)**

Run: `netlify dev`, open `/roadmap`, and confirm:
1. Dashboard shows `0 / 98 stages`, `0 / 38 chapters`, `0 / 22 items`, `0 / 8` logs; checkboxes disabled.
2. Edit → enter token → check a Redis group → build dashboard + the M1 ring update; "Saved" appears.
3. Reload → state persists; open another browser → same state.
4. Wrong token on a toggle → reverts + "That token didn't work."

- [ ] **Step 4: Commit**

```bash
git add src/scripts/roadmap.ts
git commit -m "feat(roadmap): client island for three-track hydrate + edit"
```

---

## Task 5: Update the guide + final verification

**Files:**
- Update: `docs/roadmap-guide.md`

- [ ] **Step 1: Update `docs/roadmap-guide.md` to the v2 structure**

Read the current file, then revise so it describes the build-anchored model. Specifically:
- "What you're working on" → the **5 build milestones** (Redis → SQLite → HTTP → DNS → Kafka, pragmatic scope) plus the parallel **Reading** (DDIA, Database Internals, OSTEP, A Philosophy of Software Design) and **Foundations** (Python for Coding Interviews → DS&A for Beginners → NeetCode 150) tracks.
- "Checking things off" → unchanged mechanism (Edit → token → checkboxes auto-save), but note the checkable units are now **build stage-groups, capstone decision logs, book chapters, courses, and NeetCode patterns**.
- "Editing the plan" → still `src/data/roadmap.ts`, now three exports (`build`, `reading`, `foundations`); the **IDs-are-permanent** rule still holds; to add a Redis extension later, add a `BuildGroup` to that milestone.
- "Dashboard numbers" → Build (stages / courses), Reading (chapters / books), Foundations (items), Decision logs.
- Keep the local-dev (`netlify dev` + root `.env`) and file-map sections; update the file map to the v2 components (CheckItem/Milestone/BookCard/FoundationsSection/RoadmapDashboard; Week/TaskList removed).

- [ ] **Step 2: Full verification**

Run: `npm run test`
Expected: all suites pass.

Run: `npm run build`
Expected: success; `dist/roadmap/index.html` emitted.

Run: `grep -rn "ROADMAP_ADMIN_TOKEN" dist/ || echo "token absent"`
Expected: `token absent`.

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap-guide.md
git commit -m "docs(roadmap): update guide for the build-anchored v2 structure"
```

---

## Final verification (Definition of done — design §13)

- [x] Identity/decision-log treatment confirmed: judgment framing kept, logs as capstones.
- [ ] `/roadmap` shows three tracks (Build spine + Reading + Foundations) with the new dashboard, real tokens.
- [ ] Build = 5 course-milestones with checkable stage-groups + capstone logs; Reading = 4 books with checkable chapters; Foundations = course sequence + NeetCode-150 patterns with build hints.
- [ ] Progress persists via the existing Netlify Blobs API (GET public, POST token-gated, unknown IDs 400); token absent from client bundle.
- [ ] Dashboard derives real per-track stats from content + `completed` (verified by Task 1 tests + manual `netlify dev`).
- [ ] `roadmap-guide.md` updated.
- [ ] Keyboard-navigable, focus-visible, reduced-motion respected, responsive; `npm run test` + `npm run build` green.

## Notes for the implementer

- **The Netlify progress API is unchanged** (`netlify/functions/progress.ts`, `netlify/lib/handlers/progress.ts`, `netlify/lib/roadmap-store.ts`, and its test). It imports `allIds` from `src/data/roadmap.js`, which still exists with the new (82-id) set — so the only behavioral change is which IDs validate. Do not modify those files.
- **`Nav.astro` is unchanged** — the `/roadmap` link stays.
- **Stable IDs:** all ids are new vs v1, so any previously stored progress orphans. There is no real stored progress yet, so no migration is needed.
- **Per-pattern/course counts are display hints** sourced from NeetCode 150's standard breakdown; they may drift from the live site. That's fine — they're not load-bearing.
```
