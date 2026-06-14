# Design — Roadmap v2 (build-anchored restructure)

**Date:** 2026-06-14
**Status:** Draft for review
**Supersedes the organizing model in:** `docs/superpowers/specs/2026-06-13-roadmap-page-design.md` (v1). The *infrastructure* from v1 (Netlify Blobs progress API, token-gated edit mode, client island, design tokens) is **kept**; the *content model and page structure* are rebuilt.

---

## 1. Why we're changing it

v1 organized the page around **DDIA's chapters** — six milestones, each bundling a slice of the book + a matching CodeCrafters build + NeetCode patterns, woven into a per-week "braid." That baked in a slow, book-paced cadence (~6 months for one book) and forced the three materials to *finish together* when they naturally move at very different speeds.

New goals (from the owner):
- **Complete** the CodeCrafters projects (not thematic slices).
- Read **DDIA faster** (1–2 chapters/week) and read **more books** than just DDIA.
- Keep the materials we like: **NeetCode** (DSA/problem-solving), **DDIA + more** (systems), **CodeCrafters** (building).

The fix: stop forcing the three threads to sync. Re-anchor the page on **completing builds**, and let reading and DSA run as **independent parallel tracks** at their own pace.

## 2. Structure (decided: Option A — build-anchored)

The **Build track is the spine.** Each milestone = one CodeCrafters course taken to (pragmatic) completion. **Reading** and **Foundations** become parallel ongoing tracks shown alongside, not woven into each build week.

```
Building engineering judgment
[ dashboard: Build % · Reading % · Foundations % + key counts ]

BUILD — CodeCrafters  (the spine)
  ▸ M1 Redis     core / RDB / AOF / replication      → capstone decision logs
  ▸ M2 SQLite
  ▸ M3 HTTP server
  ▸ M4 DNS server
  ▸ M5 Kafka
READING — interleaved  (parallel)
  ▸ DDIA · Database Internals · OSTEP · A Philosophy of Software Design
FOUNDATIONS — NeetCode  (parallel, ongoing)
  Courses → NeetCode 150 patterns
```

## 3. Build track (the spine)

**Five milestones, one CodeCrafters course each, in this order. Language: Python.** "Complete" is **pragmatic** — finish each course's base + the systems-relevant extensions; treat pure feature-completionism (Redis Lists/Streams/Sorted Sets/Geo/Auth/etc.) as optional bonus, not on the path.

Stage counts are real (from each course's `course-definition.yml`). Hour/timeline figures are **estimates** at **~1.5h/stage** (fresh learner, Python; range ~1–2.5h) and a **7h/week build budget**.

| # | Course | Scope (pragmatic) | Stages | ~Hours | ~Weeks |
|---|---|---|---|---|---|
| **M1** | **Redis** | core 7 + RDB 6 + AOF 10 + Replication 18 (skip Lists/Streams/Transactions/Optimistic/Pub-Sub/Sorted Sets/Geo/Auth) | **41** | ~62h | ~9 |
| **M2** | **SQLite** | full (base) | 9 | ~14h | ~2 |
| **M3** | **HTTP server** | full (base 8 + Compression 3 + Persistent Connections 3) | 14 | ~21h | ~3 |
| **M4** | **DNS server** | full (base) | 8 | ~12h | ~2 |
| **M5** | **Kafka** | full (base 5 + Concurrency 2 + Partitions 5 + Consume 6 + Produce 8) | 26 | ~39h | ~6 |
| | | **Total (pragmatic)** | **98** | **~147h** | **~22 wks ≈ ~5 months** |

For reference: *full 100%* of all five courses is ~173 stages (~260h, ~8–9 months) — the extra ~75 stages are almost all optional Redis extensions. We're not doing those by default.

### 3.1 Sub-checkpoints (the unit of progress)
Each milestone breaks into **stage-groups** (= the course's base + each chosen extension). These are the checkable items on the page and the natural "you finished a chunk" moments:

- **M1 Redis:** Core server (7) · RDB persistence (6) · AOF persistence (10) · Replication (18)
- **M2 SQLite:** Base (9)
- **M3 HTTP:** Base (8) · Compression (3) · Persistent connections (3)
- **M4 DNS:** Base (8)
- **M5 Kafka:** Base (5) · Concurrent clients (2) · Listing partitions (5) · Consuming (6) · Producing (8)

**14 checkable build groups** total (4 + 1 + 3 + 1 + 5). The dashboard derives "stages completed" by summing the stage counts of checked groups.

CodeCrafters notes baked into the content: the **base stages are linear; extensions are à la carte** (pick any, skip the rest). Natural ordering within Redis: **RDB before Replication** (the replication handshake transfers an RDB file).

## 4. Reading track (parallel, interleaved)

**Core four books**, read at **~3.5h/week (1–2 chapters)** with a **1 anchor + 1 light** weekly rhythm, interleaved so the reading tracks the current build.

| Book | Scope | Free? |
|---|---|---|
| **DDIA** (Kleppmann) | all 12 chapters | no |
| **Database Internals** (Petrov) | all (Part I storage engines, Part II distributed) | no |
| **OSTEP** | **Concurrency + Persistence** parts only (~20 short chapters) | yes |
| **A Philosophy of Software Design** (Ousterhout) | all (~21 short chapters) | no |

### 4.1 Interleave schedule (mapped to build milestones)
| Milestone | Anchor reading | Light slot |
|---|---|---|
| M1 Redis | DDIA Ch 1–6 | APoSD (finish ~first 6 wks) → OSTEP Concurrency |
| M2 SQLite | Database Internals Ch 1–3 (B-tree basics, file formats) | OSTEP Persistence |
| M3 HTTP | Database Internals Ch 4–7 (B-trees, recovery, LSM) | OSTEP Persistence (journaling) |
| M4 DNS | Database Internals Ch 8–9 (distributed intro, failure detection) | OSTEP leftovers |
| M5 Kafka | DDIA Ch 7–11 + Database Internals Ch 10–14 (consensus, replication) | — |
| Past build | finish DDIA Ch 12 + Database Internals / OSTEP remainder | — |

**Duration (honest):** DDIA + APoSD finish within the ~5-month build; Database Internals + OSTEP spill to **~8–10 months total**. Reading extending past the build is accepted.

## 5. Foundations track (parallel, ongoing)

NeetCode, **course-first then problem-list** (owner is newer to standalone DSA problems). Budget **2h/week**. Current state (from the owner's account):

- Python for Beginners — 82/82 ✅
- Python for Coding Interviews — 31/40 (finishing within days)
- Algorithms & Data Structures for Beginners — 5/35
- Advanced Algorithms — 0
- NeetCode 150 — 0/150; Core Skills practice — 0/20

**Sequence:**
1. Finish **Python for Coding Interviews**.
2. **Algorithms & Data Structures for Beginners** (~21h left ≈ ~10 wks at 2h/wk) — through the Redis milestone.
3. **NeetCode 150**, pattern by pattern in order (Arrays & Hashing → Two Pointers → Sliding Window → Stack → Binary Search → …) — the long-running track (~a year; a habit, not a deadline). Optional bridge: **Core Skills** (implement the data structures) right after the beginners course.
4. **Advanced Algorithms** (Hard) — optional, later.

**Pattern ↔ build hints** surfaced on the page: Arrays & Hashing ↔ Redis hash store; Trees / Binary Search ↔ SQLite B-tree (M2); Graphs ↔ replication/partitioning (M4/M5).

## 6. Time budget & overall timeline

- **~12.5h/week**, split **build 7h / reading 3.5h / DSA 2h**.
- **Build spine:** ~5 months (Redis → Kafka).
- **Reading:** DDIA + APoSD within the build; full core list ~8–10 months.
- **Foundations:** beginners course through ~the Redis milestone; NeetCode 150 continues well past the build.
- Net: a coherent **~5-month "builds done"** headline, with reading + DSA as continuing tracks.

## 7. Page design

Reuse the site's design tokens and the existing v1 visual language (dark theme, `<details>` expand/collapse, the four-thread color system, the dashed decision-log block).

**Layout (top → bottom):**
1. **Header** — keep title "Building engineering judgment" and the owner's current thesis copy ("Follow along with what I'm doing…"). *(Do not revert the thesis.)*
2. **Dashboard** — three track summaries instead of the old single bar:
   - **Build:** stages completed / 98 · courses done / 5 · a progress bar
   - **Reading:** chapters read · books done / 4
   - **Foundations:** current course + NeetCode patterns done
   - **Decision logs:** count (see §8)
3. **Legend** — repurpose the four hues: **Build** (blue), **Reading/Systems** (teal), **Foundations** (purple), **Judgment** (terracotta).
4. **Build section** — 5 milestone cards (`<details>`), each expanding to its sub-checkpoints (checkable) + capstone decision log(s).
5. **Reading section** — 4 book cards (`<details>`), each expanding to checkable chapters; plus a compact interleave-schedule note.
6. **Foundations section** — the course sequence (checkable) + NeetCode 150 patterns (checkable), with the pattern↔build hints.

**Checkable granularity:**
- Build: per **stage-group** (~15 items).
- Reading: per **chapter** for the deep books (DDIA, Database Internals); short books (OSTEP, APoSD) may group chapters into sections to keep the list sane.
- Foundations: per **course** and per **NeetCode-150 pattern**.

## 8. Identity / decision logs — **DECIDED**

Keep the **"engineering judgment" framing**. Decision logs are **re-homed as capstones tied to build sub-checkpoints / milestones** (e.g., after Redis: *"RESP vs JSON," "RDB vs AOF," "single- vs multi-leader replication"*; after SQLite: *"B-tree vs LSM for this workload"*). Same dashed-block signature, **~5–8 capstone logs total** instead of one-per-week — preserving the page's distinct voice and the judgment payoff within the build-anchored structure. Each milestone carries one or more capstone `DecisionLog`s (`logs?: DecisionLog[]` in §9); completing one is a checkable judgment artifact and counts toward the dashboard's "decision logs" stat.

## 9. Data model (`src/data/roadmap.ts`, rewritten)

Pure, framework-agnostic TS (so the Netlify function can still import the ID set). Stable string IDs everywhere — progress is stored by ID.

```ts
export type Track = 'build' | 'reading' | 'foundations';

// --- Build ---
export interface DecisionLog { id: string; prompt: string; intro?: string; }
export interface BuildGroup { id: string; label: string; stages: number; hours?: number; }
export interface BuildMilestone {
  id: string; no: string; course: string; goal: string;
  groups: BuildGroup[];          // checkable stage-groups
  logs?: DecisionLog[];          // capstone judgment artifacts (see §8)
}

// --- Reading ---
export interface Chapter { id: string; no: string; title: string; }
export interface Book {
  id: string; title: string; author: string; url?: string; free?: boolean;
  scopeNote?: string;            // e.g. "Concurrency + Persistence only"
  chapters: Chapter[];           // checkable
}

// --- Foundations ---
export interface FoundationItem {
  id: string; label: string; kind: 'course' | 'pattern';
  total?: number;                // e.g. pattern problem count, or course lesson count
  pairsWith?: string;            // build hint, e.g. "Redis hash store"
}

export const build: BuildMilestone[];
export const reading: Book[];
export const foundations: FoundationItem[];

// derived (used by page + Netlify validation + dashboard)
export const allIds: Set<string>;
export interface RoadmapStats { /* per-track %, counts, decision-log count */ }
export function deriveStats(completed: string[]): RoadmapStats;
```

## 10. Persistence (reuse v1 as-is)

The progress API is **ID-agnostic**, so it carries over with **no change**:
- `netlify/functions/progress.ts` + `netlify/lib/handlers/progress.ts` + `netlify/lib/roadmap-store.ts` — unchanged.
- GET (public) / POST (token-gated, validates submitted IDs against `allIds`) — unchanged; only the contents of `allIds` change.
- Netlify Blobs store `roadmap` / key `progress` / `consistency: 'strong'` — unchanged.
- Client island (`src/scripts/roadmap.ts`) — keep the load/hydrate/edit/optimistic-save mechanism; update only the DOM wiring (new element IDs, `deriveStats` shape).
- `ROADMAP_ADMIN_TOKEN`, `.env`, README — unchanged.

**Migration:** the ID set changes completely, so any stored progress orphans. There is no real progress recorded yet (the owner hasn't started checking items), so we simply reset — acceptable, no migration logic needed.

## 11. What's reused vs. rewritten

| Reused (no/minor change) | Rewritten |
|---|---|
| Netlify progress API + Blobs + token gate | `src/data/roadmap.ts` (content model → 3 tracks) |
| Client island mechanism (fetch/hydrate/edit/save) | `src/pages/roadmap.astro` (3-track layout + dashboard) |
| Design tokens, four-thread palette, dashed-log block | Components: Milestone→course, Week→checkpoint; new Book/Chapter + Foundations components; updated Dashboard |
| `DecisionLog.astro` (re-homed to capstones) | `deriveStats` (multi-track) + dashboard element IDs |
| Nav link, docs scaffolding | `roadmap-guide.md` (update to new structure) |

## 12. Non-goals / out of scope

- The optional Redis extensions (Lists, Streams, Transactions, Pub/Sub, Sorted Sets, Geospatial, Auth, Optimistic Locking) and other CodeCrafters courses (Git, Shell, grep, Interpreter, etc.) — explicitly off the default path; can be added later as bonus.
- Per-visitor progress, multi-writer, or real auth (still single-owner, single shared token).
- Persisting decision-log *text* — the page tracks completion; the writeups live in the owner's repo/blog.

## 13. Definition of done

- [x] Identity/decision-log treatment confirmed (§8): keep judgment framing, logs as capstones.
- [ ] `/roadmap` shows three tracks (Build spine + Reading + Foundations) with the new dashboard, using real tokens.
- [ ] Build = 5 course-milestones with checkable stage-groups + capstone logs; Reading = 4 books with checkable chapters + interleave note; Foundations = course sequence + NeetCode-150 patterns with build hints.
- [ ] Progress still persists via the existing Netlify Blobs API (GET public, POST token-gated, unknown IDs 400); token absent from client bundle.
- [ ] Dashboard derives real per-track stats from content + `completed`.
- [ ] `roadmap-guide.md` updated to the new structure.
- [ ] Keyboard-navigable, focus-visible, reduced-motion respected, responsive; tests + build green.
```
