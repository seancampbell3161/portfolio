# Project Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every project a screenshot of its site, taken by Playwright, shown beside its title in the home building clip, in its inspector panel, and at the top of its case study.

**Architecture:** A plain-Node script screenshots each project that has a `url` into `src/assets/projects/<slug>.jpg`, with the target list computed by a unit-tested `.mjs` helper. A Vite-only module globs that folder into a slug-to-image map, and three Astro components render through `<Image>` from `astro:assets` so each placement ships WebP at its own size. The building lane grows to hold 66px clips through per-lane CSS offsets and a `--rows-building` variable written at build and kept by the client layout pass; the single item list the phone graph depends on is untouched.

**Tech Stack:** Astro 5 (`astro:assets`, sharp already installed), Playwright 1.61, Vitest, plain `.mjs` for the script and its helper (the `og.mjs` pattern), CSS container queries.

**Spec:** `docs/superpowers/specs/2026-09-05-project-thumbnails-design.md`

## Global Constraints

- Screenshots: viewport 1280×800, device scale 2, JPEG quality 90, written to `src/assets/projects/<slug>.jpg`; `networkidle` with a 45s timeout, falling back to the loaded page on timeout, then a 2.5s wait.
- Only projects with a frontmatter `url` are shot; a project without one is never written, so a hand-placed file under its slug survives.
- Clip thumbnail 90×56 at 900px and up, 56×35 below; hidden when the clip is narrower than 200px, by a container query, never by script.
- Building clip 66px tall; building row pitch 70px; `--rows-building` is at least 2; building lane height `12px + rows × 70px`; other lanes stay 120px.
- `<Image>` `widths`: clip `[180, 360]` with `sizes="90px"`; panel `[480, 960]`; page hero `[800, 1500]`. Clip and hero load eagerly, the panel lazily.
- Alt text: empty in the clip and the panel; `A screenshot of {title}` on the page.
- Project ids are their slugs (`src/lib/timeline/sources.ts`), so `projectImage(item.id)` finds a project's picture.
- Commit messages carry no agent co-author trailer (Sean's global CLAUDE.md).
- Tests run with `npm test` (Vitest); `npm run check` builds then tests; `npm run e2e` needs `npm run preview` running on port 4321.

---

### Task 1: The target list, `src/lib/thumbs.mjs`

**Files:**
- Create: `src/lib/thumbs.mjs`
- Test: `src/lib/__tests__/thumbs.test.ts`

**Interfaces:**
- Produces: `frontmatterOf(source: string): string`, `urlOf(frontmatter: string): string | undefined`, `projectShotTargets(files: { path: string; source: string }[]): { slug: string; url: string }[]`, `thumbFile(slug: string): string`. Task 2 imports `projectShotTargets` and `thumbFile`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/thumbs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { frontmatterOf, urlOf, projectShotTargets, thumbFile } from "../thumbs.mjs";

const roaming = `---
title: "Roaming.Camp"
start: 2025-03-01 # placeholder
status: live
url: "https://roaming.camp"
---

## Problem
`;
const rswebtwain = `---
title: "RSWebTWAIN"
status: done
source: "https://github.com/seancampbell3161/WebTWAIN"
---
`;

describe("frontmatterOf", () => {
  it("returns the text between the first two --- lines", () => {
    expect(frontmatterOf(roaming)).toContain('title: "Roaming.Camp"');
    expect(frontmatterOf(roaming)).not.toContain("## Problem");
  });
  it("accepts CRLF line endings", () => {
    expect(frontmatterOf("---\r\nurl: https://a.b\r\n---\r\nbody")).toBe("url: https://a.b");
  });
  it("is empty without a frontmatter block", () => {
    expect(frontmatterOf("# just a heading")).toBe("");
  });
});

describe("urlOf", () => {
  it("reads a quoted url", () => {
    expect(urlOf('url: "https://roaming.camp"')).toBe("https://roaming.camp");
  });
  it("reads a bare url and drops a trailing comment", () => {
    expect(urlOf("url: https://songle.lol # placeholder")).toBe("https://songle.lol");
  });
  it("ignores a commented-out url line", () => {
    expect(urlOf("# url: https://later.example\nstatus: done")).toBeUndefined();
  });
  it("is undefined when there is no url", () => {
    expect(urlOf("source: https://github.com/x/y")).toBeUndefined();
  });
});

describe("projectShotTargets", () => {
  it("pairs each file with a url to its slug, in order, and skips the rest", () => {
    const files = [
      { path: "src/content/projects/roaming-camp.mdx", source: roaming },
      { path: "src/content/projects/rswebtwain.mdx", source: rswebtwain },
    ];
    expect(projectShotTargets(files)).toEqual([{ slug: "roaming-camp", url: "https://roaming.camp" }]);
  });
  it("is empty when no file has a url", () => {
    expect(projectShotTargets([{ path: "a/b.mdx", source: rswebtwain }])).toEqual([]);
  });
});

describe("thumbFile", () => {
  it("builds the repo-relative jpg path from a slug", () => {
    expect(thumbFile("songle")).toBe("src/assets/projects/songle.jpg");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/thumbs.test.ts`
Expected: FAIL with `Cannot find module '../thumbs.mjs'`

- [ ] **Step 3: Write the helper**

Create `src/lib/thumbs.mjs`:

```js
// src/lib/thumbs.mjs
// Which projects get a screenshot and where it goes (thumbnails spec §4.1).
// Plain .mjs, like og.mjs, so scripts/project-screenshots.mjs runs it without
// a compile step and Vitest tests it.

/** The frontmatter block of an MDX file: the text between its first two `---` lines, or "" without one. */
export function frontmatterOf(source) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return m ? m[1] : "";
}

/** The `url:` value of a frontmatter block, unquoted, without a trailing `#` comment; undefined when absent. */
export function urlOf(frontmatter) {
  const m = /^url:\s*("?)([^"\s#]+)\1/m.exec(frontmatter);
  return m ? m[2] : undefined;
}

/**
 * `{ slug, url }` for every project file that has a url, in the order given.
 * Each file is `{ path, source }`; the slug is the basename without `.mdx`.
 * A project without a url is not a target, so a picture placed by hand under
 * its slug is never overwritten.
 */
export function projectShotTargets(files) {
  return files.flatMap(({ path, source }) => {
    const url = urlOf(frontmatterOf(source));
    if (!url) return [];
    const slug = path.replace(/^.*\//, "").replace(/\.mdx$/, "");
    return [{ slug, url }];
  });
}

/** Repo-relative path the runner writes a project's screenshot to. */
export function thumbFile(slug) {
  return `src/assets/projects/${slug}.jpg`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/thumbs.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/thumbs.mjs src/lib/__tests__/thumbs.test.ts
git commit -m "feat(thumbs): the screenshot targets, read from the projects' frontmatter"
```

---

### Task 2: The screenshot script and the two pictures

**Files:**
- Create: `scripts/project-screenshots.mjs`
- Create: `src/assets/projects/roaming-camp.jpg`, `src/assets/projects/songle.jpg` (generated)
- Modify: `package.json` (scripts block, lines 5–17)

**Interfaces:**
- Consumes: `projectShotTargets`, `thumbFile` from Task 1.
- Produces: the two JPEGs Task 4 onwards render.

- [ ] **Step 1: Write the script**

Create `scripts/project-screenshots.mjs`:

```js
// Screenshots every project that has a url into src/assets/projects/<slug>.jpg
// (thumbnails spec §4.1). Run as `npm run thumbs` and commit the results; rerun
// when a site changes its face. Mirrors scripts/og-screenshots.mjs.
import { chromium } from "playwright";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { projectShotTargets, thumbFile } from "../src/lib/thumbs.mjs";

const PROJECTS_DIR = "src/content/projects";
const WIDTH = 1280;
const HEIGHT = 800;

async function targets() {
  const names = (await readdir(PROJECTS_DIR)).filter((n) => n.endsWith(".mdx")).sort();
  const files = await Promise.all(
    names.map(async (name) => {
      const path = join(PROJECTS_DIR, name);
      return { path, source: await readFile(path, "utf8") };
    }),
  );
  return projectShotTargets(files);
}

async function run() {
  const shots = await targets();
  if (shots.length === 0) {
    console.log("No project has a url; nothing to shoot.");
    return;
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error("Failed to launch Chromium. Run `npx playwright install chromium` once, then retry.\n", err);
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  let failures = 0;
  for (const { slug, url } of shots) {
    const out = thumbFile(slug);
    try {
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      } catch (err) {
        // A map or a live feed can keep the network busy for good; the page is
        // still there, so shoot what loaded.
        if (!String(err).includes("Timeout")) throw err;
        console.log(`  ${url} never went idle; shooting as loaded`);
      }
      // Tiles, fonts and entrance animations.
      await page.waitForTimeout(2500);
      await mkdir(dirname(out), { recursive: true });
      await page.screenshot({ path: out, type: "jpeg", quality: 90 });
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
  console.log(`\nDone — ${shots.length} shot(s) written to src/assets/projects/.`);
}

run();
```

- [ ] **Step 2: Add the npm script**

In `package.json`, after the `"og"` line, add:

```json
    "thumbs": "node scripts/project-screenshots.mjs",
```

- [ ] **Step 3: Run it**

Run: `npm run thumbs`
Expected: two `✓` lines, for `https://roaming.camp` and `https://songle.lol`, then `Done — 2 shot(s) written to src/assets/projects/.` (RSWebTWAIN and the DAW engine have no url and are not mentioned.)

- [ ] **Step 4: Check the outputs**

Run: `ls -la src/assets/projects/`
Expected: exactly `roaming-camp.jpg` and `songle.jpg`, each between 50KB and 3MB. Open both and confirm they show the sites, not an error page.

- [ ] **Step 5: Commit**

```bash
git add scripts/project-screenshots.mjs package.json src/assets/projects/roaming-camp.jpg src/assets/projects/songle.jpg
git commit -m "feat(thumbs): npm run thumbs screenshots each project's site; Roaming.Camp and Songle shot"
```

---

### Task 3: `rowsNeeded` in `layout.ts`

**Files:**
- Modify: `src/lib/timeline/layout.ts` (after `packLane`, which ends near line 240)
- Test: `src/lib/timeline/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `RowPlaced` from `layout.ts`.
- Produces: `rowsNeeded(placed: readonly { row: number }[], floor: number): number`. Tasks 5 uses it in `Timeline.astro` and `apply.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/timeline/__tests__/layout.test.ts` (import `rowsNeeded` in the existing import list from `../layout.js`):

```ts
describe("rowsNeeded (thumbnails spec §6)", () => {
  it("counts the rows a packed lane uses", () => {
    expect(rowsNeeded([{ row: 0 }, { row: 2 }, { row: 1 }], 1)).toBe(3);
  });
  it("never goes below the floor", () => {
    expect(rowsNeeded([{ row: 0 }], 2)).toBe(2);
    expect(rowsNeeded([], 2)).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: FAIL, `rowsNeeded is not a function` (or a missing export error)

- [ ] **Step 3: Write the helper**

Append to `src/lib/timeline/layout.ts`:

```ts
/**
 * Thumbnails spec §6: the rows a packed lane needs, never below `floor`. The
 * building lane's height derives from this at build and on the client, so
 * three overlapping projects grow the lane instead of clipping the third row.
 */
export function rowsNeeded(placed: readonly { row: number }[], floor: number): number {
  return Math.max(floor, ...placed.map((p) => p.row + 1));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/layout.ts src/lib/timeline/__tests__/layout.test.ts
git commit -m "feat(timeline): rowsNeeded, a lane's packed row count with a floor"
```

---

### Task 4: The picture map and the clip thumbnail

**Files:**
- Create: `src/lib/images.ts`
- Modify: `src/components/Timeline.astro` (frontmatter imports lines 1–15; the item markup around lines 109–113; the clip rules after `.tl-sub`, around line 375; the phone block after the `.tl-sub` phone rule, around line 630)
- Modify: `src/__tests__/home-contract.test.ts` (after the readout test, before the final `});`)
- Modify: `scripts/interactions.mjs` (before `// ---- phone ----`)

**Interfaces:**
- Consumes: the JPEGs from Task 2.
- Produces: `projectImage(slug: string): ImageMetadata | undefined` from `src/lib/images.ts`; the `.tl-thumb` class. Tasks 6 and 7 import `projectImage`.

- [ ] **Step 1: Write the failing contract test**

Add to `src/__tests__/home-contract.test.ts`, before the final `});`:

```ts
  // A building clip's picture (thumbnails spec §5). Present as long as a project
  // with a picture is on the timeline; two are committed.
  it("keeps the clip thumbnail", () => {
    expect(html).toContain('class="tl-thumb"');
  });
```

- [ ] **Step 2: Build and run it to verify it fails**

Run: `npm run build 2>&1 | tail -2 && npx vitest run src/__tests__/home-contract.test.ts`
Expected: FAIL, `keeps the clip thumbnail`, expected the page to contain `class="tl-thumb"`

- [ ] **Step 3: Write the picture map**

Create `src/lib/images.ts`:

```ts
// src/lib/images.ts
// The slug-to-picture map over src/assets/projects/ (thumbnails spec §4.2).
// Vite-only, the way src/lib/timeline/astro.ts is Astro-only: import.meta.glob
// is resolved at build, so nothing else in src/lib/ has to know about assets.
import type { ImageMetadata } from "astro";

const files = import.meta.glob<{ default: ImageMetadata }>("/src/assets/projects/*.{jpg,png}", { eager: true });

const bySlug = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(files)) {
  const slug = path.replace(/^.*\//, "").replace(/\.(jpg|png)$/, "");
  // Two pictures for one project would mean one silently wins; fail the build instead.
  if (bySlug.has(slug)) throw new Error(`Two pictures for project "${slug}" in src/assets/projects/`);
  bySlug.set(slug, mod.default);
}

/** The project's screenshot, or undefined when none is committed under its slug. */
export function projectImage(slug: string): ImageMetadata | undefined {
  return bySlug.get(slug);
}
```

- [ ] **Step 4: Render the thumbnail in the clip**

In `src/components/Timeline.astro`, add two imports after the `layout` import block (line 15):

```ts
import { Image } from "astro:assets";
import { projectImage } from "../lib/images";
```

Replace the clip markup

```astro
            <a class="tl-clip" href={item.href} data-item-link={item.id}>
              <span class="tl-sr">{item.lane[0].toUpperCase() + item.lane.slice(1)}: </span>
              <span class="tl-title">{item.title}</span>
              {item.subtitle && <small class="tl-sub">{item.subtitle}</small>}
            </a>
```

with

```astro
            <a class="tl-clip" href={item.href} data-item-link={item.id}>
              <span class="tl-sr">{item.lane[0].toUpperCase() + item.lane.slice(1)}: </span>
              {shot && <Image class="tl-thumb" src={shot} alt="" widths={[180, 360]} sizes="90px" loading="eager" />}
              <span class="tl-title">{item.title}</span>
              {item.subtitle && <small class="tl-sub">{item.subtitle}</small>}
            </a>
```

and, inside the `items.map((item) => {` callback, right after `const p = placed.get(item.id);`, add:

```ts
        // Thumbnails spec §5: a building span carries its site's picture; project ids are slugs.
        const shot = item.lane === "building" && item.kind === "span" ? projectImage(item.id) : undefined;
```

- [ ] **Step 5: Style the clip at 900px and up**

In the global `<style>` of `Timeline.astro`, after the `.tl-sub` rule (which ends near line 375), add:

```css
  /* A building span carries its picture beside the title (thumbnails spec §5.1).
     The item is a size container so the picture can hide on a narrow clip in
     CSS alone; moments keep width:auto and must not be containers. */
  .tl-item[data-lane="building"][data-kind="span"] {
    container-type: inline-size;
  }
  .tl-item[data-lane="building"][data-kind="span"] .tl-clip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-content: center;
    column-gap: 10px;
    height: 66px;
    padding: 0 10px 0 0;
    white-space: normal;
  }
  .tl-item[data-lane="building"][data-kind="span"] :is(.tl-title, .tl-sub) {
    grid-column: 2;
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tl-item[data-lane="building"][data-kind="span"] .tl-title {
    grid-row: 1;
  }
  .tl-item[data-lane="building"][data-kind="span"] .tl-sub {
    grid-row: 2;
    margin-top: 1px;
  }
  .tl-thumb {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 90px;
    height: 56px;
    margin-left: 5px;
    border-radius: 2px;
    object-fit: cover;
    object-position: 50% 0;
  }
  @container (width < 200px) {
    .tl-thumb {
      display: none;
    }
  }
```

- [ ] **Step 6: Style the phone row**

Inside the `@media (max-width: 899.98px)` block, after the phone `.tl-sub` rule (the one that sets `margin: 2px 0 0; font-size: 11px;`), add:

```css
    /* Thumbnails spec §5.2: the row keeps its text and gains the picture at the right. */
    .tl-item[data-lane="building"][data-kind="span"] .tl-clip {
      grid-template-columns: minmax(0, 1fr) auto;
      height: auto;
      padding: 0;
    }
    .tl-item[data-lane="building"][data-kind="span"] :is(.tl-title, .tl-sub) {
      grid-column: 1;
    }
    .tl-thumb {
      grid-column: 2;
      grid-row: 1 / 3;
      align-self: start;
      width: 56px;
      height: 35px;
      margin: 0;
    }
```

- [ ] **Step 7: Build and run the contract test to verify it passes**

Run: `npm run build 2>&1 | grep -E "error|Complete" ; npx vitest run src/__tests__/home-contract.test.ts`
Expected: the build completes without errors; PASS, 8 tests

- [ ] **Step 8: Write the failing e2e checks**

In `scripts/interactions.mjs`, insert before `// ---- phone ----`:

```js
// ---- project thumbnails (interactions 3) ----
// The all-time zoom shows every project at its narrowest, so the 200px rule is
// exercised both ways when clips straddle it.
const thumbs = await fresh(`${BASE}/`);
await thumbs.locator('[data-zoom-control] button[data-zoom="all"]').click();
const clipState = await thumbs.$$eval('.tl-item[data-lane="building"][data-kind="span"]:not([data-out])', (els) =>
  els.map((el) => {
    const img = el.querySelector(".tl-thumb");
    return {
      id: el.dataset.id,
      width: el.getBoundingClientRect().width,
      hasImg: !!img,
      shown: !!img && getComputedStyle(img).display !== "none",
    };
  }),
);
check("a thumbnail shows exactly when its clip is at least 200px wide", clipState.filter((c) => c.hasImg).every((c) => c.shown === (c.width >= 200)));
check("at least one building clip shows its thumbnail", clipState.some((c) => c.shown));
await thumbs.close();

```

- [ ] **Step 9: Run the harness to see the new checks fail or pass for the right reason**

With `npm run preview` running in another terminal (it serves the `dist/` you just built):

Run: `npm run e2e 2>&1 | grep -E "thumbnail|failure|all checks"`
Expected: both thumbnail checks `ok` (the CSS from Steps 5 and 6 is already in the build; these checks lock it). If either fails, the container query or the `data-out` handling is wrong; fix the CSS, rebuild, rerun.

- [ ] **Step 10: Look at it**

Run: `npm run shots` (preview still running), then open `screenshots/` and check the home page at both widths: at the year zoom Roaming.Camp shows its picture beside its title in a 66px clip; on the phone the Roaming.Camp row has the picture at its right. The building lane is still 120px tall here, so the second row overflows the lane until Task 5; that is expected at this point.

- [ ] **Step 11: Commit**

```bash
git add src/lib/images.ts src/components/Timeline.astro src/__tests__/home-contract.test.ts scripts/interactions.mjs
git commit -m "feat(timeline): a building clip carries its site's picture beside the title"
```

---

### Task 5: The building lane grows to its rows

**Files:**
- Modify: `src/components/Timeline.astro` (frontmatter `placed` loop lines 35–41; the `<section class="tl" ...>` tag at line 61; `.tl` tokens lines 138–148; `.tl-stage` `grid-template-rows` at line 226; `.tl-items` background lines 312–314; `.tl-item` `top` at line 320)
- Modify: `src/scripts/timeline/apply.ts` (imports lines 7–19; the `LANES.forEach` loop lines 29–41)
- Modify: `src/__tests__/home-contract.test.ts`
- Modify: `scripts/interactions.mjs` (inside the thumbnails section from Task 4, before `await thumbs.close();`)

**Interfaces:**
- Consumes: `rowsNeeded` from Task 3; `packLane` from `layout.ts`.
- Produces: `--rows-building` on `.tl` (a number), `--lane-h-building`, `--lane-2-top`, `--lane-3-top`, `--row-pitch-building` tokens.

- [ ] **Step 1: Write the failing contract test**

Add to `src/__tests__/home-contract.test.ts`, before the final `});`:

```ts
  it("writes the building lane's row count on the root, which the layout pass keeps", () => {
    expect(html).toMatch(/<section class="tl"[^>]*--rows-building:\s*\d+/);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/home-contract.test.ts`
Expected: FAIL on `--rows-building` (the build from Task 4 has no such variable)

- [ ] **Step 3: Write the row count at build**

In `src/components/Timeline.astro`, add `rowsNeeded` to the import list from `../lib/timeline/layout`, and replace

```ts
const placed = new Map<string, { lane: number; row: number; x: number; w: number; labeled: boolean }>();
LANES.forEach((lane, laneIndex) => {
  for (const p of packLane(items, lane, win, now, estimate)) {
    placed.set(p.item.id, { lane: laneIndex, row: p.row, x: p.x, w: p.w, labeled: p.labeled });
  }
});
```

with

```ts
const placed = new Map<string, { lane: number; row: number; x: number; w: number; labeled: boolean }>();
// Thumbnails spec §6: the building lane is as tall as its rows, never under two.
let buildingRows = 2;
LANES.forEach((lane, laneIndex) => {
  const packed = packLane(items, lane, win, now, estimate);
  if (lane === "building") buildingRows = rowsNeeded(packed, 2);
  for (const p of packed) {
    placed.set(p.item.id, { lane: laneIndex, row: p.row, x: p.x, w: p.w, labeled: p.labeled });
  }
});
```

Then change the root tag

```astro
<section class="tl" data-timeline data-now={now.toISOString()} data-zoom={zoom} aria-label={`Timeline, ${label}`}>
```

to

```astro
<section class="tl" data-timeline data-now={now.toISOString()} data-zoom={zoom} style={`--rows-building:${buildingRows}`} aria-label={`Timeline, ${label}`}>
```

- [ ] **Step 4: Name the lane rows in CSS**

In the `.tl` rule, after `--row-top: 12px;`, add:

```css
    /* Thumbnails spec §6: the building lane holds 66px clips at a 70px pitch and
       is as tall as its packed rows (the inline style and the layout pass set
       --rows-building; two is the floor). The other lanes keep --lane-h. */
    --row-pitch-building: 70px;
    --rows-building: 2;
    --lane-h-building: calc(var(--row-top) + var(--rows-building) * var(--row-pitch-building));
    --lane-2-top: calc(var(--lane-h) + var(--lane-h-building));
    --lane-3-top: calc(2 * var(--lane-h) + var(--lane-h-building));
```

Change the `.tl-stage` rows

```css
    grid-template-rows: var(--ruler-h) repeat(4, var(--lane-h));
```

to

```css
    grid-template-rows: var(--ruler-h) var(--lane-h) var(--lane-h-building) var(--lane-h) var(--lane-h);
```

Replace the three background lines of `.tl-items`

```css
    background-image: linear-gradient(var(--color-border) 1px, transparent 1px);
    background-size: 100% var(--lane-h);
    background-position: 0 -1px;
```

with one gradient whose stops sit at the three lane boundaries:

```css
    /* One 1px rule under each of the first three lanes; the lanes are no longer equal. */
    background-image: linear-gradient(
      to bottom,
      transparent calc(var(--lane-h) - 1px),
      var(--color-border) calc(var(--lane-h) - 1px),
      var(--color-border) var(--lane-h),
      transparent var(--lane-h),
      transparent calc(var(--lane-2-top) - 1px),
      var(--color-border) calc(var(--lane-2-top) - 1px),
      var(--color-border) var(--lane-2-top),
      transparent var(--lane-2-top),
      transparent calc(var(--lane-3-top) - 1px),
      var(--color-border) calc(var(--lane-3-top) - 1px),
      var(--color-border) var(--lane-3-top),
      transparent var(--lane-3-top)
    );
```

Change the `.tl-item` `top`

```css
    top: calc(var(--lane) * var(--lane-h) + var(--row-top) + var(--row) * var(--row-pitch));
```

to

```css
    top: calc(var(--lane-top) + var(--row-top) + var(--row) * var(--pitch));
```

and add, right after the `.tl-item` rule:

```css
  /* Each lane's top edge and row pitch, by lane; --lane stays for the strip and gutter. */
  .tl-item[data-lane="writing"]   { --lane-top: 0px; --pitch: var(--row-pitch); }
  .tl-item[data-lane="building"]  { --lane-top: var(--lane-h); --pitch: var(--row-pitch-building); }
  .tl-item[data-lane="learning"]  { --lane-top: var(--lane-2-top); --pitch: var(--row-pitch); }
  .tl-item[data-lane="community"] { --lane-top: var(--lane-3-top); --pitch: var(--row-pitch); }
```

- [ ] **Step 5: Keep the row count on the client**

In `src/scripts/timeline/apply.ts`, add `rowsNeeded` to the import list from `../../lib/timeline/layout`, and replace

```ts
  LANES.forEach((lane, laneIndex) => {
    for (const p of packLane(items, lane, win, now, measure)) {
```

with

```ts
  LANES.forEach((lane, laneIndex) => {
    const packed = packLane(items, lane, win, now, measure);
    // Thumbnails spec §6: the building lane follows its packed rows, floor two.
    if (lane === "building") root.style.setProperty("--rows-building", String(rowsNeeded(packed, 2)));
    for (const p of packed) {
```

- [ ] **Step 6: Build and run the contract test to verify it passes**

Run: `npm run build 2>&1 | grep -E "error|Complete" ; npx vitest run src/__tests__/home-contract.test.ts`
Expected: build completes; PASS, 9 tests

- [ ] **Step 7: Write the e2e lane checks**

In `scripts/interactions.mjs`, inside the thumbnails section, before `await thumbs.close();`, add:

```js
const laneHeights = await thumbs.$$eval(".tl-head", (els) => els.map((el) => el.getBoundingClientRect().height));
const buildingRows = Number(await thumbs.$eval(".tl", (el) => getComputedStyle(el).getPropertyValue("--rows-building")));
check("the building lane is 12 + rows x 70 tall", Math.abs(laneHeights[1] - (12 + buildingRows * 70)) < 1);
check("the other lanes keep 120px", [0, 2, 3].every((i) => Math.abs(laneHeights[i] - 120) < 1));
check("building clips sit inside their lane", await thumbs.$$eval('.tl-item[data-lane="building"]:not([data-out])', (els) => {
  const lane = document.querySelectorAll(".tl-head")[1].getBoundingClientRect();
  return els.every((el) => { const r = el.getBoundingClientRect(); return r.top >= lane.top && r.bottom <= lane.bottom + 1; });
}));
```

and, in the phone section after `check("phone has no cursor", ...)`, add:

```js
check("a phone building row shows its picture", (await phone.locator('.tl-item[data-lane="building"]:not([data-out]) .tl-thumb:visible').count()) > 0);
```

- [ ] **Step 8: Run the harness**

With `npm run preview` running against the fresh build:

Run: `npm run e2e 2>&1 | grep -E "FAIL|lane|clips sit|picture|failure|all checks"`
Expected: every new check `ok` and `all checks passed`. A `FAIL` on "sit inside their lane" means the per-lane `--lane-top` or `--pitch` rules are wrong; a `FAIL` on the heights means the `.tl-stage` rows or the tokens are.

- [ ] **Step 9: Look at it**

Run: `npm run shots`, then check the home page at both widths and at the three zooms if you can (the year zoom stacks Roaming.Camp and the DAW engine in two rows): the building lane is taller than its neighbours, its gridline sits under the second row, the learning and community lanes start where the building lane ends, and nothing overlaps the ruler or the playhead's label. On the phone nothing should have changed from Task 4.

- [ ] **Step 10: Commit**

```bash
git add src/components/Timeline.astro src/scripts/timeline/apply.ts src/__tests__/home-contract.test.ts scripts/interactions.mjs
git commit -m "feat(timeline): the building lane is as tall as its rows, 70px a row, floor two"
```

---

### Task 6: The picture in the inspector panel

**Files:**
- Modify: `src/components/Inspector.astro` (frontmatter imports at the top; the `<aside class="insp-side">` block around lines 48–55; the `.insp-facts` style around line 170)
- Modify: `src/__tests__/home-contract.test.ts`

**Interfaces:**
- Consumes: `projectImage` from Task 4.

- [ ] **Step 1: Write the failing contract test**

Add to `src/__tests__/home-contract.test.ts`, before the final `});`:

```ts
  it("keeps the panel's picture, lazy since panels start hidden", () => {
    expect(html).toMatch(/<img[^>]*class="insp-shot"[^>]*loading="lazy"|<img[^>]*loading="lazy"[^>]*class="insp-shot"/);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/home-contract.test.ts`
Expected: FAIL on `insp-shot`

- [ ] **Step 3: Render it**

In `src/components/Inspector.astro`'s frontmatter, add:

```ts
import { Image } from "astro:assets";
import { projectImage } from "../lib/images";
```

Inside the `items.map((item) => {` callback, right after `const b = item.body;`, add:

```ts
    // Thumbnails spec §7.1: a building panel shows the project's picture; project ids are slugs.
    const shot = b?.lane === "building" ? projectImage(item.id) : undefined;
```

Then replace

```astro
        <aside class="insp-side">
          {b?.lane === "building" && (
            <dl class="insp-facts">
```

with

```astro
        <aside class="insp-side">
          {shot && (
            <Image
              class="insp-shot"
              src={shot}
              alt=""
              widths={[480, 960]}
              sizes="(max-width: 899px) 100vw, 420px"
              loading="lazy"
            />
          )}
          {b?.lane === "building" && (
            <dl class="insp-facts">
```

Add before the `.insp-facts` rule in the component's `<style>`:

```css
  /* Thumbnails spec §7.1: the project's picture above its facts. */
  .insp-shot {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 0 18px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
```

- [ ] **Step 4: Build and run the contract test to verify it passes**

Run: `npm run build 2>&1 | grep -E "error|Complete" ; npx vitest run src/__tests__/home-contract.test.ts`
Expected: build completes; PASS, 10 tests

- [ ] **Step 5: Look at it**

With `npm run preview` running: open `http://localhost:4321/#item-roaming-camp` at 1280px and at 390px. The panel shows the Roaming.Camp screenshot above Stack, Started and Status in the side column at desktop; on the phone bottom sheet the picture spans the sheet's width above the facts. Open `#item-rswebtwain`: no picture, facts as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector.astro src/__tests__/home-contract.test.ts
git commit -m "feat(inspector): a building panel shows the project's picture above its facts"
```

---

### Task 7: The picture on the case study page

**Files:**
- Modify: `src/layouts/ProjectPage.astro` (frontmatter imports and the article markup after `<p class="standfirst">`)
- Modify: `src/styles/reader.css` (the `.reader .hero` rule, line 61)

**Interfaces:**
- Consumes: `projectImage` from Task 4; `.reader .hero` from `reader.css`.

- [ ] **Step 1: Write the failing check**

There is no dist-reading test for project pages, so the check is a grep over the built page. Run, before changing anything:

`npm run build 2>&1 | tail -1 && grep -c 'A screenshot of Roaming.Camp' dist/building/roaming-camp/index.html`
Expected: `0` (grep exits 1 with a count of 0)

- [ ] **Step 2: Render it**

In `src/layouts/ProjectPage.astro`'s frontmatter, add:

```ts
import { Image } from "astro:assets";
import { projectImage } from "../lib/images";
```

and after `const host = ...`, add:

```ts
// Thumbnails spec §7.2: the case study opens with the site's picture when one is committed.
const shot = projectImage(entry.slug);
```

Replace

```astro
  <p class="standfirst">{description}</p>
  <div class="body">
```

with

```astro
  <p class="standfirst">{description}</p>
  {shot && (
    <Image class="hero" src={shot} alt={`A screenshot of ${title}`} widths={[800, 1500]} sizes="(max-width: 899px) 100vw, 744px" loading="eager" />
  )}
  <div class="body">
```

In `src/styles/reader.css`, change

```css
.reader .hero {
  width: 100%;
  border-radius: var(--radius-md);
  margin-bottom: 36px;
}
```

to

```css
.reader .hero {
  width: 100%;
  height: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 36px;
}
```

(`height: auto` because `<Image>` writes the intrinsic height attribute; the border keeps a light screenshot from bleeding into the page. Essays without a hero are unaffected; an essay with one gains the same border.)

- [ ] **Step 3: Build and check**

Run: `npm run build 2>&1 | grep -E "error|Complete" && grep -c 'A screenshot of Roaming.Camp' dist/building/roaming-camp/index.html && grep -c 'class="hero"' dist/building/rswebtwain/index.html`
Expected: build completes; `1` for Roaming.Camp; `0` for RSWebTWAIN (grep exits 1 on the last count, which is the expected outcome)

- [ ] **Step 4: Look at it**

With `npm run preview` running: open `/building/roaming-camp` at 1280px and 390px. The picture sits under the standfirst at the article's width and the body starts 36px below it. Open `/building/rswebtwain`: no picture, the body follows the standfirst as before.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/ProjectPage.astro src/styles/reader.css
git commit -m "feat(building): a case study opens with the site's picture"
```

---

### Task 8: Docs and final verification

**Files:**
- Modify: `CLAUDE.md` (Build commands list; the "Timeline data" paragraph, line 29; the "Image Requirements" list, line 64)
- Modify: `README.md` (the commands table, line 28; the images note, line 116)

- [ ] **Step 1: CLAUDE.md**

In the Build & Development Commands list, after the `npm run e2e` line, add:

```markdown
- `npm run thumbs` — Playwright screenshots of every project that has a `url` in its frontmatter, into `src/assets/projects/<slug>.jpg`; committed. A project without a `url` can carry a hand-placed picture under its slug instead.
```

In the "Timeline data" paragraph, change

```markdown
`astro.ts` is the only file that imports from Astro.
```

to

```markdown
`astro.ts` is the only timeline file that imports from Astro; beside it, `src/lib/images.ts` is the only module that reads `src/assets/` (a slug-to-picture map over the project screenshots, rendered through `astro:assets` in the building clips, the inspector and the case studies).
```

In the "Image Requirements" list, add:

```markdown
- Project screenshots: `src/assets/projects/<slug>.jpg`, generated by `npm run thumbs` and committed; shown at 90×56 in the home clip (hidden under 200px of clip width), above the facts in the inspector, and under the standfirst on the case study
```

- [ ] **Step 2: README.md**

In the commands table, after the `npm run og` row, add:

```markdown
| `npm run thumbs` | Screenshot every project that has a `url` into `src/assets/projects/`, for the clips, panels and case studies |
```

Near the images note at line 116, add a sentence:

```markdown
Project screenshots live in `src/assets/projects/<slug>.jpg`, generated by `npm run thumbs` and committed; a project without a site can carry a hand-placed picture under its slug.
```

- [ ] **Step 3: Full verification**

Run: `npm run check 2>&1 | grep -E "Test Files|Tests |FAIL|error"`
Expected: every test file passes, no failures.

With `npm run preview` running: `npm run e2e 2>&1 | grep -E "FAIL|failure|all checks passed"`
Expected: `all checks passed`.

Run: `npm run shots` and review the home page at both widths, a project page and the building index (unchanged) in `screenshots/`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: project thumbnails, npm run thumbs and the picture map"
```

---

## Self-review

**Spec coverage.** §4.1 script and targets: Tasks 1 and 2. §4.2 map: Task 4. §4.3 rendering sizes: Tasks 4, 6, 7 use the table's widths, sizes and loading. §5.1 desktop clip, container query, empty alt: Task 4. §5.2 phone row: Task 4 Step 6, e2e in Task 5. §6 lane rows, offsets, gridlines, `rowsNeeded` at build and on the client: Tasks 3 and 5. §7.1 panel: Task 6. §7.2 page with the hero class and named alt: Task 7. §8 files: docs in Task 8, the rest in their tasks. §9 accessibility: alt text in Tasks 4, 6, 7; explicit width and height come from `<Image>`. §10 tests: unit in Tasks 1 and 3, contract in Tasks 4, 5, 6, e2e in Tasks 4 and 5, `check`/`e2e`/`shots` in Task 8.

**Placeholders.** None: every step carries its code or its exact command and expected output.

**Type consistency.** `projectShotTargets(files)` and `thumbFile(slug)` are named the same in Tasks 1 and 2; `projectImage(slug)` in Tasks 4, 6 and 7; `rowsNeeded(placed, floor)` in Tasks 3 and 5; the class names `tl-thumb` and `insp-shot` match between markup, CSS and tests; the CSS tokens `--rows-building`, `--lane-h-building`, `--lane-2-top`, `--lane-3-top`, `--row-pitch-building`, `--lane-top` and `--pitch` are spelled the same in every rule and in the e2e check.
