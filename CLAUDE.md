# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Astro dev server with hot reload
- `npm run build` — Production build (outputs to `dist/`)
- `npm run check` — Production build followed by the full Vitest suite, including the roadmap client-contract tests that read `dist/roadmap/index.html` and `dist/roadmap/now/index.html`
- `npm run preview` — Preview production build locally
- `npm run shots` — Full-page screenshots of the home page, the writing index, the Building index, the roadmap and its current-phase page, two essays (one with code blocks), a project page, the 404 page and a newsletter page, at desktop and phone widths (`screenshots/`, gitignored). Needs `npm run preview` running.
- `npm run e2e` — Playwright pass over the home timeline's scrub and pan interactions at desktop and phone widths (hover, pin, drag, tap, keys, deep links), the hero readout's links and its pruning under a fixed clock past the build day, the reader frame's reading line and sticky sidebar on an essay, a short case study and a phone, the I/O multiplexing figure's wakes, tallies, count changes, play and reduced motion, and the view transitions section: a script arriving mid-swap still upgrading its page, the morph naming the clicked element, a roadmap save flushing (not merely surviving) a navigation, listeners not stacking across a navigate-away-and-back, reduced motion completing a swap immediately, and back restoring an open panel without replaying the playhead draw-in. It also covers the roadmap's current-phase page: a stale visit re-picking its phase heading, build blocks and tab title (and the week and phase name in `/roadmap`'s link to it), a visit after the plan ends heading the page with the week label alone, the timeline's now chip and phone now row landing on it, a save flushed across the two roadmap pages, and one toggle after navigating between them saving exactly once. Needs `npm run preview` running.
- `npm run thumbs` — Playwright screenshots of every project that has a `url` in its frontmatter, into `src/assets/projects/<slug>.jpg`; committed. A project without a `url` can carry a hand-placed `.jpg` or `.png` under its slug instead.
- `npm test` — Run the Vitest unit suite

## Architecture

This is a static portfolio site built with **Astro 5**. Everything renders at build time and ships no framework, though navigation is client-side: `<ClientRouter />` swaps pages in over a cross-fade rather than reloading. Most of the JavaScript is progressive enhancement layered over markup that already works without it, but not all of it is — without scripting, the mobile navigation menu (`src/components/TransportBar.astro`) and the newsletter form (`src/components/Newsletter.astro`) stop working outright, while the roadmap's live numbers (`src/components/roadmap/RoadmapMeters.astro`, `RoadmapArrangement.astro`, `RoadmapInspector.astro`, `RoadmapNow.astro`, `RetentionSection.astro`) stay usable but render at zero. The home timeline's zoom, scrubbing and panning are enhancements too: without scripting the page shows the current year and every clip is a link. So are the reader frame's reading line and sticky sidebar (`src/scripts/reader.ts`): without scripting the line stays hidden and the sidebar scrolls with the page. The I/O multiplexing essay's figure (`src/components/figures/IoMultiplexing.astro`) is the same: without scripting it shows a completed epoll wake at 32 sockets and no controls.

**Key integrations:** MDX (blog posts), Sitemap, RSS

**Routing:** File-based via `src/pages/`. Blog posts use dynamic route `src/pages/blog/[...slug].astro` backed by MDX content files in `src/content/blog/`.

**Content collections:** Blog posts are MDX files validated by a Zod schema in `src/content/config.ts`. Frontmatter requires `title`, `description`, `pubDate`. Optional: `updatedDate`, `heroImage`, `tags` (string array), `draft` (boolean). Projects are MDX files in src/content/projects/ (four today) validated by projectFrontmatterSchema (title, description, start, end, status, stack, url, source); the body uses ## Problem, ## Solution, ## Tradeoffs, ## Impact.

**Component composition:** The home page (`src/pages/index.astro`) is `TransportBar`, a hero whose right column ends in `RightNow` (a "Right now" readout: one row per lane with something touching the build day, from `rightNow` in `src/lib/timeline/now.ts`; each entry links like its clip), `Timeline`, `Inspector`, `ContactBlock`, and `Footer`. `Timeline` renders one chronological list of items and lays it out as four lanes at 900px and up, and as a vertical graph below; `Inspector` server-renders a panel for every item (shown by CSS `:target` without JavaScript, by `src/scripts/timeline/` with it). The home `Inspector` links to a project's page rather than rendering its case study, and the contact block is the photo, the pitch and the three links (its photo column stretches to the links' bottom edge at 900px and up). The one testimonial is currently unpublished: `src/data/testimonial.ts` is kept but imported by nothing.

**Timeline interactions:** `src/scripts/timeline/` is a folder of modules sharing one store (`state.ts`): `apply.ts` lays out a window, `inspector.ts` opens panels, `pan.ts` drives the overview strip's whole-year offset (drag, tap, arrow keys), `scrub.ts` drives the ruler's cursor and the "On this date" panel (hover, press to pin, arrow keys by month), and `now.ts` prunes the hero's readout to the entries that still touch the real day (it only removes: the set can only shrink between deploys, so nothing is built on the client). Pure math lives beside the rest of the timeline in `src/lib/timeline/` (`layout.ts` offsets, `scrub.ts` cursor math and hashes, `track.ts` `onDate`, `now.ts` `rightNow` and `nowText`). A pinned date is `#on-YYYY-MM-DD` in the URL; the pan offset is never stored. Both are JavaScript-only like zoom: the built HTML keeps the strip and ruler `aria-hidden`, and the script upgrades them into sliders. `src/__tests__/home-contract.test.ts` reads `dist/index.html` to keep every hook the scripts depend on.

**Timeline data:** `src/lib/timeline/` is pure TypeScript (unit-tested in Vitest): `types.ts` (item shape and zod validation), `sources.ts` (adapters from the blog, the `projects` collection, `src/data/community.ts`), `layout.ts` (zoom windows, positions, row packing, ruler ticks, graph layout), `track.ts` is lane-agnostic (`TrackEntry`, `indexRows`, `segmentRows` with a `TrackIndex`, `writtenWhile`, `during`, `rangeText`, `whenText`, reading time) and serves the writing and building indexes, both sidebars, and the inspector's wording. `astro.ts` is the only timeline file that imports from Astro; beside it, `src/lib/images.ts` is the only module that reads `src/assets/` (a slug-to-picture map over the project screenshots, rendered through `astro:assets` in the building clips, the inspector and the case studies). The Learning lane derives from the roadmap via `src/lib/roadmap/arrange.ts`.

**Writing pages:** `src/pages/blog/index.astro` renders the Writing lane as a vertical track (`src/components/Track.astro`, rows built by `src/lib/timeline/track.ts`). `src/pages/blog/[...slug].astro` renders an essay through `src/layouts/BlogPost.astro`, whose sidebar holds a short segment of the same track (newer and older neighbours) and a "Written while" list computed from the timeline (spans overlapping the publish date, moments within 14 days). Reading time is computed from the MDX body. Every date the blog prints goes through `src/lib/dates.ts`, which formats in UTC.

**Building pages:** `src/pages/building/index.astro` renders the Building lane as a vertical track; `src/pages/building/[...slug].astro` renders a case study through `src/layouts/ProjectPage.astro`. Both that layout and `src/layouts/BlogPost.astro` fill `src/layouts/Reader.astro`, whose frame and prose styles are the global `src/styles/reader.css`, because Astro's scoped styles do not reach slotted content. `src/components/WhileList.astro` renders "Written while" and "While building".

**Reader frame interactions:** `Reader.astro` asks `TransportBar` for the reading line (a hidden 2px line at the bar's bottom edge in the lane colour, `data-reader-progress`) and imports `src/scripts/reader.ts`, which on every scroll frame measures the body (`data-reader-body`) and writes `--p` on the line, hiding it while the body fits the viewport, so a short case study shows none. The same script marks the sidebar (`data-reader-aside`) with `data-fits` when it sits under the bar with room to spare, and `reader.css` turns that into `position: sticky` at 900px and up with the offset in `--stick`; a sidebar taller than the screen scrolls with the page. The math is `src/lib/reading.ts` (`readingProgress`, unit-tested with pixel fixtures). `src/__tests__/reader-contract.test.ts` reads one built essay and one built case study to keep the three hooks and the no-script state.

**Navigation and the lifecycle contract:** `Layout.astro` carries
`<ClientRouter fallback="swap" />`, so every navigation is a client-side swap
with a cross-fade, and the transport bar is named (`src/styles/view-transitions.css`)
so it stays out of it. Astro executes a bundled module script once per session,
so nothing initialises at import: every enhancement registers through
`onPage(init)` (`src/scripts/lifecycle.ts`, logic in `src/lib/lifecycle.ts`),
which re-runs it on `astro:page-load` and aborts the previous run on
`astro:before-swap`. Each init takes `{ first, signal }` — `first` is true only
after a cold load, so an intro like the playhead draw-in never replays on a
navigation, and `signal` must be passed to every listener. `roadmap.ts` and
`review.ts` are the exception to what abort means: they *flush* their debounced
save rather than cancelling it. `src/scripts/morph.ts` is the one script that
stays a top-level module; it arms the clicked link's picture and title
(`data-morph`, `data-morph-shot`, `data-morph-title`) so they morph into the
destination's (`data-morph-dest`). All view-transition names live in
`src/styles/view-transitions.css`; Astro's `transition:*` directives are unused.
`src/__tests__/transitions-contract.test.ts` reads `dist/` to keep the router,
the names and the prefetch opt-outs in place.

Three details here are the easiest to get wrong. First, `first` is not simply "the
first run of this init" — a page reached only by navigating there (an essay,
then Home) has its own script bundle fetched and executed *during* the swap
that lands on it, so that init's first-ever run can itself be a real navigation,
not a cold load. `createLifecycle` handles this with one `cold` flag shared by
every init and flipped false by a single `astro:before-swap` listener registered
once, in the helper itself, rather than one flag per init: a per-init listener
registered during that same swap would be too late to see the very swap it
needs to know about, and would wrongly call its own arrival a cold load — this
is exactly what once made the home page replay its playhead intro on a real
navigation. Second, a delegated click interceptor that calls `preventDefault()`
on an anchor — `timeline/inspector.ts`'s and `timeline/scrub.ts`'s handling of
`a[data-item-link]` and the panel-close links — must register in the *capture*
phase. `<ClientRouter />` registers its own `document` click listener at
module-parse time, in the bubble phase, and starts its own navigation only when
`ev.defaultPrevented` is still false by the time that listener runs
(`node_modules/astro/components/ClientRouter.astro:67-108`); ours register
later, on `astro:page-load`, which the router itself dispatches, so a
bubble-phase `preventDefault()` here always loses that race and the router
navigates anyway. Third, a hash write must carry `history.state` forward —
`history.replaceState(history.state, "", url)`, never `null` — because
`<ClientRouter />` stamps its own `{ index, scrollX, scrollY }` on every entry
and goes permanently inert on `popstate` for that entry when it reads that
state back as `null` (`node_modules/astro/dist/transitions/router.js:391-393`);
`timeline/index.ts`'s `writeHash()` got this wrong until it was caught, and the
back button silently stopped working for any entry it had touched.

**Figures:** interactive figures inside essays follow one shape, set by the I/O multiplexing figure: a pure model in `src/lib/figures/` (unit-tested; every number and sentence the figure prints), an Astro component in `src/components/figures/` that server-renders a meaningful still frame with its controls `hidden` and imports its script, and a re-runnable init in `src/scripts/figures/` that reveals the controls and animates by writing data attributes the scoped CSS styles. The MDX imports the component in place of a picture. `IoMultiplexing.astro` plays one event-loop wake at a time under select, poll or epoll at 8, 32 or 128 sockets: arrivals come from a generator seeded by count and wake number, so every mechanism sees the same data and the per-mechanism tally is an honest comparison; the wake's phases and the frame at any elapsed time come from the model (`schedule`, `frameAt`), so the script holds no timers, and one animation-frame loop paints only when the frame changes. select and poll leave a trail on every cell; epoll lights the ready ones alone. Under reduced motion a wake is a single held return frame. The grid is `aria-hidden` and the one live region is the readout sentence. The script rebuilds the grid on a count change by cloning the first cell, which keeps Astro's scoped-style attribute. `src/__tests__/figure-contract.test.ts` finds the essay that carries the figure by hook and keeps the hooks and the no-script state.

**Roadmap pages:** the roadmap is two pages rendering one plan. `src/pages/roadmap.astro` shows where the work has been and where it is headed: the meters and an arrangement — three dated tracks (Build, Reading, Foundations) as clips on a quarter calendar, positioned by `src/lib/roadmap/arrange.ts` reusing `src/lib/timeline/layout.ts`. `src/pages/roadmap/now.astro` shows the current phase in depth: `RoadmapNow.astro`, then `RoadmapPractice.astro` (the 2-hour day) and `RetentionSection.astro` (the review deck). `/roadmap` links to it from a line under its thesis ("Week 2 of 22 · Redis →": the week label, then one short phase name per phase, rewritten and re-picked on load) and from the timeline's "now" chip and the phone graph's "now" row, whose screen-reader text is the same week label. Neither page frames the plan in hand-written copy: every heading, tab title and link label on `/roadmap/now`, and on `/roadmap`'s link to it, comes from the plan's data. The schedule is the source of every roadmap date: `src/lib/roadmap/weeks.ts` holds the week arithmetic and one `WEEK_ONE` constant, `src/data/roadmap.ts` carries the seven-phase table with its per-phase reading and foundations pairings, and every milestone, book and foundation-group span derives from it — so re-dating the whole plan is one edit. `src/lib/roadmap/schedule.ts` answers which week it is (`weekLabel`), what `/roadmap/now` shows (`nowShowing`: the phase covering the week and that phase's `milestone`, null for the ramp and outside the plan) and what the page is titled (`nowTitle`: the week label and `phaseShortName`, the part of a phase name before its dash), and `src/scripts/roadmap-schedule.ts` applies all three on load: the one enhancement on the site that rewrites rather than narrows on the client, because its inputs are static data the bundle already holds. `schedule.ts` also holds `phaseSpanText`, the one definition of the "Weeks 1–7 · Sep 7 – Oct 24" form that each phase header prints and `schedule-mockup-contract.test.ts` checks the mockup against. `RoadmapNow.astro` server-renders a header and a pairings block for every phase (`data-now-phase`) and a build block for every milestone (`data-now-milestone`), and the script reveals the current ones. Each phase header is the page's eyebrow (the week label) and `<h1>` (the phase name); before Week 0 and after the capstone a lone `<h1>` carries the week label instead, and the script retitles the tab wherever `data-now-title` sits. Checkboxes and log inputs live only in the build blocks, once per milestone, because phases and milestones are not one to one: M5 and the Capstone share Kafka, and `CheckItem` and `DecisionLog` put real ids on their inputs, so a build block per phase would repeat them. Each phase header also carries `data-phase-start` and `data-phase-milestone`, which exist so the e2e stale-visit check can pick a phase without importing the TypeScript phase table. `src/lib/roadmap/pairings.ts` turns a phase's flat `Pairing[]` into the rows a list renders: it groups them under their book or foundations group (a book the schedule returns to merges back into its first group), and derives a foundation item's workload from its own `total` and its build hint from its own `pairsWith`. A pairing's `note` therefore carries only the schedule's reason and is often empty — repeating the title, the count or the hint there is a second copy that drifts. `PairingList.astro` names, in each Build clip's panel and on `/roadmap/now`, what to read alongside a milestone, laying out `pairings.ts`'s groups and holding no wording of its own. `MilestoneBuild.astro` renders a milestone's goal, dates, checkpoints and decision logs for both the Build clip panel (which slots its pairings between the checkpoints and the logs) and `/roadmap/now`. `RoadmapArrangement.astro` draws the lanes and a mobile graph; `RoadmapInspector.astro` server-renders one `:target` panel per clip, reusing `CheckItem` and `MilestoneBuild`; `RoadmapMeters.astro` shows live progress. Saved progress is not available at build time, so every clip is server-rendered from an EMPTY completed set: its count, its status fill and its spoken status are placeholders, not a still frame, and `src/scripts/roadmap.ts`'s `renderClips()` overwrites all three through `data-clip-id` (status class), `data-clip-sub` (count) and `data-clip-status` (spoken word). Each clip is drawn three times over — the desktop clip, the mobile graph row and the panel kicker — and all three carry the hooks, because repainting only some is what once left a clip reading "0 of 5 chapters" beside a panel already showing 1/5. Positions are never repainted from there; only `roadmap-arrangement.ts` moves clips, and only on a zoom. The repaint is silent, so `#rm-clip-live` (a `role="status"` region outside `.rm-arr`, which is hidden below 900px) speaks each edit; the sentence is `progressAnnouncement` in `arrange.ts`, unit-tested there rather than in the DOM script, and it names the status only when it flips. The owner's controls are `RoadmapToolbar.astro`, rendered on both pages; on `/roadmap` the arrangement renders it above `.rm-arr` so it survives below 900px, with the zoom group in its slot. Lanes size to their packed rows, and the zoom control is only rendered when the all-time window differs from the default. Editing works on both pages without either overwriting the other: `src/scripts/roadmap.ts` saves the full completed set it loaded from the server, not the checkboxes on screen, and a navigation between the two pages flushes a pending save that the arriving page's load waits for. `roadmap.ts` and `review.ts` drive editing and the review deck through preserved element ids and `data-*` hooks, backed by the token-gated Netlify functions and Blobs stores. Both pages share the global `src/styles/roadmap.css`. `src/__tests__/roadmap-contract.test.ts` and `roadmap-now-contract.test.ts` read the two built pages, and each asserts that no element id repeats.

**Icon system:** `src/components/Icon.astro` is a custom Lucide icon component with inlined SVGs — no external icon library dependency.

**Path aliases:** `@/*` → `src/*`, `@components/*`, `@layouts/*`, `@styles/*` (configured in tsconfig.json).

## Styling

Global CSS with design tokens in `src/styles/global.css`. Dark theme using CSS custom properties. Fonts: Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (ruler and dates) from Google Fonts. Lane colors are --lane-writing, --lane-building, --lane-learning, --lane-community. The responsive breakpoint is 900px. The old `--color-accent*` tokens are gone; use a lane or track token.

## Deployment

Deployed to **Netlify** (configured in `netlify.toml`). Site URL: `https://seanthedeveloper.com`. Node 20.

## Blog Posts

Create new posts as `.mdx` files in `src/content/blog/`. Required frontmatter:

```yaml
title: "Post Title"
description: "Short description"
pubDate: "YYYY-MM-DD"
```

Set `draft: true` to exclude from listings.

## Image Requirements

- Profile photo: 640x852px (`public/images/profile.jpg`)
- Share images: `public/og/<page>.png` (`home`, `roadmap`, `blog`, `building`), generated by `npm run og` (screenshots the live site) and committed
- Project screenshots: `src/assets/projects/<slug>.jpg`, generated by `npm run thumbs` and committed, or a hand-placed `.jpg` or `.png` under its slug for a project without a `url`; shown at 90×56 in the home clip (hidden under 200px of clip width), above the facts in the inspector, and under the standfirst on the case study
