# Roadmap Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, prerendered `/roadmap` page that presents a four-thread learning braid (build / systems / foundations / judgment), shows shared progress read-only, and lets the owner unlock a token-gated edit mode that persists to Netlify Blobs.

**Architecture:** A normal static Astro 5 page renders content from `src/data/roadmap.ts`. A small vanilla-TS island fetches `/api/progress`, hydrates checkboxes, and derives the dashboard. Persistence is one hand-rolled Netlify Function (`netlify/functions/progress.ts` → `netlify/lib/handlers/progress.ts`) backed by `@netlify/blobs`, reusing the existing `constantTimeEquals` and dependency-injection conventions. No Astro adapter; `/api/progress` reaches the function via the existing `netlify.toml` redirect.

**Tech Stack:** Astro 5.16, TypeScript (strict), `@netlify/blobs`, Netlify Functions, vitest.

**Reference:** Design doc `docs/superpowers/specs/2026-06-13-roadmap-page-design.md`. Visual target `roadmap/roadmap-preview.html` (styling swapped to the site's real tokens).

**Branch:** Work happens on `feat/roadmap-page` (already created; design doc already committed there).

---

## Refinement vs. the design doc

The design doc said M2–M6's judgment could be a "milestone-level `DecisionLog`." During planning this was simplified to avoid a dual-meaning `log` field: only **weekly** decision logs (`Week.log`) are checkable and counted; M2–M6 carry a display-only `Milestone.judgment` string for their judgment thread. Counts stay honest and content-derived. This is the only deviation from the written design.

---

## File structure

| File | Responsibility |
|---|---|
| `src/data/roadmap.ts` (create) | Single source of content: types, `roadmap[]`, derived ID sets, `deriveStats()`. Pure framework-agnostic TS. |
| `src/data/__tests__/roadmap.test.ts` (create) | Unit tests for ID uniqueness + `deriveStats`. |
| `src/components/roadmap/TaskList.astro` (create) | Renders the checkable "Daily rhythm" task list. |
| `src/components/roadmap/DecisionLog.astro` (create) | The dashed signature block + "Mark logged" checkable control. |
| `src/components/roadmap/Week.astro` (create) | Nested `<details>` week: goal, component rows, TaskList, DecisionLog. |
| `src/components/roadmap/Milestone.astro` (create) | `<details>` milestone: summary, thread dots, per-milestone %, body (weeks or scaffold). |
| `src/components/roadmap/RoadmapDashboard.astro` (create) | Stat row + progress bar + legend + edit control. |
| `src/pages/roadmap.astro` (create) | The page: layout, header, dashboard, milestone list, the global roadmap stylesheet, and the client `<script>` import. |
| `src/scripts/roadmap.ts` (create) | Client island: fetch progress, hydrate, edit mode, optimistic debounced POST. |
| `src/components/Nav.astro` (modify) | Add the "Roadmap" nav link. |
| `netlify/lib/roadmap-store.ts` (create) | Injectable Netlify Blobs accessor for the `roadmap` store. |
| `netlify/lib/handlers/progress.ts` (create) | GET (public) + POST (token-gated, validated) handler. |
| `netlify/lib/__tests__/handlers/progress.test.ts` (create) | Handler unit tests with a fake store + fixed clock. |
| `netlify/functions/progress.ts` (create) | Thin function entry wiring real store + env token + `allIds`. |
| `README.md` (modify or create) | Document `ROADMAP_ADMIN_TOKEN` + `netlify dev`. |
| `.env.example` (modify or create) | Document the env var for local dev. |

---

## Task 1: Content module + derived stats (TDD)

**Files:**
- Create: `src/data/roadmap.ts`
- Test: `src/data/__tests__/roadmap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/data/__tests__/roadmap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  roadmap,
  allTaskIds,
  allLogIds,
  allIds,
  deriveStats,
} from "../roadmap.js";

describe("roadmap content", () => {
  it("exposes six milestones", () => {
    expect(roadmap).toHaveLength(6);
  });

  it("has unique IDs across all tasks and logs", () => {
    const ids = [...allTaskIds, ...allLogIds];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds allIds as the union of task and log IDs", () => {
    expect(allIds.size).toBe(allTaskIds.length + allLogIds.length);
  });

  it("includes the known M1/W1 task and log IDs", () => {
    expect(allIds.has("m1.w1.mon")).toBe(true);
    expect(allIds.has("m1.w1.log")).toBe(true);
  });

  it("has 9 tasks and 2 logs in the current content", () => {
    expect(allTaskIds).toHaveLength(9);
    expect(allLogIds).toHaveLength(2);
  });
});

describe("deriveStats", () => {
  it("reports zero progress for an empty completed list", () => {
    const s = deriveStats([]);
    expect(s.pct).toBe(0);
    expect(s.tasksDone).toBe(0);
    expect(s.tasksTotal).toBe(allTaskIds.length);
    expect(s.logsDone).toBe(0);
    expect(s.logsTotal).toBe(allLogIds.length);
  });

  it("counts completed tasks and logs and ignores unknown IDs", () => {
    const s = deriveStats(["m1.w1.mon", "m1.w1.log", "does.not.exist"]);
    expect(s.tasksDone).toBe(1);
    expect(s.logsDone).toBe(1);
    expect(s.perMilestone.m1).toBeGreaterThan(0);
  });

  it("computes planned hours as 180 (weeks + milestone estimates)", () => {
    expect(deriveStats([]).plannedHours).toBe(180);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/data/__tests__/roadmap.test.ts`
Expected: FAIL — cannot resolve `../roadmap.js` (module does not exist yet).

- [ ] **Step 3: Write the content module**

Create `src/data/roadmap.ts`:

```ts
// Single source of roadmap content. Pure, framework-agnostic TS so it can be
// imported by both the Astro page and the Netlify function. IDs are stable
// strings — progress is stored by ID, so renaming a label is safe but changing
// an ID orphans its stored progress.

export type Track = "build" | "systems" | "foundations";

export interface Resource {
  title: string;
  source: string;
  kind: "video" | "docs" | "article" | "course" | "book";
  url?: string;
}

export interface Component {
  track: Track;
  title: string;
  detail?: string;
  source?: string;
}

export interface Task {
  id: string;
  day?: string;
  label: string;
  hours?: number;
}

export interface DecisionLog {
  id: string;
  prompt: string;
  intro?: string;
}

export interface Week {
  id: string;
  no: string;
  name: string;
  hours: number;
  goal: string;
  components?: Component[];
  tasks?: Task[];
  resources?: Resource[];
  log?: DecisionLog;
}

export interface Milestone {
  id: string;
  no: string;
  title: string;
  goal: string;
  /** Headline hours estimate for milestones whose weeks are not yet enumerated. */
  estHours?: number;
  /** Four-thread summary rows for scaffolded milestones (M2–M6). */
  components?: Component[];
  /** Display-only one-line summary of the judgment thread for scaffolded milestones. */
  judgment?: string;
  weeks: Week[];
}

export const roadmap: Milestone[] = [
  {
    id: "m1",
    no: "M1",
    title: "Storage — how bytes become a database",
    goal: "defend choosing an in-memory store over disk, and name exactly when that choice breaks.",
    weeks: [
      {
        id: "m1.w1",
        no: "W1",
        name: "A server that speaks a protocol",
        hours: 8,
        goal: "By Sunday you can open a raw TCP socket, parse a wire protocol by hand, and explain why Redis chose RESP over JSON.",
        components: [
          {
            track: "build",
            title: "Build Your Own Redis — stages 1–4",
            detail:
              "Bind a TCP listener, accept connections, parse the RESP protocol, answer PING / ECHO.",
            source: "codecrafters.io · Redis track",
          },
          {
            track: "systems",
            title: "DDIA — Ch. 1",
            detail:
              "Reliability, scalability, maintainability — the rubric every later decision is graded against.",
          },
          {
            track: "foundations",
            title: "NeetCode — Arrays & Hashing",
            detail:
              "15 min daily. The hash map you reach for here is the same structure the store is built on.",
          },
        ],
        tasks: [
          { id: "m1.w1.mon", day: "Mon", label: "Socket + accept loop, echo bytes back raw" },
          { id: "m1.w1.tue", day: "Tue", label: "Parse a single RESP array; handle PING" },
          { id: "m1.w1.wed", day: "Wed", label: "Handle ECHO; DDIA Ch.1 first half" },
          { id: "m1.w1.thu", day: "Thu", label: "Concurrent connections; DDIA Ch.1 finish" },
          { id: "m1.w1.fri", day: "Fri", label: "NeetCode: Two Sum, Group Anagrams, Top-K" },
          { id: "m1.w1.sat", day: "Sat", label: "Refactor parser; write the decision log below" },
        ],
        log: {
          id: "m1.w1.log",
          intro:
            "One entry, ~150 words, tagged for retrieval. This is the part that turns hours into transferable judgment — and the seed of a blog post.",
          prompt:
            "“RESP vs JSON for a wire protocol: what Redis traded away, and the workload where I’d make the opposite call.”",
        },
      },
      {
        id: "m1.w2",
        no: "W2",
        name: "An in-memory store with expiry",
        hours: 8,
        goal: "By Sunday you can reason about why a hash index is O(1) and what it costs you in memory and durability.",
        components: [
          {
            track: "build",
            title: "Redis — SET / GET / TTL stages",
            detail:
              "Back the store with a hash map; add key expiry and the passive/active expiry choice.",
            source: "codecrafters.io · Redis track",
          },
          {
            track: "systems",
            title: "DDIA — Ch. 3, hash indexes",
            detail: "Why the log-structured hash index works, and the moment it stops scaling.",
          },
          {
            track: "foundations",
            title: "NeetCode — Two Pointers",
            detail: "15 min daily.",
          },
        ],
        tasks: [
          { id: "m1.w2.mon", day: "Mon", label: "SET / GET against an in-memory map" },
          { id: "m1.w2.wed", day: "Wed", label: "Key expiry; DDIA Ch.3 hash indexes" },
          { id: "m1.w2.sat", day: "Sat", label: "Decision log + push to genai-journey repo" },
        ],
        log: {
          id: "m1.w2.log",
          prompt:
            "“In-memory vs durable: the actual failure I’m accepting when I keep state in RAM.”",
        },
      },
      {
        id: "m1.w3",
        no: "W3",
        name: "Indexes & retrieval",
        hours: 8,
        goal: "Build secondary lookups; read DDIA Ch.3 on B-trees vs LSM as a preview of M2. (Weeks expand into the same Build / Systems / Foundations / Decision-log shape.)",
      },
      {
        id: "m1.w4",
        no: "W4",
        name: "Persistence — RDB & AOF",
        hours: 8,
        goal: "Add snapshotting and an append-only log; the capstone decision log compares the two durability strategies.",
      },
    ],
  },
  {
    id: "m2",
    no: "M2",
    title: "Storage engines — B-trees vs LSM",
    goal: "read a query pattern and predict which engine wins, before you benchmark.",
    estHours: 28,
    components: [
      {
        track: "build",
        title: "Build Your Own SQLite",
        detail: "Read the real file format, walk the B-tree, run an indexed query.",
      },
      {
        track: "systems",
        title: "DDIA Ch. 3 (deep) + Ch. 2",
        detail: "B-trees vs LSM-trees; relational vs document vs graph models.",
      },
      { track: "foundations", title: "Binary Search · Trees · Tries" },
    ],
    judgment:
      "“The workload decides the engine” — map read/write ratios to B-tree vs LSM.",
    weeks: [],
  },
  {
    id: "m3",
    no: "M3",
    title: "Encoding & the wire",
    goal: "version an API without breaking last year’s clients.",
    estHours: 32,
    components: [
      {
        track: "build",
        title: "HTTP server + DNS server",
        detail: "Two CodeCrafters tracks — request/response, then resolution and caching.",
      },
      {
        track: "systems",
        title: "DDIA Ch. 4",
        detail: "Encoding & evolution: JSON, Protobuf, Avro, schema migrations.",
      },
      { track: "foundations", title: "Stack · Linked List · Sliding Window" },
    ],
    judgment: "“The migration I’d never ship.”",
    weeks: [],
  },
  {
    id: "m4",
    no: "M4",
    title: "Distribution — replication & partitioning",
    goal: "place data and pick a leader strategy under a real failure model.",
    estHours: 28,
    components: [
      {
        track: "build",
        title: "Redis replication stages",
        detail: "Leader/follower handshake, command propagation.",
      },
      { track: "systems", title: "DDIA Ch. 5 + Ch. 6", detail: "Replication and partitioning." },
      { track: "foundations", title: "Graphs · Heaps" },
    ],
    judgment: "“Single-leader vs multi-leader: where I draw the line.”",
    weeks: [],
  },
  {
    id: "m5",
    no: "M5",
    title: "Consistency & consensus",
    goal: "name the consistency model a feature needs — and the one it’s secretly relying on.",
    estHours: 32,
    components: [
      {
        track: "build",
        title: "Build Your Own Kafka",
        detail: "Partitioned log, offsets, ordering guarantees.",
      },
      {
        track: "systems",
        title: "DDIA Ch. 7 · 8 · 9",
        detail: "Transactions, the trouble with distributed systems, consensus.",
      },
      { track: "foundations", title: "Dynamic Programming · Intervals" },
    ],
    judgment: "“Which consistency model, and what it costs.”",
    weeks: [],
  },
  {
    id: "m6",
    no: "M6",
    title: "Systems in the wild — batch, streams & a real design",
    goal: "take a project you already shipped and write the design doc it deserved.",
    estHours: 28,
    components: [
      {
        track: "build",
        title: "Finish Kafka → apply it for real",
        detail: "Retrofit a streaming or batch component onto Songle or Roaming.Camp.",
      },
      {
        track: "systems",
        title: "DDIA Ch. 10 · 11 · 12",
        detail: "Batch, stream, and the closing synthesis.",
      },
      { track: "foundations", title: "Graphs (advanced) · Backtracking · mixed review" },
    ],
    judgment:
      "Capstone — a published system-design writeup distilled from the decision logs (ties into the blog).",
    weeks: [],
  },
];

const taskIdsOf = (m: Milestone) => m.weeks.flatMap((w) => (w.tasks ?? []).map((t) => t.id));
const logIdsOf = (m: Milestone) => m.weeks.flatMap((w) => (w.log ? [w.log.id] : []));

export const allTaskIds: string[] = roadmap.flatMap(taskIdsOf);
export const allLogIds: string[] = roadmap.flatMap(logIdsOf);
export const allIds: Set<string> = new Set([...allTaskIds, ...allLogIds]);

export interface RoadmapStats {
  pct: number;
  tasksDone: number;
  tasksTotal: number;
  plannedHours: number;
  logsDone: number;
  logsTotal: number;
  perMilestone: Record<string, number>;
}

export function deriveStats(completed: string[]): RoadmapStats {
  const done = new Set(completed);

  const tasksTotal = allTaskIds.length;
  const tasksDone = allTaskIds.filter((id) => done.has(id)).length;
  const logsTotal = allLogIds.length;
  const logsDone = allLogIds.filter((id) => done.has(id)).length;
  const pct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  const weekHours = roadmap.reduce(
    (sum, m) => sum + m.weeks.reduce((a, w) => a + (w.hours || 0), 0),
    0,
  );
  const estHours = roadmap.reduce(
    (sum, m) => sum + (m.weeks.length ? 0 : m.estHours ?? 0),
    0,
  );
  const plannedHours = weekHours + estHours;

  const perMilestone: Record<string, number> = {};
  for (const m of roadmap) {
    const ids = [...taskIdsOf(m), ...logIdsOf(m)];
    const d = ids.filter((id) => done.has(id)).length;
    perMilestone[m.id] = ids.length ? Math.round((d / ids.length) * 100) : 0;
  }

  return { pct, tasksDone, tasksTotal, plannedHours, logsDone, logsTotal, perMilestone };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/data/__tests__/roadmap.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/data/roadmap.ts src/data/__tests__/roadmap.test.ts
git commit -m "feat(roadmap): add content module with derived stats"
```

---

## Task 2: Presentational components (markup only)

The page owns all roadmap CSS (one global stylesheet in Task 3). These components emit semantic markup and inherit the four thread colors via CSS custom properties set on the page wrapper. No per-component `<style>`.

**Files:**
- Create: `src/components/roadmap/TaskList.astro`
- Create: `src/components/roadmap/DecisionLog.astro`
- Create: `src/components/roadmap/Week.astro`
- Create: `src/components/roadmap/Milestone.astro`
- Create: `src/components/roadmap/RoadmapDashboard.astro`

- [ ] **Step 1: Create `TaskList.astro`**

```astro
---
import type { Task } from "../../data/roadmap";

interface Props {
  tasks: Task[];
}

const { tasks } = Astro.props;
---

<div class="rm-rhythm">
  <h5>Daily rhythm</h5>
  {
    tasks.map((task) => (
      <div class="rm-task">
        <input type="checkbox" id={task.id} data-id={task.id} disabled />
        <label for={task.id}>
          {task.day && <span class="rm-day">{task.day}</span>}
          {task.label}
        </label>
      </div>
    ))
  }
</div>
```

- [ ] **Step 2: Create `DecisionLog.astro`**

The dashed signature block carries one checkable control bound to the log ID.

```astro
---
import type { DecisionLog } from "../../data/roadmap";

interface Props {
  log: DecisionLog;
}

const { log } = Astro.props;
---

<div class="rm-log">
  <div class="rm-log-head">
    <span class="rm-dot d-judgment"></span>Decision log — the week's artifact
  </div>
  {log.intro && <p class="rm-log-intro">{log.intro}</p>}
  <p class="rm-log-prompt">{log.prompt}</p>
  <label class="rm-mark">
    <input type="checkbox" id={log.id} data-id={log.id} disabled />
    <span>Mark logged</span>
  </label>
</div>
```

- [ ] **Step 3: Create `Week.astro`**

```astro
---
import type { Week } from "../../data/roadmap";
import TaskList from "./TaskList.astro";
import DecisionLog from "./DecisionLog.astro";

interface Props {
  week: Week;
  open?: boolean;
}

const { week, open = false } = Astro.props;

const trackLabel: Record<string, string> = {
  build: "Build",
  systems: "Systems",
  foundations: "Foundations",
};

const components = week.components ?? [];
const tasks = week.tasks ?? [];
---

<details class="rm-wk" open={open}>
  <summary>
    <span class="rm-wk-no">{week.no}</span>
    <span class="rm-wk-name">{week.name}</span>
    <span class="rm-wk-meta">~{week.hours}h</span>
  </summary>
  <div class="rm-wk-body">
    <p class="rm-goal">{week.goal}</p>

    {
      components.map((c) => (
        <div class="rm-comp">
          <span class="rm-comp-tag" style={`color:var(--${c.track})`}>
            <span class={`rm-dot d-${c.track}`} />
            {trackLabel[c.track]}
          </span>
          <div>
            <h4>{c.title}</h4>
            {c.detail && <p>{c.detail}</p>}
            {c.source && <p class="rm-src">{c.source}</p>}
          </div>
        </div>
      ))
    }

    {tasks.length > 0 && <TaskList tasks={tasks} />}
    {week.log && <DecisionLog log={week.log} />}
  </div>
</details>
```

- [ ] **Step 4: Create `Milestone.astro`**

Renders enumerated weeks when present; otherwise the four-thread scaffold (component rows + the judgment summary row).

```astro
---
import type { Milestone } from "../../data/roadmap";
import Week from "./Week.astro";

interface Props {
  milestone: Milestone;
  open?: boolean;
}

const { milestone, open = false } = Astro.props;

const trackLabel: Record<string, string> = {
  build: "Build",
  systems: "Systems",
  foundations: "Foundations",
};

const scaffolded = milestone.weeks.length === 0;
const components = milestone.components ?? [];
// The first enumerated week opens by default so the page lands on real content.
---

<details class="rm-m" open={open} data-milestone={milestone.id}>
  <summary>
    <span class="rm-m-no">{milestone.no}</span>
    <span class="rm-m-mid">
      <p class="rm-m-title">{milestone.title}</p>
      <p class="rm-m-goal">{milestone.goal}</p>
      <span class="rm-threads">
        <span class="rm-dot d-build"></span>
        <span class="rm-dot d-systems"></span>
        <span class="rm-dot d-foundations"></span>
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
      !scaffolded &&
        milestone.weeks.map((week, i) => <Week week={week} open={i === 0} />)
    }

    {
      scaffolded && (
        <>
          {components.map((c) => (
            <div class="rm-comp">
              <span class="rm-comp-tag" style={`color:var(--${c.track})`}>
                <span class={`rm-dot d-${c.track}`} />
                {trackLabel[c.track]}
              </span>
              <div>
                <h4>{c.title}</h4>
                {c.detail && <p>{c.detail}</p>}
              </div>
            </div>
          ))}
          {milestone.judgment && (
            <div class="rm-comp">
              <span class="rm-comp-tag" style="color:var(--judgment)">
                <span class="rm-dot d-judgment" />
                Judgment
              </span>
              <div>
                <h4>{milestone.judgment}</h4>
              </div>
            </div>
          )}
        </>
      )
    }
  </div>
</details>
```

- [ ] **Step 5: Create `RoadmapDashboard.astro`**

```astro
---
import { deriveStats } from "../../data/roadmap";

// Server-rendered defaults (zeroed); the client island overwrites these on load.
const s = deriveStats([]);
---

<div class="rm-dash">
  <div class="rm-stat">
    <div class="rm-n"><span id="rm-pct">0</span><small>%</small></div>
    <div class="rm-l">Complete</div>
  </div>
  <div class="rm-stat">
    <div class="rm-n">
      <span id="rm-done">0</span><small> / <span id="rm-total">{s.tasksTotal}</span></small>
    </div>
    <div class="rm-l">Tasks done</div>
  </div>
  <div class="rm-stat">
    <div class="rm-n">~<span id="rm-hours">{s.plannedHours}</span><small>h</small></div>
    <div class="rm-l">Planned</div>
  </div>
  <div class="rm-stat">
    <div class="rm-n">
      <span id="rm-logs-done">0</span><small> / <span id="rm-logs-total">{s.logsTotal}</span></small>
    </div>
    <div class="rm-l">Decision logs</div>
  </div>
</div>
<div class="rm-bar"><i id="rm-bar-fill"></i></div>

<div class="rm-controls">
  <div class="rm-legend">
    <span><i class="rm-dot d-build"></i><b>Build</b> — CodeCrafters</span>
    <span><i class="rm-dot d-systems"></i><b>Systems</b> — DDIA, the lens</span>
    <span><i class="rm-dot d-foundations"></i><b>Foundations</b> — NeetCode reps</span>
    <span><i class="rm-dot d-judgment"></i><b>Judgment</b> — decision log</span>
  </div>
  <div class="rm-edit-wrap">
    <span id="rm-save-state" class="rm-save-state" role="status" aria-live="polite"></span>
    <button id="rm-edit" type="button" class="rm-edit-btn">Edit</button>
  </div>
</div>
<p id="rm-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>
```

- [ ] **Step 6: Verify the components compile (deferred build check)**

These components are not referenced yet, so Astro will not type-check them until Task 3 imports them. No standalone command here — the build verification happens in Task 3, Step 3.

- [ ] **Step 7: Commit**

```bash
git add src/components/roadmap/
git commit -m "feat(roadmap): add presentational components"
```

---

## Task 3: The page + global stylesheet

**Files:**
- Create: `src/pages/roadmap.astro`

- [ ] **Step 1: Create `roadmap.astro` (markup + composition)**

```astro
---
import Layout from "../layouts/Layout.astro";
import Nav from "../components/Nav.astro";
import Footer from "../components/Footer.astro";
import RoadmapDashboard from "../components/roadmap/RoadmapDashboard.astro";
import Milestone from "../components/roadmap/Milestone.astro";
import { roadmap } from "../data/roadmap";
---

<Layout
  title="Roadmap — Building Engineering Judgment | Sean Campbell"
  description="A public learning roadmap: a four-thread braid of building, systems, foundations, and the decision logs that turn hours into engineering judgment."
>
  <Nav />

  <main class="roadmap-page">
    <div class="rm-wrap">
      <p class="rm-eyebrow">A learning roadmap · in progress</p>
      <h1 class="rm-title">Building <em>engineering judgment</em></h1>
      <p class="rm-thesis">
        Not three skill gaps to close in parallel — <strong>one skill.</strong> Every build,
        every chapter, every problem rolls up into knowing which tool to reach for, and being
        able to defend the call.
      </p>

      <RoadmapDashboard />

      <div class="rm-milestones">
        {roadmap.map((m, i) => <Milestone milestone={m} open={i === 0} />)}
      </div>

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
    --systems: #5fb3ac;
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
    max-width: 60ch;
    margin: 0;
  }
  .rm-thesis strong {
    color: var(--color-text-primary);
    font-weight: 600;
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
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .rm-n small {
    font-size: 15px;
    color: var(--color-text-faint);
    font-weight: 500;
  }
  .rm-l {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-faint);
    margin-top: 6px;
  }
  .rm-bar {
    height: 4px;
    background: var(--color-bg-hover);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-top: 14px;
  }
  .rm-bar > i {
    display: block;
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, var(--build), var(--color-accent-secondary));
    transition: width var(--transition-slow);
  }

  /* ---- controls: legend + edit ---- */
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
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
  }
  .rm-legend span {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .rm-legend b {
    color: var(--color-text-primary);
    font-weight: 500;
  }
  .rm-dot {
    width: 9px;
    height: 9px;
    border-radius: var(--radius-full);
    flex: none;
    display: inline-block;
  }
  .d-build {
    background: var(--build);
  }
  .d-systems {
    background: var(--systems);
  }
  .d-foundations {
    background: var(--foundations);
  }
  .d-judgment {
    background: var(--judgment);
  }

  .rm-edit-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .rm-save-state {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-faint);
  }
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
  .rm-edit-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-accent-bg);
  }
  .rm-message {
    font-size: 13px;
    color: #f4a896;
    margin: 12px 0 0;
  }

  /* ---- milestones ---- */
  .rm-milestones {
    margin-top: 6px;
  }
  .rm-m {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-elevated);
    margin-top: 14px;
    overflow: hidden;
  }
  .rm-m > summary {
    list-style: none;
    cursor: pointer;
    padding: 22px 24px;
    display: flex;
    align-items: flex-start;
    gap: 18px;
    outline: none;
  }
  .rm-m > summary::-webkit-details-marker {
    display: none;
  }
  .rm-m > summary:focus-visible {
    box-shadow: inset 0 0 0 2px var(--systems);
  }
  .rm-m-no {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-faint);
    padding-top: 5px;
    min-width: 30px;
    letter-spacing: 0.05em;
  }
  .rm-m-mid {
    flex: 1;
    min-width: 0;
  }
  .rm-m-title {
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
  }
  .rm-m-goal {
    color: var(--color-text-secondary);
    font-size: 14.5px;
    margin: 0;
  }
  .rm-m-goal::before {
    content: "Judgment goal — ";
    color: var(--judgment);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .rm-threads {
    display: flex;
    gap: 6px;
    margin-top: 13px;
  }
  .rm-threads .rm-dot {
    width: 7px;
    height: 7px;
    opacity: 0.9;
  }
  .rm-m-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 9px;
    padding-top: 3px;
  }
  .rm-pct {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-secondary);
    min-width: 38px;
    text-align: right;
  }
  .rm-ring {
    font-family: var(--font-mono);
    color: var(--color-text-faint);
    font-size: 18px;
    transition: transform var(--transition-base);
  }
  .rm-m[open] > summary .rm-ring {
    transform: rotate(45deg);
  }
  .rm-m-body {
    padding: 4px 24px 26px;
    border-top: 1px solid var(--color-border);
  }

  /* ---- weeks ---- */
  .rm-wk {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-hover);
    margin-top: 14px;
    overflow: hidden;
  }
  .rm-wk > summary {
    list-style: none;
    cursor: pointer;
    padding: 15px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    outline: none;
  }
  .rm-wk > summary::-webkit-details-marker {
    display: none;
  }
  .rm-wk > summary:focus-visible {
    box-shadow: inset 0 0 0 2px var(--systems);
  }
  .rm-wk-no {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--build);
    border: 1px solid color-mix(in srgb, var(--build) 40%, transparent);
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.05em;
  }
  .rm-wk-name {
    font-weight: 600;
    font-size: 15px;
    flex: 1;
  }
  .rm-wk-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-faint);
  }
  .rm-wk-body {
    padding: 6px 18px 20px;
  }

  .rm-goal {
    font-size: 14px;
    color: var(--color-text-secondary);
    border-left: 2px solid var(--judgment);
    padding: 2px 0 2px 14px;
    margin: 8px 0 20px;
  }

  /* ---- component rows ---- */
  .rm-comp {
    display: grid;
    grid-template-columns: 118px 1fr;
    gap: 0 18px;
    padding: 13px 0;
    border-top: 1px solid var(--color-border);
  }
  .rm-comp:first-of-type {
    border-top: none;
  }
  .rm-comp-tag {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding-top: 2px;
  }
  .rm-comp-tag .rm-dot {
    margin-top: 4px;
  }
  .rm-comp h4 {
    margin: 0 0 3px;
    font-size: 14.5px;
    font-weight: 600;
  }
  .rm-comp p {
    margin: 0;
    font-size: 13.5px;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }
  .rm-comp .rm-src {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--color-text-faint);
    margin-top: 3px;
  }

  /* ---- checkable daily rhythm ---- */
  .rm-rhythm {
    margin-top: 18px;
    border-top: 1px solid var(--color-border);
    padding-top: 16px;
  }
  .rm-rhythm h5 {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-faint);
    margin: 0 0 12px;
  }
  .rm-task {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding: 7px 0;
    font-size: 13.5px;
  }
  .rm-task input,
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
  .rm-task input:disabled,
  .rm-mark input:disabled {
    cursor: default;
  }
  .roadmap-page.rm-editing .rm-task input:hover,
  .roadmap-page.rm-editing .rm-mark input:hover {
    border-color: var(--color-text-secondary);
  }
  .rm-task input:checked,
  .rm-mark input:checked {
    background: var(--build);
    border-color: var(--build);
  }
  .rm-task input:checked::after,
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
  .rm-task input:focus-visible,
  .rm-mark input:focus-visible {
    outline: 2px solid var(--systems);
    outline-offset: 2px;
  }
  .rm-task label {
    cursor: pointer;
  }
  .rm-day {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--foundations);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 6px;
  }
  .rm-task input:checked + label {
    color: var(--color-text-faint);
    text-decoration: line-through;
    text-decoration-color: var(--color-border-hover);
  }

  /* ---- decision log (the signature) ---- */
  .rm-log {
    margin-top: 20px;
    border: 1px dashed color-mix(in srgb, var(--judgment) 45%, transparent);
    border-radius: var(--radius-md);
    padding: 18px;
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
  .rm-log-intro {
    margin: 0 0 12px;
    font-size: 13.5px;
    color: var(--color-text-secondary);
  }
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
    cursor: pointer;
  }

  .rm-note {
    font-size: 12.5px;
    color: var(--color-text-faint);
    text-align: center;
    margin-top: 46px;
    font-family: var(--font-mono);
    letter-spacing: 0.02em;
    line-height: 1.7;
  }

  @media (max-width: 640px) {
    .rm-dash {
      grid-template-columns: repeat(2, 1fr);
    }
    .rm-comp {
      grid-template-columns: 1fr;
      gap: 8px 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .roadmap-page * {
      transition: none !important;
    }
  }
</style>
```

- [ ] **Step 2: Sanity-check the cross-reference of element IDs**

Confirm every ID the script (Task 6) reads exists in the rendered markup: `rm-pct`, `rm-done`, `rm-total`, `rm-hours`, `rm-logs-done`, `rm-logs-total`, `rm-bar-fill`, `rm-edit`, `rm-save-state`, `rm-message`, plus `[data-id]` on every checkbox and `[data-milestone-pct]` on every milestone %. (All are present across `RoadmapDashboard.astro` and `Milestone.astro`.)

- [ ] **Step 3: Build and verify the page renders**

Run: `npm run build`
Expected: build succeeds; output includes `dist/roadmap/index.html`. Confirm with:

Run: `test -f dist/roadmap/index.html && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/pages/roadmap.astro
git commit -m "feat(roadmap): add page shell, dashboard, and stylesheet"
```

---

## Task 4: Nav link

**Files:**
- Modify: `src/components/Nav.astro:6-11`

- [ ] **Step 1: Add the Roadmap link to the nav array**

In `src/components/Nav.astro`, change the `navLinks` array to insert Roadmap between Blog and Contact:

```ts
const navLinks = [
  { href: '/#work', label: 'Work' },
  { href: '/#beyond', label: 'Beyond' },
  { href: '/blog', label: 'Blog' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/#contact', label: 'Contact' },
];
```

(The mobile menu maps the same `navLinks` array, so no second change is needed.)

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: build succeeds.

Run: `grep -rl "/roadmap" dist/index.html`
Expected: prints `dist/index.html` (the nav link is present on the home page).

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.astro
git commit -m "feat(roadmap): link Roadmap in the nav"
```

---

## Task 5: Progress API (store + handler + tests + function)

**Files:**
- Create: `netlify/lib/roadmap-store.ts`
- Create: `netlify/lib/handlers/progress.ts`
- Test: `netlify/lib/__tests__/handlers/progress.test.ts`
- Create: `netlify/functions/progress.ts`

- [ ] **Step 1: Create the store helper**

Create `netlify/lib/roadmap-store.ts`:

```ts
import { getStore } from "@netlify/blobs";

export interface ProgressBlob {
  version: 1;
  updatedAt: string; // ISO
  completed: string[]; // task & log IDs
}

export interface RoadmapStore {
  getProgress(): Promise<ProgressBlob | null>;
  setProgress(blob: ProgressBlob): Promise<void>;
}

export function blobsRoadmapStore(): RoadmapStore {
  // `consistency: 'strong'` so the owner sees their own write immediately.
  const store = getStore({ name: "roadmap", consistency: "strong" });
  return {
    async getProgress() {
      const v = await store.get("progress", { type: "json" });
      return (v as ProgressBlob | null) ?? null;
    },
    async setProgress(blob) {
      await store.setJSON("progress", blob);
    },
  };
}
```

- [ ] **Step 2: Write the failing handler test**

Create `netlify/lib/__tests__/handlers/progress.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { handleProgress, type ProgressDeps } from "../../handlers/progress.js";
import type { ProgressBlob, RoadmapStore } from "../../roadmap-store.js";

function fakeStore(initial: ProgressBlob | null = null) {
  let blob = initial;
  const store: RoadmapStore & { current: () => ProgressBlob | null } = {
    async getProgress() {
      return blob;
    },
    async setProgress(b) {
      blob = b;
    },
    current: () => blob,
  };
  return store;
}

const clock = () => new Date("2026-06-13T12:00:00Z");
const validIds = new Set(["m1.w1.mon", "m1.w1.log", "m1.w2.wed"]);

function deps(over: Partial<ProgressDeps> = {}): ProgressDeps {
  return { store: fakeStore(), token: "secret", validIds, clock, ...over };
}

const get = () => new Request("http://x/api/progress");
const post = (body: unknown, auth?: string) =>
  new Request("http://x/api/progress", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });

describe("handleProgress GET", () => {
  it("returns empty state when no blob exists", async () => {
    const res = await handleProgress(get(), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: [], updatedAt: null });
  });

  it("returns stored progress when present", async () => {
    const store = fakeStore({
      version: 1,
      updatedAt: "2026-06-01T00:00:00.000Z",
      completed: ["m1.w1.mon"],
    });
    const res = await handleProgress(get(), deps({ store }));
    expect(await res.json()).toEqual({
      completed: ["m1.w1.mon"],
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  });
});

describe("handleProgress POST auth", () => {
  it("rejects a missing token with 401", async () => {
    const res = await handleProgress(post({ completed: [] }), deps());
    expect(res.status).toBe(401);
  });

  it("rejects a bad token with 401", async () => {
    const res = await handleProgress(post({ completed: [] }, "Bearer wrong"), deps());
    expect(res.status).toBe(401);
  });
});

describe("handleProgress POST validation", () => {
  it("rejects an unknown id with 400", async () => {
    const res = await handleProgress(
      post({ completed: ["m1.w1.mon", "bogus"] }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-array completed field with 400", async () => {
    const res = await handleProgress(post({ completed: "nope" }, "Bearer secret"), deps());
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new Request("http://x/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
      body: "{not json",
    });
    const res = await handleProgress(req, deps());
    expect(res.status).toBe(400);
  });
});

describe("handleProgress POST success", () => {
  it("persists the completed array and returns updatedAt", async () => {
    const store = fakeStore();
    const res = await handleProgress(
      post({ completed: ["m1.w1.mon", "m1.w1.log"] }, "Bearer secret"),
      deps({ store }),
    );
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ ok: true, updatedAt: "2026-06-13T12:00:00.000Z" });
    expect(store.current()).toEqual({
      version: 1,
      updatedAt: "2026-06-13T12:00:00.000Z",
      completed: ["m1.w1.mon", "m1.w1.log"],
    });
  });

  it("de-duplicates repeated IDs before storing", async () => {
    const store = fakeStore();
    await handleProgress(
      post({ completed: ["m1.w1.mon", "m1.w1.mon"] }, "Bearer secret"),
      deps({ store }),
    );
    expect(store.current()?.completed).toEqual(["m1.w1.mon"]);
  });
});

describe("handleProgress other methods", () => {
  it("returns 405 for unsupported methods", async () => {
    const req = new Request("http://x/api/progress", { method: "DELETE" });
    const res = await handleProgress(req, deps());
    expect(res.status).toBe(405);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- netlify/lib/__tests__/handlers/progress.test.ts`
Expected: FAIL — cannot resolve `../../handlers/progress.js` (handler not written yet).

- [ ] **Step 4: Write the handler**

Create `netlify/lib/handlers/progress.ts`:

```ts
import { constantTimeEquals } from "../tokens.js";
import type { ProgressBlob, RoadmapStore } from "../roadmap-store.js";

export interface ProgressDeps {
  store: RoadmapStore;
  token: string; // expected admin token (from env)
  validIds: Set<string>; // allowlist derived from roadmap content
  clock: () => Date;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

export async function handleProgress(req: Request, deps: ProgressDeps): Promise<Response> {
  if (req.method === "GET") {
    const blob = await deps.store.getProgress();
    return json(200, {
      completed: blob?.completed ?? [],
      updatedAt: blob?.updatedAt ?? null,
    });
  }

  if (req.method === "POST") {
    const token = bearer(req);
    if (!token || !deps.token || !constantTimeEquals(token, deps.token)) {
      return json(401, { error: "unauthorized" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid body" });
    }

    const completed = (body as { completed?: unknown })?.completed;
    if (!Array.isArray(completed) || !completed.every((x) => typeof x === "string")) {
      return json(400, { error: "invalid body" });
    }

    const unknown = completed.filter((id) => !deps.validIds.has(id));
    if (unknown.length) {
      return json(400, { error: "unknown id", ids: unknown });
    }

    const blob: ProgressBlob = {
      version: 1,
      updatedAt: deps.clock().toISOString(),
      completed: [...new Set(completed)],
    };
    await deps.store.setProgress(blob);
    return json(200, { ok: true, updatedAt: blob.updatedAt });
  }

  return json(405, { error: "method not allowed" });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- netlify/lib/__tests__/handlers/progress.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 6: Write the function entry**

Create `netlify/functions/progress.ts`:

```ts
import { handleProgress } from "../lib/handlers/progress.js";
import { blobsRoadmapStore } from "../lib/roadmap-store.js";
import { allIds } from "../../src/data/roadmap.js";

const token = process.env.ROADMAP_ADMIN_TOKEN ?? "";

export default async (req: Request) =>
  handleProgress(req, {
    store: blobsRoadmapStore(),
    token,
    validIds: allIds,
    clock: () => new Date(),
  });
```

- [ ] **Step 7: Run the full test suite + build to confirm nothing regressed**

Run: `npm run test`
Expected: all suites PASS (existing newsletter tests + the two new suites).

Run: `npm run build`
Expected: build succeeds (confirms the `src/data/roadmap.ts` import path type-checks).

- [ ] **Step 8: Commit**

```bash
git add netlify/lib/roadmap-store.ts netlify/lib/handlers/progress.ts \
  netlify/lib/__tests__/handlers/progress.test.ts netlify/functions/progress.ts
git commit -m "feat(roadmap): add token-gated progress API on Netlify Blobs"
```

---

## Task 6: Client island (hydrate, edit mode, persist)

**Files:**
- Create: `src/scripts/roadmap.ts`

The page already imports this module via `<script>import "../scripts/roadmap.ts";</script>` (Task 3).

- [ ] **Step 1: Write the client island**

Create `src/scripts/roadmap.ts`:

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

function render() {
  for (const box of boxes()) {
    box.checked = completed.has(box.dataset.id!);
  }

  const s = deriveStats([...completed]);
  setText("rm-pct", String(s.pct));
  setText("rm-done", String(s.tasksDone));
  setText("rm-total", String(s.tasksTotal));
  setText("rm-hours", String(s.plannedHours));
  setText("rm-logs-done", String(s.logsDone));
  setText("rm-logs-total", String(s.logsTotal));

  const bar = document.getElementById("rm-bar-fill");
  if (bar) bar.style.width = `${s.pct}%`;

  for (const el of document.querySelectorAll<HTMLElement>("[data-milestone-pct]")) {
    el.textContent = `${s.perMilestone[el.dataset.milestonePct!] ?? 0}%`;
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
    // Leave whatever we have; render shows zeros on first failure.
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
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
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
    await load(); // revert optimistic UI to server truth
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
  // Restore an in-session unlock so a reload keeps edit mode.
  if (sessionStorage.getItem(TOKEN_KEY)) setEditable(true);
  void load();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

- [ ] **Step 2: Build and verify the bundle excludes the admin token**

Run: `npm run build`
Expected: build succeeds.

Run: `grep -rn "ROADMAP_ADMIN_TOKEN" dist/ || echo "token absent from client bundle"`
Expected: `token absent from client bundle` (the token name never appears in client output).

- [ ] **Step 3: Manual verification with `netlify dev`**

Create a local `.env` with a test token (Task 7 documents this), then:

Run: `netlify dev`
Then in the browser at the printed local URL (`/roadmap`), verify:
1. Page loads; dashboard shows `0%`, `0 / 9` tasks, `~180h`, `0 / 2` logs; checkboxes are disabled.
2. `GET /api/progress` returns `{ "completed": [], "updatedAt": null }` (e.g. `curl localhost:8888/api/progress`).
3. Click **Edit**, enter the test token; checkboxes become editable. Check a task — dashboard updates immediately and "Saved" appears after ~0.5s.
4. Reload — the checked item persists and shows on first paint (state came from the blob).
5. Open the page in a different browser/incognito — the same checked state shows (shared, not per-visitor).
6. Click **Edit**, enter a wrong token, toggle a box — it reverts and shows "That token didn't work."

- [ ] **Step 4: Commit**

```bash
git add src/scripts/roadmap.ts
git commit -m "feat(roadmap): add client island for hydrate + token-gated edit"
```

---

## Task 7: Documentation (env var + local dev)

**Files:**
- Modify or create: `README.md`
- Modify or create: `.env.example`

- [ ] **Step 1: Document the env var in `.env.example`**

If `.env.example` exists, append; otherwise create it with at least:

```bash
# Admin token that unlocks edit mode on /roadmap. Generate a long random value,
# e.g. `openssl rand -hex 32`. Set the same value in the Netlify site env vars.
ROADMAP_ADMIN_TOKEN=replace-with-a-long-random-secret
```

- [ ] **Step 2: Document setup in `README.md`**

Add a "Roadmap page" section to `README.md` (create the file if missing) containing:

```markdown
## Roadmap page (`/roadmap`)

A public learning roadmap with a shared, persisted progress state.

- **Content** lives in `src/data/roadmap.ts` (single source of truth).
- **Progress** is stored in Netlify Blobs (store `roadmap`, key `progress`) via the
  `netlify/functions/progress.ts` function. `GET /api/progress` is public; `POST` is
  gated by a bearer token.
- **Edit mode**: on `/roadmap`, click **Edit** and enter `ROADMAP_ADMIN_TOKEN`. The token
  is kept in `sessionStorage` and sent only to the API — it never ships in the client bundle.

### Environment

Set `ROADMAP_ADMIN_TOKEN` (a long random secret) in:

- the Netlify site environment variables (Site settings → Environment variables), and
- a local `.env` file for development (see `.env.example`).

### Local development

Blobs require the Netlify environment, so run the dev server through the Netlify CLI:

\`\`\`bash
netlify dev
\`\`\`

`npm run dev` (plain Astro) serves the page but the `/api/progress` calls will fail because
Blobs are not configured outside `netlify dev`.
```

(Use literal triple backticks in the README; they are escaped above only to nest in this plan.)

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "docs(roadmap): document ROADMAP_ADMIN_TOKEN and netlify dev"
```

---

## Final verification (Definition of done)

After all tasks, confirm against the design doc §11:

- [ ] `npm run test` — all suites pass.
- [ ] `npm run build` — succeeds; `dist/roadmap/index.html` emitted.
- [ ] `/roadmap` linked in nav (desktop + mobile).
- [ ] Milestones/weeks expand-collapse; four-thread braid + dashed decision-log block render with site tokens.
- [ ] `netlify dev`: GET public; edit mode unlocks with the token; a toggle persists across reload and shows in another browser.
- [ ] `POST` rejects missing/bad token (401) and unknown IDs (400); `grep` confirms the token is absent from `dist/`.
- [ ] Keyboard focus visible on summaries/checkboxes; `prefers-reduced-motion` respected; dashboard reflows to 2 columns at ≤640px.
- [ ] `ROADMAP_ADMIN_TOKEN` documented in README + `.env.example`.

---

## Notes for the implementer

- **Cross-boundary import risk:** `netlify/functions/progress.ts` imports `../../src/data/roadmap.js`. Netlify's esbuild bundler follows relative imports across the `src/`↔`netlify/` boundary, and `roadmap.ts` is pure TS (no Astro imports), so it bundles cleanly. If `netlify dev`/deploy ever fails to resolve it, the fallback is to keep the canonical content in `src/data/roadmap.ts` and re-export the ID set from a tiny `netlify/lib/` shim — content stays a single source. Do not duplicate the content array.
- **Why `data-id` (not `name`):** both task checkboxes and the decision-log "Mark logged" checkbox use `data-id`; the client collects all `[data-id]` inputs into the single `completed` array, so tasks and logs persist through the same path.
- **Honest denominators:** "Tasks done 0/9" and "Decision logs 0/2" reflect only the fully-specified M1 content. As the owner fills in M2–M6 weeks (adding tasks/logs with new stable IDs), the denominators grow automatically — nothing is hardcoded.
```
