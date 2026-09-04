# Arrangement, sub-project 4: Everything else

Design spec, 2026-09-03. Approved section by section in brainstorming the same day.

## 1. Context

This is the last of the four sub-projects carrying the Arrangement redesign across seanthedeveloper.com. The foundation (`docs/superpowers/specs/2026-09-02-arrangement-foundation-home-design.md`) set the language and the timeline model in `src/lib/timeline/`; the writing sub-project (`docs/superpowers/specs/2026-09-02-arrangement-writing-design.md`) rebuilt the blog as the Writing lane played vertically; the roadmap sub-project (`docs/superpowers/specs/2026-09-02-arrangement-roadmap-design.md`) rebuilt the roadmap as an arrangement and derived the home Learning lane from it.

What remains is the set of pages and loose ends those specs deferred here: project detail beyond the home inspector, the community entries as confirmed data, the 404 and newsletter result pages (the last pages in the old design and the last users of the old blue accent), the README, share images, and a list of small items parked at the end of sub-project 3. It also settles two things left open: where Leon Noel's testimonial lives, and whether 100Devs stays on the site.

## 2. Scope

In scope:

- A Building index at `/building` and one page per project at `/building/<slug>`.
- The writing track generalized so the Building index and the project sidebar reuse it, and the essay layout split into a shared reading frame and the essay content.
- The home inspector simplified: it links to the project page instead of rendering the case study inline.
- Leon Noel's testimonial in the contact block; 100Devs and its parked file removed.
- Community entries with confirmed dates, links, and link labels.
- The 404 page and the three newsletter result pages redesigned; the old accent tokens retired.
- The roadmap leftovers from sub-project 3, each with a decision in §9.
- README rewritten; `CLAUDE.md` updated; share images regenerated after deploy.

Out of scope: tag pages, series, per-essay or per-project share cards (essays and projects fall back to their section's card), a Community index page (the lane has three entries; the Track component makes one cheap to add later), photos for community entries, a per-project decision log, and the standalone HTML files under the repo-root `roadmap/` directory, which no loader reads. The Netlify functions and their stored-data shapes are untouched, as in sub-project 3.

## 3. Decisions from brainstorming

- **Projects get pages, and Building gets an index (option A).** Rejected: pages without an index (leaves the nav asymmetric with nowhere that lists the projects), and inspector-only with a richer panel (a project never gets its own URL, title, or share image).
- **The project body stays free-form MDX; no schema additions.** The four headings (Problem, Solution, Tradeoffs, Impact) remain a convention. Rejected: a cover-image field, and a per-project decision log (a second decision-log data model next to the roadmap's, which is bound to the Netlify store).
- **No Community page.** Entries get real dates and a link each where one exists. Rejected: a `/community` index (three rows), and photos in the inspector.
- **Testimonial in the contact block; 100Devs off the site (option B).** The quote sits at the hiring moment. The parked file is deleted and the Learning lane stays fully derived from the roadmap. Rejected: 100Devs back on the Learning lane as one hand-authored span, and leaving both parked.
- **The 404 is an empty position on the arrangement (option A).** Rejected: a plain text 404 in the new tokens.
- **One shared result panel for the three newsletter pages.**
- **Architecture: generalize the writing track (approach 1).** The track module becomes lane-agnostic, the essay layout splits into a shared reading frame plus content, and the project page fills the same frame. Rejected: a sibling `building.ts` and `BuildingTrack` with their own styles (duplicates tested row math, the gutter CSS, and the reading-frame styles, which would drift), and rendering the Building index from the home page's phone graph (a layout of the whole timeline with global styles; carving one lane out is coupling, not reuse).

## 4. The Building pages

### 4.1 URLs and navigation

The index lives at `/building`. Each project lives at `/building/<slug>`, where the slug is the MDX filename under `src/content/projects/`, which is already the timeline id. The transport bar's Building link points at `/building` and is active, underlined in coral, on the index and on every project page.

The project adapter in `src/lib/timeline/sources.ts` sets each project's `href` to its page. On the home page a clip click still opens the inspector (the client script intercepts it); without JavaScript the clip is a plain link to the project page, as an essay clip is to its essay.

### 4.2 The index

The Building lane played vertically, in the writing index's structure: a page head with the count and the date range in the writing index's form ("4 projects, Jun 2023 to now"), the track, the footer. No newsletter block. Rows are ordered newest start first, with a now row on top and a year row before the first project of each start year.

An entry row's mono column shows the range on two lines: the start month and year, then "to Sep 2024", or "to now" while in progress. Each date is a `<time>` element. The body shows the title as the row's one link, the description, and the stack in small text where the writing index shows tags. The gutter node for a span entry is a short bar rather than a dot: solid for done and live, striped for in progress, in the lane color.

### 4.3 The project page

The same two-column reading frame as an essay (§5.2). The article column holds:

- A kicker: the coral square, then "Building, " followed by the when text (§5.1): "in progress since June 2026", "March 2024 to September 2024, live", "September 2024 to April 2025".
- The title as the `h1`, the description as the standfirst.
- The MDX body, with the essay's prose styles. No subscribe block.

The sidebar holds, in order:

- A "Building" kicker.
- A facts list: Stack; Started; Ended, or Status when there is no end; Site when `url` is set; Source when `source` is set. Dates through the dates module.
- The track segment, labelled "Nearby projects": the current project ringed between its neighbours by start date, headed by the now row for the newest project or "N newer, all projects", and tailed by "N older, all projects" when any remain. Both links go to `/building`.
- "While building": the essays published within the project's span, and the roadmap threads and community entries that overlap it (§5.1, `during`), ordered writing, learning, community, rendered by the shared `WhileList` (§5.2). Omitted when empty.

Below 900px the order is article, then sidebar, as on essays.

### 4.4 The home inspector

`Inspector.astro` stops rendering project MDX and loses its `projects` prop; `src/pages/index.astro` stops passing it. A building panel shows the description, the facts column (Stack, Started, Status), and links: "Read the case study" to the project page, then Site and Source when set, then Close. Community panels label their link with the entry's `linkLabel`, falling back to "Details" (§6.3). The learning quote markup goes (§6.1). Kicker and facts dates use the shared helpers (§5.1) instead of `toLocaleDateString`.

### 4.5 Share images

`src/lib/og.mjs` gains `{ route: "/building", name: "building" }`. The index passes `ogImagePath("building")`; project pages pass the same, since per-project cards are out of scope. Essays without a hero image pass `ogImagePath("blog")` instead of falling through to the home card. Images regenerate against live after deploy (§13).

## 5. The track module and shared components

### 5.1 `src/lib/timeline/track.ts`

Pure, as today. The essay shape becomes a lane-agnostic entry:

```ts
export interface TrackEntry {
  id: string;
  href: string;
  title: string;
  start: Date;
  end?: Date;
  status: Status;      // essays are "done"
  description?: string;
  tags?: string[];     // essay tags, or a project's stack
  minutes?: number;    // essays only
}
export type EntryRow = TrackEntry & { kind: "entry"; current?: boolean };
export type TrackRow =
  | { kind: "now"; label: string }
  | { kind: "year"; label: string }
  | { kind: "more"; label: string; href: string }
  | EntryRow;
export interface TrackIndex { href: string; noun: string }  // { href: "/blog", noun: "essays" }
```

- `sortEntries(entries)`: newest `start` first, ties by id. Replaces `sortEssays`.
- `indexRows(entries, now)`: unchanged in shape; year rows come from the start year.
- `segmentRows(entries, currentId, now, index)`: the "more" rows read `"${n} newer, all ${index.noun}"` and `"${n} older, all ${index.noun}"` and link to `index.href`. The writing pages pass `{ href: "/blog", noun: "essays" }`; the project page passes `{ href: "/building", noun: "projects" }`.
- `readingMinutes` and `writtenWhile` are unchanged. `writtenWhile` keeps its rule: spans overlap the exact publish date, moments within 14 days.
- `during(items, span, now, exclude)`: `span` is `{ start: Date; end?: Date }`, run to `now` when it has no end (the current project may be in progress). Returns items whose lane is not `exclude` and that overlap the span: a span item when its own effective range (its end, or now while in progress) intersects, a moment when its start falls inside, both inclusive. Ordered by lane in `LANES` order with `exclude` removed, then start, then id. Shares one overlap helper with `writtenWhile`.
- `rangeText(start, end?)`: "March 2024 to September 2024"; the single month and year when both fall in the same month; when there is no end, "since March 2024".
- `whenText({ status, start, end })`: the kicker and inspector wording, one rule for every page:
  - in progress: `in progress since ${monthYearLong(start)}`
  - planned: `planned, ${rangeText(start, end)}`
  - live: `${rangeText(start, end)}, live`
  - done with an end: `rangeText(start, end)`; done without an end (a moment): `longDate(start)`

`src/lib/dates.ts` gains `monthYearLong(d)`, "June 2026", UTC like the rest.

### 5.2 Components and layouts

- **`Track.astro`** takes `lane?: Lane` (default `"writing"`) and sets `--c` from it. Rows of kind `entry` render as today for moments. For an entry with an `end` or with status in progress, the index density's mono column shows the two-line range (§4.2) and the gutter node is the bar; the segment density shows the range on one line, "Mar 2024 to Sep 2024" or "Jun 2026 to now", where the essay segment shows a date.
- **`src/layouts/Reader.astro`** (new) owns the two-column frame that `BlogPost.astro` holds today: the grid, the article and aside columns, the kicker and square styles, the prose styles for the body, and the phone order. Props: `title`, `description`, `image`, `active: Lane`. Slots: default for the article, `aside` for the sidebar. It renders `Layout`, `TransportBar`, `main`, `Footer`.
- **`BlogPost.astro`** becomes the essay content inside `Reader`: kicker, title, standfirst, tags, hero, body, subscribe block; the sidebar with the Writing kicker, the track segment, and `WhileList`. Unchanged on screen.
- **`src/layouts/ProjectPage.astro`** (new): the project content of §4.3 inside `Reader`. Props: the collection entry, `segment: TrackRow[]`, `during: TimelineItem[]`.
- **`src/components/WhileList.astro`** (new): the "written while" markup lifted from `BlogPost.astro`: a muted-square kicker with a label prop ("Written while", "While building") and the list, each item with its lane dot, title link, and "lane, status" line.
- **`src/pages/building/index.astro`** (new): calls `getTimeline()`, keeps the building items, maps them to entries (description and stack from the body), and renders the head, `Track` with `lane="building"` at index density, and the footer.
- **`src/pages/building/[...slug].astro`** (new): static paths from the projects collection; renders the entry's `Content`; calls `getTimeline()` for the segment and the `during` list; passes them to `ProjectPage`.
- **`src/pages/blog/index.astro`** and **`src/pages/blog/[...slug].astro`** adopt the entry shape and the `TrackIndex` argument. `TransportBar.astro` points Building at `/building`.

## 6. Testimonial, 100Devs, community

### 6.1 Testimonial

`src/data/testimonial.ts` (new) exports one constant `{ quote, author, role }` holding Leon Noel's quote verbatim from the parked file. `ContactBlock.astro` renders it under its copy and links, inside the text column beside the photo: a `figure` with the quote in italic, a 3px left rule in `--lane-learning` (it comes from a mentor), and a `figcaption` with the author and role in muted text. The order holds on phones.

`src/lib/timeline/types.ts` drops the `Testimonial` interface and the learning body's optional `testimonial`; `Inspector.astro` drops the quote markup and its styles.

### 6.2 100Devs

`src/data/parked/hundred-devs.ts` is deleted, along with `learningEntrySchema` and `LearningEntry` in `types.ts` and any test that covers them. The Learning lane remains derived from the roadmap with no hand-authored items.

### 6.3 Community

`src/data/community.ts` entries get their confirmed dates (§14) and lose the placeholder comments. `communityEntrySchema` gains `linkLabel: z.string().min(1).optional()`; the community inspector body carries it; `fromCommunity` passes it through. The inspector's link reads `linkLabel ?? "Details"`. Entries that have no `url` render no link, as today.

## 7. The 404 page

`src/pages/404.astro`, rewritten in place. Transport bar with no section active, then a centred column (max width 720px, top padding clearing the fixed bar). Contents, top to bottom:

1. **The empty position**, a `figure` with `aria-hidden="true"`: a ruler line carrying the playhead and its "now" tag in the ruler's mono style, and four lane rows, each a muted label (Writing, Building, Learning, Community) and an empty track line in its lane color at low opacity. No tick labels: nothing is recorded at this position, so the ruler carries no dates. Static CSS, no dates computed at build.
2. **A heading and one line**, written by Sean during implementation (§14). Until supplied, the page ships with a placeholder heading and line marked in a comment, as the placeholder dates are.
3. **The requested path** in mono inside a `<p hidden>`: a two-line inline script sets the `<code>` text from `location.pathname` and removes `hidden`. Without JavaScript the paragraph stays hidden and the page reads as heading, line, links.
4. **Links**: Home, then Writing (`/blog`), Building (`/building`), Learning (`/roadmap`), Community (`/#lane-community`), each underlined in its lane color; Home in the text color.

No shared component: nothing else draws an empty console. Astro emits `dist/404.html`, which Netlify already serves for unknown routes.

## 8. Newsletter result pages and the retired tokens

`src/components/ResultPanel.astro` (new): a panel in the inspector's idiom, elevated background, hairline border, a 3px top rule in `--lane-writing`, radius 4px, centred at max width 560px. Props: `kicker` (default "Writing, newsletter"), `title`, `link: { href, label }`. The default slot holds the paragraph. The kicker carries the gold square; the title is the page's `h1`.

`src/pages/newsletter/confirmed.astro`, `error.astro`, and `unsubscribed.astro` become `Layout`, `TransportBar` with `active="writing"`, `ResultPanel` with their current copy and their "Back to the blog" link relabelled "Back to the essays", and `Footer`. Their duplicated styles go.

With those four pages moved, `--color-accent`, `--color-accent-secondary`, `--color-accent-bg`, and `--color-accent-border` are deleted from `src/styles/global.css`, along with the comment that kept them. The plan greps `src/` to confirm no other reader before deleting.

## 9. Roadmap leftovers

Each item parked at the end of sub-project 3, with its decision. The progress and review scripts stay unedited; every id and `data-*` hook they read is preserved.

- **Edit button on the zoom row.** The `#rm-edit` button and the `#rm-message` paragraph move from `RoadmapMeters.astro` into the arrangement's head row (`.rm-arr-head`), right-aligned after the zoom control. The head row must stay visible at every width because edit mode works on the phone graph too: the arrangement body hides below 900px as today, the zoom control hides with it, and the head row with Edit and the message stays.
- **The now tag over a striped corner.** The playhead's "now" tag stacks above clips and paints the console background behind its text, so a clip's hatch no longer shows through it.
- **Lane height from the packed row count.** `RoadmapArrangement.astro` sets `--rows` on each `.rm-lane` at build time (the highest packed row plus one, at least one); the lane's height is computed from `--rows` and a row-height token instead of the fixed `--lane-h`. `src/scripts/roadmap-arrangement.ts` sets `--rows` again after each re-lay.
- **The All zoom.** At build time the component compares the all-time window with the default span window; when they are equal, the zoom control is not rendered. The script returns early when the control is absent, and ignores a stored zoom preference in that case. The control appears on its own once a clip's date falls outside the default window.
- **Contract test.** `src/__tests__/roadmap-contract.test.ts` reads `dist/roadmap/index.html` and asserts: an `input[data-id]` for every id in `allIds()`; `[data-milestone-pct]` for every milestone and `[data-book-pct]` for every book; `[data-log-id]` with its four `[data-log-field]` controls and `[data-log-status]` for every decision log; and the fixed ids and hooks the two scripts read (`rm-edit`, `rm-message`, `rm-build-stages`, `rm-build-courses`, `rm-build-bar`, `rm-read-ch`, `rm-read-books`, `rm-read-bar`, `rm-fnd-done`, `rm-fnd-bar`, `rm-logs-done`, `rm-save-state`, `.roadmap-page`, `rv-thread`, `rv-message`, `rv-reveal`, `rv-runner`, `[data-rv-rate]`, `[data-rv-thread-count]`). The plan re-derives that list by grepping `src/scripts/roadmap.ts` and `review.ts`, which are the source of truth. The suite is skipped with a visible reason when `dist/` is absent so `npm test` still runs alone; `package.json` gains `"check": "astro build && vitest run"` as the full pre-push command. No `postbuild` hook, so the Netlify build path does not run Vitest.
- **Dead hooks and CSS.** The plan collects every id and `data-*` attribute read by the three roadmap scripts, and every selector in `src/pages/roadmap.astro` and the roadmap components; any id or attribute in the markup that no script or stylesheet reads is removed, and any CSS rule with no matching markup in the built page is removed.
- **Essay share image fallback.** §4.5.

## 10. README and docs

`README.md` is rewritten as the human-facing document: what the site is and the arrangement idea in a paragraph; the pages (`/`, `/blog`, `/building`, `/roadmap`); how to add an essay, a project, a community entry, and a roadmap milestone, each with the file and the required fields; the commands, including `check`, `shots`, and `og`; the roadmap operations section carried over as it is (Blobs store, admin token, `netlify dev`); deployment; the profile photo size, which is the one image the site needs. The template boilerplate about customising components that no longer exist goes. `public/images/README.md` is deleted; its one live fact (the profile photo size) moves into the README.

`CLAUDE.md` gains the Building pages, the `Reader` and `ProjectPage` layouts, `WhileList`, `ResultPanel`, the testimonial data file, the `check` script, and the generalized track; its Timeline data and Writing pages paragraphs are corrected where they name the old shapes.

## 11. Files

New:

- `src/layouts/Reader.astro`, `src/layouts/ProjectPage.astro`
- `src/pages/building/index.astro`, `src/pages/building/[...slug].astro`
- `src/components/WhileList.astro`, `src/components/ResultPanel.astro`
- `src/data/testimonial.ts`
- `src/__tests__/roadmap-contract.test.ts`
- `public/og/building.png` (generated after deploy)

Changed:

- `src/lib/timeline/track.ts` and `__tests__/track.test.ts`: `TrackEntry`, `EntryRow`, `TrackIndex`, `sortEntries`, `segmentRows`, `during`, `rangeText`, `whenText`.
- `src/lib/timeline/types.ts` and `__tests__/types.test.ts`: `linkLabel` on community; `Testimonial`, the learning testimonial, `learningEntrySchema`, `LearningEntry` removed.
- `src/lib/timeline/sources.ts` and `__tests__/sources.test.ts`: project `href`, community `linkLabel`.
- `src/lib/dates.ts` and `src/lib/__tests__/dates.test.ts`: `monthYearLong`.
- `src/lib/og.mjs` and `src/lib/__tests__/og.test.ts`: the building shot.
- `src/components/Track.astro`, `Inspector.astro`, `TransportBar.astro`, `ContactBlock.astro`.
- `src/layouts/BlogPost.astro`; `src/pages/index.astro`, `blog/index.astro`, `blog/[...slug].astro`.
- `src/pages/404.astro`, `src/pages/newsletter/confirmed.astro`, `error.astro`, `unsubscribed.astro`.
- `src/styles/global.css`: accent tokens removed.
- `src/components/roadmap/RoadmapMeters.astro`, `RoadmapArrangement.astro`; `src/pages/roadmap.astro`; `src/scripts/roadmap-arrangement.ts`.
- `src/data/community.ts`, `src/content/projects/*.mdx`, `src/data/roadmap.ts`: confirmed dates (§14).
- `scripts/screenshots.mjs`: Building index, one project page, the 404, one newsletter page.
- `package.json`: the `check` script. `README.md`, `CLAUDE.md`.

Deleted:

- `src/data/parked/hundred-devs.ts`
- `public/images/README.md`

## 12. Accessibility

- The Building index is one `<ol>` with one link per row, as the writing index is; the current project on a page carries `aria-current="page"` in its segment. Range dates are `<time>` elements with `datetime`.
- A project page has one `h1`; the sidebar lists carry `aria-label`s ("Nearby projects", "While building"); the facts list is a `<dl>`.
- The inspector keeps its `:target` panels and one link per clip.
- The 404's console fragment is `aria-hidden`; the path paragraph is hidden until filled; the links are a list.
- The result panel's title is the page `h1`; the kicker is plain text.
- The roadmap's Edit button keeps its id and accessible name at every width; the zoom group is omitted entirely rather than emptied; lane clips keep their status suffix.

## 13. Testing

Vitest, over the pure modules:

- `track.ts`: index rows for entries with and without an end carry end and status, which the component reads to draw the bar and the range; segment rows use the index noun and link; `during` counts a span that intersects, a moment inside, excludes the given lane, runs an in-progress project to now, and orders by lane, start, id; `rangeText` and `whenText` for every status, including the same-month case and the moment case.
- `dates.ts`: `monthYearLong`.
- `types.ts`: `linkLabel` accepted and optional; the learning schema gone.
- `sources.ts`: project `href` is the page; community `linkLabel` passes through.
- `og.mjs`: the building shot is in the list.
- The contract test of §9, run after a build through `npm run check`.

Then: `npm run check` passes; `scripts/screenshots.mjs` renders the new pages at both widths and the output is reviewed; a keyboard pass by hand on the Building index, a project page, and the 404 (tab through the links, follow one, back); the roadmap's live progress numbers checked on the deployed page, since the contract test guards the hooks and the deploy proves the fetch. After deploy, `npm run og` regenerates all four share images and the result is committed.

## 14. Inputs needed during implementation

- **Project dates**, start and end with status, replacing the placeholders in `src/content/projects/`: Songle (now 2023-06-01 to 2024-02-01, live), Roaming.Camp (2025-03-01 to 2026-06-30, live), RSWebTWAIN (2024-09-01 to 2025-04-01, done), the browser DAW engine (since 2026-06-01, in progress).
- **Community**: the DSD cohort lead start and end (now 2023-03-01 to 2024-02-01); which talks happened and in which month (the architecture talk is placed 2025-04, the productivity talk 2026-03); a link and a label for any entry that has one.
- **Roadmap dates** in `src/data/roadmap.ts`, still the sub-project 3 placeholders, if they are to be corrected in this round.
- **The 404 heading and line**, in Sean's voice.

Until supplied, the placeholders stay with their comments and the pages build against them.
