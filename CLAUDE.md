# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Astro dev server with hot reload
- `npm run build` — Production build (outputs to `dist/`)
- `npm run check` — Production build followed by the full Vitest suite, including the roadmap client-contract test that reads `dist/roadmap/index.html`
- `npm run preview` — Preview production build locally
- `npm run shots` — Full-page screenshots of the home page, the writing index, the Building index, two essays (one with code blocks), a project page, the 404 page and a newsletter page, at desktop and phone widths (`screenshots/`, gitignored). Needs `npm run preview` running.
- `npm test` — Run the Vitest unit suite

## Architecture

This is a static portfolio site built with **Astro 5**. Everything renders at build time and ships no framework or client-side rendering. Most of the JavaScript is progressive enhancement layered over markup that already works without it; the mobile navigation menu (`src/components/TransportBar.astro`) and the newsletter form (`src/components/Newsletter.astro`) are the two exceptions that require it.

**Key integrations:** MDX (blog posts), Sitemap, RSS

**Routing:** File-based via `src/pages/`. Blog posts use dynamic route `src/pages/blog/[...slug].astro` backed by MDX content files in `src/content/blog/`.

**Content collections:** Blog posts are MDX files validated by a Zod schema in `src/content/config.ts`. Frontmatter requires `title`, `description`, `pubDate`. Optional: `updatedDate`, `heroImage`, `tags` (string array), `draft` (boolean). Projects are MDX files in src/content/projects/ (four today) validated by projectFrontmatterSchema (title, description, start, end, status, stack, url, source); the body uses ## Problem, ## Solution, ## Tradeoffs, ## Impact.

**Component composition:** The home page (`src/pages/index.astro`) is `TransportBar`, a hero, `Timeline`, `Inspector`, `ContactBlock`, and `Footer`. `Timeline` renders one chronological list of items and lays it out as four lanes at 900px and up, and as a vertical graph below; `Inspector` server-renders a panel for every item (shown by CSS `:target` without JavaScript, by `src/scripts/timeline.ts` with it). The home `Inspector` links to a project's page rather than rendering its case study, and the contact block carries the site's one testimonial from `src/data/testimonial.ts`.

**Timeline data:** `src/lib/timeline/` is pure TypeScript (unit-tested in Vitest): `types.ts` (item shape and zod validation), `sources.ts` (adapters from the blog, the `projects` collection, `src/data/community.ts`), `layout.ts` (zoom windows, positions, row packing, ruler ticks, graph layout), `track.ts` is lane-agnostic (`TrackEntry`, `indexRows`, `segmentRows` with a `TrackIndex`, `writtenWhile`, `during`, `rangeText`, `whenText`, reading time) and serves the writing and building indexes, both sidebars, and the inspector's wording. `astro.ts` is the only file that imports from Astro. The Learning lane derives from the roadmap via `src/lib/roadmap/arrange.ts`.

**Writing pages:** `src/pages/blog/index.astro` renders the Writing lane as a vertical track (`src/components/Track.astro`, rows built by `src/lib/timeline/track.ts`). `src/pages/blog/[...slug].astro` renders an essay through `src/layouts/BlogPost.astro`, whose sidebar holds a short segment of the same track (newer and older neighbours) and a "Written while" list computed from the timeline (spans overlapping the publish date, moments within 14 days). Reading time is computed from the MDX body. Every date the blog prints goes through `src/lib/dates.ts`, which formats in UTC.

**Building pages:** `src/pages/building/index.astro` renders the Building lane as a vertical track; `src/pages/building/[...slug].astro` renders a case study through `src/layouts/ProjectPage.astro`. Both that layout and `src/layouts/BlogPost.astro` fill `src/layouts/Reader.astro`, whose frame and prose styles are the global `src/styles/reader.css`, because Astro's scoped styles do not reach slotted content. `src/components/WhileList.astro` renders "Written while" and "While building".

**Roadmap page:** `src/pages/roadmap.astro` renders the roadmap as an arrangement — three dated tracks (Build, Reading, Foundations) as clips on a quarter calendar, positioned by `src/lib/roadmap/arrange.ts` reusing `src/lib/timeline/layout.ts`. `RoadmapArrangement.astro` draws the lanes and a mobile graph; `RoadmapInspector.astro` server-renders one `:target` panel per clip, reusing `CheckItem` and `DecisionLog`; `RoadmapMeters.astro` shows live progress. The owner's controls sit in a toolbar above the arrangement so they survive below 900px, lanes size to their packed rows, and the zoom control is only rendered when the all-time window differs from the default. Editing and the spaced-repetition review deck are unchanged: `src/scripts/roadmap.ts` and `review.ts` still drive them through preserved element ids and `data-*` hooks, backed by the token-gated Netlify functions and Blobs stores. `src/scripts/roadmap-arrangement.ts` handles only zoom and the playhead. `arrange.ts` also produces the home page's Learning-lane thread spans, so the roadmap is the single source and `src/data/learning.ts` was retired.

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
