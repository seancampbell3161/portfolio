# Two-phase Decision Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each roadmap decision log into a predict-before → confront-after artifact: real prose stored per log, shown collapsed by default and expandable, with a status/verdict pill.

**Architecture:** Additive `version: 2` blob field (`logEntries` keyed by log ID) persisted through the existing Netlify Blobs progress API; the hand-rolled handler gains validation for the new field; `DecisionLog.astro` becomes a `<details>` reusing the existing `.rm-log` tokens; the vanilla-TS client island hydrates/saves the prose. The `completed[]` array and `deriveStats` are untouched — the "Logged" checkbox still drives the `logsDone` stat (decision A).

**Tech Stack:** Astro 5 (static + Netlify adapter), TypeScript, Netlify Blobs, Vitest.

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-07-06-decision-log-two-phase-design.md`. Every task's requirements implicitly include these.

- **Blob v2 is additive.** Readers default a missing `logEntries` to `{}`; no migration job — the first v2 write upgrades in place.
- **`completed[]` semantics and `deriveStats` are UNCHANGED.** `logsDone` still derives from `completed`; the "Logged" checkbox still drives it (decision A). Do not modify `deriveStats` or its tests.
- **Validation caps:** `prediction` and `confrontation` are strings ≤ **4000 chars** each; `confidence` is an integer **0–100** or `null`; `verdict` is one of `"right" | "partly" | "wrong"` or `null`.
- **Unknown `logEntries` keys** (not a known log ID) → `400`.
- **Entirely-empty entries** (all fields empty/null) are dropped before persisting and never stored.
- **XSS:** stored prose is written to the DOM ONLY via `textContent` / input `.value` — never `innerHTML`.
- **Single writer, last-write-wins.** The admin token stays server-side and never enters the client bundle.
- **`LogEntry` type is defined once** in `src/data/roadmap.ts` and imported by both the server (`netlify/lib`) and the client (`src/scripts`).
- **Test command:** `npm test` (runs `vitest run`). **Build/type check:** `npm run build`.
- **Every commit message ends with the trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

- `src/data/roadmap.ts` — **Modify.** Add exported `LogEntry` interface (single source of truth); export the existing `logIds`.
- `netlify/lib/roadmap-store.ts` — **Modify.** Re-export `LogEntry`; bump `ProgressBlob` to `version: 2` with `logEntries`.
- `netlify/lib/handlers/progress.ts` — **Modify.** Add `validLogIds` to `ProgressDeps`; GET returns `logEntries`; POST validates and persists `logEntries`.
- `netlify/functions/progress.ts` — **Modify.** Pass `validLogIds: new Set(logIds)`.
- `netlify/lib/__tests__/handlers/progress.test.ts` — **Modify.** Update existing expectations to v2; add read/write `logEntries` tests.
- `src/components/roadmap/DecisionLog.astro` — **Rewrite.** `<details>` with two phases + controls + hydration hooks.
- `src/pages/roadmap.astro` — **Modify.** Add global CSS for the new decision-log elements.
- `src/scripts/roadmap.ts` — **Modify.** Hydrate/render/save `logEntries`; derive the status pill.

---

## Task 1: Blob v2 schema + read path

**Files:**
- Modify: `src/data/roadmap.ts` (add `LogEntry`; export `logIds` at line 236)
- Modify: `netlify/lib/roadmap-store.ts:3-7`
- Modify: `netlify/lib/handlers/progress.ts:4-9,18-24,48-54`
- Modify: `netlify/functions/progress.ts:3,11`
- Test: `netlify/lib/__tests__/handlers/progress.test.ts`

**Interfaces:**
- Produces: `LogEntry { prediction: string; confidence: number | null; confrontation: string; verdict: "right"|"partly"|"wrong"|null }` (exported from `src/data/roadmap.ts`, re-exported from `roadmap-store.ts`).
- Produces: `ProgressBlob { version: 2; updatedAt: string; completed: string[]; logEntries: Record<string, LogEntry> }`.
- Produces: `ProgressDeps.validLogIds: Set<string>`.
- Produces: `GET /api/progress` → `{ completed, logEntries, updatedAt }`.

- [ ] **Step 1: Add the `LogEntry` type and export `logIds` in `src/data/roadmap.ts`**

Add the interface next to the existing `DecisionLog` interface (after line 12):

```ts
export interface LogEntry {
  prediction: string;
  confidence: number | null; // integer 0–100
  confrontation: string;
  verdict: "right" | "partly" | "wrong" | null;
}
```

Change line 236 from `const logIds = ...` to export it:

```ts
export const logIds = build.flatMap((m) => (m.logs ?? []).map((l) => l.id));
```

- [ ] **Step 2: Bump the blob schema in `netlify/lib/roadmap-store.ts`**

Replace lines 3–7 (`import` line stays at top; add the re-export and the new fields):

```ts
import { getStore } from "@netlify/blobs";
import type { LogEntry } from "../../src/data/roadmap.js";

export type { LogEntry };

export interface ProgressBlob {
  version: 2;
  updatedAt: string; // ISO
  completed: string[]; // task & log IDs
  logEntries: Record<string, LogEntry>; // decision-log prose, keyed by log ID
}
```

- [ ] **Step 3: Add `validLogIds` to deps and return `logEntries` from GET in `netlify/lib/handlers/progress.ts`**

Update the `ProgressDeps` interface (lines 4–9) to add `validLogIds`:

```ts
export interface ProgressDeps {
  store: RoadmapStore;
  token: string; // expected admin token (from env)
  validIds: Set<string>; // allowlist for `completed` (all IDs)
  validLogIds: Set<string>; // allowlist for `logEntries` keys (log IDs only)
  clock: () => Date;
}
```

Update the GET branch (lines 18–24) to include `logEntries`:

```ts
  if (req.method === "GET") {
    const blob = await deps.store.getProgress();
    return json(200, {
      completed: blob?.completed ?? [],
      logEntries: blob?.logEntries ?? {},
      updatedAt: blob?.updatedAt ?? null,
    });
  }
```

Update the POST blob construction (lines 48–52) to write v2 with an empty map for now (validation lands in Task 2):

```ts
    const blob: ProgressBlob = {
      version: 2,
      updatedAt: deps.clock().toISOString(),
      completed: [...new Set(completed)],
      logEntries: {},
    };
```

- [ ] **Step 4: Wire `validLogIds` in `netlify/functions/progress.ts`**

Replace the import (line 3) and the deps object (add line after `validIds`):

```ts
import { allIds, logIds } from "../../src/data/roadmap.js";
```

```ts
  handleProgress(req, {
    store: blobsRoadmapStore(),
    token,
    validIds: allIds,
    validLogIds: new Set(logIds),
    clock: () => new Date(),
  });
```

- [ ] **Step 5: Update the test harness and write the failing read-path tests**

In `netlify/lib/__tests__/handlers/progress.test.ts`, add a `validLogIds` constant next to `validIds` (line 20) and include it in the `deps()` helper (line 23):

```ts
const validIds = new Set(["m1.w1.mon", "m1.w1.log", "m1.w2.wed"]);
const validLogIds = new Set(["m1.w1.log"]);

function deps(over: Partial<ProgressDeps> = {}): ProgressDeps {
  return { store: fakeStore(), token: "secret", validIds, validLogIds, clock, ...over };
}
```

Update the two existing GET expectations to include `logEntries: {}`:

```ts
  it("returns empty state when no blob exists", async () => {
    const res = await handleProgress(get(), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: [], logEntries: {}, updatedAt: null });
  });

  it("returns stored progress when present", async () => {
    const store = fakeStore({
      version: 2,
      updatedAt: "2026-06-01T00:00:00.000Z",
      completed: ["m1.w1.mon"],
      logEntries: {},
    });
    const res = await handleProgress(get(), deps({ store }));
    expect(await res.json()).toEqual({
      completed: ["m1.w1.mon"],
      logEntries: {},
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  });
```

Update the POST-success blob assertion (was `version: 1`, no `logEntries`) to v2:

```ts
    expect(store.current()).toEqual({
      version: 2,
      updatedAt: "2026-06-13T12:00:00.000Z",
      completed: ["m1.w1.mon", "m1.w1.log"],
      logEntries: {},
    });
```

Add a new describe block for the read path of `logEntries` (v1 back-compat and stored entries):

```ts
describe("handleProgress GET logEntries", () => {
  it("returns stored logEntries", async () => {
    const store = fakeStore({
      version: 2,
      updatedAt: "2026-06-01T00:00:00.000Z",
      completed: [],
      logEntries: {
        "m1.w1.log": { prediction: "RESP", confidence: 60, confrontation: "", verdict: null },
      },
    });
    const res = await handleProgress(get(), deps({ store }));
    const out = await res.json();
    expect(out.logEntries).toEqual({
      "m1.w1.log": { prediction: "RESP", confidence: 60, confrontation: "", verdict: null },
    });
  });

  it("defaults a v1 blob (no logEntries) to an empty map", async () => {
    const store = fakeStore({
      version: 1,
      updatedAt: "2026-06-01T00:00:00.000Z",
      completed: ["m1.w1.mon"],
    } as unknown as ProgressBlob);
    const res = await handleProgress(get(), deps({ store }));
    const out = await res.json();
    expect(out.logEntries).toEqual({});
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all `progress.test.ts` tests green, including the two new `GET logEntries` cases.

- [ ] **Step 7: Commit**

```bash
git add src/data/roadmap.ts netlify/lib/roadmap-store.ts netlify/lib/handlers/progress.ts netlify/functions/progress.ts netlify/lib/__tests__/handlers/progress.test.ts
git commit -m "feat(roadmap): blob v2 logEntries schema + GET read path

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: POST validation for `logEntries`

**Files:**
- Modify: `netlify/lib/handlers/progress.ts` (import `LogEntry`; add `validateLogEntries`; integrate into POST)
- Test: `netlify/lib/__tests__/handlers/progress.test.ts`

**Interfaces:**
- Consumes: `ProgressDeps.validLogIds`, `LogEntry`, `ProgressBlob` (from Task 1).
- Produces: `POST` accepts `{ completed: string[]; logEntries?: Record<string, LogEntry> }`; stores validated, empty-dropped entries; rejects invalid input with `400`.

- [ ] **Step 1: Write the failing validation tests**

Add a new describe block to `progress.test.ts`:

```ts
describe("handleProgress POST logEntries", () => {
  const okEntry = { prediction: "RESP over JSON", confidence: 60, confrontation: "", verdict: null };

  it("persists a valid logEntries map and round-trips via GET", async () => {
    const store = fakeStore();
    const res = await handleProgress(
      post({ completed: [], logEntries: { "m1.w1.log": okEntry } }, "Bearer secret"),
      deps({ store }),
    );
    expect(res.status).toBe(200);
    expect(store.current()?.logEntries).toEqual({ "m1.w1.log": okEntry });
  });

  it("rejects an unknown log-id key with 400", async () => {
    const res = await handleProgress(
      post({ completed: [], logEntries: { "m1.w1.mon": okEntry } }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects over-length prose with 400", async () => {
    const long = { ...okEntry, prediction: "x".repeat(4001) };
    const res = await handleProgress(
      post({ completed: [], logEntries: { "m1.w1.log": long } }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range confidence with 400", async () => {
    const bad = { ...okEntry, confidence: 150 };
    const res = await handleProgress(
      post({ completed: [], logEntries: { "m1.w1.log": bad } }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid verdict with 400", async () => {
    const bad = { ...okEntry, verdict: "maybe" };
    const res = await handleProgress(
      post({ completed: [], logEntries: { "m1.w1.log": bad } }, "Bearer secret"),
      deps(),
    );
    expect(res.status).toBe(400);
  });

  it("drops an entirely-empty entry before persisting", async () => {
    const store = fakeStore();
    const empty = { prediction: "", confidence: null, confrontation: "", verdict: null };
    await handleProgress(
      post({ completed: [], logEntries: { "m1.w1.log": empty } }, "Bearer secret"),
      deps({ store }),
    );
    expect(store.current()?.logEntries).toEqual({});
  });

  it("still accepts a POST with no logEntries field", async () => {
    const store = fakeStore();
    const res = await handleProgress(post({ completed: [] }, "Bearer secret"), deps({ store }));
    expect(res.status).toBe(200);
    expect(store.current()?.logEntries).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — the unknown-key/over-length/confidence/verdict cases return `200` (no validation yet) and the round-trip stores `{}` instead of the entry.

- [ ] **Step 3: Add the validation helper and wire it into POST**

In `netlify/lib/handlers/progress.ts`, extend the import (line 2) to include `LogEntry`:

```ts
import type { ProgressBlob, LogEntry, RoadmapStore } from "../roadmap-store.js";
```

Add these above `handleProgress` (after the `json` helper):

```ts
const MAX_PROSE = 4000;
const VERDICTS = new Set(["right", "partly", "wrong"]);

type LogEntriesResult =
  | { ok: true; value: Record<string, LogEntry> }
  | { ok: false };

function validateLogEntries(raw: unknown, validLogIds: Set<string>): LogEntriesResult {
  if (raw === undefined) return { ok: true, value: {} };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false };

  const out: Record<string, LogEntry> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!validLogIds.has(id)) return { ok: false };
    if (typeof v !== "object" || v === null || Array.isArray(v)) return { ok: false };
    const e = v as Record<string, unknown>;

    const prediction = e.prediction ?? "";
    const confrontation = e.confrontation ?? "";
    const confidence = e.confidence ?? null;
    const verdict = e.verdict ?? null;

    if (typeof prediction !== "string" || prediction.length > MAX_PROSE) return { ok: false };
    if (typeof confrontation !== "string" || confrontation.length > MAX_PROSE) return { ok: false };
    if (
      confidence !== null &&
      (typeof confidence !== "number" || !Number.isInteger(confidence) || confidence < 0 || confidence > 100)
    ) {
      return { ok: false };
    }
    if (verdict !== null && (typeof verdict !== "string" || !VERDICTS.has(verdict))) return { ok: false };

    // drop entirely-empty entries so the blob never stores blanks
    if (prediction === "" && confrontation === "" && confidence === null && verdict === null) continue;

    out[id] = {
      prediction,
      confidence: confidence as number | null,
      confrontation,
      verdict: verdict as LogEntry["verdict"],
    };
  }
  return { ok: true, value: out };
}
```

In the POST branch, after the `completed` unknown-ID check (line 46) and before the blob construction, add:

```ts
    const logResult = validateLogEntries((body as { logEntries?: unknown })?.logEntries, deps.validLogIds);
    if (!logResult.ok) {
      return json(400, { error: "invalid logEntries" });
    }
```

Change the blob's `logEntries: {}` to `logEntries: logResult.value`:

```ts
    const blob: ProgressBlob = {
      version: 2,
      updatedAt: deps.clock().toISOString(),
      completed: [...new Set(completed)],
      logEntries: logResult.value,
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all `POST logEntries` cases green, no regressions elsewhere.

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/handlers/progress.ts netlify/lib/__tests__/handlers/progress.test.ts
git commit -m "feat(roadmap): validate & persist logEntries on POST

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `DecisionLog.astro` component + styles

No unit tests exist for Astro components in this repo; this task is verified by a successful build and a visual check. Props stay `{ log }`, so the `Milestone.astro:39` call site (`<DecisionLog log={log} />`) is unchanged.

**Files:**
- Rewrite: `src/components/roadmap/DecisionLog.astro`
- Modify: `src/pages/roadmap.astro` (add CSS inside the existing `<style is:global>` at line 70)

**Interfaces:**
- Produces DOM hooks the client island (Task 4) consumes: `<details data-log-id>`, `[data-log-status]`, `[data-log-field="prediction|confidence|confrontation|verdict"]` (each also carrying `data-log-id`), and the existing `input[data-id]` "Logged" checkbox.

- [ ] **Step 1: Rewrite `src/components/roadmap/DecisionLog.astro`**

```astro
---
import type { DecisionLog } from "../../data/roadmap";

interface Props {
  log: DecisionLog;
}

const { log } = Astro.props;
---

<details class="rm-log" data-log-id={log.id}>
  <summary class="rm-log-summary">
    <span class="rm-dot d-judgment"></span>
    <span class="rm-log-prompt">{log.prompt}</span>
    <span class="rm-log-status is-none" data-log-status>not started</span>
    <span class="rm-log-chev" aria-hidden="true">▸</span>
  </summary>

  <div class="rm-log-body">
    {log.intro && <p class="rm-log-intro">{log.intro}</p>}

    <div class="rm-phase">
      <div class="rm-phase-label">
        <span class="rm-phase-num">1</span>Prediction
        <span class="rm-phase-when">— before you read the answer</span>
      </div>
      <textarea
        class="rm-prose"
        data-log-field="prediction"
        data-log-id={log.id}
        rows="3"
        placeholder="Commit your call before the build…"
        disabled></textarea>
      <div class="rm-phase-meta">
        <label class="rm-field-label">
          confidence
          <input
            class="rm-conf"
            type="number"
            min="0"
            max="100"
            step="1"
            data-log-field="confidence"
            data-log-id={log.id}
            disabled />
          <span aria-hidden="true">%</span>
        </label>
      </div>
    </div>

    <div class="rm-phase">
      <div class="rm-phase-label">
        <span class="rm-phase-num">2</span>Confrontation
        <span class="rm-phase-when">— after the build</span>
      </div>
      <textarea
        class="rm-prose"
        data-log-field="confrontation"
        data-log-id={log.id}
        rows="3"
        placeholder="What actually happened? Where were you wrong?"
        disabled></textarea>
      <div class="rm-phase-meta">
        <label class="rm-field-label">
          verdict
          <select class="rm-verdict" data-log-field="verdict" data-log-id={log.id} disabled>
            <option value="">—</option>
            <option value="right">right</option>
            <option value="partly">partly</option>
            <option value="wrong">wrong</option>
          </select>
        </label>
      </div>
    </div>

    <label class="rm-mark" for={log.id}>
      <input type="checkbox" id={log.id} data-id={log.id} disabled />
      <span>Logged</span>
    </label>
  </div>
</details>
```

- [ ] **Step 2: Replace the decision-log CSS in `src/pages/roadmap.astro`**

Inside the `<style is:global>` block, replace the existing `.rm-log` / `.rm-log-head` / `.rm-log-intro` / `.rm-log-prompt` rules (roadmap.astro lines ~388–414, from the `/* ---- decision log (the signature) ---- */` comment through the `.rm-log-prompt { … }` rule) with the block below. Keep the existing `.rm-mark` rules that follow it.

```css
  /* ---- decision log (the signature) ---- */
  .rm-log {
    margin-top: 16px;
    border: 1px dashed color-mix(in srgb, var(--judgment) 45%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--judgment) 6%, transparent);
    overflow: hidden;
  }
  .rm-log[open] {
    background: color-mix(in srgb, var(--judgment) 9%, transparent);
  }
  .rm-log-summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 13px 15px;
  }
  .rm-log-summary::-webkit-details-marker { display: none; }
  .rm-log-prompt {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--color-text-primary);
    font-weight: 500;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rm-log[open] .rm-log-prompt {
    white-space: normal;
    font-style: italic;
    border-left: 2px solid var(--judgment);
    padding-left: 12px;
  }
  .rm-log-status {
    flex: none;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    border-radius: var(--radius-full);
    padding: 2px 9px;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }
  .rm-log-status.is-predicted { color: var(--judgment); border-color: color-mix(in srgb, var(--judgment) 35%, transparent); text-transform: none; }
  .rm-log-status.is-right { color: var(--reading); border-color: color-mix(in srgb, var(--reading) 40%, transparent); }
  .rm-log-status.is-partly { color: #e0b45f; border-color: color-mix(in srgb, #e0b45f 40%, transparent); }
  .rm-log-status.is-wrong { color: #d98b8b; border-color: color-mix(in srgb, #d98b8b 40%, transparent); }
  .rm-log-status.is-none { color: var(--color-text-faint); }
  .rm-log-chev {
    flex: none;
    color: var(--color-text-muted);
    font-size: 11px;
    transition: transform var(--transition-base);
  }
  @media (prefers-reduced-motion: reduce) { .rm-log-chev { transition: none; } }
  .rm-log[open] .rm-log-chev { transform: rotate(90deg); }
  .rm-log-summary:focus-visible { outline: 2px solid var(--judgment); outline-offset: 2px; }

  .rm-log-body {
    padding: 4px 15px 15px;
    border-top: 1px dashed color-mix(in srgb, var(--judgment) 25%, transparent);
  }
  .rm-log-intro { margin: 12px 0 0; font-size: 13.5px; color: var(--color-text-secondary); }
  .rm-phase { margin-top: 14px; }
  .rm-phase-label {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 7px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .rm-phase-num {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-full);
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: var(--color-bg);
    background: var(--judgment);
  }
  .rm-phase-when { color: var(--color-text-muted); text-transform: none; letter-spacing: 0; }
  .rm-prose {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font: inherit;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-primary);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 9px 11px;
  }
  .rm-prose:disabled { color: var(--color-text-secondary); resize: none; opacity: 1; -webkit-text-fill-color: var(--color-text-secondary); }
  .rm-prose:focus-visible { outline: none; border-color: color-mix(in srgb, var(--judgment) 50%, transparent); }
  .rm-phase-meta { margin-top: 7px; }
  .rm-field-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }
  .rm-conf { width: 54px; }
  .rm-conf, .rm-verdict {
    font: inherit;
    font-size: 11px;
    color: var(--color-text-primary);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 3px 7px;
  }
  .rm-conf:disabled, .rm-verdict:disabled { color: var(--color-text-secondary); -webkit-text-fill-color: var(--color-text-secondary); }
```

- [ ] **Step 3: Build to verify the component and CSS compile**

Run: `npm run build`
Expected: PASS — build completes, no Astro/TS errors, `/roadmap` prerenders.

- [ ] **Step 4: Visual check**

Run: `netlify dev` and open `/roadmap`. Confirm each decision log renders as a collapsed dashed row (prompt + "not started" pill + chevron), and clicking a row expands it to reveal the two phases, the disabled textareas/controls, and the "Logged" checkbox. (Read-only state — controls are disabled until Task 4 wires edit mode.)

- [ ] **Step 5: Commit**

```bash
git add src/components/roadmap/DecisionLog.astro src/pages/roadmap.astro
git commit -m "feat(roadmap): collapsible two-phase decision-log component + styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Client island — hydrate, edit, save

Verified end-to-end via `netlify dev` (no client-side unit tests in this repo). Reuses the existing token/debounce/optimistic-revert machinery in `src/scripts/roadmap.ts`.

**Files:**
- Modify: `src/scripts/roadmap.ts`

**Interfaces:**
- Consumes: `GET/POST /api/progress` `logEntries` (Tasks 1–2); the `[data-log-id]` / `[data-log-field]` / `[data-log-status]` DOM hooks (Task 3); `LogEntry` type from `src/data/roadmap.ts`.

- [ ] **Step 1: Import `LogEntry` and add module state**

At the top of `src/scripts/roadmap.ts`, extend the import and add a state object below the existing `const completed`:

```ts
import { deriveStats } from "../data/roadmap";
import type { LogEntry } from "../data/roadmap";
```

```ts
const completed = new Set<string>();
const logEntries: Record<string, LogEntry> = {};
```

- [ ] **Step 2: Add status derivation + a `renderLogs` function**

Add above `render()`:

```ts
function statusFor(e: LogEntry | undefined): { text: string; cls: string } {
  if (!e || (!e.prediction && !e.confrontation)) return { text: "not started", cls: "is-none" };
  if (e.confrontation) {
    if (e.verdict) return { text: e.verdict, cls: `is-${e.verdict}` };
    return { text: "confronted", cls: "is-partly" };
  }
  const conf = e.confidence == null ? "" : ` · ${e.confidence}%`;
  return { text: `predicted${conf}`, cls: "is-predicted" };
}

function applyStatus(details: HTMLElement, e: LogEntry | undefined) {
  const status = details.querySelector<HTMLElement>("[data-log-status]");
  if (!status) return;
  const s = statusFor(e);
  status.textContent = s.text; // textContent — never innerHTML
  status.className = `rm-log-status ${s.cls}`;
}

function renderLogs() {
  for (const details of document.querySelectorAll<HTMLElement>("[data-log-id]")) {
    const id = details.dataset.logId!;
    const e = logEntries[id];
    const pred = details.querySelector<HTMLTextAreaElement>('[data-log-field="prediction"]');
    const conf = details.querySelector<HTMLInputElement>('[data-log-field="confidence"]');
    const conf2 = details.querySelector<HTMLTextAreaElement>('[data-log-field="confrontation"]');
    const verd = details.querySelector<HTMLSelectElement>('[data-log-field="verdict"]');
    if (pred) pred.value = e?.prediction ?? "";
    if (conf) conf.value = e?.confidence == null ? "" : String(e.confidence);
    if (conf2) conf2.value = e?.confrontation ?? "";
    if (verd) verd.value = e?.verdict ?? "";
    applyStatus(details, e);
  }
}
```

- [ ] **Step 3: Call `renderLogs()` from `render()`**

At the end of the existing `render()` function (after the `perBook` loop), add:

```ts
  renderLogs();
```

- [ ] **Step 4: Populate `logEntries` in `load()`**

In `load()`, widen the parsed type and populate the map before `render()`:

```ts
async function load() {
  try {
    const res = await fetch(API);
    const data = (await res.json()) as {
      completed?: string[];
      logEntries?: Record<string, LogEntry>;
    };
    completed.clear();
    for (const id of data.completed ?? []) completed.add(id);
    for (const key of Object.keys(logEntries)) delete logEntries[key];
    for (const [id, e] of Object.entries(data.logEntries ?? {})) logEntries[id] = e;
  } catch {
    // leave as-is; render shows zeros on first failure
  }
  render();
}
```

- [ ] **Step 5: Enable log fields in edit mode**

In `setEditable()`, after the `boxes()` loop, also toggle the log-field controls:

```ts
function setEditable(on: boolean) {
  editing = on;
  for (const box of boxes()) box.disabled = !on;
  for (const f of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("[data-log-field]")) {
    f.disabled = !on;
  }
  document.querySelector(".roadmap-page")?.classList.toggle("rm-editing", on);
  const btn = document.getElementById("rm-edit");
  if (btn) btn.textContent = on ? "Done" : "Edit";
}
```

- [ ] **Step 6: Handle field edits and add the serializer**

Add a change handler and a serializer (above `init()`):

```ts
function onLogFieldChange(event: Event) {
  const el = event.target as HTMLElement;
  if (!el.matches?.("[data-log-field]") || !editing) return;
  const details = el.closest<HTMLElement>("[data-log-id]");
  if (!details) return;
  const id = details.dataset.logId!;
  const cur: LogEntry = logEntries[id] ?? {
    prediction: "",
    confidence: null,
    confrontation: "",
    verdict: null,
  };
  const field = el.dataset.logField;
  if (field === "prediction") cur.prediction = (el as HTMLTextAreaElement).value;
  else if (field === "confrontation") cur.confrontation = (el as HTMLTextAreaElement).value;
  else if (field === "confidence") {
    const v = (el as HTMLInputElement).value.trim();
    cur.confidence = v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v))));
  } else if (field === "verdict") {
    const v = (el as HTMLSelectElement).value;
    cur.verdict = v === "" ? null : (v as LogEntry["verdict"]);
  }
  logEntries[id] = cur;
  applyStatus(details, cur);
  scheduleSave();
}

function serializableLogEntries(): Record<string, LogEntry> {
  const out: Record<string, LogEntry> = {};
  for (const [id, e] of Object.entries(logEntries)) {
    if (!e.prediction && !e.confrontation && e.confidence == null && !e.verdict) continue;
    out[id] = e;
  }
  return out;
}
```

- [ ] **Step 7: Send `logEntries` in `save()`**

In `save()`, change the POST body to include the serialized entries:

```ts
      body: JSON.stringify({ completed: [...completed], logEntries: serializableLogEntries() }),
```

- [ ] **Step 8: Register the field listeners in `init()`**

In `init()`, after the existing `change` listener registration, add both `input` and `change` (textareas/number fire `input`; the select fires `change`):

```ts
  document.addEventListener("input", onLogFieldChange);
  document.addEventListener("change", onLogFieldChange);
```

- [ ] **Step 9: Build to verify it compiles**

Run: `npm run build`
Expected: PASS — no TS errors.

- [ ] **Step 10: End-to-end verification**

Run: `netlify dev` and open `/roadmap` (ensure `ROADMAP_ADMIN_TOKEN` is set in `.env`). Then:
1. Click **Edit**, enter the token → a decision log's textareas/controls become editable.
2. Type a prediction + set confidence → the collapsed pill shows `predicted · NN%`; wait for "Saved".
3. Reload the page → the prediction, confidence, and pill persist (read-only).
4. Edit again, add a confrontation + pick a verdict → the pill switches to the verdict (e.g. `partly`); reload confirms it persisted.
5. Confirm the "Logged" checkbox still toggles and the dashboard `logs` count is unchanged in behavior.

- [ ] **Step 11: Commit**

```bash
git add src/scripts/roadmap.ts
git commit -m "feat(roadmap): hydrate, edit & persist two-phase decision logs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Don't touch `deriveStats` or its tests.** Completion for the `logs` stat stays on the `completed` array via the "Logged" checkbox (decision A). The `logEntries` prose is a parallel concern.
- **XSS discipline:** the only places stored prose reaches the DOM are `.value` assignments (textareas/inputs) and the status pill via `textContent`. Never introduce `innerHTML` for any stored string.
- **`netlify dev`, not `astro dev`:** Netlify Blobs and the function require the Netlify dev environment; `astro dev` alone will 500 on `/api/progress`.
- The debounced-save, token prompt, 401-revert, and optimistic-update flows already exist — reuse them; don't reimplement.
