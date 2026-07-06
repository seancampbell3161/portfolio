# Per-page OG Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the home, roadmap, and blog-index pages real Open Graph preview images that are actual screenshots of those pages, so shared links (LinkedIn etc.) render a thumbnail instead of a 404.

**Architecture:** A local, on-demand Node script (`npm run og`) drives headless Chromium via Playwright, screenshots the live pages into `public/og/*.png`, and those PNGs are committed as static assets. A single config module (`src/lib/og.mjs`) is the source of truth for which routes get shots and what their image paths are; the Astro layout/pages import it so `<meta og:image>` and the generated filenames can never drift apart.

**Tech Stack:** Astro 5 (static), Playwright (devDependency, local only), Node 20 ESM, Vitest.

## Global Constraints

- **Playwright is a `devDependencies`-only dependency.** It must never appear in `dependencies` — it does not ship to the site bundle or the Netlify production build.
- **OG image dimensions:** 1200×630 CSS px captured at `deviceScaleFactor: 2` → output PNGs are exactly **2400×1260**, ratio 1.91:1.
- **Screenshot base URL** defaults to `https://seanthedeveloper.com`, overridable via the `OG_BASE_URL` env var. The roadmap's live progress exists only in production Netlify Blobs, so production is the correct default.
- **Single source of truth:** all `/og/<name>.png` paths come from `ogImagePath()` in `src/lib/og.mjs`. Never hardcode a `/og/*.png` string anywhere else.
- **Node/Netlify:** Node 20. The runner is plain Node ESM (`.mjs`) so it needs no TypeScript compile step.
- **Commit trailer:** every commit message in this plan ends with a blank line then:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## File Structure

- **Create** `src/lib/og.mjs` — config + path helpers (source of truth). Plain `.mjs` (not `.ts`) so the Node runner imports it without compilation; Astro/Vite and Vitest resolve `.mjs` natively.
- **Create** `src/lib/__tests__/og.test.ts` — unit test for the config/path logic.
- **Create** `scripts/og-screenshots.mjs` — the Playwright runner (no unit test; verified by running it — see Task 2 rationale).
- **Modify** `package.json` — add `playwright` devDependency + `"og"` script.
- **Modify** `src/layouts/Layout.astro` — default `image` → `ogImagePath("home")`.
- **Modify** `src/pages/roadmap.astro` — pass `image={ogImagePath("roadmap")}`.
- **Modify** `src/pages/blog/index.astro` — pass `image={ogImagePath("blog")}`.
- **Create (generated, committed)** `public/og/home.png`, `public/og/roadmap.png`, `public/og/blog.png`.

**Why no automated test for `scripts/og-screenshots.mjs`:** its only behavior is "launch a real browser and capture a real page." A unit test would have to mock Playwright away, leaving nothing real under test. It is verified by running it (Task 2) and by inspecting the committed PNGs (Task 4). Do **not** add a fake/mocked test for it.

---

### Task 1: OG config module (source of truth) + unit test

**Files:**
- Create: `src/lib/og.mjs`
- Test: `src/lib/__tests__/og.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `src/lib/og.mjs`):
  - `DEFAULT_BASE_URL: string`
  - `OG_SHOTS: Array<{ route: string, name: string }>`
  - `ogImagePath(name: string): string` → `"/og/<name>.png"`
  - `outputFile(name: string): string` → `"public/og/<name>.png"`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/og.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { OG_SHOTS, DEFAULT_BASE_URL, ogImagePath, outputFile } from "../og.mjs";

describe("og config", () => {
  it("derives the public meta path from a name", () => {
    expect(ogImagePath("roadmap")).toBe("/og/roadmap.png");
  });

  it("derives the repo output path from a name", () => {
    expect(outputFile("home")).toBe("public/og/home.png");
  });

  it("defaults to an absolute https production base url", () => {
    expect(DEFAULT_BASE_URL).toMatch(/^https:\/\/[^/]+$/);
  });

  it("has a home shot, absolute routes, and filename-safe unique names", () => {
    expect(OG_SHOTS.length).toBeGreaterThan(0);
    for (const shot of OG_SHOTS) {
      expect(shot.route.startsWith("/")).toBe(true);
      expect(shot.name).toMatch(/^[a-z0-9-]+$/);
    }
    const names = OG_SHOTS.map((s) => s.name);
    expect(names).toContain("home");
    expect(new Set(names).size).toBe(names.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- og`
Expected: FAIL — cannot resolve `../og.mjs` (module does not exist yet).

- [ ] **Step 3: Write the module**

Create `src/lib/og.mjs`:

```js
// Single source of truth for Open Graph screenshot pages.
// Consumed by: scripts/og-screenshots.mjs (plain Node), the Astro layout/pages
// (via Vite), and src/lib/__tests__/og.test.ts (Vitest).
// Kept as .mjs (not .ts) so the plain-node runner imports it without a compile step.

export const DEFAULT_BASE_URL = "https://seanthedeveloper.com";

// Each shot: `route` is the live path to screenshot; `name` is the asset basename.
export const OG_SHOTS = [
  { route: "/", name: "home" },
  { route: "/roadmap", name: "roadmap" },
  { route: "/blog", name: "blog" },
];

// Public URL used in <meta og:image>; served from public/og/<name>.png.
export function ogImagePath(name) {
  return `/og/${name}.png`;
}

// Repo-relative filesystem path the runner writes each screenshot to.
export function outputFile(name) {
  return `public/og/${name}.png`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- og`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/og.mjs src/lib/__tests__/og.test.ts
git commit -m "$(cat <<'EOF'
feat(og): config module for per-page screenshot paths

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Playwright screenshot runner + `npm run og`

**Files:**
- Modify: `package.json` (add devDependency + script)
- Create: `scripts/og-screenshots.mjs`

**Interfaces:**
- Consumes: `OG_SHOTS`, `DEFAULT_BASE_URL`, `outputFile` from `src/lib/og.mjs` (Task 1).
- Produces: the `npm run og` command; writes `public/og/<name>.png` for each shot at 2400×1260.

- [ ] **Step 1: Install Playwright as a devDependency**

Run: `npm install -D playwright`
Expected: `package.json` gains `"playwright"` under `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Download the Chromium browser binary (one-time)**

Run: `npx playwright install chromium`
Expected: Chromium downloads and installs (no error). This is a machine-local, one-time step — not committed.

- [ ] **Step 3: Add the `og` npm script**

In `package.json`, add to the `"scripts"` object (after `"astro": "astro"`):

```json
    "og": "node scripts/og-screenshots.mjs",
```

- [ ] **Step 4: Write the runner**

Create `scripts/og-screenshots.mjs`:

```js
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { OG_SHOTS, DEFAULT_BASE_URL, outputFile } from "../src/lib/og.mjs";

const BASE_URL = (process.env.OG_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
const WIDTH = 1200;
const HEIGHT = 630;

async function run() {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(
      "Failed to launch Chromium. Run `npx playwright install chromium` once, then retry.\n",
      err,
    );
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  let failures = 0;
  for (const { route, name } of OG_SHOTS) {
    const url = `${BASE_URL}${route}`;
    const out = outputFile(name);
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      // Let client hydration (e.g. roadmap's /api/progress fetch) and any
      // entrance transitions settle before capture, so numbers aren't 0.
      await page.waitForTimeout(1500);
      await mkdir(dirname(out), { recursive: true });
      await page.screenshot({
        path: out,
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      });
      await page.close();
      console.log(`✓ ${url} → ${out}`);
    } catch (err) {
      failures++;
      console.error(`✗ ${url} → ${out}\n`, err);
    }
  }

  await browser.close();
  if (failures > 0) {
    console.error(`\n${failures} shot(s) failed.`);
    process.exit(1);
  }
  console.log(`\nDone — ${OG_SHOTS.length} shot(s) written to public/og/.`);
}

run();
```

- [ ] **Step 5: Smoke-test the runner against production**

Run: `npm run og`
Expected output (order may vary): three `✓ https://seanthedeveloper.com<route> → public/og/<name>.png` lines, then `Done — 3 shot(s) written to public/og/.`, exit code 0. Three files now exist in `public/og/` (they are committed later in Task 4).

- [ ] **Step 6: Commit the tooling (not the PNGs yet)**

```bash
git add package.json package-lock.json scripts/og-screenshots.mjs
git commit -m "$(cat <<'EOF'
feat(og): playwright screenshot runner + npm run og

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire per-page `og:image` meta tags

**Files:**
- Modify: `src/layouts/Layout.astro` (frontmatter, ~lines 1–12)
- Modify: `src/pages/roadmap.astro` (frontmatter + `<Layout>` props)
- Modify: `src/pages/blog/index.astro` (frontmatter + `<Layout>` props)

**Interfaces:**
- Consumes: `ogImagePath` from `src/lib/og.mjs` (Task 1).
- Produces: `<meta property="og:image">` resolving to `https://seanthedeveloper.com/og/{home,roadmap,blog}.png` on the three pages; all other pages fall back to `/og/home.png`.

- [ ] **Step 1: Layout default → home screenshot**

In `src/layouts/Layout.astro`, add the import as the first line inside the frontmatter and change the `image` default.

Change:

```astro
---
interface Props {
  title: string;
  description?: string;
  image?: string;
}

const { 
  title, 
  description = "Software Engineer building systems that bridge complex technical challenges with real human needs.",
  image = "/og-image.png"
} = Astro.props;
```

to:

```astro
---
import { ogImagePath } from "../lib/og.mjs";

interface Props {
  title: string;
  description?: string;
  image?: string;
}

const { 
  title, 
  description = "Software Engineer building systems that bridge complex technical challenges with real human needs.",
  image = ogImagePath("home")
} = Astro.props;
```

(Leave the rest of the frontmatter and the `<meta property="og:image" content={new URL(image, Astro.site)} />` markup unchanged — it already resolves to an absolute URL.)

- [ ] **Step 2: Roadmap page → roadmap screenshot**

In `src/pages/roadmap.astro`, add the import to the frontmatter (after the existing imports, before the closing `---`):

```astro
import { ogImagePath } from "../lib/og.mjs";
```

Then change the `<Layout>` opening tag from:

```astro
<Layout
  title="Roadmap — Building Engineering Judgment | Sean Campbell"
  description="A public learning roadmap: building real systems (CodeCrafters), reading deeply (DDIA & more), and DSA fundamentals (NeetCode) — building engineering judgment in the open."
>
```

to:

```astro
<Layout
  title="Roadmap — Building Engineering Judgment | Sean Campbell"
  description="A public learning roadmap: building real systems (CodeCrafters), reading deeply (DDIA & more), and DSA fundamentals (NeetCode) — building engineering judgment in the open."
  image={ogImagePath("roadmap")}
>
```

- [ ] **Step 3: Blog index → blog screenshot**

In `src/pages/blog/index.astro`, add the import after the existing imports (note the `../../` depth):

```astro
import { ogImagePath } from "../../lib/og.mjs";
```

Then change the `<Layout>` opening tag from:

```astro
<Layout
  title="Blog | Sean Campbell"
  description="Thoughts on software engineering, architecture patterns, and lessons from production systems."
>
```

to:

```astro
<Layout
  title="Blog | Sean Campbell"
  description="Thoughts on software engineering, architecture patterns, and lessons from production systems."
  image={ogImagePath("blog")}
>
```

- [ ] **Step 4: Build and verify the meta tags resolved correctly**

Run: `npm run build`
Expected: build succeeds, no errors.

Then run:

```bash
grep -rho 'property="og:image" content="[^"]*"' dist/index.html dist/roadmap/index.html dist/blog/index.html
```

Expected output (exactly these three lines):

```
property="og:image" content="https://seanthedeveloper.com/og/home.png"
property="og:image" content="https://seanthedeveloper.com/og/roadmap.png"
property="og:image" content="https://seanthedeveloper.com/og/blog.png"
```

(If Astro is configured for flat file output instead of directories, the roadmap/blog files may be `dist/roadmap.html` / `dist/blog.html`; adjust the paths and re-grep. The three URLs must be exactly as above.)

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Layout.astro src/pages/roadmap.astro src/pages/blog/index.astro
git commit -m "$(cat <<'EOF'
feat(og): point per-page og:image at committed screenshots

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Generate and commit the OG images

**Files:**
- Create (generated): `public/og/home.png`, `public/og/roadmap.png`, `public/og/blog.png`

**Interfaces:**
- Consumes: `npm run og` (Task 2), which reads `OG_SHOTS` (Task 1).
- Produces: three committed PNGs served at `/og/<name>.png`.

- [ ] **Step 1: Generate the screenshots from production**

Run: `npm run og`
Expected: three `✓` lines + `Done — 3 shot(s) written to public/og/.`, exit 0.

- [ ] **Step 2: Verify dimensions are 2400×1260**

Run: `sips -g pixelWidth -g pixelHeight public/og/home.png public/og/roadmap.png public/og/blog.png`
Expected: for each of the three files, `pixelWidth: 2400` and `pixelHeight: 1260`.

- [ ] **Step 3: Eyeball the roadmap shot for real (non-zero) progress**

Run: `open public/og/roadmap.png`
Expected: the image shows the roadmap hero — the "Building engineering judgment" title and the progress dashboard with **real numbers** (not all `0 / N`). If it shows zeros, the hydration wait was too short or the run hit a non-production base URL — stop and investigate before committing.

- [ ] **Step 4: Confirm nothing ignores the assets, then commit**

Run: `git status --short public/og`
Expected: the three PNGs appear as untracked/added (not ignored).

```bash
git add public/og/home.png public/og/roadmap.png public/og/blog.png
git commit -m "$(cat <<'EOF'
feat(og): add generated OG screenshot images

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Post-implementation (manual, after deploy)

Not a code task — do this once the commits are deployed to Netlify:

1. Deploy (push to `main` / merge). `public/og/*.png` are served at `https://seanthedeveloper.com/og/<name>.png`.
2. Paste each of `/`, `/roadmap`, `/blog` into the **[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)** to force a re-scrape (LinkedIn caches previews ~7 days; without this you'll keep seeing the old empty card).
3. Confirm the card renders the screenshot. Optionally verify the raw image loads: `curl -sI https://seanthedeveloper.com/og/roadmap.png | head -1` → `HTTP/2 200`.

**Refreshing later:** re-run `npm run og`, then `git add public/og && git commit && push`. The roadmap card reflects progress as of the last run, not live.

---

## Self-Review

**Spec coverage:**
- §1 problem (missing default image) → Task 3 Step 1 (default → `/og/home.png`) + Task 4 (image exists). ✓
- §2 approach (local script, commit PNGs) → Tasks 2 & 4. ✓
- §3 production base URL + `OG_BASE_URL` override → Task 2 Step 4 (runner) + Global Constraints. ✓
- §4 roadmap production-data constraint → Task 4 Step 3 (non-zero verification). ✓
- §5 three shots + home as default → `OG_SHOTS` (Task 1) + Layout default (Task 3). ✓
- §6 wiring (Layout + 2 pages) → Task 3. ✓
- §7 1200×630 @2x, top-fold clip, dark → Task 2 runner + Task 4 Step 2. ✓
- §8 script shape → Task 2 Step 4. ✓
- §9 playwright devDep, files, gitignore check → Task 2 Step 1, Task 4 Step 4. ✓
- §10 verification (local/build/live) → Task 4 + Post-implementation. ✓
- §11 out-of-scope items → not implemented (correct). ✓

**Placeholder scan:** No TBD/TODO; every code and command step is concrete. ✓

**Type consistency:** `ogImagePath`, `outputFile`, `OG_SHOTS`, `DEFAULT_BASE_URL` are named identically in Task 1 (definition), Task 2 (runner import), and Task 3 (page imports). Output paths (`public/og/<name>.png`) and meta paths (`/og/<name>.png`) both derive from the same `name`. ✓
