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
