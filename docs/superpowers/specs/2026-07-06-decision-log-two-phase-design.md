# Design — Two-phase decision logs (predict → confront)

**Date:** 2026-07-06
**Status:** Draft for review
**Builds on:** `docs/superpowers/specs/2026-06-14-roadmap-restructure-design.md` (roadmap v2, build-anchored). The infrastructure from v2 — Netlify Blobs progress store, token-gated edit mode, client island, design tokens, the `<details>` milestone/week pattern — is **kept and extended**. Only the decision-log surface changes.

---

## 1. Why we're building this

The roadmap's thesis is that engineering judgment is the one real skill, and the **decision log is the week's real artifact**. Today a decision log is a static `prompt` plus a single "Mark logged" checkbox — it records *that* a log happened, not *what was decided* or whether the call held up.

Judgment improves through one loop: **make the call in writing before you know the answer, then confront it against reality.** A single checkbox can't hold that loop. This change builds the predict-before → confront-after split into the page itself, so the ritual is structural rather than remembered, and the accumulated logs become the raw material for the M6 capstone writeup.

**Decided shape (validated with visual mockups):** each decision log stores real prose for both phases but stays **collapsed by default** — one tight row per log — and expands on click to reveal the full reasoning. The collapsed row carries a status/verdict pill, so scanning the track *is* a calibration record at a glance.

## 2. What changes (and what doesn't)

**Changes:** the blob schema (v1 → v2, additive), the `POST` validation in the progress handler, `DecisionLog.astro`, and the client island's load/render/save.

**Unchanged:** `completed[]` semantics, `deriveStats`, the `logsDone` stat and its tests, the token gate, the four-thread design tokens, the milestone/week `<details>` pattern, all roadmap **content** in `roadmap.ts`.

## 3. Data model — blob v2 (additive)

`ProgressBlob` (in `netlify/lib/roadmap-store.ts`) gains one field and bumps its version:

```ts
export interface LogEntry {
  prediction: string;                          // written before the build
  confidence: number | null;                   // integer 0–100
  confrontation: string;                       // written after the build
  verdict: "right" | "partly" | "wrong" | null;
}

export interface ProgressBlob {
  version: 2;
  updatedAt: string;                           // ISO
  completed: string[];                         // UNCHANGED — task IDs + "Logged" checkbox IDs
  logEntries: Record<string, LogEntry>;        // NEW — keyed by decision-log ID
}
```

- **Backward compatible.** A stored v1 blob has no `logEntries`; readers treat a missing map as `{}`. No migration job — the first v2 write upgrades the blob in place.
- **`completed` is untouched.** The "Logged" checkbox still adds/removes the log's ID in `completed`, so `deriveStats` and its tests need no changes (decision **A** from design review).
- **Prose-less entries are not stored.** An entry is only real if a phase has prose; one with no prediction and no confrontation text is omitted on save (a bare confidence or verdict without prose isn't a real entry). This keeps the status pill coherent — a confidence-only entry never persists as a phantom "not started" row — and the blob only grows with real content.

## 4. Content model — no change

`DecisionLog` stays `{ id: string; prompt: string; intro?: string }`. The `prompt` remains the static decision question. The two phase headings ("Prediction — before you read the answer", "Confrontation — after the build") are presentational constants in the component, not content. Nothing in `roadmap.ts` changes, so all existing log IDs and the `logIds` allowlist stay stable.

## 5. Component — `DecisionLog.astro` as a `<details>`

Reuses the `<details>`/`<summary>` pattern already used by milestones and weeks (free keyboard nav + a11y; `prefers-reduced-motion` already respected globally).

**Collapsed `<summary>`** (one row): judgment dot · prompt (ellipsis-truncated) · status/verdict pill · chevron marker (rotates on open; default marker hidden).

**Expanded body:**
- **Phase 1 — Prediction:** heading + a prose field + a confidence control (0–100).
- **Phase 2 — Confrontation:** heading + a prose field + a verdict control (right / partly / wrong).
- The existing **"Logged"** checkbox (`<input data-id={log.id}>`) — unchanged; drives the `logsDone` stat.

**Read-only default:** prose renders as static text, confidence/verdict/checkbox disabled — exactly like the current checkbox's read-only behavior. Fields become editable only in edit mode.

Markup carries stable hooks for the client: `data-log-id` on the `<details>`, and `data-field="prediction|confidence|confrontation|verdict"` on the controls, so the island can hydrate and read them without brittle selectors. Styling reuses the existing `.rm-log` tokens (dashed `--judgment` border, `--judgment` 6% background, JetBrains Mono labels).

## 6. Status pill — derived, never stored

Computed client-side from the entry (presentational only):

| State | Condition | Collapsed row shows |
|---|---|---|
| Not started | no `prediction` text | muted "not started" |
| Predicted | `prediction` set, no `confrontation` | `predicted · NN%` |
| Confronted | `confrontation` set | the `verdict` pill (right / partly / wrong) |

This is what turns the collapsed track into an at-a-glance calibration record.

## 7. API — extend the progress handler

`netlify/lib/handlers/progress.ts`, `POST` path. Body becomes `{ completed: string[]; logEntries?: Record<string, LogEntry> }`.

Validation (all failures → `400 { error }`, mirroring the existing unknown-ID rejection; the write is all-or-nothing):
- `logEntries`, if present, must be a plain object. Every **key must be a known log ID**. The handler's current `validIds` set holds *all* IDs (it validates `completed`, which may contain log IDs); log-entry keys need a **log-ID-only** allowlist, so add `validLogIds: Set<string>` to `ProgressDeps`, derived from `roadmap.ts`'s `logIds`. Unknown keys → reject.
- `prediction` and `confrontation`: strings, each **≤ 4000 chars** (blob-bloat guard — the same concern the original spec raised for `completed`).
- `confidence`: integer `0–100` or `null`.
- `verdict`: one of `"right" | "partly" | "wrong"` or `null`.
- Entries with no prose (empty `prediction` and `confrontation`) are dropped before persisting, regardless of `confidence`/`verdict`.

`GET` returns `logEntries` alongside `completed` and `updatedAt` (missing map → `{}`). The token gate, `updatedAt` stamping via `deps.clock()`, and the `version` field are handled exactly as today (version written as `2`).

## 8. Client island — `src/scripts/roadmap.ts`

- **On load (`load()`):** GET now also reads `logEntries`. For each log, populate the prose fields **via `textContent` / input `.value`, never `innerHTML`** (XSS-safe — the prose is owner-written but renders on a public page), set the confidence/verdict controls, and compute the status pill (§6).
- **Edit mode:** prose fields, confidence, and verdict become editable alongside the checkboxes. Editing any of them marks state dirty and triggers the **existing debounced save** (`SAVE_DEBOUNCE_MS`), which now serializes `{ completed, logEntries }`. The current optimistic-update / revert-on-error / clear-token-on-401 flow is reused unchanged.
- **Assembling `logEntries` for POST:** read the current field values into the map, dropping prose-less entries (same rule as the server) so we never persist bare metadata.
- Dashboard derivation is **unchanged** — `logsDone` still comes from `completed` via `deriveStats`.

## 9. Security & quality floor

- **XSS:** stored prose is injected only through `textContent` / `.value`. No `innerHTML` for any stored string.
- **Blob bloat:** per-field length caps + dropping prose-less entries + known-ID-only keys bound the blob's growth (single writer, last-write-wins).
- **Token secrecy:** write path stays token-gated; the token never enters the client bundle (unchanged).
- **A11y / responsive:** `<details>` gives keyboard + focus behavior for free; keep visible focus rings and the existing mobile reflow; `prefers-reduced-motion` already honored for the chevron transition.

## 10. Testing

Extend `netlify/lib/__tests__/handlers/progress.test.ts`:
- `POST` accepts a valid `logEntries` map and round-trips it via `GET`.
- Rejects an unknown log-ID key (`400`).
- Rejects over-length `prediction`/`confrontation` (`400`).
- Rejects out-of-range `confidence` and an invalid `verdict` (`400`).
- A v1 blob (no `logEntries`) reads back as `{ logEntries: {} }` without error.
- `completed`-only POSTs (no `logEntries`) still succeed — no regression.

`deriveStats` tests are intentionally untouched (decision A).

## 11. Definition of done

- [ ] Blob is v2; a pre-existing v1 blob loads and upgrades on first write with no data loss.
- [ ] Each decision log renders as a collapsed `<details>` with prompt + status/verdict pill; expands to full prediction + confrontation prose.
- [ ] Visitors see stored prose read-only; edit mode makes prose, confidence, and verdict editable and persists them.
- [ ] Status pill derives correctly across not-started / predicted / confronted.
- [ ] `POST` validates keys, lengths, confidence range, and verdict enum; the token never reaches the client.
- [ ] `logsDone` stat and `deriveStats` behavior are unchanged; the "Logged" checkbox still drives them.
- [ ] Stored prose is rendered only via `textContent` / `.value`.
- [ ] Handler tests above pass; keyboard-navigable, focus-visible, responsive, reduced-motion respected.

## 12. Non-goals / deferred

- **Per-visitor entries, accounts, versioned history** of a log's edits — out. Single writer, last-write-wins, as today.
- **Deriving completion from the verdict** (decision B) — deferred; the explicit "Logged" checkbox stays for now.
- **Static per-phase sub-prompts** in content — not needed; generic phase headings suffice.
- **Markdown/rich text** in prose — plain text only for v1.
