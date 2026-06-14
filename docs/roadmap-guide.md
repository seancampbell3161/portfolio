# Roadmap — owner's guide

A reference for **you** (the owner) on what the `/roadmap` page is, what you're working on, and the two ways you "update progress": **checking things off** (the live page) and **editing the plan** (the content file).

> Public page: `https://seanthedeveloper.com/roadmap` · Content source: `src/data/roadmap.ts`

---

## 1. The idea

The roadmap presents your learning plan as **one skill — engineering judgment** — built through three parallel tracks:

| Thread | Color | What it is |
|---|---|---|
| **Build** | blue | CodeCrafters "Build Your Own X" — the spine; five courses taken to pragmatic completion |
| **Reading** | teal | Four systems books, read 1–2 chapters/week interleaved with the builds |
| **Foundations** | purple | NeetCode — courses first, then the 150 patterns |
| **Judgment** | terracotta | **Capstone decision logs** — the reasoning artifacts at the end of each build milestone |

The **Build track is the spine.** Each milestone is one complete CodeCrafters course. Reading and Foundations run as independent parallel tracks at their own pace — no forced sync. The decision logs are the signature: they're where hours turn into transferable judgment (and the seed of a blog post).

---

## 2. What you're working on (current state)

**Five build milestones** (Redis → SQLite → HTTP → DNS → Kafka), each broken into checkable stage-groups, plus two parallel tracks.

### Build — CodeCrafters (Python)

| # | Course | Stage-groups (checkable) | Stages |
|---|---|---|---|
| **M1** | **Redis** | Core server · RDB persistence · AOF persistence · Replication | 41 |
| **M2** | **SQLite** | Base (read the file format, B-tree, indexed query) | 9 |
| **M3** | **HTTP server** | Base · Compression · Persistent connections | 14 |
| **M4** | **DNS server** | Base (UDP, binary packets, forwarding) | 8 |
| **M5** | **Kafka** | Base · Concurrent clients · Listing partitions · Consuming · Producing | 26 |

"Complete" is **pragmatic** — the scope above covers the systems-relevant content; the optional Redis extensions (Lists, Streams, Auth, Pub/Sub, etc.) are explicitly off the default path.

Each milestone ends in one or more **capstone decision logs** (8 total across all milestones). Examples: *"RESP vs JSON,"* *"RDB vs AOF,"* *"B-tree vs LSM,"* *"binary protocols."*

### Reading — interleaved (~1–2 chapters/week)

| Book | Author | Scope | Chapters |
|---|---|---|---|
| **Designing Data-Intensive Applications** | Kleppmann | All 12 chapters | 12 |
| **Database Internals** | Petrov | All 14 chapters | 14 |
| **Operating Systems: Three Easy Pieces** | Arpaci-Dusseau | Concurrency + Persistence parts only | 7 |
| **A Philosophy of Software Design** | Ousterhout | All (5 chapter-groups) | 5 |

DDIA + APoSD finish within the ~5-month build; Database Internals + OSTEP spill past it — that's expected and fine.

### Foundations — NeetCode

Courses first (in order), then the NeetCode 150 patterns:

1. **Python for Coding Interviews** (finishing)
2. **Algorithms & Data Structures for Beginners** (~35 lessons)
3. **Core Skills** — implement the data structures (~20 lessons)
4. **NeetCode 150 — patterns** (Arrays & Hashing → … → Bit Manipulation, 18 patterns tracked)
5. **Advanced Algorithms** (optional, later)

Pattern ↔ build hints appear on the page: Arrays & Hashing ↔ Redis hash store; Trees / Binary Search ↔ SQLite B-tree; Graphs ↔ replication & partitioning.

---

## 3. Updating progress — checking things off (the everyday flow)

This is how you record that you finished a chunk of work. It edits the **shared, persisted** state (everyone sees it), stored in Netlify Blobs.

1. Go to **`/roadmap`** on the live site.
2. Click **Edit** (below the dashboard).
3. Enter your **admin token** (`ROADMAP_ADMIN_TOKEN`). It's kept in the browser's `sessionStorage` for the session only — never shipped in the page.
4. The checkboxes become editable. Check the relevant item:
   - **Build stage-group** — a completed chunk of a CodeCrafters course (e.g., Redis Core server).
   - **Capstone decision log** — use the "Mark logged" checkbox inside the dashed terracotta block when you've written the entry.
   - **Book chapter** — a chapter (or chapter-group) in the Reading track.
   - **Course or NeetCode pattern** — a completed course or pattern group in the Foundations track.
5. Each toggle saves automatically (~½ second debounce). You'll see **"Saving…" → "Saved"**. The dashboard numbers update instantly.
6. Click **Done** when finished. Reloading the page (or opening it on another device) shows the same state.

Notes:
- Visitors see your progress **read-only** — they can't toggle anything.
- If the token is wrong you'll get **"That token didn't work."** and edit mode closes. Re-click Edit and try again.
- If a save fails (network), the change is reverted to the last saved state and you'll see a message — just toggle again.
- **Checking a box ≠ writing the log.** The "Mark logged" checkbox only *tracks* that a decision-log entry is done; the actual write-up lives wherever you keep it (your `genai-journey` repo / a blog draft). The roadmap just records completion.

### What the dashboard numbers mean

- **Build — stages / courses:** total CodeCrafters stages completed (derived from checked stage-groups), and how many full courses are done.
- **Reading — chapters / books:** chapters checked, and how many books are fully read.
- **Foundations — items:** courses + NeetCode patterns checked out of 22.
- **Decision logs:** capstone logs marked done (out of 8).

---

## 4. Updating progress — editing the plan (adding/changing content)

When you want to **add a stage-group, adjust a book's chapters, or add a NeetCode pattern**, edit **`src/data/roadmap.ts`**, then commit and push. This is version-controlled (unlike the checkbox state, which is the only thing stored in Blobs).

### The one rule that matters: IDs are permanent

Progress is stored **by ID**. So:
- ✅ **Renaming a label** (the visible text) is always safe.
- ❌ **Changing an existing `id`** orphans whatever progress was stored against it (the checkbox forgets it was checked).
- ✅ **Adding new items** with new IDs is safe — they just start unchecked.

**The file exports three arrays:** `build`, `reading`, and `foundations`. Each item in each array has a stable string `id`.

**ID conventions in use:**
- Build stage-groups: `redis.core`, `redis.rdb`, `sqlite.base`, `http.compression`, etc.
- Capstone logs: `redis.log.resp`, `redis.log.durability`, `kafka.log.capstone`, etc.
- Book chapters: `ddia.ch1`, `dbint.ch3`, `ostep.c1`, `aposd.s2`, etc.
- Foundations: `fd.pyci`, `fd.dsab`, `fd.nc.arrays`, `fd.nc.trees`, etc.

### Extending the plan

**To add a Redis extension (or any new stage-group to an existing milestone):** add a new `BuildGroup` to that milestone's `groups` array with a fresh unique ID.

```ts
// Example: adding a Redis Pub/Sub extension (if you decide to do it)
{ id: "redis.pubsub", label: "Pub/Sub — subscribe/publish channels", stages: 4, hours: 6 },
```

**To add book chapters:** append `Chapter` objects to the appropriate book's `chapters` array.

**To add a NeetCode pattern:** append a `FoundationItem` with `kind: "pattern"` to the `foundations` array.

After editing: the page rebuilds at deploy, and the new IDs become checkable. Existing checked state is preserved (because you only *added* IDs).

---

## 5. Local development & deploy

The progress API uses **Netlify Blobs**, which only work under the Netlify environment — so run the dev server through the Netlify CLI, not plain `astro dev`:

```bash
netlify dev          # serves the site AND wires up Blobs + functions
```

You need `ROADMAP_ADMIN_TOKEN` available locally — put it in a **`.env` at the project root** (gitignored):

```
ROADMAP_ADMIN_TOKEN=<your openssl rand -hex 32 value>
```

`npm run dev` (plain Astro) will render the page but `/api/progress` calls fail (no Blobs).

**Deploy:** push to `main`. Netlify builds and deploys. For edit mode to work in production, set the **same** `ROADMAP_ADMIN_TOKEN` in the Netlify dashboard (Site settings → Environment variables). Local and production can use different tokens if you prefer.

---

## 6. Where everything lives

| File | What it does |
|---|---|
| `src/data/roadmap.ts` | **The content.** Three exports: `build` (5 milestones + stage-groups + decision logs), `reading` (4 books + chapters), `foundations` (courses + patterns). Edit this to change the plan. |
| `src/pages/roadmap.astro` | The page + all styling (the four-thread palette + three-track layout). |
| `src/components/roadmap/CheckItem.astro` | Shared checkable row — used by all three tracks. |
| `src/components/roadmap/Milestone.astro` | A build course card (stage-groups + capstone logs). |
| `src/components/roadmap/BookCard.astro` | A reading book card (chapters). |
| `src/components/roadmap/FoundationsSection.astro` | Courses + NeetCode 150 patterns. |
| `src/components/roadmap/RoadmapDashboard.astro` | Three-track dashboard + edit controls. |
| `src/components/roadmap/DecisionLog.astro` | The dashed capstone-log block. |
| `src/scripts/roadmap.ts` | Client logic: loads progress from the API, edit mode, auto-save, dashboard hydration. |
| `netlify/functions/progress.ts` + `netlify/lib/handlers/progress.ts` | The API: public GET, token-gated POST, stores to Blobs. |
| `.env` (local, gitignored) / Netlify env vars | `ROADMAP_ADMIN_TOKEN`. |

Design rationale and the full restructure plan are archived in `docs/superpowers/specs/2026-06-14-roadmap-restructure-design.md` and `docs/superpowers/plans/2026-06-14-roadmap-restructure.md` if you ever want the "why."

---

## TL;DR

- **Finished a stage-group / chapter / course / decision log?** → `/roadmap` → Edit → enter token → check the box. Auto-saves, shared, persists.
- **Want to extend the plan or add content?** → edit `src/data/roadmap.ts` (`build`, `reading`, or `foundations`); never reuse or rename an existing `id`. Commit and push.
- **Run it locally?** → `netlify dev` with `ROADMAP_ADMIN_TOKEN` in a root `.env`.
