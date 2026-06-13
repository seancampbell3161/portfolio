// Single source of roadmap content. Pure, framework-agnostic TS so it can be
// imported by both the Astro page and the Netlify function. IDs are stable
// strings — progress is stored by ID, so renaming a label is safe but changing
// an ID orphans its stored progress.

export type Track = "build" | "systems" | "foundations";

export interface Resource { // reserved for future week-level reference links
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
  hours?: number; // reserved for future per-task hour display
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
    (sum, m) => sum + m.weeks.reduce((a, w) => a + (w.hours ?? 0), 0),
    0,
  );
  const estHours = roadmap.reduce(
    (sum, m) => sum + (m.weeks.length ? 0 : m.estHours ?? 0),
    0,
  );
  const plannedHours = weekHours + estHours;

  const perMilestone: Record<string, number> = {};
  for (const m of roadmap) {
    // Per-milestone % counts tasks + logs (what the milestone ring tracks), unlike the top-level pct which is tasks only.
    const ids = [...taskIdsOf(m), ...logIdsOf(m)];
    const d = ids.filter((id) => done.has(id)).length;
    perMilestone[m.id] = ids.length ? Math.round((d / ids.length) * 100) : 0;
  }

  return { pct, tasksDone, tasksTotal, plannedHours, logsDone, logsTotal, perMilestone };
}
