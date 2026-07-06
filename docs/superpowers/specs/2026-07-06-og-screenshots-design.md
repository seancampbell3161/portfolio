# Design — Per-page OG screenshots (local script)

**Date:** 2026-07-06
**Status:** Draft for review

---

## 1. Why we're building this

When a page from this site is shared on LinkedIn (or Twitter/Facebook/Slack/iMessage), the platform renders a preview card from the page's Open Graph `<meta>` tags — it does **not** screenshot the page itself; it downloads whatever static image URL `og:image` points at.

`src/layouts/Layout.astro` already emits correct OG + Twitter Card tags with a per-page `image` prop, but the default it points at — `/og-image.png` — **does not exist** in `public/`, so every share currently resolves to a 404 and shows no thumbnail.

Goal: give the main shareable pages a real preview image that looks like the page, so a shared link to `/roadmap` shows the roadmap, a shared link to `/blog` shows the blog, and everything else falls back to a valid home-page card.

## 2. Approach (decided)

A **local, on-demand Node script** (`npm run og`) drives headless Chromium via Playwright, visits the live pages, captures a 1200×630 top-of-fold hero shot of each, and writes PNGs into `public/og/`. The PNGs are **committed to the repo** and deploy as ordinary static assets.

Rejected alternatives (and why):
- **Screenshot in the Netlify build** — adds a Chromium install to every CI build (slower, more brittle), and the roadmap would capture as all-zeros because the production Blobs data isn't reachable from the build container (see §4).
- **GitHub Actions auto-commit** — more CI infrastructure than a portfolio warrants right now.
- **Third-party screenshot API** in `og:image` — introduces a paid external dependency and runtime coupling.

The config array (§5) leaves the door open to promote this to CI later without rework.

## 3. Screenshot target — production URL

The script screenshots against **`https://seanthedeveloper.com`** by default, overridable via an `OG_BASE_URL` environment variable (e.g. `OG_BASE_URL=http://localhost:4321` to capture undeployed static-page design changes via `astro preview`).

**Workflow / first-run chicken-and-egg:** the meta-tag wiring (§6) must be deployed before the images exist. So the first rollout is two deploys:
1. Deploy the wiring + script (images 404 as they do today — no regression).
2. Run `npm run og` against production → commit the PNGs → deploy again.

Thereafter, refreshing any preview is: `npm run og` → commit → push.

## 4. Why production specifically (the roadmap constraint)

`/roadmap` renders `0 / N` in its static HTML and **hydrates live progress client-side** via `fetch("/api/progress")` (`src/scripts/roadmap.ts`). That endpoint reads a **Netlify Blobs** store (`netlify/lib/handlers/progress.ts` → `RoadmapStore`).

Netlify Blobs under local `netlify dev` is a **separate, empty sandbox store** — so a locally-served roadmap would still screenshot as all-zeros. The real progress data exists **only in production**. Therefore the roadmap shot must come from the live site, which is why production is the default target for all pages (keeping one coherent environment rather than a per-page split).

## 5. The three shots

Config is a single array at the top of the script:

| Route | Output file | Also serves as |
|---|---|---|
| `/` | `public/og/home.png` | site-wide **default** OG image |
| `/roadmap` | `public/og/roadmap.png` | — |
| `/blog` | `public/og/blog.png` | — |

Adding a route later = one line in this array.

## 6. Wiring (`Layout.astro` + two pages)

`src/layouts/Layout.astro` already takes `image?: string` and resolves it to an absolute URL against `Astro.site`. Changes:

- **Default:** change `image = "/og-image.png"` → `image = "/og/home.png"` (line 11). Every page without an explicit image — home, newsletter pages, 404 — then falls back to the home screenshot.
- **`src/pages/roadmap.astro`:** add `image="/og/roadmap.png"` to the `<Layout ...>` props.
- **`src/pages/blog/index.astro`:** add `image="/og/blog.png"` to the `<Layout ...>` props.

No change to the meta-tag markup itself — it already handles absolute-URL resolution and `twitter:card = summary_large_image`.

## 7. Image spec

- **Viewport:** 1200×630, `deviceScaleFactor: 2` → output PNGs are a retina-crisp **2400×1260** at the ideal 1.91:1 OG ratio (well under LinkedIn's ~5MB limit).
- **Framing:** capture the top fold via a fixed clip `{ x: 0, y: 0, width: 1200, height: 630 }` — nav + hero. This is the strongest framing for all three pages (e.g. the roadmap's "Building engineering judgment" title + live dashboard).
- **Theme:** the site's dark theme carries through; a dark card reads as premium against LinkedIn's light feed.
- **Color scheme:** emulate `prefers-color-scheme: dark` in the Playwright context so the shot matches the site's intended appearance regardless of the CI/host default.

## 8. The script — `scripts/og-screenshots.mjs`

Node ESM script, run via `npm run og`. Shape:

1. Read `OG_BASE_URL` (default `https://seanthedeveloper.com`).
2. Launch Chromium; create one context with `viewport: { width: 1200, height: 630 }`, `deviceScaleFactor: 2`, `colorScheme: 'dark'`.
3. For each `{ route, out }` in the config array:
   - `page.goto(base + route, { waitUntil: 'networkidle' })`.
   - **Settle wait:** an explicit short wait (e.g. `page.waitForTimeout(1500)` after network-idle) so `fetch('/api/progress')` resolves and roadmap numbers render before capture. (A `waitForFunction` on a specific stat is avoided because a genuine `0` value would hang it.)
   - `page.screenshot({ path: 'public/og/' + out, clip: { x: 0, y: 0, width: 1200, height: 630 } })`.
   - `log()` the route + output path written.
4. Close the browser; exit non-zero if any shot failed, so a broken run is obvious.

Ensure `public/og/` exists (create it if missing).

## 9. Dependencies & files

- **Add** `playwright` as a **devDependency only** — it never ships to the site bundle or the Netlify production build. One-time local `npx playwright install chromium` to fetch the browser binary.
- **New file:** `scripts/og-screenshots.mjs`.
- **New `package.json` script:** `"og": "node scripts/og-screenshots.mjs"`.
- **New committed assets:** `public/og/home.png`, `public/og/roadmap.png`, `public/og/blog.png`.
- **Verify** no `.gitignore` rule excludes `public/og/` or `*.png` before committing the assets.

## 10. Verification

- **Local:** run `npm run og`; confirm three PNGs are written at 2400×1260 and visually show the correct pages (roadmap shows real, non-zero progress).
- **Build:** `npm run build` succeeds and `dist/og/*.png` are present (static passthrough from `public/`).
- **Live:** after deploy, paste each URL into the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) to force a re-scrape and confirm the card renders (LinkedIn caches ~7 days, so the inspector is required to see updates).

## 11. Out of scope (YAGNI)

- Per-blog-post screenshots (`/blog/<slug>`) — prose pages may look better as designed title cards; deferred.
- Automatic regeneration in CI or on deploy — deferred; the script is the seam if we ever want it.
- Templated/designed OG cards (Satori / `astro-og-canvas`) — deferred.

## 12. Risks

- **First-run two-step deploy** (§3) — mitigated: no regression vs. today's 404 in the interim.
- **Playwright browser binary** must be installed locally (`npx playwright install chromium`) — one-time, documented in the script's failure message.
- **Stale previews** — committed PNGs only refresh when the script is re-run; acceptable for pages that change rarely. The roadmap card reflects progress as of the last run, not live.
