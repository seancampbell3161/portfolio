# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run dev` — Start Astro dev server with hot reload
- `npm run build` — Production build (outputs to `dist/`)
- `npm run preview` — Preview production build locally

## Architecture

This is a static portfolio site built with **Astro 5**. It ships zero client-side JavaScript — everything is rendered at build time.

**Key integrations:** MDX (blog posts), Sitemap, RSS

**Routing:** File-based via `src/pages/`. Blog posts use dynamic route `src/pages/blog/[...slug].astro` backed by MDX content files in `src/content/blog/`.

**Content collections:** Blog posts are MDX files validated by a Zod schema in `src/content/config.ts`. Frontmatter requires `title`, `description`, `pubDate`. Optional: `updatedDate`, `heroImage`, `tags` (string array), `draft` (boolean).

**Component composition:** The home page (`src/pages/index.astro`) composes standalone section components (Hero, Projects, Currently, Beyond, Testimonial, Contact) from `src/components/`.

**Icon system:** `src/components/Icon.astro` is a custom Lucide icon component with inlined SVGs — no external icon library dependency.

**Path aliases:** `@/*` → `src/*`, `@components/*`, `@layouts/*`, `@styles/*` (configured in tsconfig.json).

## Styling

Global CSS with design tokens in `src/styles/global.css`. Dark theme using CSS custom properties. Fonts: DM Sans (body), JetBrains Mono (code) loaded from Google Fonts.

## Deployment

Deployed to **Netlify** (configured in `netlify.toml`). Site URL: `https://seancampbell.dev`. Node 20.

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
- Beyond section images: 800x500px (`public/images/beyond/`)
- OG image: `public/og-image.png`
