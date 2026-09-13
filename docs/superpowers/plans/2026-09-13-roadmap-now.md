# /roadmap/now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the roadmap's phase ribbon and move the current phase (its heading, build checkpoints and decision logs, and reading), the 2-hour day and the review deck from `/roadmap` to a new `/roadmap/now` page, linked from `/roadmap`.

**Architecture:** `/roadmap/now` server-renders a header and a pairings block for every phase and a build block for every milestone, all `hidden` except what `nowShowing(buildDay)` names. `src/scripts/roadmap-schedule.ts` re-picks them on load from the same pure function, so a stale deploy stays correct. Shared markup moves into components used by both pages (`RoadmapToolbar`, `MilestoneBuild`), and the page's global styles move into `src/styles/roadmap.css`. `src/scripts/roadmap.ts` and `review.ts` are unchanged: they already save the full progress set, so two editable pages cannot overwrite each other.

**Tech Stack:** Astro 5 (static, `<ClientRouter />`), TypeScript, Vitest (unit tests plus contract tests that read `dist/`), Playwright via plain Node scripts (`scripts/interactions.mjs`, `scripts/screenshots.mjs`).

**Spec:** `docs/superpowers/specs/2026-09-13-roadmap-now-design.md`

## Global Constraints

- No logic change to `src/scripts/roadmap.ts` or `src/scripts/review.ts`. Task 7 edits them temporarily to prove two checks can fail, and reverts before committing.
- No change to `netlify/`, to stored progress ids, or to the progress or review APIs.
- Every id and `data-*` hook the scripts read stays exactly as it is: `rm-edit`, `rm-message`, `rm-save-state`, `rm-clip-live`, the meter ids, `input[data-id]`, `data-log-*`, `data-milestone-pct`, `data-book-pct`, `data-clip-*`, and every `rv-*` id.
- New hooks, spelled exactly: `data-week-label` (existing name, now on both pages), `data-now-phase`, `data-phase-start`, `data-phase-milestone`, `data-now-milestone`, `data-now-outside`.
- Placeholder copy, used verbatim (the owner may rewrite it before merge):
  - `/roadmap/now` title: `Now — Learning Roadmap | Sean Campbell`
  - `/roadmap/now` description: `What I'm building, reading and drilling in this phase of my public learning roadmap, with live progress.`
  - `/roadmap/now` eyebrow: `A learning roadmap · right now`
  - `/roadmap/now` h1: `What I'm working on <em>now</em>`
  - `/roadmap/now` back link: `← The whole roadmap`
  - outside-the-plan line: `Nothing on the plan is running right now. <a href="/roadmap">See the whole roadmap</a>.`
  - `/roadmap` link line: `<span data-week-label>…</span> · What I'm working on now →`
  - the "now" chip's hidden text: ` · what I'm working on`
- Commits: `type(scope): subject` with an optional short body. Never add a `Co-Authored-By` trailer.
- Styles use the tokens in `src/styles/global.css` and the `--lane-*` and `--track-*` tokens. No new colours. The breakpoint is 900px.
- Commands: `npm run build`; `npm run check` (build, then the whole Vitest suite); `npx vitest run <file>`.
- `npm run e2e` and `npm run shots` need `npm run preview` serving the **latest** build on port 4321. Run the preview in the background, and stop and restart it after every `npm run build`.
- Comparison files go in `.superpowers/sdd/` (gitignored). Create it with `mkdir -p .superpowers/sdd`.

## File Structure

| File | Responsibility |
|---|---|
| `src/styles/roadmap.css` (new) | Every roadmap style, shared by both pages. Moved verbatim from `roadmap.astro`, then edited in Tasks 5 and 6. |
| `src/lib/roadmap/schedule.ts` | Gains `nowShowing(now)`: which phase and milestone `/roadmap/now` shows. |
| `src/components/roadmap/RoadmapToolbar.astro` (new) | Save state, Edit button, message line, live region; a slot for the zoom group. |
| `src/components/roadmap/MilestoneBuild.astro` (new) | A milestone's goal, dates and percent, checkpoints and decision logs; a slot between checkpoints and logs. |
| `src/components/roadmap/RoadmapNow.astro` (new) | The week label, 7 phase headers, 5 build blocks, 7 pairings blocks, the outside-the-plan line. |
| `src/pages/roadmap/now.astro` (new) | The `/roadmap/now` page. |
| `src/scripts/roadmap-schedule.ts` | Rewrites every week label and re-picks the revealed blocks, on any page. |
| `src/pages/roadmap.astro` | Loses the band, ribbon, Retention, routine and styles; gains the link line. |
| `src/components/roadmap/RoadmapArrangement.astro` | Renders `RoadmapToolbar`; the "now" chip and phone "now" row become links. |
| `src/components/roadmap/RoadmapInspector.astro` | The Build panel renders `MilestoneBuild`. |
| `src/__tests__/roadmap-now-contract.test.ts` (new) | Reads `dist/roadmap/now/index.html`. |
| `src/__tests__/roadmap-contract.test.ts` | Loses the band, ribbon and review deck checks; gains no-repeated-ids, absence and link checks. |
| `src/__tests__/transitions-contract.test.ts`, `src/lib/og.mjs`, `scripts/screenshots.mjs` | Each gains the new page. |
| `scripts/interactions.mjs` | The stale-visit block moves to `/roadmap/now`; new link, cross-page and one-instance checks. |
| Deleted | `src/components/roadmap/ThisWeek.astro`, `src/components/roadmap/RoadmapArc.astro` |

---

### Task 1: Move the roadmap's styles into `src/styles/roadmap.css`

A pure move. The built CSS must not change.

**Files:**
- Create: `src/styles/roadmap.css`
- Modify: `src/pages/roadmap.astro` (the `<style is:global>` block, lines 57–1093)

**Interfaces:**
- Consumes: nothing.
- Produces: `src/styles/roadmap.css`, imported with `<style is:global> @import "<relative path>/styles/roadmap.css"; </style>`. Tasks 5 and 6 edit it. After this task its rules sit at column 0, and rules inside `@media` blocks are indented two spaces.

- [ ] **Step 1: Record the built CSS and screenshots before the move**

```bash
mkdir -p .superpowers/sdd
npm run build
node -e '
const fs = require("fs");
const html = fs.readFileSync("dist/roadmap/index.html", "utf8");
const hrefs = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="([^"]+)")[^>]*>/g)].map((m) => m[1]);
const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const css = [...hrefs.map((h) => fs.readFileSync("dist" + h, "utf8")), ...inline].join("\n");
fs.writeFileSync(process.argv[1], css.replace(/}/g, "}\n"));
' .superpowers/sdd/roadmap-css-before.css
```

Restart `npm run preview`, then:

```bash
npm run shots
cp screenshots/roadmap-1280.png .superpowers/sdd/roadmap-1280-before.png
cp screenshots/roadmap-390.png .superpowers/sdd/roadmap-390-before.png
```

- [ ] **Step 2: Create `src/styles/roadmap.css` from the page's style block**

```bash
cat > src/styles/roadmap.css <<'EOF'
/* src/styles/roadmap.css
   The roadmap's styles, shared by /roadmap and /roadmap/now (roadmap-now spec
   §9). They were the <style is:global> block in src/pages/roadmap.astro and stay
   global: both pages render the components they style, and the client scripts
   restyle that markup by class. Imported the way Reader.astro imports
   reader.css. */

EOF
awk '/^<style is:global>$/{f=1;next} /^<\/style>$/{f=0} f' src/pages/roadmap.astro | sed 's/^  //' >> src/styles/roadmap.css
```

Check that it starts with the header comment followed by `/* ---- palette + page frame ----`, and ends with `.rm-practice ul { display: grid; gap: var(--space-sm); padding-left: 18px; font-size: 14px; }`:

```bash
sed -n 1,12p src/styles/roadmap.css && tail -2 src/styles/roadmap.css
```

- [ ] **Step 3: Replace the page's style block with the import**

```bash
node -e '
const fs = require("fs");
const f = "src/pages/roadmap.astro";
const src = fs.readFileSync(f, "utf8");
const out = src.replace(/<style is:global>[\s\S]*<\/style>\n/, "<style is:global>\n  @import \"../styles/roadmap.css\";\n</style>\n");
if (out === src) throw new Error("style block not found");
fs.writeFileSync(f, out);
'
tail -5 src/pages/roadmap.astro
```

Expected tail:

```astro
</script>

<style is:global>
  @import "../styles/roadmap.css";
</style>
```

- [ ] **Step 4: Confirm the built CSS is unchanged**

```bash
npm run build
node -e '
const fs = require("fs");
const html = fs.readFileSync("dist/roadmap/index.html", "utf8");
const hrefs = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="([^"]+)")[^>]*>/g)].map((m) => m[1]);
const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const css = [...hrefs.map((h) => fs.readFileSync("dist" + h, "utf8")), ...inline].join("\n");
fs.writeFileSync(process.argv[1], css.replace(/}/g, "}\n"));
' .superpowers/sdd/roadmap-css-after.css
diff .superpowers/sdd/roadmap-css-before.css .superpowers/sdd/roadmap-css-after.css && echo "CSS unchanged"
```

Expected: `CSS unchanged`. If `diff` prints anything, stop: a rule changed or moved relative to another, which can change the cascade. Find out why before going on.

- [ ] **Step 5: Confirm the page looks the same**

Restart `npm run preview`, then:

```bash
npm run shots
cmp screenshots/roadmap-1280.png .superpowers/sdd/roadmap-1280-before.png && cmp screenshots/roadmap-390.png .superpowers/sdd/roadmap-390-before.png && echo "pixels identical"
```

If `cmp` reports a difference, open both pairs of images and compare them by eye. The playhead can move by a fraction of a pixel between two builds on the same day. Any other visible difference is a regression.

- [ ] **Step 6: Run the suite**

Run: `npm run check`
Expected: every test file passes; the roadmap and transitions contract tests run (not skipped).

- [ ] **Step 7: Commit**

```bash
git add src/styles/roadmap.css src/pages/roadmap.astro
git commit -m "refactor(roadmap): move the roadmap's styles into src/styles/roadmap.css"
```

---

### Task 2: `nowShowing`, the phase and build `/roadmap/now` shows

**Files:**
- Modify: `src/lib/roadmap/schedule.ts` (after `currentPhase`)
- Test: `src/lib/roadmap/__tests__/schedule.test.ts`

**Interfaces:**
- Consumes: `currentPhase(now: Date): Phase | null` (existing); `Phase.milestone?: string` (the ramp has none).
- Produces: `export function nowShowing(now: Date): { phase: string | null; milestone: string | null }`. Tasks 5 and 6 call it from `RoadmapNow.astro` and `src/scripts/roadmap-schedule.ts`.

- [ ] **Step 1: Write the failing test**

In `src/lib/roadmap/__tests__/schedule.test.ts`, change the import line

```ts
import { weekOf, currentPhase, weekLabel, phaseSpanText } from "../schedule.js";
```

to

```ts
import { weekOf, currentPhase, weekLabel, phaseSpanText, nowShowing } from "../schedule.js";
```

and insert this block immediately before `describe("weekLabel", () => {`:

```ts
describe("nowShowing", () => {
  it("shows a phase and the milestone it builds", () => {
    expect(nowShowing(at("2026-09-09"))).toEqual({ phase: "m1", milestone: "redis" }); // W1
  });
  it("shows the ramp with no build, because the ramp has no milestone", () => {
    expect(nowShowing(at("2026-09-02"))).toEqual({ phase: "ramp", milestone: null });
  });
  it("shows Kafka's build for both M5 and the Capstone, which share it", () => {
    // Phases and milestones are not one to one. This is why /roadmap/now renders
    // build blocks per milestone rather than per phase (roadmap-now spec §6).
    expect(nowShowing(at("2026-12-16"))).toEqual({ phase: "m5", milestone: "kafka" }); // W15
    expect(nowShowing(at("2027-01-20"))).toEqual({ phase: "capstone", milestone: "kafka" }); // W20
  });
  it("shows nothing outside the plan", () => {
    expect(nowShowing(at("2026-08-20"))).toEqual({ phase: null, milestone: null });
    expect(nowShowing(at("2027-02-08"))).toEqual({ phase: null, milestone: null });
  });
});

```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/roadmap/__tests__/schedule.test.ts`
Expected: FAIL, the four `nowShowing` tests with `TypeError: nowShowing is not a function`; every other test passes.

- [ ] **Step 3: Implement**

In `src/lib/roadmap/schedule.ts`, insert immediately after the closing `}` of `currentPhase`:

```ts

/**
 * What /roadmap/now shows for `now`: the phase covering the week, and the build
 * milestone that phase drives. The ramp has no milestone, and outside the plan
 * there is neither. Pure, like weekLabel, so the page's server render and
 * src/scripts/roadmap-schedule.ts cannot disagree about which blocks show.
 */
export function nowShowing(now: Date): { phase: string | null; milestone: string | null } {
  const p = currentPhase(now);
  return { phase: p?.id ?? null, milestone: p?.milestone ?? null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/roadmap/__tests__/schedule.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roadmap/schedule.ts src/lib/roadmap/__tests__/schedule.test.ts
git commit -m "feat(roadmap): nowShowing names the phase and build /roadmap/now shows"
```

---

### Task 3: Lift the owner's controls into `RoadmapToolbar`

A pure move. The built `/roadmap` HTML must not change.

**Files:**
- Create: `src/components/roadmap/RoadmapToolbar.astro`
- Modify: `src/components/roadmap/RoadmapArrangement.astro` (frontmatter imports; lines 74–99, the toolbar, message and live region)

**Interfaces:**
- Consumes: nothing.
- Produces: `<RoadmapToolbar>` with a default slot, rendering `#rm-save-state`, `#rm-edit`, `#rm-message` and `#rm-clip-live`. Task 5 renders it on `/roadmap/now` with an empty slot.

- [ ] **Step 1: Record the built HTML before the move**

```bash
mkdir -p .superpowers/sdd
npm run build
node -e '
const fs = require("fs");
const html = fs.readFileSync("dist/roadmap/index.html", "utf8");
fs.writeFileSync(process.argv[1], html.replace(/--ph:[0-9.e-]+/g, "--ph:X").replace(/>\s*</g, ">\n<"));
' .superpowers/sdd/roadmap-html-before.html
```

(`--ph` is the playhead's position, computed from the build time, so it is masked.)

- [ ] **Step 2: Create `src/components/roadmap/RoadmapToolbar.astro`**

```astro
---
// The owner's controls (roadmap-now spec §7): the save state, the Edit button,
// the message line, and the live region that speaks each edit. /roadmap renders
// it through RoadmapArrangement, which passes its zoom group into the slot;
// /roadmap/now renders it with an empty slot. The ids are a contract with
// src/scripts/roadmap.ts and src/scripts/review.ts — do not rename them.
---

<div class="rm-toolbar">
  <slot />
  <span id="rm-save-state" class="rm-save-state" role="status" aria-live="polite"></span>
  <button id="rm-edit" type="button" class="rm-edit-btn">Edit</button>
</div>
<p id="rm-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>

{/* Ticking a checkbox silently rewrites counts and status fills that a sighted
    reader watches change and a screen-reader user cannot. This is the spoken
    half of that repaint (the sentence itself is progressAnnouncement in
    src/lib/roadmap/arrange.ts). It is server-rendered empty so the region is
    already in the accessibility tree when the first edit writes into it. On
    /roadmap it sits outside .rm-arr, which is display:none below 900px: edit
    mode works at every width, so its announcements must too. */}
<p id="rm-clip-live" class="sr-only" role="status" aria-live="polite"></p>
```

- [ ] **Step 3: Render it from `RoadmapArrangement.astro`**

In the frontmatter, after `import { monthDayYear, monthYear } from "../../lib/dates";`, add:

```ts
import RoadmapToolbar from "./RoadmapToolbar.astro";
```

Replace this block:

```astro
{/* Above the arrangement and outside it, because the arrangement is hidden
    below 900px while edit mode still works on the mobile graph. The ids here
    are a contract with src/scripts/roadmap.ts — do not rename them. */}
<div class="rm-toolbar">
  {showZoom && (
    <div class="rm-zoom" role="group" aria-label="Zoom">
      <button type="button" data-rm-zoom="span" aria-pressed="true">{spanLabel}</button>
      <button type="button" data-rm-zoom="all" aria-pressed="false">All</button>
    </div>
  )}
  <span id="rm-save-state" class="rm-save-state" role="status" aria-live="polite"></span>
  <button id="rm-edit" type="button" class="rm-edit-btn">Edit</button>
</div>
<p id="rm-message" class="rm-message" role="alert" aria-live="assertive" hidden></p>

{/* Ticking a checkbox silently rewrites clip counts and status fills that a
    sighted reader watches change and a screen-reader user cannot. This is the
    spoken half of that repaint (the sentence itself is progressAnnouncement in
    src/lib/roadmap/arrange.ts). It is server-rendered empty so the region is
    already in the accessibility tree when the first edit writes into it, and it
    sits outside .rm-arr, which is display:none below 900px — edit mode works at
    every width, so its announcements must too. */}
<p id="rm-clip-live" class="sr-only" role="status" aria-live="polite"></p>
```

with:

```astro
{/* Above the arrangement and outside it, because the arrangement is hidden
    below 900px while edit mode still works on the mobile graph. The zoom group
    rides in the toolbar's slot; the owner's controls are RoadmapToolbar's. */}
<RoadmapToolbar>
  {showZoom && (
    <div class="rm-zoom" role="group" aria-label="Zoom">
      <button type="button" data-rm-zoom="span" aria-pressed="true">{spanLabel}</button>
      <button type="button" data-rm-zoom="all" aria-pressed="false">All</button>
    </div>
  )}
</RoadmapToolbar>
```

- [ ] **Step 4: Confirm the built HTML is unchanged**

```bash
npm run build
node -e '
const fs = require("fs");
const html = fs.readFileSync("dist/roadmap/index.html", "utf8");
fs.writeFileSync(process.argv[1], html.replace(/--ph:[0-9.e-]+/g, "--ph:X").replace(/>\s*</g, ">\n<"));
' .superpowers/sdd/roadmap-html-after.html
diff .superpowers/sdd/roadmap-html-before.html .superpowers/sdd/roadmap-html-after.html && echo "HTML unchanged"
```

Expected: `HTML unchanged`. If the build crossed midnight UTC, the "now" row's date may differ, and that is the only acceptable difference.

- [ ] **Step 5: Run the suite**

Run: `npm run check`
Expected: all pass. `keeps the owner's controls outside the arrangement that is hidden below 900px` still passes: the toolbar renders before `.rm-arr`.

- [ ] **Step 6: Commit**

```bash
git add src/components/roadmap/RoadmapToolbar.astro src/components/roadmap/RoadmapArrangement.astro
git commit -m "refactor(roadmap): lift the owner's controls into RoadmapToolbar"
```

---

### Task 4: One `MilestoneBuild` for a milestone's checkpoints and logs

A pure move behind a new guard: no element id on `/roadmap` may repeat.

**Files:**
- Create: `src/components/roadmap/MilestoneBuild.astro`
- Modify: `src/components/roadmap/RoadmapInspector.astro` (imports; the Build panel)
- Test: `src/__tests__/roadmap-contract.test.ts`

**Interfaces:**
- Consumes: `BuildMilestone` from `src/data/roadmap.ts` (`id`, `goal`, `start`, `end`, `groups: { id, label, stages, hours? }[]`, `logs?: DecisionLog[]`); `CheckItem`; `DecisionLog`; `longDate` and `isoDay` from `src/lib/dates`.
- Produces: `<MilestoneBuild milestone={m}>…slot…</MilestoneBuild>`, which renders `.rm-insp-goal`, `.rm-insp-facts` (with `data-milestone-pct`), `.rm-insp-checks`, the default slot, then the logs. Task 5 renders it in `RoadmapNow.astro` with no children. Its inputs carry real ids, so a page must render a given milestone's `MilestoneBuild` at most once.

- [ ] **Step 1: Add the no-repeated-ids guard**

In `src/__tests__/roadmap-contract.test.ts`, replace the line

```ts
  it("keeps the review deck's rating buttons and per-thread counters", () => {
```

with:

```ts
  it("never repeats an element id", () => {
    // CheckItem and DecisionLog put real ids on their inputs, matched by <label for>
    // and aria-labelledby. A milestone rendered twice on one page would repeat
    // them, and a label would quietly tick the wrong checkbox (roadmap-now spec §6).
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("keeps the review deck's rating buttons and per-thread counters", () => {
```

- [ ] **Step 2: Run it against today's build**

```bash
npm run build
npx vitest run src/__tests__/roadmap-contract.test.ts
```

Expected: PASS, including `never repeats an element id`. Today's page has 145 ids and none repeat; the guard exists for the tasks that follow.

- [ ] **Step 3: Record the built HTML before the move**

```bash
mkdir -p .superpowers/sdd
node -e '
const fs = require("fs");
const html = fs.readFileSync("dist/roadmap/index.html", "utf8");
fs.writeFileSync(process.argv[1], html.replace(/--ph:[0-9.e-]+/g, "--ph:X").replace(/>\s*</g, ">\n<"));
' .superpowers/sdd/roadmap-html-before.html
```

- [ ] **Step 4: Create `src/components/roadmap/MilestoneBuild.astro`**

```astro
---
// A build milestone's work: its goal, dates and percent, its checkpoint rows and
// its decision logs (roadmap-now spec §7). The timeline's Build panel
// (RoadmapInspector) and /roadmap/now (RoadmapNow) both render it, so the
// checkpoint wording has one definition. The default slot sits between the
// checkpoints and the logs: the Build panel passes its phase pairings there;
// /roadmap/now passes nothing and prints its pairings after the build.
//
// Every input here carries a real id, so a page must render a given milestone's
// MilestoneBuild at most once.
import type { BuildMilestone } from "../../data/roadmap";
import CheckItem from "./CheckItem.astro";
import DecisionLog from "./DecisionLog.astro";
import { longDate, isoDay } from "../../lib/dates";

interface Props {
  milestone: BuildMilestone;
}
const { milestone: m } = Astro.props;
---

<p class="rm-insp-goal">{m.goal}</p>
<p class="rm-insp-facts">
  <time datetime={isoDay(m.start)}>{longDate(m.start)}</time> – <time datetime={isoDay(m.end)}>{longDate(m.end)}</time> · <span data-milestone-pct={m.id}>0%</span>
</p>
<div class="rm-insp-checks">
  {m.groups.map((g) => (
    <CheckItem id={g.id} label={g.label} meta={`${g.stages} stages${g.hours ? ` · ~${g.hours}h` : ""}`} />
  ))}
</div>
<slot />
{(m.logs ?? []).map((log) => <DecisionLog log={log} />)}
```

- [ ] **Step 5: Use it in `RoadmapInspector.astro`**

In the frontmatter, replace

```ts
import DecisionLog from "./DecisionLog.astro";
```

with

```ts
import MilestoneBuild from "./MilestoneBuild.astro";
```

In the header comment, replace

```ts
// JavaScript. The checkpoint rows and decision logs are the existing
// CheckItem/DecisionLog components, rehoused here from the retired
// Milestone/BookCard/FoundationsSection bodies. data-milestone-pct/data-book-pct
// keep src/scripts/roadmap.ts's per-clip percent updates working.
```

with

```ts
// JavaScript. The checkpoint rows are CheckItem; a Build panel's goal,
// checkpoints and decision logs come from MilestoneBuild, which /roadmap/now
// renders too. data-milestone-pct/data-book-pct keep src/scripts/roadmap.ts's
// per-clip percent updates working.
```

Replace the Build panel:

```astro
  {/* Build */}
  {build.map((m) => (
    <section class="rm-insp" id={`clip-${m.id}`} style="--c: var(--track-build)">
      <p class="rm-insp-k"><i></i>Build, <span data-clip-status={m.id}>{statusOf(m.id)}</span> · {m.no}</p>
      <h2 class="rm-insp-title">{m.course}</h2>
      <p class="rm-insp-goal">{m.goal}</p>
      <p class="rm-insp-facts">
        <time datetime={isoDay(m.start)}>{longDate(m.start)}</time> – <time datetime={isoDay(m.end)}>{longDate(m.end)}</time> · <span data-milestone-pct={m.id}>0%</span>
      </p>
      <div class="rm-insp-checks">
        {m.groups.map((g) => (
          <CheckItem id={g.id} label={g.label} meta={`${g.stages} stages${g.hours ? ` · ~${g.hours}h` : ""}`} />
        ))}
      </div>
      {phases.filter((p) => p.milestone === m.id).map((p) => (
        <>
          <PairingList label={`Reading · ${p.label}`} items={p.reading} />
          <PairingList label={`Foundations · ${p.label}`} items={p.foundations} />
        </>
      ))}
      {(m.logs ?? []).map((log) => <DecisionLog log={log} />)}
      <p class="rm-insp-close"><a href="#" data-inspector-close>Close</a></p>
    </section>
  ))}
```

with:

```astro
  {/* Build */}
  {build.map((m) => (
    <section class="rm-insp" id={`clip-${m.id}`} style="--c: var(--track-build)">
      <p class="rm-insp-k"><i></i>Build, <span data-clip-status={m.id}>{statusOf(m.id)}</span> · {m.no}</p>
      <h2 class="rm-insp-title">{m.course}</h2>
      <MilestoneBuild milestone={m}>
        {phases.filter((p) => p.milestone === m.id).map((p) => (
          <>
            <PairingList label={`Reading · ${p.label}`} items={p.reading} />
            <PairingList label={`Foundations · ${p.label}`} items={p.foundations} />
          </>
        ))}
      </MilestoneBuild>
      <p class="rm-insp-close"><a href="#" data-inspector-close>Close</a></p>
    </section>
  ))}
```

`CheckItem`, `longDate` and `isoDay` stay imported, because the Reading and Foundations panels still use them.

- [ ] **Step 6: Confirm the built HTML is unchanged**

```bash
npm run build
node -e '
const fs = require("fs");
const html = fs.readFileSync("dist/roadmap/index.html", "utf8");
fs.writeFileSync(process.argv[1], html.replace(/--ph:[0-9.e-]+/g, "--ph:X").replace(/>\s*</g, ">\n<"));
' .superpowers/sdd/roadmap-html-after.html
diff .superpowers/sdd/roadmap-html-before.html .superpowers/sdd/roadmap-html-after.html && echo "HTML unchanged"
```

Expected: `HTML unchanged`. In particular, each Build panel's pairing lists still sit between its checkpoints and its first decision log.

- [ ] **Step 7: Run the suite**

Run: `npm run check`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/roadmap/MilestoneBuild.astro src/components/roadmap/RoadmapInspector.astro src/__tests__/roadmap-contract.test.ts
git commit -m "refactor(roadmap): one MilestoneBuild for a milestone's checkpoints and logs"
```

---

### Task 5: Move the current phase, the routine and the review deck to `/roadmap/now`

**Files:**
- Create: `src/pages/roadmap/now.astro`, `src/components/roadmap/RoadmapNow.astro`, `src/__tests__/roadmap-now-contract.test.ts`
- Modify: `src/pages/roadmap.astro`, `src/scripts/roadmap-schedule.ts`, `src/styles/roadmap.css`, `src/__tests__/roadmap-contract.test.ts`, `src/__tests__/transitions-contract.test.ts`, `src/lib/og.mjs`, `scripts/screenshots.mjs`, `scripts/interactions.mjs`
- Delete: `src/components/roadmap/ThisWeek.astro`, `src/components/roadmap/RoadmapArc.astro`

**Interfaces:**
- Consumes: `nowShowing`, `weekLabel`, `phaseSpanText` (`src/lib/roadmap/schedule.ts`); `weekStart` (`src/lib/roadmap/weeks.ts`); `isoDay` (`src/lib/dates.ts`); `RoadmapToolbar` (Task 3); `MilestoneBuild` (Task 4); `PairingList`, `RoadmapPractice`, `RetentionSection` (existing).
- Produces:
  - the route `/roadmap/now`, built to `dist/roadmap/now/index.html`
  - the hooks `data-week-label`, `data-now-phase`, `data-phase-start`, `data-phase-milestone`, `data-now-milestone`, `data-now-outside`
  - `.rm-now-link` (a styled link line, reused by Task 6)
  - `initSchedule()` in `src/scripts/roadmap-schedule.ts`
  - the e2e values `mockProgress` and `rmPhases` (`{ id, start, milestone, span, name, hidden }[]`) and `rmExpectedLabel`, used by Tasks 6 and 7

- [ ] **Step 1: Write the `/roadmap/now` contract test**

Create `src/__tests__/roadmap-now-contract.test.ts`:

```ts
// /roadmap/now is server-rendered markup driven by three client scripts:
// src/scripts/roadmap.ts (checkpoints, logs, edit mode), src/scripts/review.ts
// (the review deck) and src/scripts/roadmap-schedule.ts (which phase and build
// show). They find their targets by id and data attribute, so a markup change
// can break saved progress, or show one phase's heading over another phase's
// work, with a green unit suite and a clean build. This reads the built page.
//
// It needs dist/, so it is skipped when there is none. `npm run check` builds
// first. roadmap-contract.test.ts fails whenever /roadmap is built and this
// page is not, so this suite cannot skip itself silently.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { build, phases, logIds } from "../data/roadmap";
import { phaseSpanText } from "../lib/roadmap/schedule";
import { weekStart } from "../lib/roadmap/weeks";
import { isoDay } from "../lib/dates";

const PAGE = "dist/roadmap/now/index.html";
const built = existsSync(PAGE);

type Block = { tag: string; value: string; index: number; hidden: boolean };

/** Every opening tag carrying `attr`, with the attribute's value and whether the tag is hidden. */
function blocks(html: string, attr: string): Block[] {
  const re = new RegExp(`<[a-z][a-z0-9]*\\b[^>]*\\s${attr}="([^"]+)"[^>]*>`, "g");
  return [...html.matchAll(re)].map((m) => ({
    tag: m[0],
    value: m[1],
    index: m.index!,
    hidden: /\shidden[\s>]/.test(m[0]),
  }));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe.skipIf(!built)("roadmap/now client contract (dist/roadmap/now/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  const headers = blocks(html, "data-phase-start").map((h) => ({
    ...h,
    phase: h.tag.match(/\sdata-now-phase="([^"]+)"/)?.[1] ?? "",
  }));
  const pairings = blocks(html, "data-now-phase").filter((b) => !b.tag.includes("data-phase-start"));
  const builds = blocks(html, "data-now-milestone");
  const shownHeaders = headers.filter((h) => !h.hidden);
  const label = html.match(/data-week-label[^>]*>([^<]*)</)?.[1] ?? "";

  // roadmap.ts: the edit controls and the live region. The meters stay on /roadmap.
  const TOOLBAR_IDS = ["rm-edit", "rm-message", "rm-save-state", "rm-clip-live"];
  // review.ts: the runner, the card faces, the counters and the message line.
  const REVIEW_IDS = [
    "rv-runner", "rv-runner-done", "rv-runner-locked", "rv-card", "rv-front", "rv-back",
    "rv-reveal", "rv-ratings", "rv-message", "rv-save-state", "rv-thread",
    "rv-due-count", "rv-streak", "rv-rotation-count", "rv-rotation-summary", "rv-rotation-empty",
  ];

  it("keeps the page root the script hangs edit mode on", () => {
    expect(html).toMatch(/class="roadmap-page"/);
  });

  it("keeps the toolbar's and the review deck's fixed ids", () => {
    for (const id of [...TOOLBAR_IDS, ...REVIEW_IDS]) {
      expect(html, `missing id ${id}`).toContain(`id="${id}"`);
    }
  });

  it("keeps the review deck's rating buttons and per-thread counters", () => {
    for (const rating of [0, 1, 2, 3]) {
      expect(html, `missing rating ${rating}`).toContain(`data-rv-rate="${rating}"`);
    }
    for (const thread of ["build", "reading", "foundations", "judgment", "behavioral"]) {
      expect(html, `missing thread count ${thread}`).toContain(`data-rv-thread-count="${thread}"`);
    }
  });

  it("renders the week label with real text before any script runs", () => {
    expect(label).toMatch(/Week \d+ of \d+|Ramp week|The plan (starts|is finished)/);
  });

  it("server-renders a header and a pairings block for every phase, and a build block for every milestone", () => {
    expect(headers.map((h) => h.phase)).toEqual(phases.map((p) => p.id));
    expect(pairings.map((b) => b.value)).toEqual(phases.map((p) => p.id));
    expect(builds.map((b) => b.value)).toEqual(build.map((m) => m.id));
  });

  it("stamps each header with its first Monday and its milestone, for the stale-visit e2e", () => {
    for (const p of phases) {
      const h = headers.find((x) => x.phase === p.id)!;
      expect(h.tag, `${p.id} start`).toContain(`data-phase-start="${isoDay(weekStart(p.fromWeek))}"`);
      if (p.milestone) expect(h.tag, `${p.id} milestone`).toContain(`data-phase-milestone="${p.milestone}"`);
      else expect(h.tag, `${p.id} has no milestone`).not.toContain("data-phase-milestone");
    }
  });

  it("reveals at most one phase, with its own pairings and its own milestone's build", () => {
    expect(shownHeaders.length, "more than one phase header is visible").toBeLessThanOrEqual(1);
    const shownPairings = pairings.filter((b) => !b.hidden).map((b) => b.value);
    const shownBuilds = builds.filter((b) => !b.hidden).map((b) => b.value);
    if (shownHeaders.length === 0) {
      expect(shownPairings).toEqual([]);
      expect(shownBuilds).toEqual([]);
      return;
    }
    const phase = phases.find((p) => p.id === shownHeaders[0].phase)!;
    expect(shownPairings).toEqual([phase.id]);
    expect(shownBuilds).toEqual(phase.milestone ? [phase.milestone] : []);
  });

  it("shows a phase whenever the label names a week", () => {
    if (/Week \d+ of \d+|Ramp week/.test(label)) {
      expect(shownHeaders, `label reads "${label}" but no phase is visible`).toHaveLength(1);
    }
  });

  it("shows the outside-the-plan line exactly when no phase is showing", () => {
    const outside = html.match(/<[a-z]+\b[^>]*\sdata-now-outside\b[^>]*>/)?.[0];
    expect(outside, "missing data-now-outside").toBeDefined();
    expect(/\shidden[\s>]/.test(outside!)).toBe(shownHeaders.length === 1);
  });

  it("renders every build checkbox and every decision log exactly once", () => {
    // M5 and the Capstone share Kafka. A build block per phase would print its
    // inputs twice, so they live in one block per milestone (roadmap-now spec §6).
    const countOf = (re: RegExp) => (html.match(re) ?? []).length;
    const checkbox = (id: string) =>
      new RegExp(`<input\\b(?=[^>]*\\bdata-id="${escapeRe(id)}")(?=[^>]*\\btype="checkbox")[^>]*>`, "g");
    for (const id of [...build.flatMap((m) => m.groups.map((g) => g.id)), ...logIds]) {
      expect(countOf(checkbox(id)), `checkbox ${id}`).toBe(1);
    }
    for (const id of logIds) {
      expect(countOf(new RegExp(`<details\\b[^>]*\\bdata-log-id="${escapeRe(id)}"`, "g")), `log ${id}`).toBe(1);
    }
  });

  it("never repeats an element id", () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("says which weeks the visible phase covers", () => {
    // The label counts one week; the phase covers several. The header has to say
    // so, or seven weeks of work reads as one week's.
    const h = shownHeaders[0];
    if (!h) return; // outside the plan there is no phase to scope
    const phase = phases.find((p) => p.id === h.phase)!;
    const markup = html.slice(h.index, html.indexOf("</header>", h.index));
    expect(markup).toContain(phaseSpanText(phase));
    expect(markup).toContain(phase.label);
  });

  /** One phase's pairings block, up to the next pairings block or the outside line. */
  const pairingsOf = (id: string): string => {
    const i = pairings.findIndex((b) => b.value === id);
    const next = pairings[i + 1]?.index ?? html.indexOf("data-now-outside", pairings[i].index);
    return html.slice(pairings[i].index, next);
  };

  it("prints each book's title once, however many of its chapters a phase carries", () => {
    // M1 reads seven OSTEP chapters. Flat, that repeated the book's title seven times.
    const m1 = pairingsOf("m1");
    const book = "Operating Systems: Three Easy Pieces";
    expect(m1.split(book)).toHaveLength(2); // one occurrence
    expect(m1).toContain("P1. Persistence"); // still every chapter
    expect(m1).toContain("C3. Concurrency");
  });

  it("derives a foundation item's workload rather than repeating it in a note", () => {
    const m1 = pairingsOf("m1");
    expect(m1).toContain("7 problems"); // fd.nc.stack's own `total`
    expect(m1).not.toMatch(/<small[^>]*>\s*7\s*<\/small>/); // never the bare number
  });
});
```

- [ ] **Step 2: Rewrite `/roadmap`'s contract for the page it becomes**

Replace the whole of `src/__tests__/roadmap-contract.test.ts` with:

```ts
// The roadmap page is server-rendered markup driven by client scripts, chiefly
// src/scripts/roadmap.ts. They find their targets by id and data attribute, so a
// markup change can break saved progress with a green unit suite and a clean
// build. This test reads the built page and asserts every hook is still there.
// The current phase, the routine and the review deck live on /roadmap/now, whose
// contract is src/__tests__/roadmap-now-contract.test.ts.
//
// It needs dist/, so it is skipped when there is none. `npm run check` builds
// first and then runs the suite; plain `npm test` still works on its own.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { allIds, logIds, build, reading } from "../data/roadmap";
import { roadmapClips } from "../lib/roadmap/arrange";

const PAGE = "dist/roadmap/index.html";
const built = existsSync(PAGE);

describe.skipIf(!built)("roadmap client contract (dist/roadmap/index.html)", () => {
  const html = built ? readFileSync(PAGE, "utf8") : "";

  // Fixed ids, derived from src/scripts/roadmap.ts: its setText/setWidth
  // targets, the edit button, the message line, the save state and the live
  // region.
  const ROADMAP_IDS = [
    "rm-edit", "rm-message", "rm-save-state",
    "rm-build-stages", "rm-build-courses", "rm-build-bar",
    "rm-read-ch", "rm-read-books", "rm-read-bar",
    "rm-fnd-done", "rm-fnd-bar", "rm-logs-done", "rm-clip-live",
  ];

  it("keeps the page root the script hangs edit mode on", () => {
    expect(html).toMatch(/class="roadmap-page"/);
  });

  it("keeps every fixed element id", () => {
    for (const id of ROADMAP_IDS) {
      expect(html, `missing id ${id}`).toContain(`id="${id}"`);
    }
  });

  it("keeps the owner's controls outside the arrangement that is hidden below 900px", () => {
    // .rm-arr is display:none below 900px, but edit mode must still work there
    // (the owner may check things off on a phone) — that's why #rm-edit and
    // #rm-message live in the toolbar, before .rm-arr opens, rather than inside
    // it. A future re-indent that moves the toolbar back inside .rm-arr would
    // satisfy every other assertion here while silently killing edit mode on
    // phones, so this checks document order rather than mere presence.
    const editAt = html.indexOf('id="rm-edit"');
    const messageAt = html.indexOf('id="rm-message"');
    const arrAt = html.indexOf('class="rm-arr"');
    expect(editAt, "rm-edit not found").toBeGreaterThan(-1);
    expect(messageAt, "rm-message not found").toBeGreaterThan(-1);
    expect(arrAt, "rm-arr not found").toBeGreaterThan(-1);
    expect(
      editAt,
      "#rm-edit must appear before .rm-arr opens — .rm-arr is hidden below 900px, but edit mode is not, so the owner's controls cannot live inside it",
    ).toBeLessThan(arrAt);
    expect(
      messageAt,
      "#rm-message must appear before .rm-arr opens — .rm-arr is hidden below 900px, but edit mode is not, so the owner's controls cannot live inside it",
    ).toBeLessThan(arrAt);
  });

  it("keeps a checkbox for every leaf id, because progress is stored by id", () => {
    // The frozen script only wires up input[data-id] and sets its .checked /
    // .disabled — if data-id moved onto a wrapper element, or the element
    // weren't a real checkbox, a plain substring check would still pass while
    // saving broke. Both attributes must sit on the SAME <input> tag; they are
    // matched with lookaheads so neither attribute's position relative to the
    // other is assumed (today's built markup happens to write type="checkbox"
    // before data-id, but nothing pins that order).
    for (const id of allIds) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `<input\\b(?=[^>]*\\bdata-id="${escaped}")(?=[^>]*\\btype="checkbox")[^>]*>`,
      );
      expect(html, `data-id ${id} is not on a checkbox <input>`).toMatch(re);
    }
  });

  it("keeps a percentage hook for every milestone and every book", () => {
    for (const m of build) expect(html, `missing milestone ${m.id}`).toContain(`data-milestone-pct="${m.id}"`);
    for (const b of reading) expect(html, `missing book ${b.id}`).toContain(`data-book-pct="${b.id}"`);
  });

  it("keeps the live-progress hooks on every clip, on all three surfaces", () => {
    // Every clip is rendered three times over: the desktop arrangement clip,
    // the mobile graph row, and the inspector panel's kicker. All three are
    // server-rendered from an EMPTY completed set, so all three are wrong until
    // src/scripts/roadmap.ts rewrites them from the saved progress. A hook that
    // survives on one surface and not the others leaves the page half-stale --
    // which is the bug this contract exists to prevent coming back.
    const countOf = (needle: string) => html.split(needle).length - 1;
    for (const c of roadmapClips(new Set<string>(), new Date())) {
      expect(
        countOf(`data-clip-id="${c.id}"`),
        `clip ${c.id}: the status class is rewritten on the desktop clip and the graph row`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        countOf(`data-clip-sub="${c.id}"`),
        `clip ${c.id}: the count is rewritten on the desktop clip and the graph row`,
      ).toBeGreaterThanOrEqual(2);
      expect(
        countOf(`data-clip-status="${c.id}"`),
        `clip ${c.id}: the spoken status is rewritten on both clips and the panel kicker`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every decision log with its four fields and its status line", () => {
    for (const id of logIds) {
      expect(html, `missing log ${id}`).toContain(`data-log-id="${id}"`);
    }
    for (const field of ["prediction", "confrontation", "verdict", "confidence"]) {
      expect(html, `missing log field ${field}`).toContain(`data-log-field="${field}"`);
    }
    expect(html).toContain("data-log-status");
  });

  it("never repeats an element id", () => {
    // CheckItem and DecisionLog put real ids on their inputs, matched by <label for>
    // and aria-labelledby. A milestone rendered twice on one page would repeat
    // them, and a label would quietly tick the wrong checkbox (roadmap-now spec §6).
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("names, in the Redis panel, the chapters read alongside it", () => {
    const panel = html.slice(html.indexOf('id="clip-redis"'), html.indexOf('id="clip-sqlite"'));
    expect(panel).toContain("data-pairing-list");
    expect(panel).toContain("alongside RDB/AOF");     // the schedule's own reason
    expect(panel).toMatch(/Storage and Retrieval/i);  // a resolved chapter title, not an id
  });

  it("no longer carries the phase ribbon, the this-week band or the review deck", () => {
    // Deleted or moved to /roadmap/now (roadmap-now spec §4). A stray copy here
    // would put the band's hooks, or the review deck's ids, on two pages. Matched
    // as attributes on a tag, not as bare text, because /roadmap also loads
    // roadmap-schedule.ts (Task 6), whose selector strings name these hooks; a
    // build that inlined that script must not fail this test.
    expect(html).not.toMatch(/\sdata-roadmap-arc\b/);
    expect(html).not.toMatch(/\sdata-this-week\b/);
    expect(html).not.toMatch(/\sdata-now-phase="/);
    expect(html).not.toContain('id="rv-runner"');
  });

  it("builds /roadmap/now alongside it", () => {
    // Otherwise roadmap-now-contract.test.ts skips itself and passes silently.
    expect(existsSync("dist/roadmap/now/index.html")).toBe(true);
  });
});
```

- [ ] **Step 3: Add the new page to the transitions contract, the share images and the screenshots**

In `src/__tests__/transitions-contract.test.ts`, replace

```ts
  roadmap: "dist/roadmap/index.html",
```

with

```ts
  roadmap: "dist/roadmap/index.html",
  "roadmap now": "dist/roadmap/now/index.html",
```

In `src/lib/og.mjs`, replace

```js
  { route: "/roadmap", name: "roadmap" },
```

with

```js
  { route: "/roadmap", name: "roadmap" },
  { route: "/roadmap/now", name: "roadmap-now" },
```

In `scripts/screenshots.mjs`, replace

```js
  { name: "roadmap", path: "/roadmap" },
```

with

```js
  { name: "roadmap", path: "/roadmap" },
  { name: "roadmap-now", path: "/roadmap/now" },
```

and in its header comment replace `index, the roadmap, two essays` with `index, the roadmap and /roadmap/now, two essays`.

- [ ] **Step 4: Run the contract tests to verify they fail**

```bash
npm run build
npx vitest run src/__tests__/roadmap-contract.test.ts src/__tests__/roadmap-now-contract.test.ts src/__tests__/transitions-contract.test.ts
```

Expected: FAIL in `roadmap-contract.test.ts` on `no longer carries the phase ribbon, the this-week band or the review deck` and `builds /roadmap/now alongside it`. The other two suites are skipped, because `dist/roadmap/now/index.html` does not exist yet.

- [ ] **Step 5: Make the schedule script re-pick blocks on any page**

Replace the whole of `src/scripts/roadmap-schedule.ts` with:

```ts
// src/scripts/roadmap-schedule.ts
// Keeps the roadmap's week honest when a deploy goes stale. Every block is
// already in the page, so this only rewrites each week label and re-picks which
// phase and build blocks show (roadmap-now spec §6). It never builds DOM, so a
// revealed block always matches the label above it. On /roadmap/now it drives
// RoadmapNow.astro; pages without those hooks are left alone.
import { onPage } from "./lifecycle";
import { nowShowing, weekLabel } from "../lib/roadmap/schedule";

export function initSchedule(): void {
  const now = new Date();

  const label = weekLabel(now);
  for (const el of document.querySelectorAll<HTMLElement>("[data-week-label]")) {
    el.textContent = label;
  }

  const { phase, milestone } = nowShowing(now);
  for (const el of document.querySelectorAll<HTMLElement>("[data-now-phase]")) {
    el.hidden = el.dataset.nowPhase !== phase;
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-now-milestone]")) {
    el.hidden = el.dataset.nowMilestone !== milestone;
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-now-outside]")) {
    el.hidden = phase !== null;
  }
}

onPage(initSchedule);
```

- [ ] **Step 6: Create `src/components/roadmap/RoadmapNow.astro`**

```astro
---
// The current phase in depth, for /roadmap/now (roadmap-now spec §4–§6).
// Everything is server-rendered: a header and a pairings block for every phase,
// and a build block for every milestone. All but nowShowing(build day) are
// `hidden`, and src/scripts/roadmap-schedule.ts re-picks them on load, so a
// deploy that goes stale never shows one phase's heading over another's work.
//
// Phase blocks hold no form controls. Build blocks hold every checkbox and log
// input, once each: M5 and the Capstone share Kafka, so a build block per phase
// would repeat its ids. The reveal matches by attribute, which is what lets a
// phase's header and its pairings sit on either side of the build.
//
// data-phase-start and data-phase-milestone exist for the stale-visit check in
// scripts/interactions.mjs, which cannot import the TypeScript phase table.
import { phases, build } from "../../data/roadmap";
import { nowShowing, weekLabel, phaseSpanText } from "../../lib/roadmap/schedule";
import { weekStart } from "../../lib/roadmap/weeks";
import { isoDay } from "../../lib/dates";
import MilestoneBuild from "./MilestoneBuild.astro";
import PairingList from "./PairingList.astro";

const now = new Date();
const showing = nowShowing(now);
---

<section class="rm-now" aria-labelledby="rm-week-label">
  <p class="rm-week-label" id="rm-week-label" data-week-label>{weekLabel(now)}</p>

  {phases.map((p) => (
    <header
      class="rm-now-phase"
      data-now-phase={p.id}
      data-phase-start={isoDay(weekStart(p.fromWeek))}
      data-phase-milestone={p.milestone}
      hidden={p.id !== showing.phase}
    >
      <h2 class="rm-week-phase">{p.name}</h2>
      {/* The label counts one week; the phase covers several. Saying so is what
          stops seven weeks of work reading as one week's. */}
      <p class="rm-week-scope">
        <span class="rm-week-chip">{p.label}</span>
        <span class="rm-week-span">{phaseSpanText(p)}</span>
      </p>
    </header>
  ))}

  {build.map((m) => (
    <section
      class="rm-now-build"
      data-now-milestone={m.id}
      hidden={m.id !== showing.milestone}
      style="--c: var(--track-build)"
      aria-labelledby={`rm-now-build-${m.id}`}
    >
      <p class="rm-insp-k"><i></i>Build · {m.no}</p>
      <h3 class="rm-now-build-title" id={`rm-now-build-${m.id}`}>{m.course}</h3>
      <MilestoneBuild milestone={m} />
    </section>
  ))}

  {/* A wrapper for every phase, even one with empty lists, so each phase always
      has exactly one pairings block. */}
  {phases.map((p) => (
    <div class="rm-week-lists" data-now-phase={p.id} hidden={p.id !== showing.phase}>
      <PairingList label="Reading" items={p.reading} />
      <PairingList label="Foundations" items={p.foundations} />
    </div>
  ))}

  <p class="rm-now-outside" data-now-outside hidden={showing.phase !== null}>
    Nothing on the plan is running right now. <a href="/roadmap">See the whole roadmap</a>.
  </p>
</section>
```

- [ ] **Step 7: Create `src/pages/roadmap/now.astro`**

```astro
---
import Layout from "../../layouts/Layout.astro";
import TransportBar from "../../components/TransportBar.astro";
import Footer from "../../components/Footer.astro";
import RoadmapToolbar from "../../components/roadmap/RoadmapToolbar.astro";
import RoadmapNow from "../../components/roadmap/RoadmapNow.astro";
import RoadmapPractice from "../../components/roadmap/RoadmapPractice.astro";
import RetentionSection from "../../components/roadmap/RetentionSection.astro";
import { ogImagePath } from "../../lib/og.mjs";
---

<Layout
  title="Now — Learning Roadmap | Sean Campbell"
  description="What I'm building, reading and drilling in this phase of my public learning roadmap, with live progress."
  image={ogImagePath("roadmap-now")}
>
  <TransportBar active="learning" />

  <main class="roadmap-page">
    <div class="rm-wrap">
      <p class="rm-eyebrow">A learning roadmap · right now</p>
      <h1 class="rm-title">What I'm working on <em>now</em></h1>
      <p class="rm-now-link"><a href="/roadmap">← The whole roadmap</a></p>

      <RoadmapToolbar />
      <RoadmapNow />
      <RoadmapPractice />
      <RetentionSection />

      <p class="rm-note">
        Progress is shared — what you see is the live, saved state. The owner can unlock edit
        mode to check items off.
      </p>
    </div>
  </main>

  <Footer />
</Layout>

<script>
  import "../../scripts/roadmap.ts";
  import "../../scripts/review.ts";
  import "../../scripts/roadmap-schedule.ts";
</script>

<style is:global>
  @import "../../styles/roadmap.css";
</style>
```

- [ ] **Step 8: Strip `/roadmap` down to the timeline**

Replace the whole of `src/pages/roadmap.astro` with:

```astro
---
import Layout from "../layouts/Layout.astro";
import TransportBar from "../components/TransportBar.astro";
import Footer from "../components/Footer.astro";
import RoadmapMeters from "../components/roadmap/RoadmapMeters.astro";
import RoadmapArrangement from "../components/roadmap/RoadmapArrangement.astro";
import RoadmapInspector from "../components/roadmap/RoadmapInspector.astro";
import { ogImagePath } from "../lib/og.mjs";
---

<Layout
  title="Roadmap — Building Engineering Judgment | Sean Campbell"
  description="A public learning roadmap: building real systems (CodeCrafters), reading deeply (DDIA & more), and DSA fundamentals (NeetCode) — building engineering judgment in the open."
  image={ogImagePath("roadmap")}
>
  <TransportBar active="learning" />

  <main class="roadmap-page">
    <div class="rm-wrap">
      <p class="rm-eyebrow">A learning roadmap · in progress</p>
      <h1 class="rm-title">Building <em>engineering judgment</em></h1>
      <p class="rm-thesis">
        Follow along with what I'm doing and the resources I'm using to become better at
        decision making &amp; problem solving as a Software Engineer. Building everything out in
        the open for anyone to see.
      </p>

      <RoadmapMeters />
      <RoadmapArrangement />
      <RoadmapInspector />

      <p class="rm-note">
        Progress is shared — what you see is the live, saved state. The owner can unlock edit
        mode to check items off.
      </p>
    </div>
  </main>

  <Footer />
</Layout>

<script>
  import "../scripts/roadmap.ts";
  import "../scripts/roadmap-arrangement.ts";
</script>

<style is:global>
  @import "../styles/roadmap.css";
</style>
```

Then delete the two retired components:

```bash
git rm src/components/roadmap/ThisWeek.astro src/components/roadmap/RoadmapArc.astro
```

- [ ] **Step 9: Update the styles**

In `src/styles/roadmap.css`, replace

```css
/* ---- this-week band (spec §7) ---- */
.rm-week {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
}
```

with

```css
/* ---- /roadmap/now: the current phase (roadmap-now spec §4) ----
   The week label, phase header and pairings keep the retired band's .rm-week-*
   names. The band's bordered card is gone, because on /roadmap/now the phase
   opens the page rather than sitting in a card inside it. The build block
   borrows the clip panel's look (.rm-insp) without its :target display rule. */
.rm-now-link {
  margin: 18px 0 0;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
}
.rm-now-link a { color: var(--lane-learning); text-decoration: none; }
.rm-now-link a:hover { text-decoration: underline; }
.rm-now { margin-top: 36px; }
.rm-now .rm-week-phase {
  font-size: clamp(22px, 4vw, 30px);
  line-height: 1.1;
  margin-top: 8px;
}
.rm-now-build {
  margin-top: var(--space-xl);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--c);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  padding: 22px 24px 24px;
}
.rm-now-build-title { margin: 0 0 10px; font-size: 20px; line-height: 1.2; }
.rm-now-outside { margin: var(--space-lg) 0 0; font-size: 14px; color: var(--color-text-secondary); }
```

Delete this line:

```css
.rm-week-panel[hidden] { display: none; }
```

Delete this block (the blank line after it can go too):

```css
/* ---- phase arc (spec §8) ---- */
.rm-arc ol {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-xl);
}
.rm-arc li {
  flex-basis: 0;
  min-width: 8rem;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  display: grid;
  gap: 2px;
}
.rm-arc-wk {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--lane-learning);
}
.rm-arc-nm { font-size: 14px; font-weight: 600; line-height: 1.3; }
.rm-arc-dt { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted); }
```

Confirm nothing references the retired names:

```bash
grep -rn 'rm-arc\|rm-week-panel\|data-this-week\|data-week-panel\|ThisWeek\|RoadmapArc\|initThisWeek' src scripts
```

Expected: no output.

- [ ] **Step 10: Run the contract tests to verify they pass**

```bash
npm run build
npx vitest run src/__tests__/roadmap-contract.test.ts src/__tests__/roadmap-now-contract.test.ts src/__tests__/transitions-contract.test.ts
```

Expected: PASS in all three files, none skipped.

- [ ] **Step 11: Run the suite**

Run: `npm run check`
Expected: all pass.

- [ ] **Step 12: Move the stale-visit e2e check to `/roadmap/now`**

In `scripts/interactions.mjs`, replace everything from the line `// ---- roadmap: the this-week band recomputes on a stale visit ----` up to, but not including, the line `// ---- roadmap: saved progress reaches the arrangement, not just the meters ----` with:

```js
// ---- roadmap/now: the current phase recomputes on a stale visit ----
// src/scripts/roadmap-schedule.ts must keep a stale deploy honest: a build made
// in one week and visited weeks later has to recompute the label AND reveal the
// matching phase and build blocks, so a heading never sits above another phase's
// work. Nothing stamps the build day on the page, so this reads the real "now"
// state first (a normal load) rather than hardcoding a date that would
// eventually roll past the plan's end. Every phase header is server-rendered
// with its first Monday (data-phase-start) and its milestone
// (data-phase-milestone, absent for the ramp), and prints its weeks in
// phaseSpanText's unit-tested format, which is what lets this pick a target
// phase and its expected blocks without importing the TS phase table into this
// plain Node script.
// roadmap.ts and review.ts each unconditionally GET /api/progress on load,
// same as vt3/vt4 above; this preview server has no Netlify Functions, so an
// unmocked GET here 404s and watch() would flag it.
const mockProgress = async (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
const rmBase = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await rmBase.route("**/api/progress", mockProgress);
await rmBase.goto(`${BASE}/roadmap/now`, { waitUntil: "networkidle" });
const rmBaseLabel = await rmBase.locator("[data-week-label]").textContent();
// Every header is always server-rendered (only some `hidden`), so this holds
// every phase whichever one is showing.
const rmPhases = await rmBase.$$eval("[data-phase-start]", (els) =>
  els.map((el) => ({
    id: el.getAttribute("data-now-phase"),
    start: el.getAttribute("data-phase-start"),
    milestone: el.getAttribute("data-phase-milestone"),
    span: el.querySelector(".rm-week-span")?.textContent ?? "",
    name: el.querySelector("h2")?.textContent ?? "",
    hidden: el.hidden,
  })),
);
await rmBase.close();

// "Weeks 15–19 · Dec 14 – Jan 16, 2027" -> { from: 15, to: 19 }; "Week 0 · …" -> { from: 0, to: 0 }.
const rmParseWeeks = (span) => {
  const m = /^Weeks? (\d+)(?:\D(\d+))?/.exec(span.trim());
  const from = Number(m[1]);
  return { from, to: m[2] !== undefined ? Number(m[2]) : from };
};

const rmBaseActiveId = rmPhases.find((p) => !p.hidden)?.id ?? null;
// The last phase chronologically, unless the build day already sits inside it
// -- then fall back to the first, which is still guaranteed different.
const rmTarget = rmPhases[rmPhases.length - 1].id !== rmBaseActiveId ? rmPhases[rmPhases.length - 1] : rmPhases[0];
const rmLastWeek = Math.max(...rmPhases.map((p) => rmParseWeeks(p.span).to));
const rmTargetFromWeek = rmParseWeeks(rmTarget.span).from;
const rmExpectedLabel = rmTargetFromWeek === 0 ? "Ramp week" : `Week ${rmTargetFromWeek} of ${rmLastWeek}`;

// The target phase's own Monday, plus a couple of days so the fixed time sits
// solidly inside it rather than exactly on the boundary.
const rmFuture = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
await rmFuture.route("**/api/progress", mockProgress);
await rmFuture.clock.setFixedTime(new Date(Date.parse(rmTarget.start) + 2 * DAY));
await rmFuture.goto(`${BASE}/roadmap/now`, { waitUntil: "networkidle" });
const rmFutureLabel = await rmFuture.locator("[data-week-label]").textContent();
const rmShownPhases = await rmFuture.$$eval("[data-now-phase]:not([hidden])", (els) =>
  els.map((el) => el.getAttribute("data-now-phase")),
);
const rmShownHeader = rmFuture.locator("[data-phase-start]:not([hidden])");
const rmShownName = (await rmShownHeader.count()) === 1 ? await rmShownHeader.locator("h2").textContent() : null;
const rmShownBuilds = await rmFuture.$$eval("[data-now-milestone]:not([hidden])", (els) =>
  els.map((el) => el.getAttribute("data-now-milestone")),
);
const rmOutsideShown = await rmFuture.locator("[data-now-outside]:not([hidden])").count();
await rmFuture.close();

check(
  "roadmap/now: a stale visit recomputes the week label instead of keeping the build day's",
  rmFutureLabel === rmExpectedLabel && rmFutureLabel !== rmBaseLabel,
);
check(
  "roadmap/now: the recompute reveals the fixed date's phase, header and pairings both, and no other",
  rmShownPhases.length === 2 && rmShownPhases.every((id) => id === rmTarget.id),
);
check("roadmap/now: the revealed header is that phase's", rmShownName === rmTarget.name);
check(
  "roadmap/now: the revealed build block is that phase's milestone, or none for the ramp",
  JSON.stringify(rmShownBuilds) === JSON.stringify(rmTarget.milestone ? [rmTarget.milestone] : []),
);
check("roadmap/now: the outside-the-plan line stays hidden inside a phase", rmOutsideShown === 0);

```

- [ ] **Step 13: Drop the review-API mocks from the checks that stay on `/roadmap`**

`review.ts` no longer runs on `/roadmap`, so these mocks now hide nothing. With them gone, a stray review fetch fails `watch()`.

In `scripts/interactions.mjs`, delete:

```js
// review.ts's own initReview() also runs on /roadmap and, once a token is
// present, fetches /api/review -- unmocked, that 404s against this
// functions-less preview server too, and a fetch() 404 is a genuine console
// error (Chromium logs "Failed to load resource" for it), which the
// strengthened watch() below now catches. Routing it is completing the mock
// to match what a deployed Netlify Function would actually return, not
// silencing a real failure.
await vt3.route("**/api/review", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) });
});
```

Delete:

```js
// See vt3 above: the #rm-edit click below hands review.ts a token too, and its
// own loadReview() fetches /api/review.
await vt4.route("**/api/review", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) });
});
```

Delete:

```js
await rmProg.route("**/api/review", async (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) }),
);
```

- [ ] **Step 14: Run the e2e pass**

Restart `npm run preview`, then run: `npm run e2e`
Expected: every line `ok`, ending `all checks passed`, including the five `roadmap/now:` checks and `no uncaught page errors`.

- [ ] **Step 15: Look at both pages at both widths**

Run: `npm run shots`, then open `screenshots/roadmap-1280.png`, `screenshots/roadmap-390.png`, `screenshots/roadmap-now-1280.png` and `screenshots/roadmap-now-390.png`. Confirm:

- `/roadmap`: heading, then meters, toolbar, timeline, legend and note. No band, no ribbon, no Retention, no 2-hour day.
- `/roadmap/now`: eyebrow, h1, back link, the Edit button, then the week label, the phase name and scope line, a bordered Build block (goal, dates, checkpoints, decision logs), the Reading and Foundations lists (two columns at 1280, stacked at 390), the 2-hour day, Retention, the note.
- Nothing overflows horizontally at 390.

- [ ] **Step 16: Commit**

```bash
git add src/pages/roadmap/now.astro src/pages/roadmap.astro src/components/roadmap/RoadmapNow.astro src/scripts/roadmap-schedule.ts src/styles/roadmap.css src/__tests__/roadmap-now-contract.test.ts src/__tests__/roadmap-contract.test.ts src/__tests__/transitions-contract.test.ts src/lib/og.mjs scripts/screenshots.mjs scripts/interactions.mjs
git commit -m "feat(roadmap): move the current phase, routine and review deck to /roadmap/now" -m "The phase ribbon is deleted: it restated the Build lane. /roadmap keeps the meters and the timeline; the new page renders phase blocks and milestone blocks separately, because M5 and the Capstone share Kafka and a per-phase build block would repeat its input ids."
```

(`git rm` in Step 8 already staged the two deletions.)

---

### Task 6: Link `/roadmap` to `/roadmap/now`

**Files:**
- Modify: `src/pages/roadmap.astro` (frontmatter, the link line, the script block), `src/components/roadmap/RoadmapArrangement.astro` (the playhead chip, the phone "now" row), `src/styles/roadmap.css` (the chip rules)
- Test: `src/__tests__/roadmap-contract.test.ts`, `scripts/interactions.mjs`

**Interfaces:**
- Consumes: `weekLabel` (`src/lib/roadmap/schedule.ts`); `.rm-now-link` (Task 5); `initSchedule`, which rewrites every `[data-week-label]` (Task 5); from the e2e script, `mockProgress`, `rmFuture`, `rmExpectedLabel` and `rmOutsideShown` (Task 5).
- Produces: `a.rm-now-chip[href="/roadmap/now"]` inside `.rm-playhead` and inside `.rm-graph-now`; `.rm-now-link a[href="/roadmap/now"]` containing `span[data-week-label]` on `/roadmap`. Task 7 clicks both links.

- [ ] **Step 1: Write the failing contract tests**

In `src/__tests__/roadmap-contract.test.ts`, replace

```ts
  it("builds /roadmap/now alongside it", () => {
    // Otherwise roadmap-now-contract.test.ts skips itself and passes silently.
    expect(existsSync("dist/roadmap/now/index.html")).toBe(true);
  });
});
```

with

```ts
  it("builds /roadmap/now alongside it", () => {
    // Otherwise roadmap-now-contract.test.ts skips itself and passes silently.
    expect(existsSync("dist/roadmap/now/index.html")).toBe(true);
  });

  it("links to /roadmap/now under the heading, with a week label the script rewrites", () => {
    expect(html).toMatch(/<a\b[^>]*href="\/roadmap\/now"[^>]*>\s*<span\b[^>]*data-week-label/);
  });

  it("links the timeline's now chip and the phone graph's now row to /roadmap/now", () => {
    const playheadAt = html.indexOf("data-rm-playhead");
    const playhead = html.slice(playheadAt, html.indexOf("</div>", playheadAt));
    expect(playhead, "the now chip").toMatch(/<a\b[^>]*href="\/roadmap\/now"/);
    const rowAt = html.indexOf('class="rm-graph-now"');
    const row = html.slice(rowAt, html.indexOf("</li>", rowAt));
    expect(row, "the phone now row").toMatch(/<a\b[^>]*href="\/roadmap\/now"/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npm run build
npx vitest run src/__tests__/roadmap-contract.test.ts
```

Expected: FAIL on the two new tests; everything else passes.

- [ ] **Step 3: Add the link line to `/roadmap`**

In `src/pages/roadmap.astro`, after `import { ogImagePath } from "../lib/og.mjs";` add:

```ts
import { weekLabel } from "../lib/roadmap/schedule";
```

Replace

```astro
        the open for anyone to see.
      </p>

      <RoadmapMeters />
```

with

```astro
        the open for anyone to see.
      </p>
      <p class="rm-now-link">
        <a href="/roadmap/now"><span data-week-label>{weekLabel(new Date())}</span> · What I'm working on now →</a>
      </p>

      <RoadmapMeters />
```

Replace

```astro
<script>
  import "../scripts/roadmap.ts";
  import "../scripts/roadmap-arrangement.ts";
</script>
```

with

```astro
<script>
  import "../scripts/roadmap.ts";
  import "../scripts/roadmap-arrangement.ts";
  import "../scripts/roadmap-schedule.ts";
</script>
```

- [ ] **Step 4: Turn the "now" markers into links**

In `src/components/roadmap/RoadmapArrangement.astro`, replace

```astro
    <div class="rm-playhead" style={`--ph:${nowX}`} data-rm-playhead><span>now</span></div>
```

with

```astro
    <div class="rm-playhead" style={`--ph:${nowX}`} data-rm-playhead>
      <a class="rm-now-chip" href="/roadmap/now">now<span class="sr-only"> · what I'm working on</span></a>
    </div>
```

and replace

```astro
      <li class="rm-graph-now"><span>now · {monthDayYear(now)}</span></li>
```

with

```astro
      <li class="rm-graph-now"><a class="rm-now-chip" href="/roadmap/now">now · {monthDayYear(now)}<span class="sr-only"> · what I'm working on</span></a></li>
```

- [ ] **Step 5: Restyle the chips by class**

In `src/styles/roadmap.css`, replace

```css
.rm-playhead span {
  position: absolute;
```

with

```css
/* The "now" chip links to /roadmap/now (roadmap-now spec §8). The playhead line
   stays pointer-events:none so it never blocks a clip; the chip alone takes
   clicks. Targeted by class rather than `span`, so the sr-only text inside it is
   not styled as a second chip. */
.rm-playhead .rm-now-chip {
  pointer-events: auto;
  text-decoration: none;
  position: absolute;
```

Replace

```css
  line-height: 1.4;
}

/* ---- legend ---- */
```

with

```css
  line-height: 1.4;
}
.rm-playhead .rm-now-chip:focus-visible { outline: 2px solid var(--color-text-primary); outline-offset: 2px; }

/* ---- legend ---- */
```

Replace

```css
  .rm-graph-now span {
    display: inline-block;
```

with

```css
  .rm-graph-now .rm-now-chip {
    display: inline-block;
    text-decoration: none;
```

- [ ] **Step 6: Run the contract tests to verify they pass**

```bash
npm run build
npx vitest run src/__tests__/roadmap-contract.test.ts src/__tests__/roadmap-now-contract.test.ts
```

Expected: PASS in both files.

- [ ] **Step 7: Run the suite**

Run: `npm run check`
Expected: all pass.

- [ ] **Step 8: Add the e2e checks**

In `scripts/interactions.mjs`, replace

```js
const rmOutsideShown = await rmFuture.locator("[data-now-outside]:not([hidden])").count();
await rmFuture.close();
```

with

```js
const rmOutsideShown = await rmFuture.locator("[data-now-outside]:not([hidden])").count();
// /roadmap's link to this page names the week too, from the same script and clock.
await rmFuture.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
const rmFutureLinkLabel = await rmFuture.locator(".rm-now-link [data-week-label]").textContent();
await rmFuture.close();
```

and replace

```js
check("roadmap/now: the outside-the-plan line stays hidden inside a phase", rmOutsideShown === 0);
```

with

```js
check("roadmap/now: the outside-the-plan line stays hidden inside a phase", rmOutsideShown === 0);
check("roadmap: the week label in /roadmap's link to /roadmap/now recomputes too", rmFutureLinkLabel === rmExpectedLabel);

// ---- roadmap: the now marker links to /roadmap/now ----
// The playhead's "now" chip at desktop width, and the phone graph's "now" row
// below 900px, are the timeline's way into the current phase (roadmap-now spec
// §8). The chip sits on a pointer-events:none playhead, so this also proves the
// chip itself takes the click.
for (const [label, width, selector] of [
  ["the timeline's now chip", 1280, ".rm-playhead .rm-now-chip"],
  ["the phone graph's now row", 400, ".rm-graph-now .rm-now-chip"],
]) {
  const p = watch(await browser.newPage({ viewport: { width, height: 900 } }));
  await p.route("**/api/progress", mockProgress);
  await p.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
  await p.locator(selector).click();
  const landed = await p.waitForURL(/\/roadmap\/now\/?$/, { timeout: 5000 }).then(() => true, () => false);
  await p.close();
  check(`roadmap: ${label} opens /roadmap/now`, landed);
}
```

- [ ] **Step 9: Run the e2e pass**

Restart `npm run preview`, then run: `npm run e2e`
Expected: every line `ok`, ending `all checks passed`, including `roadmap: the week label in /roadmap's link to /roadmap/now recomputes too`, `roadmap: the timeline's now chip opens /roadmap/now` and `roadmap: the phone graph's now row opens /roadmap/now`.

- [ ] **Step 10: Look at the links**

Run: `npm run shots`, then open `screenshots/roadmap-1280.png` and `screenshots/roadmap-390.png`. Confirm:

- the link line sits under the thesis in the Learning blue
- the "now" chip at 1280 looks as before (a light chip under the ruler, no underline)
- the phone "now" row at 390 looks as before
- no screen-reader text is visible next to either chip

- [ ] **Step 11: Commit**

```bash
git add src/pages/roadmap.astro src/components/roadmap/RoadmapArrangement.astro src/styles/roadmap.css src/__tests__/roadmap-contract.test.ts scripts/interactions.mjs
git commit -m "feat(roadmap): link /roadmap to /roadmap/now from the heading and the now marker"
```

---

### Task 7: Prove a save crosses pages and the script loads once

Test-only. Each new check is also shown to fail when the behaviour it guards is broken, because a check that cannot fail proves nothing (27cf3a6 fixed exactly that kind of check).

**Files:**
- Test: `scripts/interactions.mjs`

**Interfaces:**
- Consumes: `rmPhases` and `DAY` (e2e script scope); `.rm-now-link a[href="/roadmap"]` (Task 5); `.rm-now-link a[href="/roadmap/now"]` (Task 6); `#rm-build-stages` on `/roadmap`; `[data-now-milestone] .rm-insp-checks input[data-id]` and `.rm-check-meta` on `/roadmap/now`.
- Produces: nothing later tasks use.

- [ ] **Step 1: Add the checks**

In `scripts/interactions.mjs`, insert immediately before the line `// ---- nothing threw anywhere ----`:

```js
// ---- roadmap: two editable pages share one progress state ----
// /roadmap and /roadmap/now both run src/scripts/roadmap.ts (roadmap-now spec
// §9). Two things must hold. A save still pending when the owner leaves one page
// for the other is flushed, not dropped, and the page arrived at shows it. And
// the browser holds ONE instance of the module: Rollup shares a module imported
// by two page entries, but if a build ever inlined roadmap.ts into each page's
// bundle, two instances would each register onPage(initRoadmap) and one toggle
// would schedule two saves. The fixed clock puts both checks inside a phase
// that has a build block, so there is a checkpoint to tick whatever the date.
const rmBuildPhase = rmPhases.find((p) => p.milestone);
const rmEditPage = async () => {
  const p = watch(await browser.newPage({ viewport: { width: 1280, height: 900 } }));
  await p.addInitScript(() => sessionStorage.setItem("roadmap-admin-token", "e2e-dummy-token"));
  await p.clock.setFixedTime(new Date(Date.parse(rmBuildPhase.start) + 2 * DAY));
  // review.ts runs on /roadmap/now and, with a token present, fetches /api/review.
  await p.route("**/api/review", async (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schedules: {}, streak: 0, lastReviewDate: null }) }),
  );
  return p;
};
const rmBuildBlock = `[data-now-milestone="${rmBuildPhase.milestone}"]`;

// A save crosses pages: tick on /roadmap/now, leave for /roadmap inside the debounce.
const rmCross = await rmEditPage();
let rmCrossSaved = [];
let rmCrossPostAt = null;
await rmCross.route("**/api/progress", async (route) => {
  if (route.request().method() === "POST") {
    rmCrossPostAt = Date.now();
    rmCrossSaved = JSON.parse(route.request().postData() ?? "{}").completed ?? [];
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ completed: rmCrossSaved }) });
});
await rmCross.goto(`${BASE}/roadmap/now`, { waitUntil: "networkidle" });
await rmCross.waitForSelector(".roadmap-page.rm-editing");
// The group's own stage count ("7 stages · ~11h"): ticking the group adds exactly
// that many stages to /roadmap's build meter (deriveStats).
const rmCrossStages = Number.parseInt(
  (await rmCross.locator(`${rmBuildBlock} .rm-insp-checks .rm-check-meta`).first().textContent()) ?? "",
  10,
);
// Recorded BEFORE the click, as in vt3: toggleAt + 500 stays a true lower bound
// on when the ordinary debounce could fire.
const rmCrossToggleAt = Date.now();
await rmCross.locator(`${rmBuildBlock} .rm-insp-checks input[data-id]`).first().click();
await rmCross.waitForTimeout(200); // leave well inside the 500ms debounce
await rmCross.locator('.rm-now-link a[href="/roadmap"]').click();
await rmCross.waitForURL(/\/roadmap\/?$/);
const rmCrossMeter = await rmCross
  .waitForFunction((n) => document.getElementById("rm-build-stages")?.textContent === String(n), rmCrossStages, { timeout: 3000 })
  .then(() => true, () => false);
await rmCross.close();
check(
  "roadmap: a save pending on /roadmap/now is flushed by the navigation to /roadmap",
  rmCrossPostAt !== null && rmCrossPostAt < rmCrossToggleAt + 500,
);
check("roadmap: /roadmap's build meter shows the checkpoint ticked on /roadmap/now", rmCrossMeter);

// One instance: arrive at /roadmap/now by navigating from /roadmap, then one toggle is one save.
const rmOne = await rmEditPage();
let rmOnePosts = 0;
await rmOne.route("**/api/progress", async (route) => {
  if (route.request().method() === "POST") rmOnePosts++;
  await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
await rmOne.goto(`${BASE}/roadmap`, { waitUntil: "networkidle" });
await rmOne.locator('.rm-now-link a[href="/roadmap/now"]').click();
await rmOne.waitForURL(/\/roadmap\/now\/?$/);
// Only /roadmap/now has build blocks, and the click waits for this checkbox to
// be enabled, which happens once the arriving page's init turns edit mode on.
await rmOne.locator(`${rmBuildBlock} .rm-insp-checks input[data-id]`).first().click();
await rmOne.waitForTimeout(700); // past the 500ms debounce
await rmOne.close();
check("roadmap: one toggle after navigating from /roadmap to /roadmap/now saves exactly once", rmOnePosts === 1);

```

- [ ] **Step 2: Run the e2e pass**

`npm run preview` must be serving Task 6's build. Run: `npm run e2e`
Expected: every line `ok`, ending `all checks passed`, including the three new `roadmap:` checks.

- [ ] **Step 3: Show the flush check can fail**

Temporarily break the flush. In `src/scripts/roadmap.ts`, inside `signal.addEventListener("abort", () => {`, change

```ts
    if (!saveTimer) return;
```

to

```ts
    return;
```

Then:

```bash
npm run build
```

Restart `npm run preview`, then run: `npm run e2e`
Expected: FAIL on `roadmap: a save pending on /roadmap/now is flushed by the navigation to /roadmap`, and on vt3's `a pending save survives a navigation`. Revert:

```bash
git checkout -- src/scripts/roadmap.ts
```

- [ ] **Step 4: Show the one-instance check can fail**

Temporarily load a second instance of the module on `/roadmap/now`:

```bash
cp src/scripts/roadmap.ts src/scripts/roadmap-copy.ts
```

In `src/pages/roadmap/now.astro`, add `import "../../scripts/roadmap-copy.ts";` as the last line inside `<script>`. Then:

```bash
npm run build
```

Restart `npm run preview`, then run: `npm run e2e`
Expected: FAIL on `roadmap: one toggle after navigating from /roadmap to /roadmap/now saves exactly once`. Revert:

```bash
rm src/scripts/roadmap-copy.ts
git checkout -- src/pages/roadmap/now.astro
git status --short
```

Expected `git status --short`: only `M scripts/interactions.mjs`.

- [ ] **Step 5: Rebuild and run the e2e pass clean**

```bash
npm run build
```

Restart `npm run preview`, then run: `npm run e2e`
Expected: `all checks passed`.

- [ ] **Step 6: Commit**

```bash
git add scripts/interactions.mjs
git commit -m "test(e2e): prove a roadmap save crosses pages and the script loads once"
```

---

### Task 8: Describe `/roadmap/now` in `CLAUDE.md` and the README

**Files:**
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: the finished feature (Tasks 1–7).
- Produces: nothing.

Match each old string to the file's actual line wrapping when editing. The replacement text is exact.

- [ ] **Step 1: Update the commands in `CLAUDE.md`**

Replace

```
including the roadmap client-contract test that reads `dist/roadmap/index.html`
```

with

```
including the roadmap client-contract tests that read `dist/roadmap/index.html` and `dist/roadmap/now/index.html`
```

In the `npm run shots` line, replace `the roadmap, two essays` with `the roadmap and its current-phase page, two essays`.

In the `npm run e2e` line, replace

```
and back restoring an open panel without replaying the playhead draw-in. Needs `npm run preview` running.
```

with

```
and back restoring an open panel without replaying the playhead draw-in. It also covers the roadmap's current-phase page: a stale visit re-picking its phase and build blocks (and the week label in `/roadmap`'s link to it), the timeline's now chip and phone now row landing on it, a save flushed across the two roadmap pages, and one toggle after navigating between them saving exactly once. Needs `npm run preview` running.
```

- [ ] **Step 2: Update the architecture paragraph in `CLAUDE.md`**

Replace

```
`RoadmapInspector.astro`, `RetentionSection.astro`) stay usable but render at zero.
```

with

```
`RoadmapInspector.astro`, `RoadmapNow.astro`, `RetentionSection.astro`) stay usable but render at zero.
```

- [ ] **Step 3: Rewrite the roadmap paragraph in `CLAUDE.md`**

Replace

```
**Roadmap page:** `src/pages/roadmap.astro` renders the roadmap as an arrangement — three dated tracks (Build, Reading, Foundations) as clips on a quarter calendar, positioned by `src/lib/roadmap/arrange.ts` reusing `src/lib/timeline/layout.ts`.
```

with

```
**Roadmap pages:** the roadmap is two pages rendering one plan. `src/pages/roadmap.astro` shows where the work has been and where it is headed: the meters and an arrangement — three dated tracks (Build, Reading, Foundations) as clips on a quarter calendar, positioned by `src/lib/roadmap/arrange.ts` reusing `src/lib/timeline/layout.ts`. `src/pages/roadmap/now.astro` shows the current phase in depth: `RoadmapNow.astro`, then `RoadmapPractice.astro` (the 2-hour day) and `RetentionSection.astro` (the review deck). `/roadmap` links to it from a line under its thesis, whose week label is rewritten on load, and from the timeline's "now" chip and the phone graph's "now" row.
```

Replace

```
`src/lib/roadmap/schedule.ts` answers which week it is for `ThisWeek.astro`, the one enhancement on the site that rewrites rather than narrows on the client, because its inputs are static data the bundle already holds; it also holds `phaseSpanText`, the one definition of the "Weeks 1–7 · Sep 7 – Oct 24" form that the band prints and `schedule-mockup-contract.test.ts` checks the mockup against. The band's heading counts a single week but its lists cover the whole phase, so each panel prints that span — per-phase, so it rides along with the panel the script reveals and needs no client code.
```

with

```
`src/lib/roadmap/schedule.ts` answers which week it is (`weekLabel`) and what `/roadmap/now` shows (`nowShowing`: the phase covering the week and that phase's `milestone`, null for the ramp and outside the plan), and `src/scripts/roadmap-schedule.ts` applies both on load: the one enhancement on the site that rewrites rather than narrows on the client, because its inputs are static data the bundle already holds. `schedule.ts` also holds `phaseSpanText`, the one definition of the "Weeks 1–7 · Sep 7 – Oct 24" form that each phase header prints and `schedule-mockup-contract.test.ts` checks the mockup against. `RoadmapNow.astro` server-renders a header and a pairings block for every phase (`data-now-phase`) and a build block for every milestone (`data-now-milestone`), and the script reveals the current ones. Checkboxes and log inputs live only in the build blocks, once per milestone, because phases and milestones are not one to one: M5 and the Capstone share Kafka, and `CheckItem` and `DecisionLog` put real ids on their inputs, so a build block per phase would repeat them. Each phase header also carries `data-phase-start` and `data-phase-milestone`, which exist so the e2e stale-visit check can pick a phase without importing the TypeScript phase table.
```

Replace

```
`RoadmapArc.astro` draws the phase ribbon and `RoadmapPractice.astro` the 2-hour day; `PairingList.astro` names, in each clip's panel, what to read alongside it, laying out `pairings.ts`'s groups and holding no wording of its own.
```

with

```
`PairingList.astro` names, in each Build clip's panel and on `/roadmap/now`, what to read alongside a milestone, laying out `pairings.ts`'s groups and holding no wording of its own. `MilestoneBuild.astro` renders a milestone's goal, dates, checkpoints and decision logs for both the Build clip panel (which slots its pairings between the checkpoints and the logs) and `/roadmap/now`.
```

Replace

```
`RoadmapInspector.astro` server-renders one `:target` panel per clip, reusing `CheckItem` and `DecisionLog`;
```

with

```
`RoadmapInspector.astro` server-renders one `:target` panel per clip, reusing `CheckItem` and `MilestoneBuild`;
```

Replace

```
The owner's controls sit in a toolbar above the arrangement so they survive below 900px, lanes size to their packed rows, and the zoom control is only rendered when the all-time window differs from the default. Editing and the spaced-repetition review deck are unchanged: `src/scripts/roadmap.ts` and `review.ts` still drive them through preserved element ids and `data-*` hooks, backed by the token-gated Netlify functions and Blobs stores.
```

with

```
The owner's controls are `RoadmapToolbar.astro`, rendered on both pages; on `/roadmap` the arrangement renders it above `.rm-arr` so it survives below 900px, with the zoom group in its slot. Lanes size to their packed rows, and the zoom control is only rendered when the all-time window differs from the default. Editing works on both pages without either overwriting the other: `src/scripts/roadmap.ts` saves the full completed set it loaded from the server, not the checkboxes on screen, and a navigation between the two pages flushes a pending save that the arriving page's load waits for. `roadmap.ts` and `review.ts` drive editing and the review deck through preserved element ids and `data-*` hooks, backed by the token-gated Netlify functions and Blobs stores. Both pages share the global `src/styles/roadmap.css`. `src/__tests__/roadmap-contract.test.ts` and `roadmap-now-contract.test.ts` read the two built pages, and each asserts that no element id repeats.
```

Confirm nothing stale is left:

```bash
grep -n 'ThisWeek\|RoadmapArc\|phase ribbon\|the band' CLAUDE.md
```

Expected: no output.

- [ ] **Step 4: Update `README.md`**

Replace

```
| `/roadmap` | The learning roadmap as an arrangement, with live progress and a review deck |
```

with

```
| `/roadmap` | The learning roadmap as an arrangement, with live progress |
| `/roadmap/now` | The roadmap's current phase: its build, reading and routine, with live progress and the review deck |
```

Replace

```
| `npm run check` | Build, then the full suite (includes the roadmap contract test) |
```

with

```
| `npm run check` | Build, then the full suite (includes the roadmap contract tests) |
```

Replace

```
`/roadmap` has a shared, persisted progress state and a spaced-repetition review deck.
```

with

```
`/roadmap` and `/roadmap/now` share one persisted progress state, and `/roadmap/now` carries the spaced-repetition review deck.
```

Replace

```
- **Edit mode**: click **Edit** on the page and enter `ROADMAP_ADMIN_TOKEN`.
```

with

```
- **Edit mode**: click **Edit** on either page and enter `ROADMAP_ADMIN_TOKEN`.
```

- [ ] **Step 5: Run the suite**

Run: `npm run check`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: describe /roadmap/now in CLAUDE.md and the README"
```

---

## After the plan

These are the owner's steps, not an agent's:

1. Rewrite the placeholder copy listed under Global Constraints if wanted.
2. Push and deploy.
3. Run `npm run og` against the live site and commit `public/og/roadmap-now.png` and the refreshed `public/og/roadmap.png`. Until then the new page's share image is missing. Shooting the local preview would bake zeroed progress into every image.
