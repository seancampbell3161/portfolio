# Design — Roadmap page (`/roadmap`)

**Date:** 2026-06-13
**Status:** Approved
**Source spec:** `roadmap/roadmap-spec.md` · **Visual target:** `roadmap/roadmap-preview.html`

This design adapts the source spec to the realities of the existing Astro 5 portfolio
codebase. Where it departs from the source spec, the departure is called out and justified.

---

## 1. What we're building & why

A public `/roadmap` page presenting an ongoing learning plan as a **single skill —
engineering judgment** — rather than three parallel skill lists. It mirrors the existing
project-card pattern (collapsed summary → expand for detail) so it reads as native to the
site and slots in conceptually next to "Currently Building."

The defining idea is a **four-thread braid**: every milestone weaves four tracks — `build`
(CodeCrafters), `systems` (DDIA, the lens on the build), `foundations` (NeetCode reps), and
`judgment` (a decision-log entry that is the week's real artifact). The dashed decision-log
block is the signature element.

Visitors see it **read-only**. The owner can unlock an **edit mode** to check off tasks;
progress **persists** so the same state shows to everyone.

## 2. Non-goals

- No per-visitor progress, accounts, or sign-up. Exactly one writer (the owner).
- No full auth provider. Write access is gated by a single shared admin token.
- No rich-text journaling persistence. Decision-log *prompts* are static content; the only
  mutable state is which item IDs are marked complete.
- No new external services. Persistence uses Netlify Blobs (already a project dependency).

## 3. Key decisions (departures from the source spec)

### 3.1 API: match the existing hand-rolled Netlify Functions pattern — **no Astro adapter**

The source spec assumed a greenfield approach (`npx astro add netlify`, API routes in
`src/pages/api/` with `prerender = false`). The existing codebase already:

- hand-rolls Netlify Functions in `netlify/functions/` (`subscribe`, `confirm`,
  `unsubscribe`, `send-newsletter`) with shared libs in `netlify/lib/`,
- uses `@netlify/blobs` (`getStore("newsletter")`) via `netlify/lib/storage.ts`,
- routes `/api/* → /.netlify/functions/:splat` via `netlify.toml`,
- ships fully static with **no Astro adapter**.

Adding the adapter would collide with the existing `/api/*` redirect and change the build
setup for the entire site. **Decision:** follow the existing pattern. `/roadmap.astro` stays
a normal prerendered static page; the API is one new hand-rolled function. Lower risk,
consistent with the codebase, reuses existing infra.

### 3.2 Astro version

Installed Astro is **5.16.6**, not 6. Follow Astro 5 semantics (`output: 'static'` default;
no `output: 'hybrid'`). No version-specific work is required since we are not adding the
adapter.

### 3.3 Four-thread palette: site-native

The site's accents are blue `#60a5fa` and purple `#a78bfa` on background `#0a0a0b`. Two
threads anchor to the existing brand; two complementary hues are added.

| Thread | Hue | Source |
|---|---|---|
| `build` | `#60a5fa` blue | existing `--color-accent` |
| `foundations` | `#a78bfa` purple | existing `--color-accent-secondary` |
| `systems` | `#5fb3ac` teal | new, complementary |
| `judgment` | `#d98b6f` terracotta | new; drives the dashed decision-log signature |

All four are distinct and pass contrast on `#0a0a0b`. The progress bar uses the blue (build)
gradient so it reads native. The dashed decision-log block uses terracotta.

## 4. Architecture

- **Astro 5**, `output: 'static'`. `/roadmap` is **prerendered** (fast, indexable).
- The API is a single hand-rolled Netlify Function, mirroring `subscribe`/`confirm`:
  dependency-injected for unit testing, returning `Response` via the existing `json()` helper.
- Persistence: **Netlify Blobs**, store `roadmap`, key `progress`, `consistency: 'strong'`
  so the owner sees their write immediately.
- **Local dev runs via `netlify dev`** (not `astro dev`) so the Blobs environment is
  configured — same requirement as the existing newsletter functions.

### 4.1 Files to add / change

```
src/
  data/roadmap.ts                      # single source of content (types + roadmap[] + derived ID sets)
  pages/roadmap.astro                  # the page (prerendered)
  components/roadmap/
    RoadmapDashboard.astro             # stat row + progress bar
    Milestone.astro                    # <details> milestone card
    Week.astro                         # nested <details> week
    DecisionLog.astro                  # the dashed signature block
    TaskList.astro                     # checkable daily rhythm
  scripts/roadmap.ts                   # client island: fetch progress, edit mode, optimistic toggle
  components/Nav.astro                 # + "Roadmap" link (desktop + mobile)
netlify/
  functions/progress.ts               # thin entry: default (req) => handleProgress(req, deps)
  lib/handlers/progress.ts            # GET (public) + POST (token-gated) handler
  lib/roadmap-store.ts                # Blobs access for the roadmap store (injectable)
  lib/__tests__/progress.test.ts      # unit test with a fake store
README.md                             # document ROADMAP_ADMIN_TOKEN
```

No `astro.config.mjs` change (no adapter). No `netlify.toml` change (the `/api/*` redirect
already covers `/api/progress`).

## 5. Data model & API

### 5.1 Content model (`src/data/roadmap.ts`)

Content is version-controlled and static. **Task and log IDs are stable strings** — progress
is stored by ID, so renaming a label is fine but changing an ID orphans its progress.

```ts
export type Track = 'build' | 'systems' | 'foundations';

export interface Resource { title: string; source: string; kind: 'video'|'docs'|'article'|'course'|'book'; url?: string; }
export interface Component { track: Track; title: string; detail?: string; source?: string; }
export interface Task { id: string; day?: string; label: string; hours?: number; }
export interface DecisionLog { id: string; prompt: string; intro?: string; }
export interface Week { id: string; no: string; name: string; hours: number; goal: string;
  components: Component[]; tasks: Task[]; resources?: Resource[]; log: DecisionLog; }
export interface Milestone { id: string; no: string; title: string; goal: string;
  estHours?: number;            // headline estimate for milestones whose weeks aren't enumerated yet
  components?: Component[];      // milestone-level four-thread summary (used for scaffolded M2–M6)
  weeks: Week[]; }

export const roadmap: Milestone[];

// Derived (computed once from `roadmap`), used by both the page and the handler:
export const allTaskIds: string[];
export const allLogIds: string[];
export const allIds: Set<string>;     // task IDs ∪ log IDs — the validation allowlist
```

- ID convention: `m1.w1.mon`, `m1.w1.log`, etc.
- Pure, framework-agnostic TS (no Astro imports, no path aliases) so the Netlify handler can
  import it across the `src/` ↔ `netlify/` boundary via a relative path.
- M1 fully specified (content from the source spec §7 / preview). **M2–M6 weeks scaffolded**
  with TODO markers and milestone-level `components` only — no fabricated daily tasks. Their
  judgment artifact is represented as a milestone-level `DecisionLog` so log counts stay
  honest.

### 5.2 Progress model (Netlify Blobs)

Store `roadmap`, key `progress`, one JSON blob:

```ts
interface ProgressBlob { version: 1; updatedAt: string /* ISO */; completed: string[] /* task & log IDs */; }
```

`completed` holds both task IDs and decision-log IDs. All stats derive from it.

### 5.3 API contract (`/api/progress`)

| Method | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | none (public) | — | `200 { completed: string[], updatedAt: string\|null }`. Missing blob → `{ completed: [], updatedAt: null }`. | — |
| `POST` | `Authorization: Bearer <token>` | `{ completed: string[] }` | Validate, `setJSON`, return `200 { ok: true, updatedAt }` | `401` missing/bad token; `400` body invalid or contains an unknown ID |

Implementation notes:
- Expected token from `process.env.ROADMAP_ADMIN_TOKEN`. Compare with the existing
  `constantTimeEquals` from `netlify/lib/tokens.ts`. **Never import the token into any
  client-side code.**
- On POST, **validate every submitted ID against `allIds` from `roadmap.ts`** and reject
  unknown IDs — prevents an attacker bloating the blob with arbitrary data. Reject non-array
  / non-string-element bodies with `400`.
- Writes replace the whole `completed` array (idempotent, last-write-wins). No merge logic
  given a single writer.
- Blob access (injected as a dep for testability):

```ts
import { getStore } from '@netlify/blobs';
const store = getStore({ name: 'roadmap', consistency: 'strong' });
const data = await store.get('progress', { type: 'json' }); // null if absent
await store.setJSON('progress', { version: 1, updatedAt: new Date().toISOString(), completed });
```

- Set `ROADMAP_ADMIN_TOKEN` in Netlify site env vars and in local `.env` for `netlify dev`.
  Documented in the README.

## 6. Client behavior (`src/scripts/roadmap.ts`)

The page is static HTML; progress hydrates on load via `fetch('/api/progress')`. Small
vanilla-TS island, no framework.

- **On load:** GET progress, mark checkboxes from `completed`, compute and render the dashboard.
- **Read-only default:** checkboxes disabled for visitors (state visible, not editable). An
  "Edit" affordance is present but inert until unlocked.
- **Edit mode:** clicking "Edit" prompts for the admin token, stored in `sessionStorage`.
  Checkboxes become editable. Toggling updates the UI optimistically and **debounced-POSTs
  the full `completed` array** (~500 ms). On `401`: clear the stored token, revert, show inline
  message ("That token didn't work."). On network error: revert the toggle and surface a retry.
- **Dashboard derivation** (client-side, from content + `completed`):
  - Complete % = completed task IDs ÷ total task IDs.
  - Tasks done = `count(completed ∩ taskIds)` / total tasks.
  - Planned hours = sum of `week.hours` across enumerated weeks + `estHours` for scaffolded
    milestones (static).
  - Decision logs = `count(completed ∩ logIds)` / `allLogIds.length` (denominator derived
    from content, **not** hardcoded). Each log ID is toggled via the "Mark logged" control in
    its decision-log block (§7).
  - Per-milestone % = completed IDs within that milestone ÷ that milestone's total IDs.

## 7. Styling

Use the site's **real tokens** — `--color-*`, `--space-*`, `--radius-*`, `--transition-*`,
DM Sans (body) / JetBrains Mono (mono) — not the preview's placeholder Space Grotesk / Inter.
Reuse the `section-number` eyebrow idiom and the project-card collapse aesthetic.

Keep from the preview:
- The four-thread color system (§3.3), used consistently in legend, milestone thread-dots,
  and component tags.
- The **dashed decision-log block** as the visual signature (terracotta), distinct from the
  solid component rows. The block carries a single **checkable control bound to its log ID**
  ("Mark logged") — read-only display for visitors, toggleable in edit mode — so a completed
  decision log is tracked in `completed` exactly like a task. (The preview omits this control;
  the data model requires it.)
- Milestone/week expand-collapse via `<details>`/`<summary>` with a custom marker; `aria`
  handled natively.

Quality floor: responsive to mobile (dashboard reflows to 2 columns at ≤640px), visible
keyboard focus, `prefers-reduced-motion` respected, sufficient contrast. Sentence case,
active-voice labels ("Edit", "Save"; the saved state actually says saved).

## 8. Content to populate `roadmap.ts`

Original content mirrored from `roadmap/roadmap-preview.html`. M1 is fully specified
(4 weeks, daily tasks, weekly decision logs). M2–M6 carry milestone goal + four-thread
components + a milestone-level judgment log; **their weeks are scaffolded with TODO markers**
and will be filled in by the owner — do not fabricate daily tasks.

**Thesis (page header):** "Not three skill gaps to close in parallel — one skill. Every
build, every chapter, every problem rolls up into knowing which tool to reach for, and being
able to defend the call."

Full milestone/week/task/log content is taken verbatim from source spec §7 and the preview.

## 9. Integration

- Add **"Roadmap"** to `Nav.astro` `navLinks` (between Blog and Contact) and the mobile menu —
  it uses the same `navLinks` array, so one change covers both.
- The page uses `Layout.astro` + `Nav` + `Footer`, like the blog pages.

## 10. Testing & verification

- **Unit:** `netlify/lib/__tests__/progress.test.ts` with a fake store — GET empty, GET
  populated, POST without token → 401, POST bad token → 401, POST unknown ID → 400, POST
  valid → 200 + persisted, POST malformed body → 400. Matches the existing vitest suite.
- **Manual (`netlify dev`):** verify GET is public; edit mode unlocks with the token; a toggle
  persists across reload and shows on another browser; token never appears in the client bundle
  (`grep` the built `_astro/*.js`).
- **Build:** `npm run build` succeeds and `/roadmap` is emitted as static HTML; confirm the
  cross-boundary import of `src/data/roadmap.ts` bundles cleanly into the function under
  `netlify dev` / Netlify build. *(Fallback if esbuild balks: relocate the pure-TS content to a
  location both sides import, e.g. keep it in `src/data/roadmap.ts` and have the handler import
  the compiled path, or move the canonical module under a shared dir — content stays a single
  source.)*

## 11. Definition of done

- [ ] `/roadmap` is prerendered, linked in nav, visually matches the site (real tokens).
- [ ] Milestones and weeks expand/collapse; four-thread braid + dashed decision-log block present.
- [ ] Visitors see current progress read-only; dashboard reflects real stored state on first paint.
- [ ] Edit mode unlocks with the admin token; toggles persist via Netlify Blobs and survive
      reload + show on another device/browser.
- [ ] `GET /api/progress` is public; `POST` rejects missing/bad tokens (401) and unknown IDs
      (400); the token never reaches the client bundle.
- [ ] `netlify dev` works locally; `ROADMAP_ADMIN_TOKEN` documented in the README and set in
      Netlify env.
- [ ] Keyboard-navigable, focus-visible, `prefers-reduced-motion` respected, responsive to mobile.

## 12. Optional / future (deferred)

Per-visitor progress via `localStorage`; real auth (Netlify Identity / Supabase) if a
multi-writer model is ever wanted; persisting actual journal text per decision log to a second
blob key; a teaser/link to `/roadmap` from the homepage "Currently Building" section.
