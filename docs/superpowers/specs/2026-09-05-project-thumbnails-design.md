# Arrangement, interactions 3: Project thumbnails

Design spec, 2026-09-05. Approved section by section in brainstorming the same day, with the clip anatomy and the picture placements chosen from browser mockups.

## 1. Context

The home arrangement (specs of 2026-09-02, 2026-09-03 and 2026-09-05 under `docs/superpowers/specs/`) draws every project as a building clip: a 34px bar with the title and the stack, tinted in the lane color. A visitor learns what a project looked like only by leaving for its site. Sub-project 3 of the interactions plan gives each project a picture: a screenshot of its site, taken by Playwright, shown inside its clip, in its inspector panel and at the top of its case study.

Sub-projects 1 (scrub and pan) and 2 (the hero's "Right now" readout) are merged. Sub-project 3 was blocked on the screenshots; this spec unblocks it by generating them.

## 2. Scope

In scope:

- A Playwright script that screenshots every project with a `url` into `src/assets/projects/<slug>.jpg`, with a unit-tested helper that reads the targets from the projects' frontmatter.
- A slug-to-image map over that folder, and rendering through Astro's image service so each placement ships WebP at its own size.
- Building span clips at 66px with a 90×56 thumbnail beside the title, hidden when the clip is narrower than 200px; the phone graph rows show the same picture at 56×35.
- The building lane sized to its packed rows at a 70px pitch, with a floor of two rows, written at build and kept by the layout pass.
- The picture in the inspector's building panel, above the facts, and at the top of the case study page.
- Tests: unit, the home contract test, and the e2e harness.

Out of scope:

- The Building index (`/building`) stays text-only; Sean chose the home clips, the panel and the page.
- No thumbnails for projects without a picture; they render text-only, and a hand-placed file under the slug is enough to add one.
- No change to the roadmap, the writing lane, or the overview strip.
- No share-image change: case studies keep the Building share image.

## 3. Decisions from brainstorming

- **Where:** the home building clips, the inspector panel and the case study page. Not the Building index.
- **Projects without a site:** the script shoots only projects with a `url`; a file placed by hand under the project's slug counts the same. Shooting the GitHub repository page was rejected.
- **Clip anatomy: thumbnail beside the title** (option B of three). An artwork band under the title strip, like a waveform, was the strongest console reading but shows a wide short slice rather than a recognizable frame, and makes the lane 192px tall. The screenshot as a dimmed texture behind today's 34px clip keeps every size but shows nothing recognizable.
- **Panel:** the picture sits in the side column above the facts (over a wide frame under the description).
- **Page:** the picture opens the article under the standfirst, as an essay hero does (over the sidebar above the facts).
- **Assets:** sources in `src/assets/projects/`, rendered by Astro's image service, over raw files in `public/` or a second resize pipeline in the script.
- **Lane height:** per-lane offsets in CSS and a rows variable for the building lane, over one box per lane (the phone graph needs every item in one list) or a fixed height (three overlapping projects would overflow silently).

## 4. Pictures and the pipeline

### 4.1 The script

`scripts/project-screenshots.mjs`, run as `npm run thumbs`, mirrors `scripts/og-screenshots.mjs`:

- It reads `src/content/projects/*.mdx` and asks `projectShotTargets(files)` from `src/lib/thumbs.mjs` for `{ slug, url }` pairs: the slug is the file's basename, the url the frontmatter's `url` value. Files without a `url` are not targets.
- For each target it opens a 1280×800 page at device scale 2, navigates with `networkidle` and a 45s timeout, falls back to `load` when idle never comes (map tiles keep some sites busy), waits 2.5s for tiles and entrance animations, and writes a JPEG at quality 90 to `thumbFile(slug)`, which is `src/assets/projects/<slug>.jpg`.
- It exits non-zero when any shot fails and prints each result, like the share-image script.
- It never writes for a project without a `url`, so a hand-placed picture under that slug survives every run. A project with a `url` is always overwritten: the script is the source of truth for those.

The two outputs that exist today, `roaming-camp.jpg` and `songle.jpg`, are committed. Rerun the script when a site changes its face.

### 4.2 The map

`src/lib/images.ts` is Vite-only, like `src/lib/timeline/astro.ts` is Astro-only: it calls `import.meta.glob` over `src/assets/projects/*.{jpg,png}` eagerly, typed as `ImageMetadata`, and exports `projectImage(slug)` returning the image or `undefined`. Two files for one slug throw at build time, so a stray duplicate fails loudly instead of picking one.

### 4.3 Rendering

Every placement uses `<Image>` from `astro:assets` with `widths` and `sizes`, so the output is WebP with a `srcset`, and `width` and `height` come from the metadata, so nothing shifts as it loads:

| Placement | Rendered size | `widths` | `loading` |
|---|---|---|---|
| Clip thumbnail | 90×56 (phone 56×35) | 180, 360 | eager |
| Panel side column | the column's width, about 411px | 480, 960 | lazy |
| Page hero | the article's width, about 744px | 800, 1500 | eager |

`sizes` names the rendered width at 900px and up and `100vw` below it.

## 5. The clip

### 5.1 Desktop

A building span clip becomes a 66px grid: the picture in the first column, at 90×56 with a 2px radius, spanning both rows; the title and the stack in the second column, hugging the middle, each on one line with an ellipsis — so no wrapper element is needed and the client's item rebuild and the screen-reader prefix stay untouched. Without a picture the clip is the same height and holds the text alone. The clip's tint, the in-progress stripes and the dashed right edge are unchanged.

`.tl-item` becomes a size container (`container-type: inline-size`), and a container query hides the picture when the clip is narrower than 200px. The rule is in CSS alone, so the same markup serves every zoom and no script measures anything.

The clip's link, `data-item-link` and the client's item rebuild are unchanged; the picture is a decorative `<img>` with empty alt text inside the link, after the screen-reader lane prefix.

### 5.2 Phone

Below 900px a building row keeps its `30px 74px 1fr` grid; the clip cell becomes a flex row with the text first and the picture at 56×35 aligned to the right. Rows keep their `--row-h`. Moments, essays and the other lanes are unchanged.

## 6. The lane

`.tl-stage`'s `grid-template-rows` names its lanes: the ruler, then writing, building, learning and community, where three read `--lane-h` and building reads `--lane-h-building`. `--lane-h-building` is `calc(var(--row-top) + var(--rows-building) * var(--row-pitch-building))` with `--row-pitch-building: 70px`. `--rows-building` lives on `.tl` and is 2 by default.

Every `.tl-item` positions with `top: calc(var(--lane-top) + var(--row-top) + var(--row) * var(--pitch))`, where `--lane-top` and `--pitch` are set per `data-lane`: writing at 0, building at `--lane-h`, learning at `--lane-h + --lane-h-building`, community at `2 × --lane-h + --lane-h-building`; the building pitch is 70px and the others keep 36px. The client script keeps setting `--lane`, `--row`, `--x` and `--w` as today; `--lane` stays for the overview strip and the gutter.

The lane gridlines, today a repeating background of `--lane-h`, become one gradient with explicit stops at the three lane boundaries.

`layout.ts` gains `rowsNeeded(placed, floor)`: the number of rows a packed lane uses, never below `floor`. `Timeline.astro` writes `--rows-building` from it at build; `applyLayout` writes it again after packing the building lane, so a zoom or pan that packs three overlapping projects grows the lane rather than clipping the third row.

## 7. Panel and page

### 7.1 Inspector

`Inspector.astro` resolves `projectImage(item.id)` for building items (project ids are their slugs) and renders it at the top of the side column, above the facts, full column width with the panel's radius and a 1px border. Empty alt text; the heading names the project. Panels start hidden, so the image is lazy.

### 7.2 Case study

`ProjectPage.astro` renders the picture under the standfirst and before the body, with the essay hero's `.hero` class from `src/styles/reader.css`, only when the slug has one. Its alt text is "A screenshot of {title}". The kicker, the facts and the sidebar are unchanged.

## 8. Files

New:

- `scripts/project-screenshots.mjs` and the `thumbs` entry in `package.json`.
- `src/lib/thumbs.mjs` (`projectShotTargets`, `thumbFile`) and `src/lib/__tests__/thumbs.test.ts`.
- `src/lib/images.ts` (`projectImage`).
- `src/assets/projects/roaming-camp.jpg`, `src/assets/projects/songle.jpg`.
- `docs/superpowers/specs/2026-09-05-project-thumbnails-design.md` (this file).

Edited:

- `src/components/Timeline.astro`: thumbnail markup, the clip and lane rules, the container query, the phone row, `--rows-building` at build.
- `src/lib/timeline/layout.ts` (`rowsNeeded`) and its test.
- `src/scripts/timeline/apply.ts`: `--rows-building` after packing.
- `src/components/Inspector.astro`, `src/layouts/ProjectPage.astro`.
- `src/__tests__/home-contract.test.ts`, `scripts/interactions.mjs`.
- `CLAUDE.md`, `README.md`: the pipeline, the command, and `images.ts` beside `astro.ts` as the modules that import from Astro or Vite.

## 9. Accessibility

Thumbnails in clips and in the panel are decorative, with empty alt text, because the title is beside them; the page hero names the project. Every image has explicit width and height. The container query, not a script, hides narrow thumbnails, so nothing changes for keyboard or screen-reader users between zooms. The building lane's extra height changes nothing in reading order.

## 10. Testing

- Unit: `projectShotTargets` extracts slug and url, skips files without a url, ignores a commented placeholder; `thumbFile` builds the path; `rowsNeeded` applies the floor and counts rows.
- Contract (`dist/index.html`): the thumbnail class is present, and the root carries `--rows-building`.
- e2e (`scripts/interactions.mjs`): at the all-time zoom every building thumbnail is visible exactly when its clip is at least 200px wide; the building lane's rendered height equals `12 + rows × 70`; on the phone, a building row shows its picture.
- `npm run check`, `npm run e2e`, then `npm run shots` to eyeball the home at both widths, a project page and the panel.

## 11. Inputs needed during implementation

None from Sean. RSWebTWAIN and the DAW engine get pictures whenever a file appears under their slug in `src/assets/projects/`.
