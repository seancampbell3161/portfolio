# Roadmap — owner's guide

A reference for **you** (the owner) on what the `/roadmap` page is, what you're working on, and the two ways you "update progress": **checking things off** (the live page) and **editing the plan** (the content file).

> Public page: `https://seanthedeveloper.com/roadmap` · Content source: `src/data/roadmap.ts`

---

## 1. The idea

The roadmap presents your learning plan as **one skill — engineering judgment** — not three parallel skill lists. Every milestone weaves the same **four threads**:

| Thread | Color | What it is |
|---|---|---|
| **Build** | blue | CodeCrafters "Build Your Own X" — the thing you actually make |
| **Systems** | teal | *Designing Data-Intensive Applications* (DDIA) — the lens on the build |
| **Foundations** | purple | NeetCode reps — 15 min daily |
| **Judgment** | terracotta | The **decision log** — a ~150-word entry that is the week's real artifact |

The decision log is the signature: it's where hours turn into transferable judgment (and the seed of a blog post). It shows up as the dashed terracotta block at the bottom of each fully-built week.

---

## 2. What you're working on (current state)

Six milestones. **M1 is fully built out; M2–M6 are scaffolded** (goal + four-thread summary, ready for you to fill in weeks).

| # | Milestone | Status |
|---|---|---|
| **M1** | Storage — how bytes become a database | **Active.** W1 & W2 fully detailed (daily tasks + decision log). W3 & W4 are goal-only stubs. |
| M2 | Storage engines — B-trees vs LSM | Scaffold (Build Your Own SQLite) |
| M3 | Encoding & the wire | Scaffold (HTTP + DNS server) |
| M4 | Distribution — replication & partitioning | Scaffold (Redis replication) |
| M5 | Consistency & consensus | Scaffold (Build Your Own Kafka) |
| M6 | Systems in the wild — batch, streams & a real design | Scaffold (finish Kafka → retrofit a real project) |

**M1 weeks:**
- **W1 — A server that speaks a protocol** (~8h): TCP socket, parse RESP by hand, PING/ECHO. DDIA Ch. 1. NeetCode Arrays & Hashing. → log: *RESP vs JSON*.
- **W2 — An in-memory store with expiry** (~8h): SET/GET/TTL, hash map backing, passive/active expiry. DDIA Ch. 3 hash indexes. NeetCode Two Pointers. → log: *In-memory vs durable*.
- **W3 — Indexes & retrieval** (~8h): goal-only stub. Fill in when you get here.
- **W4 — Persistence: RDB & AOF** (~8h): goal-only stub.

**Right now the tracked totals are:** 9 daily tasks, 2 decision logs, ~180h planned. Those denominators grow automatically as you flesh out W3/W4 and M2–M6.

---

## 3. Updating progress — checking things off (the everyday flow)

This is how you record that you finished a task or a decision log. It edits the **shared, persisted** state (everyone sees it), stored in Netlify Blobs.

1. Go to **`/roadmap`** on the live site.
2. Click **Edit** (top-right of the dashboard).
3. Enter your **admin token** (`ROADMAP_ADMIN_TOKEN`). It's kept in the browser's `sessionStorage` for the session only — never shipped in the page.
4. The checkboxes become editable. **Check a daily task**, or check **"Mark logged"** inside a decision-log block when you've written that week's entry.
5. Each toggle saves automatically (~½ second debounce). You'll see **"Saving…" → "Saved"**. The dashboard numbers and the milestone rings update instantly.
6. Click **Done** when finished. Reloading the page (or opening it on another device) shows the same state.

Notes:
- Visitors see your progress **read-only** — they can't toggle anything.
- If the token is wrong you'll get **"That token didn't work."** and edit mode closes. Re-click Edit and try again.
- If a save fails (network), the change is reverted to the last saved state and you'll see a message — just toggle again.
- **Checking a box ≠ writing the log.** The "Mark logged" checkbox only *tracks* that the entry is done; the actual ~150-word write-up lives wherever you keep it (your `genai-journey` repo / a blog draft). The roadmap just records completion.

### What the dashboard numbers mean
- **Complete %** — completed daily tasks ÷ total daily tasks.
- **Tasks done** — same, as a fraction.
- **Planned** — sum of weekly hours for built-out weeks, plus per-milestone estimates for the scaffolded ones (currently ~180h).
- **Decision logs** — completed logs ÷ total logs.
- **Per-milestone %** (the number on each milestone row) — completed items *including* logs ÷ that milestone's total items.

---

## 4. Updating progress — editing the plan (adding/changing content)

When you want to **flesh out a week**, add tasks, fix wording, or build out M2–M6, you edit **`src/data/roadmap.ts`**, then commit and push. This is version-controlled (unlike the checkbox state, which is the only thing stored in Blobs).

### The one rule that matters: IDs are permanent

Progress is stored **by ID**. So:
- ✅ **Renaming a label** (the visible text) is always safe.
- ❌ **Changing an existing `id`** orphans whatever progress was stored against it (the checkbox forgets it was checked).
- ✅ **Adding new items** with new IDs is safe — they just start unchecked.

**ID convention:** `m{milestone}.w{week}.{day}` for tasks, `m{milestone}.w{week}.log` for the weekly decision log. Examples: `m1.w1.mon`, `m1.w2.log`, `m3.w1.wed`.

### Filling in a scaffolded milestone (M2–M6)

Right now a scaffolded milestone looks like this (no `weeks`, just a summary):

```ts
{
  id: "m2",
  no: "M2",
  title: "Storage engines — B-trees vs LSM",
  goal: "read a query pattern and predict which engine wins, before you benchmark.",
  estHours: 28,
  components: [ /* build / systems / foundations summary rows */ ],
  judgment: "“The workload decides the engine” — map read/write ratios to B-tree vs LSM.",
  weeks: [],          // ← empty: this is what makes it a scaffold
}
```

To activate it, add real weeks to the `weeks: []` array following the **W1 shape**. Once a milestone has weeks, its `estHours`/`components`/`judgment` summary is replaced by the real week breakdown, and the planned-hours math switches from the estimate to the sum of the weeks' hours — automatically.

**A week template** (copy, then edit — give every new task/log a fresh unique ID):

```ts
{
  id: "m2.w1",
  no: "W1",
  name: "Walking the file format",
  hours: 8,
  goal: "By Sunday you can open a real SQLite file, find the page header, and walk the B-tree to a row.",
  components: [
    {
      track: "build",
      title: "Build Your Own SQLite — stages 1–3",
      detail: "Read the header, parse the schema table, run a count(*).",
      source: "codecrafters.io · SQLite track",
    },
    { track: "systems", title: "DDIA — Ch. 3 (B-trees)", detail: "Why B-trees win on reads." },
    { track: "foundations", title: "NeetCode — Binary Search", detail: "15 min daily." },
  ],
  tasks: [
    { id: "m2.w1.mon", day: "Mon", label: "Parse the 100-byte database header" },
    { id: "m2.w1.wed", day: "Wed", label: "Walk the schema B-tree; DDIA Ch.3" },
    { id: "m2.w1.sat", day: "Sat", label: "Indexed lookup + write the decision log" },
  ],
  log: {
    id: "m2.w1.log",
    prompt: "“B-tree vs LSM for this workload: which I'd reach for, and the read/write ratio that flips it.”",
  },
}
```

Field reference (from `src/data/roadmap.ts`):
- `components[]` — the build / systems / foundations rows. `track` must be `"build" | "systems" | "foundations"`. Optional `detail` and `source`.
- `tasks[]` — the checkable daily rhythm. `id` (stable), optional `day`, `label`.
- `log` — the weekly decision log: `id` (stable), `prompt`, optional `intro`.
- A week can omit `tasks`/`components`/`log` to stay a goal-only stub (like M1's W3/W4).

After editing: the page rebuilds at deploy, and the new task/log IDs become checkable. Existing checked state is preserved (because you only *added* IDs).

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
| `src/data/roadmap.ts` | **The content.** Milestones, weeks, tasks, logs. Edit this to change the plan. |
| `src/pages/roadmap.astro` | The page + all styling (the four-thread palette + layout). |
| `src/components/roadmap/*.astro` | Milestone / Week / TaskList / DecisionLog / Dashboard pieces. |
| `src/scripts/roadmap.ts` | Client logic: loads progress, edit mode, auto-save. |
| `netlify/functions/progress.ts` + `netlify/lib/handlers/progress.ts` | The API: public GET, token-gated POST, stores to Blobs. |
| `.env` (local, gitignored) / Netlify env vars | `ROADMAP_ADMIN_TOKEN`. |

Design rationale and the full build plan are archived in `docs/superpowers/specs/2026-06-13-roadmap-page-design.md` and `docs/superpowers/plans/2026-06-13-roadmap-page.md` if you ever want the "why."

---

## TL;DR

- **Did a task / wrote a log?** → `/roadmap` → Edit → enter token → check the box. Auto-saves, shared, persists.
- **Want to change the plan / add weeks?** → edit `src/data/roadmap.ts` (never reuse or change an existing `id`), commit, push.
- **Run it locally?** → `netlify dev` with `ROADMAP_ADMIN_TOKEN` in a root `.env`.
