# Design — Arrangement redesign, part 1: foundation and home

**Date:** 2026-09-02
**Status:** Draft for review

---

## 1. Why we're building this

The current site is a competent version of the dark developer portfolio everyone has seen: near-black background, faint grid, blue and violet accents, gradient text on the name, bordered cards that lift on hover, a stats row. The distinctive material (a candid blog, a roadmap kept in the open with decision logs, a browser DAW in Rust, a scanner bridge, a geospatial platform) all gets the same card treatment, so the design flattens it.

The site also wears three hats at once: convincing a hiring manager, hosting the writing, and showing work in progress. That argues for a structure that routes people rather than pitches one thing.

After exploring four directions (an annotated essay, a studio-console timeline, a Swiss register, and a photo-derived contour design), the timeline direction, called **Arrangement**, was chosen on 2026-09-02. Its deciding argument is not visual: once every piece of content carries a lane and a date range, cross-references compute themselves. An essay knows what was being built when it was written; a project knows which essays came out of it; the roadmap knows which build overlapped which chapter.

## 2. Scope: sub-project 1 of 4

The redesign is split into four sub-projects, each with its own spec and plan, in this order:

1. **Foundation and home** (this spec): design tokens, the transport bar replacing the nav, the footer, the timeline data model and layout math, and the home page including its mobile form.
2. **Writing:** the essay layout with its position strip and "written while" sidebar, the blog index, the newsletter component restyled.
3. **Roadmap:** the arrangement over the existing roadmap data and live progress, with planned milestones, the checkpoint and decision-log inspector, and edit mode and the review surface carried across. Milestones gain planned dates.
4. **Everything else:** community entries as fully dated data, project detail beyond the inspector, 404 and newsletter pages, regenerated OG images, README.

Because tokens and the transport bar are site-wide, the blog and roadmap pages get the new palette and nav as soon as this sub-project ships, while keeping their current structure until sub-projects 2 and 3. That interim look is accepted.

## 3. The language

Reference mockups live in `.superpowers/brainstorm/` (gitignored): `directions.html` (the four directions), `arrangement-v2.html` (home, essay page, roadmap in the chosen language), and `mobile.html` (the three phone options).

The vocabulary, used consistently on every page:

- **Transport bar.** The site nav. Name on the left; Writing, Building, Learning, Community, Contact as links; on pages that have a timeline, a zoom control and today's date on the right. The active section is underlined in its lane color.
- **Lanes.** Four, each with a fixed color: writing gold, building coral, learning blue, community violet.
- **Clips.** An item drawn on a lane. Spans are bars with a 3px left rule in the lane color. Moments are dots with a label. In-progress spans are striped and end in a dashed edge at the playhead. Planned items (roadmap only, later) are dashed outlines.
- **Playhead.** A 2px vertical line at "now" with a small solid "now" tag in the ruler, placed left of the line.
- **Overview strip.** A thin all-time view of the four lanes above the ruler, with the visible window boxed.
- **Inspector.** A panel that opens beneath the arrangement when a clip is selected. On phones, a bottom sheet.
- **Vertical graph.** The phone form of the arrangement: items as rows in date order, with a narrow gutter drawing each lane as a track (bars, dots, stripes) and a horizontal "now" line.

## 4. The home page, top to bottom

1. **Transport bar.**
2. **Hero.** One headline ("Everything I've built, written and taught, in the order it happened.") and one sentence ("Software engineer in Dallas. Go, Rust and .NET. Click any clip to open it."). No stats, no buttons, no photo. Final copy is editable; the structure is not.
3. **Overview strip.** Always all time. Rows are 6px bars and dots per lane. The window box shows the current zoom.
4. **Arrangement.** Four lanes at the current-year zoom. Lane heads show the lane name and one line of summary (for example "3 essays this year"). The ruler shows months at the year zoom, quarters at three years, years at all time.
5. **Inspector.** Empty until a clip is chosen. See §9 for behavior.
6. **Contact.** A sentence, the email, GitHub and LinkedIn, and the profile photo small beside the text. This is the only place the photo appears.
7. **Footer.** Restyled with the new tokens; content unchanged.

**What the current page has that the new one absorbs.** "Beyond the Code" cards become Community clips. "Currently Building" is whatever is striped. The stats row is dropped. The testimonial from Leon Noel lives in the inspector of the 100Devs item on the Learning lane, the earliest clip on the page, where it has context.

## 5. Timeline data model

One shape for every clip on every page:

```ts
type Lane = "writing" | "building" | "learning" | "community";
type Status = "done" | "live" | "in-progress" | "planned";

interface TimelineItem {
  id: string;            // stable slug, unique across lanes
  lane: Lane;
  title: string;
  subtitle?: string;     // the clip's second line: stack, tags, or a phrase
  start: Date;
  end?: Date;            // absent + in-progress = ongoing to the playhead
  status: Status;
  href: string;          // where the clip links without JavaScript
  kind: "moment" | "span"; // derived, see below
  body?: InspectorBody;  // what the inspector shows
}
```

**Derived kind.** An item with an `end`, or with no `end` and status `in-progress`, is a span. An item with no `end` and status `done` or `live` is a moment. `planned` items must have an `end` (enforced by validation) and are spans.

**Inspector body** is a discriminated union by lane:

- writing: description, published date, link to the essay.
- building: description; facts (stack, started, status); the case study (problem, solution, tradeoffs, impact) as rendered MDX; links (visit, source).
- learning: description, link to the roadmap; optional testimonial (quote, author, role), used by the 100Devs item.
- community: organisation, description, optional link.

**Time semantics.**

- "Now" is the build date, rendered into the page, and nudged to the real date by the client script on load. Netlify rebuilds on every push, so drift is days at most.
- Dates are full ISO dates in data. When only the month is known, the author writes the first of the month.
- Zoom windows: **year** = January 1 to December 31 of the current year; **three years** = three years before now to December 31 of the current year; **all** = the earliest start in the data to December 31 of the current year. The overview strip is always **all**.

## 6. Sources: nothing is authored twice

The timeline is a derived view. `src/lib/timeline/sources.ts` gathers four sources into one array sorted by start, then id:

- **Writing** from the existing `blog` collection. `pubDate` is the start, `tags` joined with commas is the subtitle, status is `done`, href is `/blog/<slug>`. Drafts are excluded in production, exactly as the blog index does today.
- **Building** from a new `projects` content collection (MDX). Frontmatter:

  ```yaml
  title: "Roaming.Camp"
  description: "Campsite discovery that puts park, weather, cell coverage and reservation data on one map."
  start: 2025-03-01
  end: 2026-06-30        # optional
  status: live           # done | live | in-progress
  stack: ["Next.js", "Go", "PostGIS", "Mapbox"]
  url: "https://roaming.camp"   # optional
  source: "https://github.com/..." # optional
  ```

  The body uses four headings, `## Problem`, `## Solution`, `## Tradeoffs`, `## Impact`, which is the content currently hardcoded in `Projects.astro`. Subtitle is the stack joined with commas. Href is `/#item-<id>` (see §9).
- **Community** from `src/data/community.ts`: `{ id, title, org, description, start, end?, status, href? }`. Initial entries: 100Devs is **not** here (it is a learning item); DSD cohort team lead; DSD talks. Exact dates come from Sean during implementation and may be approximate to the month.
- **Learning** from `src/data/learning.ts`, hand-authored for this sub-project only: 100Devs (with the testimonial), the current CodeCrafters build, the current anchor book. Like every non-essay item, the clip links to `/#item-<id>`; the roadmap anchor appears as a link inside the inspector. Sub-project 3 replaces this file with derivation from the roadmap data.

## 7. Layout math

`src/lib/timeline/layout.ts` is plain TypeScript with no DOM access, so it runs at build time and in the browser.

- `windowFor(zoom, now, items)` returns `{ from, to }` per §5.
- `positionIn(item, window)` returns `{ x, w }` as fractions of the window width. Spans are clamped to the window. A moment has `w = 0`. Items entirely outside the window are excluded. An ongoing span ends at `now`.
- `packRows(items, estimateWidth)` assigns a row index per lane, greedily by start: an item takes the first row whose last occupant ends before it starts. For a moment, the occupied extent is its label width as returned by `estimateWidth(item)`, in window fractions. At build time the estimate is 7px per character of title plus subtitle at a 1280px reference width; in the browser it is measured.
- A lane shows at most **three rows**. If packing needs more, the oldest moments in that lane lose their labels and become bare dots (label available on hover and focus) until the packing fits. Spans never lose labels; they truncate with an ellipsis.

The vertical graph (§8) uses the same items in the same order and needs no packing: each item is a row, and the gutter draws a span from its row down to the last row whose start is not after the span's end date (or to the "now" line when ongoing). Each lane has two sub-slots in the gutter so two concurrent spans in one lane do not overlap.

## 8. Responsive behavior

- **At and above 900px:** the arrangement. Lanes are a fixed 120px tall with up to three rows at a 36px pitch starting 12px from the top; span clips are 32px tall with title and subtitle; moments are 20px. Lane height does not change between zooms.
- **Below 900px:** the vertical graph. Rows are 50px with the date in the left column, a 74px gutter, and the title and subtitle. The "now" line sits after the last past item. The transport bar collapses to name, zoom chip, and a menu button that opens the lane links and Contact, as the current mobile nav does. The overview strip remains.
- Both forms render from **one DOM list in chronological order**. The arrangement is a positioned layout of that list (lane index and date fraction as CSS custom properties per item); the graph is the list with an overlay. Screen readers get a dated list in both cases.

## 9. Interaction and accessibility

- **Without JavaScript**, the page is complete. Every clip is an `<a>`; essays link to their page, other items link to `/#item-<id>`. The inspector panel for every item is server-rendered into the page, hidden, and CSS `:target` reveals the addressed one. So a no-JavaScript visitor can open any item.
- **With JavaScript**, clicking a clip opens its inspector in place, updates the URL hash to `#item-<id>` without scrolling, and marks the clip selected. Only one inspector is open at a time. Escape closes it. On load, a matching hash opens that item and scrolls it into view. On phones the inspector is a bottom sheet with the same content.
- **Zoom.** The control in the transport bar switches between year, three years, and all. Positions and packing are recomputed in the browser with measured label widths. The choice is remembered in `localStorage`, wrapped in try/catch, and falls back to year.
- **Keyboard.** Clips are focusable in document order (chronological). Focus is visible as a 2px outline in the item's lane color. The inspector receives focus when opened and returns it to the clip when closed.
- **Motion.** None on load, with one exception: the playhead draws in from the left edge of the arrangement once, over about 600ms. Under `prefers-reduced-motion` it does not animate, and it does not animate when the page loads with a hash. No hover transforms anywhere.
- **Playhead** is updated to the real date by the client script; the server-rendered position is the build date.

## 10. Visual system

**Palette** (replaces the tokens in `src/styles/global.css`):

| Token | Value | Use |
|---|---|---|
| console | #232527 | page background |
| panel | #2C2F32 | arrangement, inspector, overview |
| rule | #3A3E42 | all borders and rules |
| text | #ECEAE4 | primary text |
| text-secondary | #C9C7C0 | body and descriptions |
| muted | #9A9C98 | labels, ruler, subtitles |
| writing | #D9B45F | lane |
| building | #D98B6F | lane |
| learning | #60A5FA | lane |
| community | #A78BFA | lane |

Muted on console is about 5.5:1, which passes AA for small text. Clip subtitles are 12px, not the mockup's 11px.

**Type.** Bricolage Grotesque for the hero headline and inspector titles (variable: opsz 96, wdth 100). Instrument Sans for everything else. JetBrains Mono only for the ruler, the zoom control, the date in the transport bar, and dates inside clips. All three load from Google Fonts as today. Scale: hero 62px desktop and 28px phone; inspector title 34px; body 17px; UI 14px; clip title 13px; clip subtitle 12px; ruler 12px.

**Shape.** Radii 3 to 4px everywhere. Removed: the grid background, gradient text, glows, hover lifts, pill tags, and the section-number eyebrows.

**Spacing** keeps the existing `--space-*` scale.

## 11. Code shape

Created:

- `src/lib/timeline/types.ts`, `sources.ts`, `layout.ts`, with tests in `src/lib/timeline/__tests__/`.
- `src/content/projects/*.mdx` (three files) and the `projects` collection in `src/content/config.ts`.
- `src/data/community.ts`, `src/data/learning.ts`.
- `src/components/TransportBar.astro` (replaces `Nav.astro`), `Timeline.astro` (one list, two layouts, includes the overview strip and ruler), `Inspector.astro` (all panels, server-rendered), `ContactBlock.astro`.
- `src/scripts/timeline.ts`: zoom, inspector, hash, playhead, bottom sheet.
- `scripts/home-screenshots.mjs`: renders `/` at 1280 and 390 to PNG for visual checks, modelled on `scripts/og-screenshots.mjs`.

Changed: `src/styles/global.css` (tokens, resets, removals), `src/pages/index.astro`, `src/components/Footer.astro`, every page that imports `Nav.astro`, `CLAUDE.md` (component composition, the projects collection, the timeline module).

Deleted: `Hero.astro`, `Beyond.astro`, `Projects.astro`, `Currently.astro`, `Testimonial.astro`, `Contact.astro`, `public/images/beyond/*`.

## 12. Validation and failure rules

- Zod validates project frontmatter at build: `status` is the enum; `end`, when present, is not before `start`; a `planned` status requires `end`; a project with status `done` or `live` requires `end`, so projects are always spans. Community and learning data are validated by the same schema at module load. A violation fails the build naming the file or entry.
- Item ids must be unique across all sources; a duplicate fails the build.
- An empty lane still renders its head, with "nothing yet" in muted text in place of clips.
- A source with zero items (for example no projects yet) is allowed.
- Row overflow follows §7. Nothing is ever hidden entirely; a bare dot still links and still opens the inspector.

## 13. Verification

Written first, in Vitest, before components:

- sources: drafts excluded in production, included otherwise; essays become moments; projects with `end` become spans; in-progress without `end` is a span to now; ids unique; sort order.
- layout: windows for each zoom at a fixed `now`; positions clamped to the window; items outside excluded; packing assigns rows greedily; a moment reserves its label width; the three-row overflow rule demotes the oldest moments.
- validation: each failure rule in §12 rejects with a message naming the offender.

Then: `npm run build` passes; `scripts/home-screenshots.mjs` renders both widths and the output is reviewed; a keyboard pass by hand (tab through clips, open, Escape, deep link); `npm run og` regenerates the home image at the end.

## 14. Out of scope here

Essay page and blog index (sub-project 2). Roadmap page and derivation of the Learning lane (sub-project 3). Project pages beyond the inspector, community images, 404 and newsletter pages, README (sub-project 4). A desktop toggle for the vertical graph: deliberately not built; both forms are layouts of one list, so it stays cheap to add later.

## 15. Inputs needed during implementation

Start and end dates for the three projects, the 100Devs period, the cohort lead role, and past talks. Month precision is fine. Until supplied, the plan uses the placeholder dates from the mockups and marks them in a comment.
