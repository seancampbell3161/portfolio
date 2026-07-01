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
