# Arrangement, sub-project 3: Roadmap

Design spec, 2026-09-02. Approved section by section in brainstorming the same day.

## 1. Context

This is the third of the four sub-projects carrying the Arrangement redesign across seanthedeveloper.com. The foundation (`docs/superpowers/specs/2026-09-02-arrangement-foundation-home-design.md`) set the language and the timeline model in `src/lib/timeline/`; the writing sub-project (`docs/superpowers/specs/2026-09-02-arrangement-writing-design.md`) rebuilt the blog. The roadmap page still wears the new palette and transport bar over its old structure: a five-stat dashboard and stacked `<details>` cards for the Build, Reading, and Foundations tracks, with a token-gated edit mode and a spaced-repetition review deck layered on top.

This sub-project rebuilds the roadmap page as an arrangement, the form the redesign was built for: three lane-threads on a calendar axis, milestones as clips, planned work as dashed outlines past the playhead, and an inspector that opens a clip's checkpoints and its two-phase decision logs. It also closes a loop from sub-project 1: the home page's Learning lane stops reading the hand-authored `src/data/learning.ts` and derives from the roadmap.

The roadmap is server-rendered Astro with vanilla-JS progressive enhancement, no framework islands. Progress and the review deck are token-gated writes to Netlify Blobs through hand-written functions under `netlify/`. Both are well-tested at the data and handler layers, and this sub-project keeps that whole mechanism: the stored-data contract does not change, so the handler tests stay green and only the page's markup and styling move.

## 2. Scope

In scope:

- The roadmap page at `/roadmap`, rebuilt as an arrangement.
- Planned dates added to the roadmap content, and a grouping layer for Foundations.
- The editable inspector: checkpoints and the two-phase decision logs per clip.
- Edit mode carried across unchanged in behaviour.
- The spaced-repetition review surface, restyled and rewired, its logic untouched.
- The home page's Learning lane derived from the roadmap; `src/data/learning.ts` retired.

Out of scope, and left where they are: the progress and review Netlify functions and their stored-data shapes (`netlify/functions/progress.ts`, `review.ts`, and the handlers and stores under `netlify/lib/`); the SM-2 scheduling and the review card set; the newsletter; the standalone HTML files under the repo-root `roadmap/` directory, which no loader reads. Regenerating the roadmap share image happens after this deploys, in the everything-else sub-project.

## 3. Decisions from brainstorming

- **Real planned dates (not sequence or hybrid).** Every clip gets a start and an end; the ruler is a true calendar into 2027. Status is derived from dates and completion, never authored.
- **The architecture reuses the shared positioning math, with roadmap-specific components.** `src/lib/timeline/layout.ts` (positions, packing, label widths) is reused; a roadmap-specific window and tick helper handle the quarter calendar. The arrangement, the meters, and the editable inspector are new roadmap components; `CheckItem` and `DecisionLog` are reused as they are. Rejected: extending the home `Timeline.astro`/`Inspector.astro` to serve both pages (would load edit-mode concerns into home components), and a fully bespoke arrangement (would duplicate tested math and let the two arrangements drift).
- **The home Learning lane shows three thread spans** (Build, Reading, Foundations), each running from its earliest child start to its latest child end. Rejected: one clip per current item, and one clip per milestone.
- **100Devs and Leon Noel's testimonial come off the timeline.** The content is preserved unreferenced in the repo; where it belongs, if anywhere, is a later decision.
- Reference mockup (gitignored): `.superpowers/brainstorm/94902-1788329608/content/arrangement-v2.html`, the `#s-roadmap` section.

## 4. The dated data model

`src/data/roadmap.ts` stays the single source of roadmap content and stays pure framework-agnostic TypeScript, since the Netlify function imports its id set. The load-bearing rule is unchanged: **leaf ids never change**, because progress is stored by id. This sub-project adds dates and one grouping layer; it does not rename or restructure any leaf id.

Dates are `Date` objects at UTC midnight, written `new Date("YYYY-MM-DD")` (date-only ISO parses as UTC), month precision, authored by Sean and placeholder until supplied.

- **Build.** `BuildMilestone` gains `start: Date` and `end: Date`. The five milestones become five clips.
- **Reading.** `Book` gains `start: Date` and `end: Date`. The four books become four clips.
- **Foundations.** Today `foundations` is a flat `FoundationItem[]` of 22 items, too many for one lane. It becomes `FoundationGroup[]`:

  ```ts
  export interface FoundationGroup {
    id: string;        // new; used only for the clip and its inspector anchor
    label: string;
    start: Date;
    end: Date;
    items: FoundationItem[];  // the existing items, ids unchanged
  }
  export const foundations: FoundationGroup[];
  ```

  The starting shape is the mockup's two groups, Courses and NeetCode 150. Every existing `FoundationItem.id` is preserved as a group child, so no stored progress is orphaned and the Netlify allowlist stays valid. The group ids are new and are never written to the progress blob.

`allIds` and `logIds` keep the same membership. `allIds` now flattens the foundation groups (`foundations.flatMap((g) => g.items)`) to gather the same leaf ids it gathers today; `logIds` is unchanged. `deriveStats` keeps its exported `RoadmapStats` shape and its numbers unchanged; internally its foundations pass iterates the groups' items (`itemsTotal = foundations.reduce((n, g) => n + g.items.length, 0)`) instead of the old flat length. The `RoadmapStats` fields the client script writes (`build.stagesDone`, `build.stagesTotal`, `build.coursesDone`, `build.coursesTotal`, `build.perMilestone`, `reading.chaptersDone`, `reading.booksDone`, `reading.perBook`, `foundations.itemsDone`, `foundations.itemsTotal`, `logsDone`, `logsTotal`) all stay.

## 5. Status derivation and the two projections

The pure work lives in a new tested module, `src/lib/roadmap/arrange.ts`, beside the existing timeline math. It imports the content and `deriveStats` from `src/data/roadmap.ts` and the positioning helpers from `src/lib/timeline/layout.ts`; it has no Astro or DOM dependency.

**Status.** A roadmap clip is one of three states, derived, never stored:

```ts
export type ClipStatus = "done" | "in-progress" | "planned";
```

Given a clip's children (its stage-groups, chapters, or foundation items), the count completed, its `start`, and `now`:

- `planned` when `start > now` and nothing is complete;
- `done` when every child id is complete;
- `in-progress` otherwise.

`done` maps to a solid clip, `in-progress` to striped, `planned` to a dashed outline.

**Roadmap clips.** `roadmapClips(completed: Set<string>, now: Date): RoadmapClip[]` builds every clip from the three content arrays. A `RoadmapClip` carries the fields the shared layout helpers read (`title`, `start`, `end`, `kind`) plus the roadmap specifics:

```ts
export interface RoadmapClip {
  id: string;          // milestone / book / foundation-group id
  track: Track;        // "build" | "reading" | "foundations"
  title: string;
  sublabel?: string;   // e.g. "3 of 4 checkpoints", "chapter 5 of 12"
  start: Date;
  end: Date;
  kind: "span";        // every roadmap clip is a span
  status: ClipStatus;
  href: string;        // "#clip-<id>", the inspector anchor
}
```

Clips reuse `positionIn`, `packLane`, and `estimateLabelWidth` from `layout.ts` for their x, width, and row within a lane. Those helpers read only `title`, `start`, `end`, and `kind`, so the plan widens their parameter type to that positioning subset (which both `TimelineItem` and `RoadmapClip` satisfy) rather than forcing a clip to be a full `TimelineItem`.

**Thread spans (for the home page).** `threadSpans(now: Date): TimelineItem[]` returns three learning-lane items, one per track, each spanning its earliest child start to its latest child end. Each is a `TimelineItem` with `lane: "learning"`, `kind: "span"`, an id like `roadmap-build`, `href: "/#item-roadmap-build"`, and a `body` of the learning inspector shape (`{ lane: "learning", description, roadmapHref }`) whose `roadmapHref` is `/roadmap#rm-track-<track>`. Status is `done` if every clip in the track is done, else `in-progress`.

**Window and ticks.** Two helpers in the roadmap module, reusing `fraction` from `layout.ts`:

```ts
export type RoadmapZoom = "span" | "all";   // "span" = 2026 to 2027
export function roadmapWindow(zoom: RoadmapZoom, now: Date, clips: readonly RoadmapClip[]): Window;
export function quarterTicks(w: Window): Tick[];   // Q1/Q2/Q3/Q4, year label at Q1
```

`roadmapWindow("span", …)` is the fixed calendar from `2026-01-01` to `2027-12-31`; `roadmapWindow("all", …)` runs from the earliest clip start to the later of the latest clip end and the end of 2027. `quarterTicks` emits a tick per quarter across the window, labelling Q1 with the year (as in the mockup: `2026`, `Q2`, `Q3`, `Q4`, `2027 Q1`, …).

## 6. The arrangement

`/roadmap`, top to bottom at 900px and wider. The page keeps its URL, its meta description, and its share image (`ogImagePath("roadmap")`).

1. The transport bar, Learning underlined, no zoom control (the arrangement carries its own).
2. The hero, kept verbatim: the eyebrow, the h1 "Building engineering judgment" (with `judgment` in the display emphasis it uses today), and the thesis paragraph.
3. A header row: the zoom control on the left with two buttons, "2026 to 2027" and "All"; on the right the save-state indicator (`#rm-save-state`) and the owner's Edit button (`#rm-edit`), moved here from the retired dashboard. The message line (`#rm-message`) sits under the row.
4. Three progress meters, `RoadmapMeters.astro`: Build in `--lane-building`, Reading in a reading token, Foundations in a foundations token, each a labelled bar with a percent and a one-line summary. They render zeroed at build (`deriveStats([])`) and the client script fills them from live progress, keeping the element ids the script writes to (see §8).
5. The arrangement, `RoadmapArrangement.astro`: a quarter ruler from `quarterTicks`, three lanes each with a head (`#rm-track-build`, `#rm-track-reading`, `#rm-track-foundations`; these anchor ids are preserved because the home Learning inspector links to them), clips packed into rows by the shared layout math, and the playhead at now. Clip styles follow status: solid done, striped in-progress, dashed-outline planned. A clip is a link to its inspector anchor (`#clip-<id>`).
6. A legend: done, in progress, planned.
7. The inspector (§7), then the review surface (§9), then the footer.

**Colours.** The three tracks get their own tokens, per the redesign direction: add `--track-build: #60A5FA`, `--track-reading: #5FB3AC`, `--track-foundations: #9DB4D6` to `src/styles/global.css`. Build's blue equals `--lane-learning`, which is deliberate: the roadmap is the Learning lane seen up close.

**Zoom.** Two windows, "2026 to 2027" (default) and "All". The choice is remembered in `localStorage` under a roadmap-specific key, matching how the home timeline remembers its zoom. Without JavaScript the default window renders and the buttons are inert, as on the home page.

**Mobile, below 900px.** The arrangement becomes the vertical graph the home page uses on phones: the three lanes stacked into one date-ordered column with a lane-coloured gutter, clips as rows. The inspector opens inline. No desktop toggle, matching sub-project 1. The graph reuses the home page's graph approach; its roadmap-specific rendering lives in the roadmap components and script.

## 7. The editable inspector

`RoadmapInspector.astro` server-renders one panel per clip, shown by the CSS `:target` mechanism without JavaScript and by the client script with it, exactly as the home inspector works (`html:not(.js) .insp:target, .insp[data-open]`). Panels carry `scroll-margin-top` to clear the fixed transport bar, as the home inspector does. Each panel (`id="clip-<id>"`) holds:

- A kicker "{Track}, {status}", the title, and the milestone goal, book scope note, or group description.
- The checkpoints, rendered by the existing `CheckItem` component: a milestone's `groups` (label plus stage count), a book's `chapters`, or a foundation group's `items`. Checkboxes are `disabled` until edit mode, carrying `data-id="<leaf id>"` exactly as today.
- For Build milestones, the two-phase decision logs, rendered by the existing `DecisionLog` component with its `data-log-id` and `data-log-field` hooks unchanged.
- A facts block: the date range and the stage or chapter totals. Per-milestone and per-book percents render here in the elements the client script targets (`[data-milestone-pct]`, `[data-book-pct]`).

Because every checkbox, log field, and percent target keeps the same `data-*` attribute and the same element-id contract the current cards use, edit mode is unchanged: the client enables every disabled control across all panels, each change re-renders optimistically, and the debounced POST saves the full state. Only the markup moved from `<details>` cards into these panels.

Panels for every clip are server-rendered whether or not the clip is currently targeted, so a deep link (`/roadmap#clip-redis`) opens the right panel with no JavaScript, and edit mode reaches every panel.

## 8. Live progress and the client script

`src/scripts/roadmap.ts` keeps its whole data path: `load()` fetching `/api/progress`, the `completed` set and `logEntries` map, `deriveStats`, the 500ms debounced `save()` POST with the Bearer token, `onEditClick` prompting for and storing the token in `sessionStorage`, and the 401-clears-token behaviour. What changes is where `render()` writes, because the markup moved:

- The meter numbers and bars keep their element ids (`rm-build-stages`, `rm-build-courses`, `rm-build-bar`, `rm-read-ch`, `rm-read-books`, `rm-read-bar`, `rm-fnd-done`, `rm-fnd-bar`, `rm-logs-done`), so `setText`/`setWidth` calls are unchanged. The retired dashboard's fourth and fifth stats (a separate decision-logs stat card and the retention stat) are gone from the header; `logsDone` now updates wherever the logs total is shown, and the retention numbers move to the review section (§9).
- The per-clip percents (`[data-milestone-pct]`, `[data-book-pct]`) now live in the inspector panels; the iteration over them is unchanged.
- A clip's own status class (solid/striped/dashed) is server-rendered from the build-time-zeroed state and recomputed on the next page load, not mid-edit. `render()` updates the meters and the checkbox states live; it does not restyle clips as items are checked. This keeps the render path simple and matters only to the one owner editing.

The `.roadmap-page.rm-editing` class hook and the `input[data-id]` / `[data-log-field]` enabling in `setEditable` are unchanged.

## 9. The review surface

The spaced-repetition deck stays a distinct section below the arrangement, `RetentionSection.astro`, restyled to the console palette. Its logic is untouched: `src/scripts/review.ts`, `netlify/functions/review.ts`, the SM-2 module, the `review` Blobs store, the token gate on both read and write, and the unlock-on-completion rule all stay. It keeps riding the same admin token in `sessionStorage`, so unlocking edit mode still reveals the runner.

The one wiring change: the retention numbers the dashboard used to show (`#rv-dash-rotation`, `#rv-dash-due`, `#rv-dash-streak`) move into the review section's own summary, which already has a public rotation summary (`#rv-rotation-summary`) and the gated runner. `review.ts` updates those numbers in their new home; the fetch, SM-2 scheduling, and save paths do not change.

## 10. The home Learning lane

`src/data/learning.ts` is retired. `src/lib/timeline/sources.ts` drops `fromLearning` and gains `fromRoadmap`, which calls `threadSpans(now)` (§5) to produce the three learning-lane items. `src/lib/timeline/astro.ts` `getTimeline()` calls `fromRoadmap` instead of reading the learning data, passing `now`. The rest of `getTimeline` is unchanged; the merged item list still validates for unique ids.

100Devs and Leon Noel's testimonial move to `src/data/parked/hundred-devs.ts`, an exported constant that nothing imports, so the content and the testimonial survive verbatim for a later decision. A one-line comment says why it is parked and points at this spec.

The home page's Learning lane thus shows three spans; clicking one opens the home inspector (read-only, learning shape) whose body links into the roadmap thread. This matches the foundation spec's rule that learning clips link to `/#item-<id>` and the roadmap anchor lives inside the inspector.

## 11. Files

New:

- `src/lib/roadmap/arrange.ts`: `ClipStatus`, `RoadmapClip`, `RoadmapZoom`, `roadmapClips`, `threadSpans`, `roadmapWindow`, `quarterTicks`, and the status helper.
- `src/lib/roadmap/__tests__/arrange.test.ts`.
- `src/components/roadmap/RoadmapArrangement.astro`, `RoadmapMeters.astro`, `RoadmapInspector.astro`.
- `src/data/parked/hundred-devs.ts`.

Changed:

- `src/data/roadmap.ts`: dates on `BuildMilestone` and `Book`; `FoundationGroup` and `foundations: FoundationGroup[]`; `allIds` flattens groups; `deriveStats` foundations pass iterates groups. Exported `RoadmapStats` shape unchanged.
- `src/data/__tests__/roadmap.test.ts`: updated for the grouped foundations shape; the id counts and `deriveStats` numbers stay the same.
- `src/pages/roadmap.astro`: rebuilt around the arrangement, meters, inspector, and review section.
- `src/scripts/roadmap.ts`: `render()` rewired to the new markup; data path unchanged.
- `src/scripts/review.ts`: retention numbers written to the review section instead of the dashboard.
- `src/components/roadmap/RetentionSection.astro`: restyled; carries the retention summary numbers.
- `src/lib/timeline/sources.ts`: `fromLearning` replaced by `fromRoadmap`.
- `src/lib/timeline/astro.ts`: `getTimeline` calls `fromRoadmap(now)`.
- `src/styles/global.css`: `--track-build`, `--track-reading`, `--track-foundations`.
- `CLAUDE.md`: the architecture note for the roadmap arrangement and the derived Learning lane.

Retired:

- `src/data/learning.ts`.
- `src/components/roadmap/RoadmapDashboard.astro` (replaced by `RoadmapMeters.astro`).
- `src/components/roadmap/Milestone.astro`, `BookCard.astro`, `FoundationsSection.astro` (their content moves into the arrangement and the inspector; `CheckItem` and `DecisionLog` survive).

`CheckItem.astro` and `DecisionLog.astro` are unchanged and reused.

## 12. Accessibility

The arrangement is a list of clips, each a real link to its panel, as on the home page. Panels are real regions reachable by `:target` without JavaScript, with `scroll-margin-top` clearing the fixed bar. Checkboxes keep their labels; decision-log fields keep the `aria-labelledby` wiring they already have. The meters use `role="status"`/`aria-live` where they announce saved state, as the dashboard does now. The lane gutter on mobile is decorative and lives in pseudo-elements. Dates render through `src/lib/dates.ts` (UTC). Focus rings are visible on every clip link and control. Nothing animates except the home page's existing playhead draw-in, which the roadmap does not need.

## 13. Testing

Vitest, `src/lib/roadmap/__tests__/arrange.test.ts`:

- `roadmapClips`: status derivation across done (all children complete), in-progress (some complete, or started and past its start), and planned (start after now, nothing complete); the sublabel counts; every clip is a span.
- `threadSpans`: three items, one per track; each spans the earliest child start to the latest child end; status done only when all clips in the track are done; the `roadmapHref` points at the right lane anchor.
- `roadmapWindow`: the fixed 2026-to-2027 span; the "all" window from the earliest start to the later of the latest end and the end of 2027.
- `quarterTicks`: eight quarter ticks across the two-year span, with the year label on each Q1.

`src/data/__tests__/roadmap.test.ts` is updated for the grouped foundations shape while keeping the same id counts and `deriveStats` numbers. The existing progress and review handler tests (`netlify/lib/__tests__/handlers/`) stay green untouched, which is the proof that the stored-data contract did not change. Build: `npm run build` succeeds and `npm run shots` captures the roadmap at both widths. Edit mode and the review runner are checked by hand under `netlify dev`, which they already require for the token and the Blobs stores.

## 14. Inputs needed during implementation

Start and end months for the five Build milestones, the four Reading books, and the two (or more) Foundations groups. Month precision is fine. Until Sean supplies them, the plan uses placeholder dates drawn from the mockup and marks them with a comment, exactly as sub-projects 1 and 2 did.
