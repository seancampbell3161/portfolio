# The current phase, split onto `/roadmap/now`

Design, 2026-09-13.

## 1. Context

`/roadmap` is the Learning page. Its job, in the owner's words, is to show
visitors what he has been working on and where he is headed. The timeline does
that. Everything stacked above it makes the timeline harder to reach.

In order, the page is: the heading, the "Week 2 of 22" band, the seven-phase
ribbon, the three progress meters, the toolbar and timeline with its clip
panels, Retention, the "Progress is shared" note, and the 2-hour day with "How
to read this schedule". At both 1440px and 400px, a visitor scrolls about
1,450px before the timeline begins (48% of the desktop page, 28% of the much
longer phone page).

Two of those sections repeat something else on the page:

- **The ribbon** restates the timeline's Build lane at a coarser grain. Its seven
  phases line up with the milestones, and its dates ("31 Aug 2026") use a second
  format beside the quarter ruler.
- **The band** prints the current phase's reading and foundations lists, and the
  current milestone's clip panel prints the same lists again, alongside that
  milestone's checkpoints and decision logs.

The owner wants the ribbon gone and "what I'm working on right now" on its own
page, reached from `/roadmap`.

## 2. Scope

In:

- Delete the ribbon.
- A new page, `/roadmap/now`, carrying the current phase in depth: the band's
  heading and pairings, the milestone's checkpoints and decision logs, the
  2-hour day, and Retention.
- `/roadmap` keeps the heading, the meters, the toolbar, the timeline and its
  panels, the legend and the note, and gains links to `/roadmap/now`.
- Editing works on both pages.

Out:

- Any change to what is stored, to the progress or review APIs, or to
  `netlify/`.
- Any logic change in `src/scripts/roadmap.ts` or `src/scripts/review.ts`.
- The home page. Its Learning lane still links to `/roadmap#rm-track-*`, and
  those anchors stay on the meters.
- A site-wide `/now` page (considered and declined, §3).
- The known `load()` failure (§12).

## 3. Decisions from brainstorming

1. **The new page is Learning's current phase,** not a site-wide `/now`. The
   home hero already carries a site-wide "Right now" readout; a `/now` page
   would be a third place saying "now".
2. **Retention and the routine move to the new page.** `/roadmap` is past and
   future; the new page is how the work runs today.
3. **Editing works on both pages.** The new page is where the owner ticks off
   today's work; the timeline's panels stay editable for correcting a finished
   milestone or ticking an early chapter.
4. **The URL is `/roadmap/now`.** It nests under Learning the way case studies
   nest under `/building`, and it stays true as phases change. `/roadmap/this-week`
   was rejected: the page covers a whole phase, and 87d09ba fixed exactly that
   week-versus-phase confusion.
5. **Visitors reach it** from a link under `/roadmap`'s heading, from the
   timeline's "now" chip, and from the phone graph's "now" row (the chip's
   equivalent below 900px). No sub-navigation in the transport bar.
6. **Phase blocks and milestone blocks, revealed separately** (§6), over
   rendering only the build day's phase (goes stale between deploys) and over
   one full panel per phase (duplicates Kafka's inputs, §6).
7. **The build comes before the reading** on the new page, because the owner's
   own routine says "Build is the spine" and calls the decision log "the real
   artifact".
8. **The new page's `<h1>` is static.** One heading whichever phase is showing.

This supersedes two rulings of `2026-09-08-roadmap-schedule-design.md` §3:

- **§3.2, "extend `/roadmap` rather than add a second page".** Its reason was
  that a second page "would re-create the two-copies condition that caused the
  drift". That reason no longer holds: §3.3 of the same spec made every date
  derive from `WEEK_ONE`, and both pages render from `src/data/roadmap.ts`.
  The danger was two hand-maintained copies of the plan. Showing one plan on
  two pages is a different thing.
- **§3.4, "all four parts of the mockup earn their place".** The ribbon no longer
  does. The owner ruled it low signal on 2026-09-13.

## 4. What lives where

**`/roadmap`**

1. Eyebrow, title, thesis. Unchanged.
2. A link line under the thesis:
   `<a href="/roadmap/now"><span data-week-label>Week 2 of 22</span> · What I'm working on now →</a>`.
   The label is server-rendered and rewritten on load (§6), so the link never
   names a stale week.
3. The three meters, with their `#rm-track-*` anchors.
4. The toolbar, the arrangement, the phone graph and the clip panels. The "now"
   chip and the phone graph's "now" row become links to `/roadmap/now` (§8).
5. The legend and the "Progress is shared" note.

Removed: the ribbon (deleted), the band, Retention, the routine, and the
`review.ts` import.

**`/roadmap/now`**

1. Eyebrow, a static `<h1>`, and a link back to `/roadmap`.
2. The toolbar (no zoom).
3. The week label, then the phase header: the phase name as `<h2>`, the
   "M1 · Storage" chip, and "Weeks 1–7 · Sep 7 – Oct 24".
4. The build: a heading naming the milestone, then its goal, dates and percent,
   its checkpoints, and its decision logs.
5. The phase's Reading and Foundations pairings.
6. The repeating 2-hour day and "How to read this schedule".
7. Retention, spaced review.
8. The "Progress is shared" note.

The copy of the `<h1>`, the link lines and the page `<title>` above is a
placeholder. The owner writes the final wording.

## 5. States

The page follows `weekOf`'s existing rules, so a Sunday already resolves forward
to the week about to start.

| State | Phase header and pairings | Build | Outside line |
|---|---|---|---|
| Inside M1–M5 | that phase | that phase's milestone | hidden |
| Capstone | Capstone | Kafka (the Capstone's `milestone`) | hidden |
| Ramp week | the ramp | none; the ramp has no `milestone` | hidden |
| Before Week 0 | none | none | shown |
| After the capstone | none | none | shown |

The outside line points to `/roadmap`. The week label reads "The plan starts…"
or "The plan is finished" in those states, as it does today. The routine and
Retention render in every state.

## 6. Revealing the right blocks

**Why two kinds of block.** Phases and milestones are not one to one: M5 and the
Capstone both carry `milestone: "kafka"`. `CheckItem` puts a real `id` on its
input with a matching `<label for>`, and `DecisionLog` builds ids like
`${log.id}-predict-label`. A page rendering one full panel per phase would
print Kafka's checkboxes and logs twice, with duplicate ids. Each thing is
therefore rendered at the level where it is unique:

- **Phase blocks** (7 headers, 7 pairings blocks) contain no form controls.
  `PairingList` has no ids, so repeating it is safe. `PairingList` renders
  nothing for an empty list, but its wrapper block is always rendered, so a
  phase with no reading or foundations items still has its pairings block
  and the count is always 7.
- **Build blocks** (5, one per milestone) contain every checkbox and log input,
  each exactly once.

**The pure function.** `src/lib/roadmap/schedule.ts` gains:

```ts
export function nowShowing(now: Date): { phase: string | null; milestone: string | null };
```

`phase` is `currentPhase(now)?.id ?? null`, and `milestone` is that phase's
`milestone ?? null`. The server render and the client script both call it, as
they both call `weekLabel` today, so they cannot disagree about which blocks
show.

**The hooks.**

| Hook | On | Meaning |
|---|---|---|
| `data-week-label` | the week label on `/roadmap/now`; the link's label on `/roadmap` | rewritten to `weekLabel(now)` |
| `data-now-phase="m1"` | each phase header and each pairings block | shown when it equals `nowShowing(now).phase` |
| `data-phase-start="2026-09-07"` | each phase header only | the Monday of the phase's first week (§10's e2e reads it) |
| `data-phase-milestone="redis"` | each phase header that has a milestone; absent on the ramp | the phase's build milestone (§10's e2e reads it; a plain Node script cannot import the phase table to learn that the Capstone builds Kafka) |
| `data-now-milestone="redis"` | each build block | shown when it equals `nowShowing(now).milestone` |
| `data-now-outside` | the outside line | shown when `phase` is null |

Because the reveal matches every element with a given hook value, a phase's
header and pairings can sit on either side of the build block. The band's
single wrapper `<div>` would not have allowed that order.

**The script.** `src/scripts/roadmap-schedule.ts` stops looking for
`[data-this-week]`. Under `onPage()` it rewrites every `[data-week-label]` on
the page and sets `hidden` on the three reveal hooks. It still only rewrites
text and toggles `hidden`; it never builds DOM. Both roadmap pages import it;
on `/roadmap` only the label is present.

## 7. Components

| Piece | Job |
|---|---|
| `src/pages/roadmap/now.astro` (new) | The page from §4. `<main class="roadmap-page">`, which `roadmap.ts` requires. Imports `roadmap.ts`, `review.ts` and `roadmap-schedule.ts`. `<TransportBar active="learning" />`. |
| `src/components/roadmap/RoadmapNow.astro` (new) | The week label, 7 phase headers, 5 build blocks, 7 pairings blocks and the outside line, all server-rendered, with everything but `nowShowing(buildDay)` `hidden`. Replaces `ThisWeek.astro`. |
| `src/components/roadmap/MilestoneBuild.astro` (new) | A milestone's goal, dates with `data-milestone-pct`, its `CheckItem` rows and its `DecisionLog`s, with a default `<slot />` between the checkpoints and the logs. `RoadmapInspector`'s Build panel passes its pairings into the slot, so that panel renders exactly as it does today; the new page passes nothing. The checkpoint wording ("7 stages · ~11h") then has one definition. |
| `src/components/roadmap/RoadmapToolbar.astro` (new) | Lifted from `RoadmapArrangement`: `.rm-toolbar` with `#rm-save-state` and `#rm-edit`, then `#rm-message` and `#rm-clip-live`, with a default slot for the zoom group. `RoadmapArrangement` renders it above `.rm-arr`, passing its zoom group; the new page renders it with nothing. Every id both scripts look up exists on both pages. |
| `RoadmapArrangement.astro` | Loses the toolbar markup. The "now" chip and phone "now" row become links (§8). |
| `RoadmapInspector.astro` | Its Build panel uses `MilestoneBuild`. Reading and Foundations panels unchanged. |
| `src/pages/roadmap.astro` | Loses `ThisWeek`, `RoadmapArc`, `RetentionSection`, `RoadmapPractice`, the `review.ts` import and its `<style>` block (§9). Gains the link line. |
| `RetentionSection.astro`, `RoadmapPractice.astro` | Move to the new page unchanged. |
| Deleted | `RoadmapArc.astro`, `ThisWeek.astro`. |

## 8. Links into `/roadmap/now`

- **Under `/roadmap`'s thesis**: the link line in §4.
- **The "now" chip.** The playhead has `pointer-events: none` and is not
  `aria-hidden`; `roadmap-arrangement.ts` only rewrites its `--ph` on a zoom. The
  chip becomes
  `<a class="rm-now-chip" href="/roadmap/now">now<span class="sr-only"> · what I'm working on</span></a>`
  with `pointer-events: auto` on the chip alone. Today's rule targets
  `.rm-playhead span`, which would also style the `sr-only` span, so it moves
  to `.rm-now-chip`. The accessible name starts with the visible word "now".
- **The phone graph's "now" row** wraps its chip in the same kind of link, with
  the same class-based rule replacing `.rm-graph-now span`.

The chip sits on top of whichever clip it crosses, so a click on the chip itself
goes to `/roadmap/now` rather than that clip. The chip is small, and the rest
of the clip stays clickable.

None of these links is intercepted by a script, so they keep the site-wide
hover prefetch and need no `data-astro-prefetch="false"`.

## 9. Editing across two pages and styles

**Editing.** No logic changes. Three properties of the existing scripts make
two editable pages safe:

- `save()` posts the in-memory `completed` set loaded from the server, and
  `onToggle` adds or removes one id in it. The checkboxes only mirror that set,
  so a page showing one milestone's checkboxes cannot erase the rest.
- A navigation flushes a pending save, and the next page's `load()` waits for
  it through `pendingFlush`. That is the path from `/roadmap/now` to `/roadmap`.
- `review.ts` unlocks on load from a stored token and on a click of `#rm-edit`,
  which the new page has.

This depends on the browser holding **one** instance of `roadmap.ts`. Rollup
puts a module imported by two page entries into a shared chunk, and the site
already relies on that for `lifecycle.ts`'s single `cold` flag. If a build ever
inlined `roadmap.ts` into each page's bundle, two instances would each register
`onPage(initRoadmap)` and one toggle would schedule two saves. §10 guards it.

**Styles.** The `<style is:global>` block in `roadmap.astro` moves verbatim to
`src/styles/roadmap.css`, minus the `.rm-arc*` rules. Both pages import it, as
`Reader.astro` imports `reader.css`. The band's card rules (`.rm-week*`) are
adjusted, because on the new page the phase header opens the page rather than
sitting in a card inside it. The build block takes the clip panel's rules for
its goal, facts and checkpoints. The final look is checked with `npm run shots`
at both widths.

## 10. Testing

**Unit.** `src/lib/roadmap/__tests__/schedule.test.ts` gains `nowShowing`:

- inside M1: `{ phase: "m1", milestone: "redis" }`
- ramp week: `{ phase: "ramp", milestone: null }`
- M5 and the Capstone both give `milestone: "kafka"`
- before Week 0 and after the capstone: both null

**Contract, `/roadmap`.** `src/__tests__/roadmap-contract.test.ts` keeps: the page
root, the toolbar and meter ids, the toolbar before `.rm-arr`, a checkbox for
every leaf id, the percentage hooks, the clip hooks on all three surfaces, every
decision log, and the Redis panel's pairings. It drops the review deck ids,
the five band tests and the ribbon test. It adds:

- no `data-roadmap-arc`, `data-this-week` or `id="rv-runner"`
- a link to `/roadmap/now` containing `data-week-label`
- the "now" chip and the phone "now" row each link to `/roadmap/now`
- every `id` attribute on the page is unique

**Contract, `/roadmap/now`.** A new `src/__tests__/roadmap-now-contract.test.ts`
reads `dist/roadmap/now/index.html`, skipped without a build:

- the page root, the toolbar ids (`rm-edit`, `rm-message`, `rm-save-state`,
  `rm-clip-live`), every review deck id, and the rating and thread-count hooks
- 7 headers carrying `data-phase-start`, 7 pairings blocks, 5 `data-now-milestone`
  blocks
- at most one phase visible; when one is, its visible build block is that
  phase's `milestone`, or none for the ramp
- a week label naming a week means a phase is visible
- `data-now-outside` is hidden exactly when a phase is visible
- every build checkbox (the group ids under `build`) and every decision log
  appears exactly once
- every `id` attribute on the page is unique
- moved from the band's tests: the visible header carries its `phaseSpanText`
  and label; M1's pairings print each book title once; a foundation item's
  workload is derived, never a bare number

**Contract, transitions.** `src/__tests__/transitions-contract.test.ts` adds
`"roadmap now": "dist/roadmap/now/index.html"` to `PAGES`.

**E2E.** In `scripts/interactions.mjs`:

- **The stale-visit block moves to `/roadmap/now`.** It reads each phase header's
  `data-now-phase`, `data-phase-start` and `data-phase-milestone`, and its week
  numbers from the span text (`phaseSpanText`'s unit-tested format), replacing
  the ribbon it read before. It keeps its checks (the label recomputes, exactly one phase shows,
  it is the right phase, its heading matches) and adds two: the revealed build
  block is that phase's milestone, and `/roadmap`'s link label recomputes under
  the same fixed clock.
- **A save crosses pages.** With a stored token and a fixed clock inside a phase
  that has a milestone, tick a checkpoint on `/roadmap/now` and click the link
  back to `/roadmap` inside the debounce. The POST lands before the debounce
  could have fired it, and `/roadmap`'s build meter shows the change. The mock
  stores the posted body and serves it on the next GET.
- **One instance.** Go from `/roadmap` to `/roadmap/now` through the heading link,
  tick one checkpoint, and expect exactly one POST.
- **The links.** At 1280px the "now" chip lands on `/roadmap/now`; at 400px the
  "now" row does.
- vt3, vt4 and the progress-repaint block stay on `/roadmap`. They drop their
  `/api/review` mocks and the comments saying `review.ts` runs there, so a
  stray review fetch fails `watch()` instead of being absorbed by a mock.

`npm run check` covers the unit and contract tests; `npm run e2e` needs
`npm run preview`.

## 11. Screenshots, share images, docs

- `scripts/screenshots.mjs` adds `{ name: "roadmap-now", path: "/roadmap/now" }`.
- `src/lib/og.mjs` adds `{ route: "/roadmap/now", name: "roadmap-now" }`, and the
  new page's `<Layout image>` uses `ogImagePath("roadmap-now")`.
- `CLAUDE.md`: the Roadmap page section is rewritten for the two pages,
  `RoadmapNow`, `MilestoneBuild`, `RoadmapToolbar`, `nowShowing` and
  `roadmap.css`; the no-script paragraph names the new page's zeroed numbers;
  the `shots` and `e2e` command descriptions name the new page and checks.
- `README.md`: `/roadmap/now` joins the routes table, and "Roadmap operations"
  says edit mode works on both pages.

## 12. Known and out of scope

- **A failed first load can overwrite saved progress.** If `load()` throws,
  `completed` stays empty, and one toggle in edit mode posts that near-empty set
  over the stored one. This predates the split and exists on `/roadmap` today.
  Not fixed here.
- **The phone graph's "now" row prints the build day.** It is not recomputed on
  load. Pre-existing; the link added here does not change it.
- **Without JavaScript** the new page shows the build day's phase and milestone,
  with disabled checkboxes, a 0% milestone, and zeroed Retention counts. This
  is the same documented gap `/roadmap` has.

## 13. Files

Added:

- `src/pages/roadmap/now.astro`
- `src/components/roadmap/RoadmapNow.astro`, `MilestoneBuild.astro`, `RoadmapToolbar.astro`
- `src/styles/roadmap.css`
- `src/__tests__/roadmap-now-contract.test.ts`

Changed:

- `src/pages/roadmap.astro`
- `src/components/roadmap/RoadmapArrangement.astro`, `RoadmapInspector.astro`
- `src/lib/roadmap/schedule.ts`, `src/lib/roadmap/__tests__/schedule.test.ts`
- `src/scripts/roadmap-schedule.ts`
- `src/__tests__/roadmap-contract.test.ts`, `src/__tests__/transitions-contract.test.ts`
- `scripts/interactions.mjs`, `scripts/screenshots.mjs`, `src/lib/og.mjs`
- `CLAUDE.md`, `README.md`

Deleted:

- `src/components/roadmap/RoadmapArc.astro`, `src/components/roadmap/ThisWeek.astro`

## 14. After the merge

Deploy, then run `npm run og` against the live site and commit the result. That
creates `public/og/roadmap-now.png` and refreshes `roadmap.png`, which still
shows the ribbon and band. Until then the new page's share image is missing.
Shooting the local preview instead would bake zeroed progress into every image,
because the preview server has no progress API.
