# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Astro dev server with hot reload
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally
- `npm run shots` — Full-page screenshots of the home page, the writing index, and one essay at desktop and phone widths (`screenshots/`, gitignored). Needs `npm run preview` running.
- `npm test` — Run the Vitest unit suite

## Architecture

This is a static portfolio site built with **Astro 5**. It ships zero client-side JavaScript — everything is rendered at build time.

**Key integrations:** MDX (blog posts), Sitemap, RSS

**Routing:** File-based via `src/pages/`. Blog posts use dynamic route `src/pages/blog/[...slug].astro` backed by MDX content files in `src/content/blog/`.

**Content collections:** Blog posts are MDX files validated by a Zod schema in `src/content/config.ts`. Frontmatter requires `title`, `description`, `pubDate`. Optional: `updatedDate`, `heroImage`, `tags` (string array), `draft` (boolean). Projects are MDX files in src/content/projects/ (four today) validated by projectFrontmatterSchema (title, description, start, end, status, stack, url, source); the body uses ## Problem, ## Solution, ## Tradeoffs, ## Impact.

**Component composition:** The home page (`src/pages/index.astro`) is `TransportBar`, a hero, `Timeline`, `Inspector`, `ContactBlock`, and `Footer`. `Timeline` renders one chronological list of items and lays it out as four lanes at 900px and up, and as a vertical graph below; `Inspector` server-renders a panel for every item (shown by CSS `:target` without JavaScript, by `src/scripts/timeline.ts` with it).

**Timeline data:** `src/lib/timeline/` is pure TypeScript (unit-tested in Vitest): `types.ts` (item shape and zod validation), `sources.ts` (adapters from the blog, the `projects` collection, `src/data/community.ts`, `src/data/learning.ts`), `layout.ts` (zoom windows, positions, row packing, ruler ticks, graph layout), `track.ts` (the writing index rows, the essay sidebar segment, written-while, reading time). `astro.ts` is the only file that imports from Astro. Learning entries are hand-authored until the roadmap sub-project derives them.

**Writing pages:** `src/pages/blog/index.astro` renders the Writing lane as a vertical track (`src/components/Track.astro`, rows built by `src/lib/timeline/track.ts`). `src/pages/blog/[...slug].astro` renders an essay through `src/layouts/BlogPost.astro`, whose sidebar holds a short segment of the same track (newer and older neighbours) and a "Written while" list computed from the timeline (spans overlapping the publish date, moments within 14 days). Reading time is computed from the MDX body. Every date the blog prints goes through `src/lib/dates.ts`, which formats in UTC.

**Icon system:** `src/components/Icon.astro` is a custom Lucide icon component with inlined SVGs — no external icon library dependency.

**Path aliases:** `@/*` → `src/*`, `@components/*`, `@layouts/*`, `@styles/*` (configured in tsconfig.json).

## Styling

Global CSS with design tokens in `src/styles/global.css`. Dark theme using CSS custom properties. Fonts: Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (ruler and dates) from Google Fonts. Lane colors are --lane-writing, --lane-building, --lane-learning, --lane-community. The responsive breakpoint is 900px.

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

- Profile photo: 640x760px (`public/images/profile.jpg`)
- OG image: `public/og-image.png`
