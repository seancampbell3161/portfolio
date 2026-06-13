# Spec — Roadmap page (`/roadmap`)

**For:** Claude Code, implementing on the existing Astro portfolio (`seanthedeveloper.com`, deployed on Netlify).
**Visual target:** `roadmap-preview.html` (attached). Treat it as the source of truth for layout, interaction, and content — but **replace its approximate styling with the site's real design tokens** (see §6).

---

## 1. What we're building & why

A public `/roadmap` page that presents an ongoing learning plan as a **single skill — engineering judgment** — rather than three parallel skill lists. It mirrors the existing project-card pattern (collapsed summary → expand for detail), so it reads as native to the site and slots in conceptually next to "Currently Building."

The defining idea is a **four-thread braid**: every milestone weaves the same four tracks — `build` (CodeCrafters), `systems` (DDIA, as the lens on the build), `foundations` (NeetCode reps), and `judgment` (a decision-log entry that is the week's real artifact). The decision-log block is the signature element; it's the learning equivalent of the Tradeoffs/Decisions section already used on project cards.

Visitors see it **read-only**. The owner can unlock an **edit mode** to check off tasks; progress **persists** so the same state shows to everyone.

## 2. Non-goals (out of scope)

- No per-visitor progress, accounts, or sign-up. There is exactly one writer (the owner).
- No full auth provider. Write access is gated by a single shared admin token (§4.3).
- No rich-text journaling persistence. The decision-log *prompts* are static content; the only mutable state is which items are marked complete.
- No new external services. Persistence uses Netlify Blobs only.

## 3. Architecture

- **Astro 6**, default `output: 'static'`. **Verify the installed Astro major version before starting** and follow its current docs; the notes below assume Astro 5/6 semantics (no `output: 'hybrid'`).
- Add the Netlify adapter: `npx astro add netlify`. Keep output static. The `/roadmap` page stays **prerendered** (fast, indexable). Only the API routes opt out.
- API routes live under `src/pages/api/` and export `const prerender = false`. The Netlify adapter compiles these into Netlify Functions automatically — do **not** hand-roll functions in `netlify/functions/`.
- Persistence: **Netlify Blobs** (`@netlify/blobs`), accessed from the API routes. Zero provisioning. Use `consistency: 'strong'` so the owner sees their write immediately.
- **Local dev must run via `netlify dev`** (not `astro dev`) so the Blobs environment is configured; otherwise `getStore` throws "environment has not been configured to use Netlify Blobs."

### 3.1 Files to add

```
src/
  data/roadmap.ts            # all roadmap content (the single source of content)
  pages/
    roadmap.astro            # the page (prerendered)
    api/progress.ts          # GET (public read) + POST (token-gated write); prerender = false
  components/roadmap/
    RoadmapDashboard.astro    # stat row + progress bar
    Milestone.astro           # <details> milestone card
    Week.astro                # nested <details> week
    DecisionLog.astro         # the signature block
    TaskList.astro            # checkable daily rhythm
  scripts/roadmap.ts          # client island: fetch progress, edit mode, optimistic toggle
astro.config.mjs              # + @astrojs/netlify adapter
```

Reuse any existing expand/collapse, chip/tag, or section-number components rather than duplicating them.

## 4. Data model & API

### 4.1 Content model (`src/data/roadmap.ts`)

Content is version-controlled and static. **Task and log IDs must be stable strings** — progress is stored by ID, so renaming a label is fine but changing an ID orphans its progress.

```ts
export type Track = 'build' | 'systems' | 'foundations';

export interface Resource { title: string; source: string; kind: 'video'|'docs'|'article'|'course'|'book'; url?: string; }
export interface Component { track: Track; title: string; detail?: string; source?: string; }
export interface Task { id: string; day?: string; label: string; hours?: number; }
export interface DecisionLog { id: string; prompt: string; }   // completing this = the week's judgment artifact
export interface Week { id: string; no: string; name: string; hours: number; goal: string;
  components: Component[]; tasks: Task[]; resources?: Resource[]; log: DecisionLog; }
export interface Milestone { id: string; no: string; title: string; goal: string; weeks: Week[]; }

export const roadmap: Milestone[];
```

ID convention: `m1.w1.mon`, `m1.w1.log`, etc. Full content in §7.

### 4.2 Progress model (Netlify Blobs)

- Store name: `roadmap`. Key: `progress`. One JSON blob:

```ts
interface ProgressBlob { version: 1; updatedAt: string /* ISO */; completed: string[] /* task & log IDs */; }
```

- `completed` holds both task IDs and decision-log IDs. Stats derive from it (§5).

### 4.3 API contract (`src/pages/api/progress.ts`, `prerender = false`)

| Method | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | none (public) | — | `200 { completed: string[], updatedAt: string\|null }`. If blob missing, return `{ completed: [], updatedAt: null }`. | — |
| `POST` | `Authorization: Bearer <token>` | `{ completed: string[] }` | Validate, `setJSON`, return `200 { ok: true, updatedAt }` | `401` missing/bad token; `400` body invalid or contains an unknown ID |

Implementation notes:
- Read the expected token from `process.env.ROADMAP_ADMIN_TOKEN`. Use a constant-time comparison. **Never import the token into any client-side code.**
- On POST, **validate every submitted ID against the known IDs in `roadmap.ts`** and reject unknown IDs — this prevents an attacker from bloating the blob with arbitrary data.
- Writes replace the whole `completed` array (idempotent, last-write-wins). No merge logic needed given a single writer.
- Blob access:

```ts
import { getStore } from '@netlify/blobs';
const store = getStore({ name: 'roadmap', consistency: 'strong' });
const data = await store.get('progress', { type: 'json' }); // null if absent
await store.setJSON('progress', { version: 1, updatedAt: new Date().toISOString(), completed });
```

- Set `ROADMAP_ADMIN_TOKEN` in the Netlify site env vars (and in a local `.env` for `netlify dev`). Document this in the repo README.

## 5. Client behavior (`src/scripts/roadmap.ts`)

The page is static HTML; progress hydrates on load via `fetch('/api/progress')`. Keep it a small vanilla-TS island — no framework needed.

- **On load:** GET progress, mark checkboxes from `completed`, compute and render the dashboard.
- **Read-only default:** checkboxes are disabled for visitors (state visible, not editable). An "Edit" affordance is present but does nothing until unlocked.
- **Edit mode:** clicking "Edit" prompts for the admin token, stored in `sessionStorage`. Checkboxes become editable. Toggling a box updates the UI optimistically and **debounced-POSTs the full `completed` array** (~500ms). On `401`, clear the stored token, revert, and show an inline message ("That token didn't work."). On network error, revert the toggle and surface a retry.
- **Dashboard derivation** (client-side, from content + `completed`):
  - Complete % = completed task IDs ÷ total task IDs.
  - Tasks done = `count(completed ∩ taskIds)` / total tasks.
  - Planned hours = sum of `hours` across all weeks/tasks in content (static).
  - Decision logs = `count(completed ∩ logIds)` / total logs.
  - Per-milestone % = completed IDs within that milestone ÷ that milestone's total.

## 6. Styling

**Do not invent a palette.** Extract the real tokens (colors, font families, spacing scale, border-radius, hairline color) from the existing components — start from the project-card and section components — and apply them here. The preview's dark palette and Space Grotesk / JetBrains Mono pairing are placeholders chosen to approximate the site; replace with the actual values so it's pixel-consistent.

Keep from the preview:
- The **four-thread color system**: one hue each for `build` / `systems` / `foundations` / `judgment`, used consistently in the legend, the milestone thread-dots, and the component tags. Pick four hues that fit the site's existing accent(s); they must stay distinguishable and pass contrast on the site background.
- The **dashed decision-log block** as the visual signature — distinct from the solid component rows.
- Milestone and week expand/collapse via `<details>`/`<summary>` (free keyboard + a11y), custom marker, `aria` handled.

Quality floor: responsive to mobile (dashboard reflows to 2 columns), visible keyboard focus, `prefers-reduced-motion` respected, sufficient color contrast. Sentence case, active-voice labels ("Edit", "Save" — and the saved state actually says saved).

## 7. Content to populate `roadmap.ts`

This is original content; mirror it from `roadmap-preview.html`. M1 is fully specified; M2–M6 give the milestone goal + the four components. **Weeks for M2–M6 follow M1's shape and will be filled in by the owner** — scaffold them as empty/partial `weeks` arrays with TODO markers, don't fabricate daily tasks.

**Thesis (page header):** "Not three skill gaps to close in parallel — one skill. Every build, every chapter, every problem rolls up into knowing which tool to reach for, and being able to defend the call."

**M1 · Storage — how bytes become a database**
Judgment goal: defend choosing an in-memory store over disk, and name exactly when that choice breaks.
- *W1 — A server that speaks a protocol* (~8h). Goal: "By Sunday you can open a raw TCP socket, parse a wire protocol by hand, and explain why Redis chose RESP over JSON."
  - build: Build Your Own Redis, stages 1–4 (TCP listener, accept loop, RESP parse, PING/ECHO) — codecrafters.io · Redis track
  - systems: DDIA Ch. 1 — reliability, scalability, maintainability as the rubric for every later decision
  - foundations: NeetCode — Arrays & Hashing, 15 min daily
  - tasks: Mon socket+accept loop, echo raw / Tue parse one RESP array, handle PING / Wed handle ECHO + DDIA Ch.1 first half / Thu concurrent connections + DDIA Ch.1 finish / Fri NeetCode Two Sum, Group Anagrams, Top-K / Sat refactor parser + write the decision log
  - log: "RESP vs JSON for a wire protocol: what Redis traded away, and the workload where I'd make the opposite call."
- *W2 — An in-memory store with expiry* (~8h). Goal: "reason about why a hash index is O(1) and what it costs you in memory and durability."
  - build: Redis SET/GET/TTL stages; passive vs active expiry
  - systems: DDIA Ch. 3 — log-structured hash indexes, and where they stop scaling
  - foundations: NeetCode — Two Pointers
  - tasks: Mon SET/GET on in-memory map / Wed key expiry + DDIA Ch.3 hash indexes / Sat decision log + push to repo
  - log: "In-memory vs durable: the actual failure I'm accepting when I keep state in RAM."
- *W3 — Indexes & retrieval* (~8h). Secondary lookups; DDIA Ch.3 B-trees vs LSM as a preview of M2. (Expand into the standard shape.)
- *W4 — Persistence: RDB & AOF* (~8h). Snapshotting + append-only log; capstone log compares the two durability strategies.

**M2 · Storage engines — B-trees vs LSM**
Judgment goal: read a query pattern and predict which engine wins, before you benchmark.
- build: Build Your Own SQLite — read the real file format, walk the B-tree, run an indexed query
- systems: DDIA Ch. 3 (deep) + Ch. 2 — B-trees vs LSM-trees; relational/document/graph models
- foundations: Binary Search · Trees · Tries
- judgment: "The workload decides the engine" — map read/write ratios to B-tree vs LSM

**M3 · Encoding & the wire**
Judgment goal: version an API without breaking last year's clients.
- build: Build Your Own HTTP server + DNS server
- systems: DDIA Ch. 4 — encoding & evolution (JSON, Protobuf, Avro, schema migrations)
- foundations: Stack · Linked List · Sliding Window
- judgment: "The migration I'd never ship"

**M4 · Distribution — replication & partitioning**
Judgment goal: place data and pick a leader strategy under a real failure model.
- build: Redis replication stages — leader/follower handshake, command propagation
- systems: DDIA Ch. 5 + Ch. 6 — replication and partitioning
- foundations: Graphs · Heaps
- judgment: "Single-leader vs multi-leader: where I draw the line"

**M5 · Consistency & consensus**
Judgment goal: name the consistency model a feature needs — and the one it's secretly relying on.
- build: Build Your Own Kafka — partitioned log, offsets, ordering guarantees
- systems: DDIA Ch. 7 · 8 · 9 — transactions, distributed trouble, consensus
- foundations: Dynamic Programming · Intervals
- judgment: "Which consistency model, and what it costs"

**M6 · Systems in the wild — batch, streams & a real design**
Judgment goal: take a project you already shipped and write the design doc it deserved.
- build: finish Kafka, then retrofit a streaming or batch component onto Songle or Roaming.Camp
- systems: DDIA Ch. 10 · 11 · 12 — batch, stream, synthesis
- foundations: Graphs (advanced) · Backtracking · mixed review
- judgment: capstone — a published system-design writeup distilled from the decision logs (ties into the blog)

## 8. Definition of done

- [ ] `/roadmap` is prerendered, linked in nav, and visually matches the site (real tokens, not the preview's placeholders).
- [ ] Milestones and weeks expand/collapse; the four-thread braid and dashed decision-log block are present.
- [ ] Visitors see current progress read-only; the dashboard reflects real stored state on first paint.
- [ ] Edit mode unlocks with the admin token; toggles persist via Netlify Blobs and survive reload + show on another device/browser.
- [ ] `GET /api/progress` is public; `POST` rejects missing/bad tokens (401) and unknown IDs (400); the token never reaches the client bundle.
- [ ] `netlify dev` works locally; `ROADMAP_ADMIN_TOKEN` documented in the README and set in Netlify env.
- [ ] Keyboard-navigable, focus-visible, `prefers-reduced-motion` respected, responsive to mobile.

## 9. Optional / future (clearly deferred)

Per-visitor progress via `localStorage`; real auth (Netlify Identity or Supabase) if multi-writer is ever wanted; persisting actual journal text per decision log to a second blob key.
