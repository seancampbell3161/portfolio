# Arrangement Part 1 (Foundation and Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page with the Arrangement timeline (four lanes, overview strip, inspector, vertical graph on phones), on top of new site-wide tokens, a transport bar nav, and a derived timeline data model.

**Architecture:** A pure TypeScript module `src/lib/timeline/` owns the item type, validation, source adapters, and layout math, and is unit-tested in Vitest with no Astro imports. An Astro-only wrapper gathers the blog and a new `projects` collection plus two data files into one chronological list. `Timeline.astro` renders that one list once; CSS lays it out as lanes at 900px and up and as a vertical graph below, and a small client script re-runs the same layout functions for zoom and drives the inspector.

**Tech Stack:** Astro 5.16 (legacy content collections: `type: 'content'`, `entry.slug`, `entry.render()`), MDX, zod 3.25, Vitest 4, Playwright (already a devDependency), plain CSS with custom properties, Google Fonts.

**Spec:** `docs/superpowers/specs/2026-09-02-arrangement-foundation-home-design.md`

## Global Constraints

- Node 20, Astro `^5.16.6`; keep the legacy collections API the blog already uses (`type: 'content'`, `entry.slug`, `entry.render()`); do not migrate to the Content Layer in this plan.
- No new runtime dependencies beyond `zod@3.25.x` (already hoisted by Astro; add it explicitly).
- Every timeline clip must be a real `<a>` and the page must work with JavaScript disabled (spec §9).
- One chronological DOM list feeds both layouts (spec §8). Never render items twice.
- Breakpoint: `900px`. Lane height `120px`, row pitch `36px`, first row at `12px`, span clip `32px`, moment `20px`, up to three rows per lane (spec §7, §8).
- Palette and type exactly as spec §10. Keep existing token names (`--color-bg`, `--color-text-primary`, and so on) so untouched pages inherit the palette; add lane tokens.
- Copy rules: sentence case, no ALL-CAPS labels, no middle dots in meta strings, no arrows appended to link text, no numbered section markers.
- Commit messages: conventional prefix (`feat:`, `test:`, `chore:`, `docs:`), imperative mood, no co-author trailer (owner's global instruction).
- All dates in data are full ISO dates (`YYYY-MM-DD`); month-precision dates use the first of the month and carry a `// placeholder` comment until the owner confirms them (spec §15).

---

## File structure

Created:

| File | Responsibility |
|---|---|
| `src/lib/timeline/types.ts` | `Lane`, `Status`, `Kind`, `TimelineItem`, `InspectorBody`; zod schemas for project frontmatter and data entries; `deriveKind`, `assertUniqueIds` |
| `src/lib/timeline/layout.ts` | `windowFor`, `fraction`, `positionIn`, `estimateLabelWidth`, `packRows`, `packLane`, `ticksFor`, `laneSummary`, `graphLayout` |
| `src/lib/timeline/sources.ts` | `fromBlog`, `fromProjects`, `fromCommunity`, `fromLearning`, `mergeTimeline` (pure; take plain arrays) |
| `src/lib/timeline/astro.ts` | `getTimeline()` (Astro-only: calls `getCollection`) |
| `src/lib/timeline/__tests__/types.test.ts`, `layout.test.ts`, `sources.test.ts` | Vitest |
| `src/content/projects/roaming-camp.mdx`, `rswebtwain.mdx`, `songle.mdx` | Case studies moved out of `Projects.astro` |
| `src/data/community.ts`, `src/data/learning.ts` | Hand-authored entries, validated at module load |
| `src/components/TransportBar.astro` | Site nav (replaces `Nav.astro`) |
| `src/components/Timeline.astro` | Overview strip, ruler, lane heads, the one item list, gutter, playhead |
| `src/components/Inspector.astro` | Every item's panel, server-rendered; CSS `:target` fallback |
| `src/components/ContactBlock.astro` | Contact section with the photo |
| `src/scripts/timeline.ts` | Zoom, inspector, URL hash, playhead, bottom sheet |
| `scripts/home-screenshots.mjs` | Renders `/` at 1280 and 390 for review |

Modified: `package.json` (zod), `src/styles/global.css`, `src/content/config.ts`, `src/pages/index.astro`, `src/components/Footer.astro`, the eight files importing `Nav.astro` (`src/layouts/BlogPost.astro`, `src/pages/index.astro`, `src/pages/blog/index.astro`, `src/pages/404.astro`, `src/pages/roadmap.astro`, `src/pages/newsletter/confirmed.astro`, `error.astro`, `unsubscribed.astro`), `CLAUDE.md`.

Deleted: `src/components/Nav.astro`, `Hero.astro`, `Beyond.astro`, `Projects.astro`, `Currently.astro`, `Testimonial.astro`, `Contact.astro`, `public/images/beyond/speaking.jpg`, `mentoring.jpg`, `opensource.jpg`.

---

### Task 1: Tokens, fonts, and the zod dependency

**Files:**
- Modify: `package.json`
- Modify: `src/styles/global.css:1-60` (imports and `:root`), `:64-80` (`body::before` grid), `:118-160` (`.text-gradient`, animations)

**Interfaces:**
- Produces: CSS custom properties every later component uses: `--color-bg`, `--color-bg-elevated`, `--color-bg-hover`, `--color-border`, `--color-border-hover`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-faint`, `--color-accent`, `--lane-writing`, `--lane-building`, `--lane-learning`, `--lane-community`, `--font-display`, `--font-sans`, `--font-mono`, `--radius-sm|md|lg|xl`, `--bp-mobile` (documented value only; media queries can't read custom properties, so every component hardcodes `900px`).

- [ ] **Step 1: Add zod as an explicit dependency**

Run: `npm install zod@3.25.76 --save-exact`
Expected: `package.json` gains `"zod": "3.25.76"` under `dependencies`; `node -e "require('zod')"` exits 0.

- [ ] **Step 2: Replace the font import and the `:root` block in `src/styles/global.css`**

Replace everything from the top of the file through the closing `}` of `:root` with:

```css
/* Global Styles */
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap");

:root {
    /* Colors (spec §10). Names kept from the previous design so untouched
       pages inherit the palette; values are the Arrangement console. */
    --color-bg: #232527;
    --color-bg-elevated: #2C2F32;
    --color-bg-hover: #33373B;
    --color-border: #3A3E42;
    --color-border-hover: #4A4F55;

    --color-text-primary: #ECEAE4;
    --color-text-secondary: #C9C7C0;
    --color-text-muted: #9A9C98;
    --color-text-faint: #7A7D7A;

    /* Accent is the learning blue; kept for pages not yet redesigned. */
    --color-accent: #60A5FA;
    --color-accent-secondary: #A78BFA;
    --color-accent-bg: rgba(96, 165, 250, 0.12);
    --color-accent-border: rgba(96, 165, 250, 0.35);

    /* Lanes */
    --lane-writing: #D9B45F;
    --lane-building: #D98B6F;
    --lane-learning: #60A5FA;
    --lane-community: #A78BFA;

    /* Typography */
    --font-display: "Bricolage Grotesque", "Instrument Sans", -apple-system, BlinkMacSystemFont, sans-serif;
    --font-sans: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --font-mono: "JetBrains Mono", "Fira Code", monospace;

    /* Spacing */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
    --space-2xl: 48px;
    --space-3xl: 64px;
    --space-4xl: 96px;
    --space-5xl: 128px;

    /* Layout */
    --max-width: 1200px;
    --content-width: 800px;
    /* Documentation only: media queries cannot read this. Components use 900px literally. */
    --bp-mobile: 900px;

    /* Transitions */
    --transition-fast: 0.15s ease;
    --transition-base: 0.2s ease;
    --transition-slow: 0.3s ease;
    --transition-slower: 0.4s ease;

    /* Border Radius (spec §10: 3 to 4px everywhere) */
    --radius-sm: 3px;
    --radius-md: 4px;
    --radius-lg: 4px;
    --radius-xl: 4px;
    --radius-full: 9999px;
}
```

- [ ] **Step 3: Remove the grid background, gradient text, and entrance animations**

Delete the whole `/* Grid Background */ body::before { ... }` rule. Delete the `.text-gradient { ... }` rule. Delete the `@keyframes fadeInUp`, `@keyframes fadeIn`, `.animate-fade-in-up`, `.animate-fade-in`, and the five `.delay-*` rules. (Only `Hero.astro`, deleted in Task 9, used them; confirm with `grep -rn "animate-fade\|text-gradient\|delay-[0-9]" src` which must list only `Hero.astro` and `global.css` before you delete.)

- [ ] **Step 4: Point headings at the display face**

In the `h1, h2, h3, h4, h5, h6 { ... }` rule add `font-family: var(--font-display);` and change `letter-spacing: -0.02em` to `letter-spacing: -0.025em`. Leave the `h1`/`h2`/`h3` size rules as they are.

- [ ] **Step 5: Build and eyeball**

Run: `npm run build`
Expected: exits 0. Then `npm run preview`, open `http://localhost:4321/blog` and `/roadmap`: dark grey console background, no grid lines, headings in Bricolage Grotesque, body in Instrument Sans. The old home page still builds but its hero text is invisible: `Hero.astro` set `opacity: 0` and relied on the removed entrance animations. That is expected and lasts only until Task 8 replaces the page.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/styles/global.css
git commit -m "feat(design): Arrangement tokens, fonts, and lane colors; drop grid and gradient text"
```

---

### Task 2: Timeline types and validation

**Files:**
- Create: `src/lib/timeline/types.ts`
- Test: `src/lib/timeline/__tests__/types.test.ts`

**Interfaces:**
- Produces:
  - `type Lane = "writing" | "building" | "learning" | "community"`; `const LANES: readonly Lane[]`
  - `type Status = "done" | "live" | "in-progress" | "planned"`; `type Kind = "moment" | "span"`
  - `interface TimelineItem { id; lane; title; subtitle?; start: Date; end?: Date; status; href; kind; body?: InspectorBody }`
  - `type InspectorBody` (discriminated on `lane`, see code)
  - `deriveKind(status: Status, end?: Date): Kind`
  - `assertUniqueIds(items: { id: string }[]): void` (throws `Error("Duplicate timeline id: <id>")`)
  - zod: `statusSchema`, `projectFrontmatterSchema`, `timelineEntrySchema`, `communityEntrySchema`, `learningEntrySchema`, and inferred types `ProjectFrontmatter`, `CommunityEntry`, `LearningEntry`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/timeline/__tests__/types.test.ts
import { describe, it, expect } from "vitest";
import {
  deriveKind,
  assertUniqueIds,
  projectFrontmatterSchema,
  timelineEntrySchema,
  communityEntrySchema,
  learningEntrySchema,
} from "../types.js";

const d = (s: string) => new Date(s);

describe("deriveKind", () => {
  it("is a span when end is present", () => {
    expect(deriveKind("done", d("2025-01-01"))).toBe("span");
    expect(deriveKind("live", d("2025-01-01"))).toBe("span");
  });
  it("is a span when in progress with no end", () => {
    expect(deriveKind("in-progress")).toBe("span");
  });
  it("is a moment when done or live with no end", () => {
    expect(deriveKind("done")).toBe("moment");
    expect(deriveKind("live")).toBe("moment");
  });
});

describe("assertUniqueIds", () => {
  it("passes on unique ids", () => {
    expect(() => assertUniqueIds([{ id: "a" }, { id: "b" }])).not.toThrow();
  });
  it("names the duplicate", () => {
    expect(() => assertUniqueIds([{ id: "a" }, { id: "a" }])).toThrow(
      "Duplicate timeline id: a",
    );
  });
});

describe("projectFrontmatterSchema", () => {
  const ok = {
    title: "Roaming.Camp",
    description: "Campsite discovery.",
    start: "2025-03-01",
    end: "2026-06-30",
    status: "live",
    stack: ["Next.js", "Go"],
    url: "https://roaming.camp",
  };
  it("accepts a valid project and coerces dates", () => {
    const parsed = projectFrontmatterSchema.parse(ok);
    expect(parsed.start).toBeInstanceOf(Date);
    expect(parsed.end?.getFullYear()).toBe(2026);
  });
  it("rejects end before start", () => {
    const r = projectFrontmatterSchema.safeParse({ ...ok, end: "2024-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/end must not be before start/);
  });
  it("rejects done or live without end", () => {
    const { end: _end, ...noEnd } = ok;
    const r = projectFrontmatterSchema.safeParse({ ...noEnd, status: "live" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/status live requires end/);
  });
  it("accepts in-progress without end", () => {
    const { end: _end, ...noEnd } = ok;
    expect(projectFrontmatterSchema.safeParse({ ...noEnd, status: "in-progress" }).success).toBe(true);
  });
  it("rejects planned (projects cannot be planned)", () => {
    expect(projectFrontmatterSchema.safeParse({ ...ok, status: "planned" }).success).toBe(false);
  });
  it("requires a non-empty stack", () => {
    expect(projectFrontmatterSchema.safeParse({ ...ok, stack: [] }).success).toBe(false);
  });
});

describe("timelineEntrySchema", () => {
  const ok = {
    id: "dsd-talk-2026-03",
    title: "Talk: architecture patterns",
    description: "A talk.",
    start: "2026-03-01",
    status: "done",
  };
  it("accepts a moment", () => {
    expect(timelineEntrySchema.safeParse(ok).success).toBe(true);
  });
  it("rejects ids that are not kebab-case slugs", () => {
    expect(timelineEntrySchema.safeParse({ ...ok, id: "Not A Slug" }).success).toBe(false);
  });
  it("rejects planned without end", () => {
    const r = timelineEntrySchema.safeParse({ ...ok, status: "planned" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/planned requires end/);
  });
  it("rejects end before start", () => {
    expect(timelineEntrySchema.safeParse({ ...ok, end: "2025-01-01" }).success).toBe(false);
  });
});

describe("communityEntrySchema and learningEntrySchema", () => {
  it("community requires org", () => {
    const r = communityEntrySchema.safeParse({
      id: "x", title: "t", description: "d", start: "2026-01-01", status: "done",
    });
    expect(r.success).toBe(false);
  });
  it("learning requires roadmapHref and allows a testimonial", () => {
    const r = learningEntrySchema.safeParse({
      id: "100devs", title: "100Devs", description: "d", start: "2021-01-15", end: "2022-01-15",
      status: "done", roadmapHref: "/roadmap",
      testimonial: { quote: "q", author: "Leon Noel", role: "Managing Director of Engineering, Resilient Coders" },
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timeline/__tests__/types.test.ts`
Expected: FAIL, "Failed to resolve import '../types.js'".

- [ ] **Step 3: Write `src/lib/timeline/types.ts`**

```ts
// src/lib/timeline/types.ts
// The one shape every clip on every page is built from (spec §5), plus the
// validation rules (spec §12). Pure: no Astro imports, so Vitest can load it.
import { z } from "zod";

export type Lane = "writing" | "building" | "learning" | "community";
export const LANES: readonly Lane[] = ["writing", "building", "learning", "community"];

export type Status = "done" | "live" | "in-progress" | "planned";
export type Kind = "moment" | "span";

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

export type InspectorBody =
  | { lane: "writing"; description: string; published: Date; href: string }
  | {
      lane: "building";
      description: string;
      stack: string[];
      started: Date;
      status: Status;
      url?: string;
      source?: string;
    }
  | { lane: "learning"; description: string; roadmapHref: string; testimonial?: Testimonial }
  | { lane: "community"; org: string; description: string; url?: string };

export interface TimelineItem {
  id: string;
  lane: Lane;
  title: string;
  subtitle?: string;
  start: Date;
  end?: Date;
  status: Status;
  href: string;
  kind: Kind;
  /** Optional so the client script can rebuild items from the DOM without it. */
  body?: InspectorBody;
}

/** Spec §5: end, or in-progress without end, is a span; otherwise a moment. */
export function deriveKind(status: Status, end?: Date): Kind {
  if (end) return "span";
  if (status === "in-progress") return "span";
  return "moment";
}

export function assertUniqueIds(items: { id: string }[]): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`Duplicate timeline id: ${id}`);
    seen.add(id);
  }
}

export const statusSchema = z.enum(["done", "live", "in-progress", "planned"]);

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be a kebab-case slug");

function endNotBeforeStart(v: { start: Date; end?: Date }, ctx: z.RefinementCtx) {
  if (v.end && v.end.getTime() < v.start.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "end must not be before start", path: ["end"] });
  }
}

/** Frontmatter for src/content/projects/*.mdx (spec §6, §12). */
export const projectFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    status: z.enum(["done", "live", "in-progress"]),
    stack: z.array(z.string().min(1)).min(1),
    url: z.string().url().optional(),
    source: z.string().url().optional(),
  })
  .superRefine((v, ctx) => {
    endNotBeforeStart(v, ctx);
    if ((v.status === "done" || v.status === "live") && !v.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `status ${v.status} requires end`,
        path: ["end"],
      });
    }
  });
export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

/** Shared shape for hand-authored entries in src/data/*.ts. */
export const timelineEntrySchema = z
  .object({
    id: slug,
    title: z.string().min(1),
    subtitle: z.string().optional(),
    description: z.string().min(1),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    status: statusSchema,
    url: z.string().url().optional(),
  })
  .superRefine((v, ctx) => {
    endNotBeforeStart(v, ctx);
    if (v.status === "planned" && !v.end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "planned requires end", path: ["end"] });
    }
  });

export const communityEntrySchema = timelineEntrySchema.innerType()
  .extend({ org: z.string().min(1) })
  .superRefine((v, ctx) => {
    endNotBeforeStart(v, ctx);
    if (v.status === "planned" && !v.end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "planned requires end", path: ["end"] });
    }
  });
export type CommunityEntry = z.infer<typeof communityEntrySchema>;

export const learningEntrySchema = timelineEntrySchema.innerType()
  .extend({
    roadmapHref: z.string().min(1),
    testimonial: z
      .object({ quote: z.string().min(1), author: z.string().min(1), role: z.string().min(1) })
      .optional(),
  })
  .superRefine((v, ctx) => {
    endNotBeforeStart(v, ctx);
    if (v.status === "planned" && !v.end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "planned requires end", path: ["end"] });
    }
  });
export type LearningEntry = z.infer<typeof learningEntrySchema>;
```

Note on `innerType()`: a `ZodEffects` (the result of `superRefine`) can't be `.extend`ed, so the extended schemas re-apply the refinement on the inner object. That duplication is deliberate and small.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timeline/__tests__/types.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/types.ts src/lib/timeline/__tests__/types.test.ts
git commit -m "feat(timeline): item type, derived kind, and validation schemas"
```

---
### Task 3: Layout math, part 1: windows, positions, row packing

**Files:**
- Create: `src/lib/timeline/layout.ts`
- Test: `src/lib/timeline/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `TimelineItem`, `Lane`, `LANES` from `./types.js`
- Produces:
  - `type Zoom = "year" | "three-years" | "all"`; `const ZOOMS: readonly Zoom[]`
  - `interface Window { from: Date; to: Date }`
  - `startOfYear(d)`, `endOfYear(d)`, `windowFor(zoom, now, items): Window`
  - `fraction(date, window): number` (unclamped)
  - `effectiveEnd(item, now): Date`
  - `interface Placed { item; x: number; w: number }`; `positionIn(item, window, now): Placed | null`
  - `type WidthEstimator = (item) => number` (fraction of window width); `estimateLabelWidth(referenceWidthPx = 1040): WidthEstimator`; `const DOT_WIDTH`
  - `interface RowPlaced extends Placed { row: number; labeled: boolean }`; `packRows(placed, estimate, maxRows = 3): RowPlaced[]`; `packLane(items, lane, window, now, estimate, maxRows = 3): RowPlaced[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/timeline/__tests__/layout.test.ts
import { describe, it, expect } from "vitest";
import type { TimelineItem, Lane, Status } from "../types.js";
import { deriveKind } from "../types.js";
import {
  windowFor,
  fraction,
  positionIn,
  packRows,
  packLane,
  estimateLabelWidth,
  DOT_WIDTH,
} from "../layout.js";

const d = (s: string) => new Date(s);
const NOW = d("2026-09-02T12:00:00");

function mk(
  id: string,
  lane: Lane,
  start: string,
  opts: { end?: string; status?: Status; title?: string; subtitle?: string } = {},
): TimelineItem {
  const status = opts.status ?? "done";
  const end = opts.end ? d(opts.end) : undefined;
  return {
    id,
    lane,
    title: opts.title ?? id,
    subtitle: opts.subtitle,
    start: d(start),
    end,
    status,
    href: `/#item-${id}`,
    kind: deriveKind(status, end),
    body: { lane: "community", org: "x", description: "x" },
  };
}

describe("windowFor", () => {
  it("year is Jan 1 to Dec 31 of now's year", () => {
    const w = windowFor("year", NOW, []);
    expect(w.from).toEqual(new Date(2026, 0, 1));
    expect(w.to.getFullYear()).toBe(2026);
    expect(w.to.getMonth()).toBe(11);
    expect(w.to.getDate()).toBe(31);
  });
  it("three-years starts three years before now and ends Dec 31", () => {
    const w = windowFor("three-years", NOW, []);
    expect(w.from.getFullYear()).toBe(2023);
    expect(w.from.getMonth()).toBe(8);
    expect(w.to.getFullYear()).toBe(2026);
  });
  it("all starts at the earliest item and falls back to Jan 1 with no items", () => {
    const items = [mk("a", "learning", "2021-01-15"), mk("b", "writing", "2025-12-21")];
    expect(windowFor("all", NOW, items).from).toEqual(d("2021-01-15"));
    expect(windowFor("all", NOW, []).from).toEqual(new Date(2026, 0, 1));
  });
});

describe("fraction and positionIn", () => {
  const w = windowFor("year", NOW, []);
  it("fraction is 0 at from and about 1 at to", () => {
    expect(fraction(w.from, w)).toBe(0);
    expect(fraction(w.to, w)).toBeCloseTo(1, 5);
  });
  it("a moment has zero width at its date", () => {
    const p = positionIn(mk("e", "writing", "2026-07-01"), w, NOW)!;
    expect(p.w).toBe(0);
    expect(p.x).toBeCloseTo(181 / 365, 2);
  });
  it("a span with an end has width end minus start", () => {
    const p = positionIn(mk("p", "building", "2026-01-01", { end: "2026-07-01", status: "live" }), w, NOW)!;
    expect(p.x).toBe(0);
    expect(p.w).toBeCloseTo(181 / 365, 2);
  });
  it("an in-progress span with no end runs to now", () => {
    const p = positionIn(mk("q", "building", "2026-06-01", { status: "in-progress" }), w, NOW)!;
    expect(p.x + p.w).toBeCloseTo(fraction(NOW, w), 5);
  });
  it("clamps a span that starts before the window", () => {
    const p = positionIn(mk("r", "learning", "2025-01-01", { end: "2026-03-01" }), w, NOW)!;
    expect(p.x).toBe(0);
    expect(p.w).toBeCloseTo(fraction(d("2026-03-01"), w), 5);
  });
  it("excludes items entirely outside the window", () => {
    expect(positionIn(mk("s", "writing", "2025-12-21"), w, NOW)).toBeNull();
    expect(positionIn(mk("t", "writing", "2027-01-05"), w, NOW)).toBeNull();
  });
});

describe("packRows", () => {
  const w = windowFor("year", NOW, []);
  const est = estimateLabelWidth(1040);
  const place = (items: TimelineItem[]) =>
    items.map((i) => positionIn(i, w, NOW)!).filter(Boolean);

  it("puts non-overlapping spans on one row", () => {
    const rows = packRows(
      place([
        mk("a", "building", "2026-01-01", { end: "2026-03-01" }),
        mk("b", "building", "2026-04-01", { end: "2026-06-01" }),
      ]),
      est,
    );
    expect(rows.map((r) => r.row)).toEqual([0, 0]);
  });
  it("puts overlapping spans on separate rows, earliest first", () => {
    const rows = packRows(
      place([
        mk("b", "building", "2026-04-01", { end: "2026-09-01" }),
        mk("a", "building", "2026-01-01", { end: "2026-06-01" }),
      ]),
      est,
    );
    expect(rows.map((r) => r.item.id)).toEqual(["a", "b"]);
    expect(rows.map((r) => r.row)).toEqual([0, 1]);
  });
  it("two moments on the same day take two rows", () => {
    const rows = packRows(place([mk("a", "writing", "2026-05-01"), mk("b", "writing", "2026-05-01")]), est);
    expect(rows.map((r) => r.row)).toEqual([0, 1]);
  });
  it("a moment reserves its label width so a close neighbour moves down", () => {
    const rows = packRows(
      place([
        mk("a", "writing", "2026-05-01", { title: "A fairly long essay title" }),
        mk("b", "writing", "2026-05-08", { title: "Another" }),
      ]),
      est,
    );
    expect(rows.map((r) => r.row)).toEqual([0, 1]);
  });
  it("a moment far enough away shares the row", () => {
    const rows = packRows(place([mk("a", "writing", "2026-01-01"), mk("b", "writing", "2026-09-01")]), est);
    expect(rows.map((r) => r.row)).toEqual([0, 0]);
  });
  it("demotes the oldest moments to bare dots until three rows suffice", () => {
    const items = [
      mk("a", "writing", "2026-05-01", { title: "Creative Frontend Designs With AI" }),
      mk("b", "writing", "2026-05-03", { title: "Composition Over Inheritance in Angular" }),
      mk("c", "writing", "2026-05-05", { title: "No One Cares About Your Work" }),
      mk("d", "writing", "2026-05-07", { title: "How Apps Like Redis Are So Efficient" }),
    ];
    const rows = packRows(place(items), est, 3);
    expect(Math.max(...rows.map((r) => r.row))).toBeLessThan(3);
    const byId = Object.fromEntries(rows.map((r) => [r.item.id, r]));
    expect(byId.a.labeled).toBe(false);
    expect(byId.d.labeled).toBe(true);
  });
  it("never demotes spans", () => {
    const items = [0, 1, 2, 3].map((i) =>
      mk(`s${i}`, "building", "2026-01-01", { end: "2026-08-01", status: "done" }),
    );
    const rows = packRows(place(items), est, 3);
    expect(rows.every((r) => r.labeled)).toBe(true);
    expect(Math.max(...rows.map((r) => r.row))).toBe(3);
  });
  it("DOT_WIDTH is a small fraction", () => {
    expect(DOT_WIDTH).toBeGreaterThan(0);
    expect(DOT_WIDTH).toBeLessThan(0.05);
  });
});

describe("packLane", () => {
  it("filters to one lane and to the window", () => {
    const w = windowFor("year", NOW, []);
    const items = [
      mk("a", "writing", "2026-05-01"),
      mk("b", "building", "2026-05-01", { end: "2026-06-01" }),
      mk("c", "writing", "2025-05-01"),
    ];
    const rows = packLane(items, "writing", w, NOW, estimateLabelWidth());
    expect(rows.map((r) => r.item.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: FAIL, "Failed to resolve import '../layout.js'".

- [ ] **Step 3: Write `src/lib/timeline/layout.ts` (part 1)**

```ts
// src/lib/timeline/layout.ts
// Pure layout math (spec §7). No DOM: runs at build time in Astro and again in
// the browser (src/scripts/timeline.ts) for zoom changes.
import type { Lane, TimelineItem } from "./types.js";

export type Zoom = "year" | "three-years" | "all";
export const ZOOMS: readonly Zoom[] = ["year", "three-years", "all"];

export interface Window {
  from: Date;
  to: Date;
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

/** Spec §5 zoom windows. */
export function windowFor(zoom: Zoom, now: Date, items: readonly TimelineItem[]): Window {
  const to = endOfYear(now);
  if (zoom === "year") return { from: startOfYear(now), to };
  if (zoom === "three-years") {
    const from = new Date(now.getTime());
    from.setFullYear(now.getFullYear() - 3);
    return { from, to };
  }
  let earliest: Date | null = null;
  for (const item of items) {
    if (!earliest || item.start.getTime() < earliest.getTime()) earliest = item.start;
  }
  return { from: earliest ?? startOfYear(now), to };
}

/** Position of a date inside a window as a fraction of its width. Not clamped. */
export function fraction(date: Date, w: Window): number {
  const span = w.to.getTime() - w.from.getTime();
  return (date.getTime() - w.from.getTime()) / span;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Where an item stops: its end, or now for an ongoing span, or its start for a moment. */
export function effectiveEnd(item: TimelineItem, now: Date): Date {
  if (item.end) return item.end;
  return item.kind === "span" ? now : item.start;
}

export interface Placed {
  item: TimelineItem;
  /** left edge, fraction of window width, clamped to [0, 1] */
  x: number;
  /** width, fraction of window width; 0 for a moment */
  w: number;
}

/** Null when the item lies entirely outside the window. */
export function positionIn(item: TimelineItem, w: Window, now: Date): Placed | null {
  const end = effectiveEnd(item, now);
  if (end.getTime() < w.from.getTime() || item.start.getTime() > w.to.getTime()) return null;
  const x = clamp01(fraction(item.start, w));
  const xe = clamp01(fraction(end, w));
  return { item, x, w: item.kind === "moment" ? 0 : Math.max(0, xe - x) };
}

/** Returns the horizontal extent a moment's label occupies, as a fraction of the window width. */
export type WidthEstimator = (item: TimelineItem) => number;

/**
 * Build-time estimate: 7px per character of title plus subtitle, plus 30px for
 * the dot and padding, against the clip area width at the 1280px reference
 * (1280 minus 80px page margins minus a 160px lane head = 1040px).
 * The browser replaces this with measured widths.
 */
export function estimateLabelWidth(referenceWidthPx = 1040): WidthEstimator {
  return (item) => ((item.title.length + (item.subtitle?.length ?? 0)) * 7 + 30) / referenceWidthPx;
}

/** A bare dot's extent (a demoted moment). */
export const DOT_WIDTH = 14 / 1040;

export interface RowPlaced extends Placed {
  row: number;
  /** false when a moment has been demoted to a bare dot */
  labeled: boolean;
}

function assignRows(sorted: readonly Placed[], extentOf: (p: Placed) => number): { rows: number[]; maxRow: number } {
  const rowEnds: number[] = [];
  const rows: number[] = [];
  let maxRow = -1;
  sorted.forEach((p, i) => {
    let r = rowEnds.findIndex((end) => end < p.x);
    if (r === -1) {
      r = rowEnds.length;
      rowEnds.push(Number.NEGATIVE_INFINITY);
    }
    rowEnds[r] = extentOf(p);
    rows[i] = r;
    if (r > maxRow) maxRow = r;
  });
  return { rows, maxRow };
}

/**
 * Greedy packing by start (spec §7): an item takes the first row whose last
 * occupant ends before it starts. A moment occupies its label width. When more
 * than maxRows are needed, the oldest labeled moments become bare dots, one at
 * a time, until the packing fits. Spans are never demoted; if spans alone need
 * more rows, the extra rows are returned as computed.
 */
export function packRows(placed: readonly Placed[], estimate: WidthEstimator, maxRows = 3): RowPlaced[] {
  const sorted = [...placed].sort(
    (a, b) => a.x - b.x || b.w - a.w || a.item.id.localeCompare(b.item.id),
  );
  const demoted = new Set<string>();
  const extentOf = (p: Placed): number =>
    p.item.kind === "moment"
      ? p.x + (demoted.has(p.item.id) ? DOT_WIDTH : estimate(p.item))
      : p.x + p.w;

  for (;;) {
    const { rows, maxRow } = assignRows(sorted, extentOf);
    if (maxRow < maxRows) {
      return sorted.map((p, i) => ({ ...p, row: rows[i], labeled: !demoted.has(p.item.id) }));
    }
    const candidate = sorted.find((p) => p.item.kind === "moment" && !demoted.has(p.item.id));
    if (!candidate) {
      return sorted.map((p, i) => ({ ...p, row: rows[i], labeled: true }));
    }
    demoted.add(candidate.item.id);
  }
}

export function packLane(
  items: readonly TimelineItem[],
  lane: Lane,
  w: Window,
  now: Date,
  estimate: WidthEstimator,
  maxRows = 3,
): RowPlaced[] {
  const placed: Placed[] = [];
  for (const item of items) {
    if (item.lane !== lane) continue;
    const p = positionIn(item, w, now);
    if (p) placed.push(p);
  }
  return packRows(placed, estimate, maxRows);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/layout.ts src/lib/timeline/__tests__/layout.test.ts
git commit -m "feat(timeline): zoom windows, positions, and greedy row packing"
```

---

### Task 4: Layout math, part 2: ruler ticks, lane summaries, vertical graph

**Files:**
- Modify: `src/lib/timeline/layout.ts` (append)
- Test: `src/lib/timeline/__tests__/layout.test.ts` (append)

**Interfaces:**
- Consumes: everything from Task 3
- Produces:
  - `interface Tick { label: string; x: number }`; `ticksFor(zoom, window): Tick[]`
  - `laneSummary(lane, items, window, now): string`
  - `interface GraphBar { id; lane; slot: 0 | 1; fromRow: number; toRow: number | null }`, `interface GraphDot { id; lane; row }`, `interface GraphLayout { rows: TimelineItem[]; bars: GraphBar[]; dots: GraphDot[]; nowRow: number }`; `graphLayout(items, window, now): GraphLayout`

- [ ] **Step 1: Append the failing tests**

Add to the imports at the top of `layout.test.ts`: `ticksFor, laneSummary, graphLayout`. Append:

```ts
describe("ticksFor", () => {
  it("year: twelve month ticks starting at 0", () => {
    const w = windowFor("year", NOW, []);
    const t = ticksFor("year", w);
    expect(t).toHaveLength(12);
    expect(t[0]).toEqual({ label: "Jan", x: 0 });
    expect(t[11].label).toBe("Dec");
    expect(t[6].x).toBeCloseTo(181 / 365, 2);
  });
  it("three-years: first tick is the quarter containing from, then every quarter", () => {
    const w = windowFor("three-years", NOW, []);
    const t = ticksFor("three-years", w);
    expect(t[0]).toEqual({ label: "Q3 2023", x: 0 });
    expect(t[1].label).toBe("Q4 2023");
    expect(t[t.length - 1].label).toBe("Q4 2026");
  });
  it("all: first tick is from's year at 0, then each January", () => {
    const w = windowFor("all", NOW, [mk("a", "learning", "2021-01-15")]);
    const t = ticksFor("all", w);
    expect(t.map((x) => x.label)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(t[0].x).toBe(0);
    expect(t[1].x).toBeGreaterThan(0);
  });
});

describe("laneSummary", () => {
  const w = windowFor("year", NOW, []);
  it("counts essays", () => {
    const items = [mk("a", "writing", "2026-05-01"), mk("b", "writing", "2026-07-01"), mk("z", "writing", "2025-01-01")];
    expect(laneSummary("writing", items, w, NOW)).toBe("2 essays");
    expect(laneSummary("writing", items.slice(0, 1), w, NOW)).toBe("1 essay");
  });
  it("describes building by status", () => {
    const items = [
      mk("a", "building", "2026-01-01", { end: "2026-06-01", status: "live" }),
      mk("b", "building", "2026-06-01", { status: "in-progress" }),
    ];
    expect(laneSummary("building", items, w, NOW)).toBe("1 live, 1 in progress");
  });
  it("says nothing yet for an empty lane", () => {
    expect(laneSummary("community", [], w, NOW)).toBe("nothing yet");
  });
  it("counts learning in progress and community appearances", () => {
    expect(laneSummary("learning", [mk("a", "learning", "2026-01-01", { status: "in-progress" })], w, NOW)).toBe("1 in progress");
    expect(laneSummary("community", [mk("a", "community", "2026-03-01"), mk("b", "community", "2026-08-01")], w, NOW)).toBe("2 appearances");
  });
});

describe("graphLayout", () => {
  const w = windowFor("year", NOW, []);
  const items = [
    mk("roaming", "building", "2026-01-01", { end: "2026-06-30", status: "live" }),
    mk("ddia", "learning", "2026-01-01", { status: "in-progress" }),
    mk("talk1", "community", "2026-03-01"),
    mk("frontend", "writing", "2026-05-16"),
    mk("daw", "building", "2026-06-01", { status: "in-progress" }),
    mk("redis", "learning", "2026-06-01", { status: "in-progress" }),
    mk("redis-essay", "writing", "2026-07-22"),
    mk("wont-stop", "writing", "2026-09-01"),
  ];
  const g = graphLayout(items, w, NOW);

  it("orders rows by start then id", () => {
    expect(g.rows.map((r) => r.id)).toEqual([
      "ddia", "roaming", "talk1", "frontend", "daw", "redis", "redis-essay", "wont-stop",
    ]);
  });
  it("puts the now line after the last row that has started", () => {
    expect(g.nowRow).toBe(8);
  });
  it("draws a finished span down to the last row starting on or before its end", () => {
    const roaming = g.bars.find((b) => b.id === "roaming")!;
    expect(roaming.fromRow).toBe(1);
    expect(roaming.toRow).toBe(5); // redis starts 2026-06-01, before the 06-30 end
  });
  it("draws an ongoing span to the now line", () => {
    expect(g.bars.find((b) => b.id === "daw")!.toRow).toBeNull();
  });
  it("gives concurrent spans in one lane different slots", () => {
    expect(g.bars.find((b) => b.id === "ddia")!.slot).toBe(0);
    expect(g.bars.find((b) => b.id === "redis")!.slot).toBe(1);
    expect(g.bars.find((b) => b.id === "roaming")!.slot).toBe(0);
    expect(g.bars.find((b) => b.id === "daw")!.slot).toBe(1);
  });
  it("lists moments as dots with their row", () => {
    expect(g.dots.find((x) => x.id === "wont-stop")!.row).toBe(7);
  });
  it("excludes items outside the window", () => {
    const g2 = graphLayout([...items, mk("old", "writing", "2025-01-01")], w, NOW);
    expect(g2.rows.some((r) => r.id === "old")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: FAIL, "ticksFor is not a function" (or "does not provide an export named").

- [ ] **Step 3: Append to `src/lib/timeline/layout.ts`**

```ts
// ---------- ruler ticks (spec §4: months / quarters / years) ----------

export interface Tick {
  label: string;
  x: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodStart(zoom: Zoom, d: Date): Date {
  if (zoom === "year") return new Date(d.getFullYear(), d.getMonth(), 1);
  if (zoom === "three-years") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(d.getFullYear(), 0, 1);
}

function nextPeriod(zoom: Zoom, d: Date): Date {
  if (zoom === "year") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  if (zoom === "three-years") return new Date(d.getFullYear(), d.getMonth() + 3, 1);
  return new Date(d.getFullYear() + 1, 0, 1);
}

function periodLabel(zoom: Zoom, d: Date): string {
  if (zoom === "year") return MONTHS[d.getMonth()];
  if (zoom === "three-years") return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

/** First tick is the period containing `from`, at x = 0; then every period boundary up to `to`. */
export function ticksFor(zoom: Zoom, w: Window): Tick[] {
  const first = periodStart(zoom, w.from);
  const ticks: Tick[] = [{ label: periodLabel(zoom, first), x: 0 }];
  for (let d = nextPeriod(zoom, first); d.getTime() <= w.to.getTime(); d = nextPeriod(zoom, d)) {
    ticks.push({ label: periodLabel(zoom, d), x: fraction(d, w) });
  }
  return ticks;
}

// ---------- lane head summaries (spec §4) ----------

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function laneSummary(lane: Lane, items: readonly TimelineItem[], w: Window, now: Date): string {
  const inWindow = items.filter((i) => i.lane === lane && positionIn(i, w, now) !== null);
  const n = inWindow.length;
  if (n === 0) return "nothing yet";
  const inProgress = inWindow.filter((i) => i.status === "in-progress").length;
  switch (lane) {
    case "writing":
      return plural(n, "essay");
    case "building": {
      const live = inWindow.filter((i) => i.status === "live").length;
      const parts: string[] = [];
      if (live) parts.push(`${live} live`);
      if (inProgress) parts.push(`${inProgress} in progress`);
      return parts.length ? parts.join(", ") : plural(n, "project");
    }
    case "learning":
      return inProgress ? `${inProgress} in progress` : plural(n, "item");
    case "community":
      return plural(n, "appearance");
  }
}

// ---------- vertical graph for phones (spec §8) ----------

export interface GraphBar {
  id: string;
  lane: Lane;
  slot: 0 | 1;
  fromRow: number;
  /** null: runs to the now line */
  toRow: number | null;
}

export interface GraphDot {
  id: string;
  lane: Lane;
  row: number;
}

export interface GraphLayout {
  rows: TimelineItem[];
  bars: GraphBar[];
  dots: GraphDot[];
  /** index of the row after which the now line is drawn */
  nowRow: number;
}

/**
 * Rows are the in-window items in start order. A span's bar runs from its row
 * down to the last row whose start is not after the span's end, or to the now
 * line when ongoing. Each lane has two slots so two concurrent spans don't
 * overlap; a third concurrent span shares slot 1.
 */
export function graphLayout(items: readonly TimelineItem[], w: Window, now: Date): GraphLayout {
  const rows = items
    .filter((i) => positionIn(i, w, now) !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
  const nowRow = rows.filter((i) => i.start.getTime() <= now.getTime()).length;

  const slotEnds: Record<Lane, [number, number]> = {
    writing: [-1, -1],
    building: [-1, -1],
    learning: [-1, -1],
    community: [-1, -1],
  };
  const bars: GraphBar[] = [];
  const dots: GraphDot[] = [];

  rows.forEach((item, idx) => {
    if (item.kind === "moment") {
      dots.push({ id: item.id, lane: item.lane, row: idx });
      return;
    }
    let toRow: number | null = null;
    if (item.end) {
      let j = idx;
      while (j + 1 < rows.length && rows[j + 1].start.getTime() <= item.end.getTime()) j++;
      toRow = j;
    }
    const ends = slotEnds[item.lane];
    const slot: 0 | 1 = ends[0] < idx ? 0 : 1;
    ends[slot] = toRow ?? nowRow;
    bars.push({ id: item.id, lane: item.lane, slot, fromRow: idx, toRow });
  });

  return { rows, bars, dots, nowRow };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timeline/__tests__/layout.test.ts`
Expected: PASS, 32 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/layout.ts src/lib/timeline/__tests__/layout.test.ts
git commit -m "feat(timeline): ruler ticks, lane summaries, and vertical graph layout"
```

---
### Task 5: Source adapters and the merge

**Files:**
- Create: `src/lib/timeline/sources.ts`
- Test: `src/lib/timeline/__tests__/sources.test.ts`

**Interfaces:**
- Consumes: `TimelineItem`, `ProjectFrontmatter`, `CommunityEntry`, `LearningEntry`, `deriveKind`, `assertUniqueIds` from `./types.js`
- Produces:
  - `interface BlogLike { slug: string; data: { title; description; pubDate: Date; tags: string[]; draft: boolean } }` (the subset of `CollectionEntry<'blog'>` the adapter reads)
  - `interface ProjectLike { slug: string; data: ProjectFrontmatter }`
  - `fromBlog(entries, { includeDrafts }): TimelineItem[]` (ids `essay-<slug>`, hrefs `/blog/<slug>`)
  - `fromProjects(entries): TimelineItem[]` (ids are the slugs, hrefs `/#item-<slug>`)
  - `fromCommunity(entries: CommunityEntry[]): TimelineItem[]`, `fromLearning(entries: LearningEntry[]): TimelineItem[]` (hrefs `/#item-<id>`)
  - `mergeTimeline(...groups: TimelineItem[][]): TimelineItem[]` (asserts unique ids; sorts by start, then id)

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/timeline/__tests__/sources.test.ts
import { describe, it, expect } from "vitest";
import { fromBlog, fromProjects, fromCommunity, fromLearning, mergeTimeline } from "../sources.js";
import type { BlogLike, ProjectLike } from "../sources.js";

const d = (s: string) => new Date(s);

const posts: BlogLike[] = [
  { slug: "i-wont-stop-coding", data: { title: "I Won't Stop Coding", description: "Why", pubDate: d("2026-09-01"), tags: ["Coding", "AI"], draft: false } },
  { slug: "open-source-projects", data: { title: "3 Open Source Projects", description: "d", pubDate: d("2026-06-13"), tags: [], draft: true } },
];

const projects: ProjectLike[] = [
  { slug: "roaming-camp", data: { title: "Roaming.Camp", description: "Campsites", start: d("2025-03-01"), end: d("2026-06-30"), status: "live", stack: ["Next.js", "Go"], url: "https://roaming.camp" } },
  { slug: "daw-engine", data: { title: "Browser DAW engine", description: "Audio", start: d("2026-06-01"), status: "in-progress", stack: ["Rust", "WASM"] } },
];

describe("fromBlog", () => {
  it("excludes drafts unless asked to include them", () => {
    expect(fromBlog(posts, { includeDrafts: false }).map((i) => i.id)).toEqual(["essay-i-wont-stop-coding"]);
    expect(fromBlog(posts, { includeDrafts: true })).toHaveLength(2);
  });
  it("makes moments on the writing lane linking to the post", () => {
    const [item] = fromBlog(posts, { includeDrafts: false });
    expect(item.lane).toBe("writing");
    expect(item.kind).toBe("moment");
    expect(item.status).toBe("done");
    expect(item.start).toEqual(d("2026-09-01"));
    expect(item.href).toBe("/blog/i-wont-stop-coding");
    expect(item.subtitle).toBe("Coding, AI");
    expect(item.body).toEqual({ lane: "writing", description: "Why", published: d("2026-09-01"), href: "/blog/i-wont-stop-coding" });
  });
  it("omits the subtitle when there are no tags", () => {
    const [, draft] = fromBlog(posts, { includeDrafts: true });
    expect(draft.subtitle).toBeUndefined();
  });
});

describe("fromProjects", () => {
  it("makes spans on the building lane with the stack as subtitle", () => {
    const [roaming, daw] = fromProjects(projects);
    expect(roaming.id).toBe("roaming-camp");
    expect(roaming.lane).toBe("building");
    expect(roaming.kind).toBe("span");
    expect(roaming.end).toEqual(d("2026-06-30"));
    expect(roaming.subtitle).toBe("Next.js, Go");
    expect(roaming.href).toBe("/#item-roaming-camp");
    expect(daw.kind).toBe("span");
    expect(daw.end).toBeUndefined();
  });
  it("carries facts into the body", () => {
    const [roaming] = fromProjects(projects);
    expect(roaming.body).toEqual({
      lane: "building", description: "Campsites", stack: ["Next.js", "Go"], started: d("2025-03-01"),
      status: "live", url: "https://roaming.camp", source: undefined,
    });
  });
});

describe("fromCommunity and fromLearning", () => {
  it("community uses org as the subtitle when none is given", () => {
    const [talk] = fromCommunity([
      { id: "dsd-talk", title: "Talk", description: "d", org: "Dallas Software Developers", start: d("2026-03-01"), status: "done" },
    ]);
    expect(talk.lane).toBe("community");
    expect(talk.subtitle).toBe("Dallas Software Developers");
    expect(talk.kind).toBe("moment");
    expect(talk.href).toBe("/#item-dsd-talk");
    expect(talk.body).toEqual({ lane: "community", org: "Dallas Software Developers", description: "d", url: undefined });
  });
  it("learning carries the roadmap link and testimonial", () => {
    const [item] = fromLearning([
      { id: "100devs", title: "100Devs", description: "d", start: d("2021-01-15"), end: d("2022-01-15"), status: "done",
        roadmapHref: "/roadmap", testimonial: { quote: "q", author: "Leon Noel", role: "r" } },
    ]);
    expect(item.lane).toBe("learning");
    expect(item.kind).toBe("span");
    expect(item.body).toEqual({ lane: "learning", description: "d", roadmapHref: "/roadmap", testimonial: { quote: "q", author: "Leon Noel", role: "r" } });
  });
});

describe("mergeTimeline", () => {
  it("sorts by start then id across sources", () => {
    const merged = mergeTimeline(fromBlog(posts, { includeDrafts: false }), fromProjects(projects));
    expect(merged.map((i) => i.id)).toEqual(["roaming-camp", "daw-engine", "essay-i-wont-stop-coding"]);
  });
  it("rejects duplicate ids", () => {
    expect(() => mergeTimeline(fromProjects(projects), fromProjects(projects))).toThrow("Duplicate timeline id: roaming-camp");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/timeline/__tests__/sources.test.ts`
Expected: FAIL, "Failed to resolve import '../sources.js'".

- [ ] **Step 3: Write `src/lib/timeline/sources.ts`**

```ts
// src/lib/timeline/sources.ts
// Adapters from each content source to TimelineItem (spec §6). Pure: they take
// plain arrays so Vitest can test them; src/lib/timeline/astro.ts feeds them.
import type { CommunityEntry, LearningEntry, ProjectFrontmatter, TimelineItem } from "./types.js";
import { assertUniqueIds, deriveKind } from "./types.js";

/** The part of CollectionEntry<'blog'> this adapter reads. */
export interface BlogLike {
  slug: string;
  data: { title: string; description: string; pubDate: Date; tags: string[]; draft: boolean };
}

/** The part of CollectionEntry<'projects'> this adapter reads. */
export interface ProjectLike {
  slug: string;
  data: ProjectFrontmatter;
}

export function fromBlog(entries: readonly BlogLike[], opts: { includeDrafts: boolean }): TimelineItem[] {
  return entries
    .filter((e) => opts.includeDrafts || !e.data.draft)
    .map((e) => {
      const href = `/blog/${e.slug}`;
      return {
        id: `essay-${e.slug}`,
        lane: "writing",
        title: e.data.title,
        subtitle: e.data.tags.length ? e.data.tags.join(", ") : undefined,
        start: e.data.pubDate,
        status: "done",
        href,
        kind: "moment",
        body: { lane: "writing", description: e.data.description, published: e.data.pubDate, href },
      };
    });
}

export function fromProjects(entries: readonly ProjectLike[]): TimelineItem[] {
  return entries.map((e) => {
    const p = e.data;
    return {
      id: e.slug,
      lane: "building",
      title: p.title,
      subtitle: p.stack.join(", "),
      start: p.start,
      end: p.end,
      status: p.status,
      href: `/#item-${e.slug}`,
      kind: deriveKind(p.status, p.end),
      body: {
        lane: "building",
        description: p.description,
        stack: p.stack,
        started: p.start,
        status: p.status,
        url: p.url,
        source: p.source,
      },
    };
  });
}

export function fromCommunity(entries: readonly CommunityEntry[]): TimelineItem[] {
  return entries.map((e) => ({
    id: e.id,
    lane: "community",
    title: e.title,
    subtitle: e.subtitle ?? e.org,
    start: e.start,
    end: e.end,
    status: e.status,
    href: `/#item-${e.id}`,
    kind: deriveKind(e.status, e.end),
    body: { lane: "community", org: e.org, description: e.description, url: e.url },
  }));
}

export function fromLearning(entries: readonly LearningEntry[]): TimelineItem[] {
  return entries.map((e) => ({
    id: e.id,
    lane: "learning",
    title: e.title,
    subtitle: e.subtitle,
    start: e.start,
    end: e.end,
    status: e.status,
    href: `/#item-${e.id}`,
    kind: deriveKind(e.status, e.end),
    body: {
      lane: "learning",
      description: e.description,
      roadmapHref: e.roadmapHref,
      testimonial: e.testimonial,
    },
  }));
}

/** One chronological list. Throws on duplicate ids (spec §12). */
export function mergeTimeline(...groups: readonly (readonly TimelineItem[])[]): TimelineItem[] {
  const all = groups.flat();
  assertUniqueIds(all);
  return all.sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/timeline/__tests__/sources.test.ts`
Expected: PASS, 9 tests. Then `npm test` to confirm the whole suite (roadmap, review, og, and the three timeline files) is green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline/sources.ts src/lib/timeline/__tests__/sources.test.ts
git commit -m "feat(timeline): adapters from blog, projects, community, and learning into one list"
```

---

### Task 6: Projects collection, data files, and the Astro wrapper

**Files:**
- Modify: `src/content/config.ts`
- Create: `src/content/projects/roaming-camp.mdx`, `src/content/projects/rswebtwain.mdx`, `src/content/projects/songle.mdx`
- Create: `src/data/community.ts`, `src/data/learning.ts`
- Create: `src/lib/timeline/astro.ts`

**Interfaces:**
- Consumes: `projectFrontmatterSchema`, `communityEntrySchema`, `learningEntrySchema` from `types.ts`; `fromBlog`, `fromProjects`, `fromCommunity`, `fromLearning`, `mergeTimeline` from `sources.ts`
- Produces:
  - `collections.projects` (legacy `type: 'content'`, so `entry.slug` and `entry.render()` work like the blog)
  - `community: CommunityEntry[]` (default export of `src/data/community.ts`), `learning: LearningEntry[]` (`src/data/learning.ts`)
  - `getTimeline(): Promise<{ items: TimelineItem[]; now: Date; projects: CollectionEntry<'projects'>[] }>`

- [ ] **Step 1: Register the projects collection**

Replace `src/content/config.ts` with:

```ts
import { defineCollection, z } from 'astro:content';
import { projectFrontmatterSchema } from '../lib/timeline/types';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// Case studies. Frontmatter rules live in src/lib/timeline/types.ts so the
// same schema validates in Vitest (spec §12).
const projects = defineCollection({
  type: 'content',
  schema: projectFrontmatterSchema,
});

export const collections = { blog, projects };
```

- [ ] **Step 2: Write the three project files**

The prose is moved verbatim from the `projects` default in `src/components/Projects.astro`. Dates marked placeholder need the owner's confirmation (spec §15).

`src/content/projects/roaming-camp.mdx`:

```mdx
---
title: "Roaming.Camp"
description: "A geospatial campsite discovery platform that unifies NPS, weather, cell coverage, and reservation data into a single interactive map."
start: 2025-03-01 # placeholder
end: 2026-06-30 # placeholder
status: live
stack: ["Next.js", "Go", "PostGIS", "Mapbox", "Docker"]
url: "https://roaming.camp"
---

## Problem

Planning outdoor trips requires juggling multiple disconnected sources — NPS, Recreation.gov, weather services, cell coverage maps — with no unified way to discover and evaluate campsites.

## Solution

Built a full-stack geospatial platform with a Next.js frontend backed by 4 Go microservices that aggregate NPS, RIDB, NWS, and FCC data into an interactive Mapbox map with site details, weather, and cell coverage.

## Tradeoffs

Chose microservices over a monolith — each service (places, weather, coverage, reservations) scales and deploys independently, but adds orchestration complexity. PostGIS handles spatial queries correctly (Earth curvature) at the cost of a heavier database dependency.

## Impact

Consolidates 4+ data sources into a single map-based interface. Background sync keeps data fresh without blocking users, and the BFF pattern keeps internal services unexposed.
```

`src/content/projects/rswebtwain.mdx`:

```mdx
---
title: "RSWebTWAIN"
description: "An open-source, headless Rust/Tauri desktop agent that bridges web browsers to TWAIN document scanners, replacing expensive proprietary libraries."
start: 2024-09-01 # placeholder
end: 2025-04-01 # placeholder
status: done
stack: ["Rust", "Tauri v2", "WebSocket", "Angular", "FFI"]
source: "https://github.com/seancampbell3161/WebTWAIN"
---

## Problem

Enterprise web apps need browser-based document scanning, but the go-to commercial library is expensive and can't handle legacy 32-bit-only scanner drivers on modern 64-bit systems.

## Solution

Built a headless Tauri v2 system-tray agent that exposes a WebSocket API on localhost for browser-to-scanner communication. Uses a typestate pattern for the TWAIN state machine — seven state transitions verified at compile time — and spawns a 32-bit sidecar process to bridge the architecture gap for legacy drivers.

## Tradeoffs

Chose Rust's typestate pattern to make invalid TWAIN state transitions compile-time errors instead of runtime bugs. This added upfront design complexity but eliminated an entire class of scanner communication failures. A 32-bit sidecar over JSON-line IPC was simpler than forcing the whole app to 32-bit, at the cost of cross-process coordination.

## Impact

Eliminates per-seat licensing costs for commercial scanning SDKs. Supports both modern 64-bit and legacy 32-bit TWAIN drivers in a single install — critical for enterprise deployments with mixed hardware. DPAPI-encrypted auth and origin validation secure the localhost WebSocket without TLS certificate complexity.
```

`src/content/projects/songle.mdx`:

```mdx
---
title: "Songle"
description: "A daily music guessing game where players identify songs from isolated audio stems — vocals, drums, bass, or instrumentation."
start: 2023-06-01 # placeholder
end: 2024-02-01 # placeholder
status: live
stack: ["Angular", ".NET", "Python", "PostgreSQL", "Docker"]
url: "https://songle.lol"
---

## Problem

Music trivia games rely on playing full tracks, making it too easy to identify songs. There's no game that challenges players with isolated stems — just vocals, drums, or bass — for a genuinely difficult guessing experience.

## Solution

Built a daily Wordle-style music guessing game where players identify songs from isolated audio stems. A .NET API orchestrates Python ML models (Spleeter/Demucs) to separate uploaded tracks into vocals, drums, bass, and instrumentation.

## Tradeoffs

Audio separation runs Python ML models invoked via subprocess from .NET rather than porting to native code. This adds deployment complexity (multi-container Docker setup) but leverages battle-tested models that would take months to reimplement.

## Impact

Players get 4 attempts with scoring based on speed (100/75/50/25 points). A daily background job auto-selects the Song of the Day, and the hybrid .NET/Python pipeline processes tracks end-to-end from YouTube URL to separated stems stored in cloud storage.
```

- [ ] **Step 3: Write `src/data/community.ts`**

```ts
// src/data/community.ts
// Hand-authored Community lane entries (spec §6). Validated at module load so
// a bad entry fails the build with its id in the message.
import { communityEntrySchema, type CommunityEntry } from "../lib/timeline/types";

const raw = [
  {
    id: "dsd-cohort-lead",
    title: "Engineer team lead, DSD cohort",
    org: "Dallas Software Developers",
    description:
      "Mentored aspiring developers through their learning journey, conducting code reviews and pair programming sessions.",
    start: "2023-03-01", // placeholder
    end: "2024-02-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2024",
    title: "Talk: architecture patterns",
    org: "Dallas Software Developers",
    description: "Backend and frontend architecture patterns, for the Dallas Software Developers meetup.",
    start: "2024-06-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2025",
    title: "Talk: developer productivity",
    org: "Dallas Software Developers",
    description: "Developer productivity, for the Dallas Software Developers meetup.",
    start: "2025-04-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2026-03",
    title: "Talk: architecture patterns",
    org: "Dallas Software Developers",
    description: "Architecture patterns, for the Dallas Software Developers meetup.",
    start: "2026-03-01", // placeholder
    status: "done",
  },
  {
    id: "dsd-talk-2026-08",
    title: "Talk: developer productivity",
    org: "Dallas Software Developers",
    description: "Developer productivity, for the Dallas Software Developers meetup.",
    start: "2026-08-01", // placeholder
    status: "done",
  },
];

const community: CommunityEntry[] = raw.map((entry) => {
  const result = communityEntrySchema.safeParse(entry);
  if (!result.success) {
    throw new Error(`community entry "${entry.id}": ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
});

export default community;
```

- [ ] **Step 4: Write `src/data/learning.ts`**

```ts
// src/data/learning.ts
// Hand-authored Learning lane entries for sub-project 1 (spec §6). Sub-project 3
// replaces this file with derivation from src/data/roadmap.ts and live progress.
import { learningEntrySchema, type LearningEntry } from "../lib/timeline/types";

const raw = [
  {
    id: "100devs",
    title: "100Devs",
    subtitle: "where it started",
    description:
      "A free, community-run software engineering program led by Leon Noel. Where I learned to build for the web and to keep showing up.",
    start: "2021-01-15", // placeholder
    end: "2022-01-15", // placeholder
    status: "done",
    roadmapHref: "/roadmap",
    testimonial: {
      quote:
        "Talented developer and lightning fast learner. I had the pleasure of mentoring Sean at 100devs. No matter the challenge or how short the deadline, Sean always triumphed. He never settled for just what was due, but pushed boundaries and always delivered a product well above and beyond what was asked. Not only was Sean's work ethic unparalleled, but the speed at which he was able to learn new materials was astonishing. His hard work and ability to quickly understand complex topics made him into a great programmer.",
      author: "Leon Noel",
      role: "Managing Director of Engineering, Resilient Coders",
    },
  },
  {
    id: "ddia",
    title: "Designing Data-Intensive Applications",
    subtitle: "reading, one chapter at a time",
    description: "The anchor book on the roadmap's reading thread, read alongside the builds.",
    start: "2026-01-01", // placeholder
    status: "in-progress",
    roadmapHref: "/roadmap#rm-track-reading",
  },
  {
    id: "redis-build",
    title: "Build your own Redis",
    subtitle: "CodeCrafters",
    description:
      "One milestone per course, taken to pragmatic completion. Each checkpoint is a CodeCrafters stage group, and the milestone ends in a capstone decision log.",
    start: "2026-06-01", // placeholder
    status: "in-progress",
    roadmapHref: "/roadmap#rm-track-build",
  },
];

const learning: LearningEntry[] = raw.map((entry) => {
  const result = learningEntrySchema.safeParse(entry);
  if (!result.success) {
    throw new Error(`learning entry "${entry.id}": ${result.error.issues.map((i) => i.message).join("; ")}`);
  }
  return result.data;
});

export default learning;
```

- [ ] **Step 5: Write `src/lib/timeline/astro.ts`**

```ts
// src/lib/timeline/astro.ts
// The only timeline module that imports from Astro. Everything it calls is pure.
import { getCollection, type CollectionEntry } from "astro:content";
import community from "../../data/community";
import learning from "../../data/learning";
import { fromBlog, fromCommunity, fromLearning, fromProjects, mergeTimeline } from "./sources";
import type { TimelineItem } from "./types";

export interface TimelineData {
  items: TimelineItem[];
  /** Build time. The client script nudges the playhead to the real date. */
  now: Date;
  projects: CollectionEntry<"projects">[];
}

export async function getTimeline(): Promise<TimelineData> {
  const includeDrafts = !import.meta.env.PROD;
  const blog = await getCollection("blog", ({ data }) => includeDrafts || !data.draft);
  const projects = await getCollection("projects");
  const items = mergeTimeline(
    fromBlog(blog, { includeDrafts }),
    fromProjects(projects),
    fromCommunity(community),
    fromLearning(learning),
  );
  return { items, now: new Date(), projects };
}
```

- [ ] **Step 6: Prove the collection validates and the data loads**

Run: `npm run build`
Expected: exits 0 and the build log lists no content errors. Then temporarily break a date, for example set `end: 2020-01-01` in `roaming-camp.mdx`, run `npm run build` again, and confirm it fails with a message containing `end must not be before start` and the file path. Restore the date.

Run: `npx tsx -e "import('./src/data/community.ts').then(m => console.log(m.default.length))"`
Expected: prints `5`. (If `tsx` is not available, `npx vite-node` works the same; either is fine to run without installing globally.)

- [ ] **Step 7: Commit**

```bash
git add src/content/config.ts src/content/projects src/data/community.ts src/data/learning.ts src/lib/timeline/astro.ts
git commit -m "feat(content): projects collection, community and learning data, timeline loader"
```

---
### Task 7: Transport bar, footer, and the nav swap

**Files:**
- Create: `src/components/TransportBar.astro`
- Modify: `src/components/Footer.astro` (styles only)
- Modify: `src/layouts/BlogPost.astro`, `src/pages/index.astro`, `src/pages/blog/index.astro`, `src/pages/404.astro`, `src/pages/roadmap.astro`, `src/pages/newsletter/confirmed.astro`, `src/pages/newsletter/error.astro`, `src/pages/newsletter/unsubscribed.astro` (import and tag)
- Delete: `src/components/Nav.astro`

**Interfaces:**
- Consumes: `Lane` from `src/lib/timeline/types.ts`; `Icon.astro` (`github`, `linkedin`)
- Produces: `<TransportBar active?: Lane, showZoom?: boolean, now?: Date />`. DOM hooks the client script (Task 10) relies on: `[data-zoom-control]` containing `button[data-zoom="year"|"three-years"|"all"]` with `aria-pressed`, and `time[data-now-label]`.

- [ ] **Step 1: Write `src/components/TransportBar.astro`**

```astro
---
import Icon from "./Icon.astro";
import type { Lane } from "../lib/timeline/types";

interface Props {
  /** Which section this page belongs to; underlines the link in its lane color. */
  active?: Lane;
  /** Show the timeline zoom control (home page only). */
  showZoom?: boolean;
  /** Build time; the client script replaces the label with the real date. */
  now?: Date;
}

const { active, showZoom = false, now = new Date() } = Astro.props;

const links: { key: Lane | "contact"; label: string; href: string }[] = [
  { key: "writing", label: "Writing", href: "/blog" },
  { key: "building", label: "Building", href: "/#lane-building" },
  { key: "learning", label: "Learning", href: "/roadmap" },
  { key: "community", label: "Community", href: "/#lane-community" },
  { key: "contact", label: "Contact", href: "/#contact" },
];

const socials = [
  { href: "https://github.com/seancampbell3161", icon: "github" as const, label: "GitHub" },
  { href: "https://linkedin.com/in/seancampbelldev", icon: "linkedin" as const, label: "LinkedIn" },
];

const year = now.getFullYear();
const dateLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
---

<header class="tb">
  <div class="tb-inner">
    <a href="/" class="tb-name">Sean Campbell</a>

    <nav class="tb-nav" aria-label="Site">
      {links.map((l) => (
        <a
          href={l.href}
          class:list={["tb-link", { on: l.key === active }]}
          style={l.key !== "contact" ? `--c: var(--lane-${l.key})` : undefined}
          aria-current={l.key === active ? "page" : undefined}
        >
          {l.label}
        </a>
      ))}
    </nav>

    <div class="tb-right">
      {showZoom && (
        <div class="tb-zoom" role="group" aria-label="Timeline zoom" data-zoom-control>
          <button type="button" data-zoom="year" aria-pressed="true">{year}</button>
          <button type="button" data-zoom="three-years" aria-pressed="false">3 yr</button>
          <button type="button" data-zoom="all" aria-pressed="false">All</button>
        </div>
      )}
      <time class="tb-date" datetime={now.toISOString().slice(0, 10)} data-now-label>{dateLabel}</time>
      <div class="tb-social">
        {socials.map((s) => (
          <a href={s.href} class="tb-social-link" target="_blank" rel="noopener noreferrer" aria-label={s.label}>
            <Icon name={s.icon} size={18} />
          </a>
        ))}
      </div>
      <button class="tb-menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="tb-mobile">
        <span></span><span></span>
      </button>
    </div>
  </div>

  <div class="tb-mobile" id="tb-mobile" hidden>
    {links.map((l) => (
      <a href={l.href} class="tb-mobile-link" style={l.key !== "contact" ? `--c: var(--lane-${l.key})` : undefined}>
        <i aria-hidden="true"></i>{l.label}
      </a>
    ))}
    <div class="tb-mobile-social">
      {socials.map((s) => (
        <a href={s.href} class="tb-mobile-link" target="_blank" rel="noopener noreferrer">
          <Icon name={s.icon} size={18} /><span>{s.label}</span>
        </a>
      ))}
    </div>
  </div>
</header>

<script>
  const bar = document.querySelector<HTMLElement>(".tb");
  const toggle = bar?.querySelector<HTMLButtonElement>(".tb-menu");
  const panel = bar?.querySelector<HTMLElement>(".tb-mobile");

  function setOpen(open: boolean) {
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    bar?.classList.toggle("menu-open", open);
  }

  toggle?.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  panel?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") setOpen(false);
  });
</script>

<style>
  .tb {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: color-mix(in srgb, var(--color-bg) 92%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-border);
    font-size: 14px;
  }
  .tb-inner {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 14px 40px;
    display: flex;
    align-items: center;
    gap: 28px;
  }
  .tb-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
    color: var(--color-text-primary);
    white-space: nowrap;
  }
  .tb-nav {
    display: flex;
    gap: 22px;
  }
  .tb-link {
    position: relative;
    padding: 4px 0;
    color: var(--color-text-muted);
    transition: color var(--transition-base);
  }
  .tb-link:hover,
  .tb-link.on {
    color: var(--color-text-primary);
  }
  .tb-link.on::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -2px;
    height: 2px;
    border-radius: 1px;
    background: var(--c, var(--color-text-primary));
  }
  .tb-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .tb-zoom {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .tb-zoom button {
    padding: 5px 11px;
    background: none;
    border: 0;
    border-right: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font: inherit;
    cursor: pointer;
  }
  .tb-zoom button:last-child {
    border-right: 0;
  }
  .tb-zoom button[aria-pressed="true"] {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
  .tb-date {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .tb-social {
    display: flex;
    gap: 4px;
  }
  .tb-social-link {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    border-radius: var(--radius-md);
  }
  .tb-social-link:hover {
    color: var(--color-text-primary);
  }
  .tb-menu {
    display: none;
    width: 36px;
    height: 32px;
    padding: 9px 8px;
    background: none;
    border: 0;
    cursor: pointer;
    flex-direction: column;
    justify-content: space-between;
  }
  .tb-menu span {
    display: block;
    height: 2px;
    background: var(--color-text-primary);
    border-radius: 1px;
    transition: transform var(--transition-base);
  }
  .tb.menu-open .tb-menu span:first-child {
    transform: translateY(6px) rotate(45deg);
  }
  .tb.menu-open .tb-menu span:last-child {
    transform: translateY(-6px) rotate(-45deg);
  }
  .tb-mobile {
    display: none;
  }
  .tb-mobile[hidden] {
    display: none;
  }

  @media (max-width: 899.98px) {
    .tb-inner {
      padding: 14px 18px;
      gap: 14px;
    }
    .tb-nav,
    .tb-social,
    .tb-date {
      display: none;
    }
    .tb-menu {
      display: flex;
    }
    .tb-mobile:not([hidden]) {
      display: flex;
      flex-direction: column;
      padding: 8px 18px 18px;
      border-top: 1px solid var(--color-border);
      background: var(--color-bg);
    }
    .tb-mobile-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      font-size: 15px;
      color: var(--color-text-secondary);
    }
    .tb-mobile-link i {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background: var(--c, var(--color-text-muted));
    }
    .tb-mobile-social {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border);
    }
  }
</style>
```

- [ ] **Step 2: Restyle `src/components/Footer.astro`**

Keep the markup. In its `<style>`, replace the `.footer-logo` rule with:

```css
  .footer-logo {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
```

and replace the `.social-link` and `.social-link:hover` rules with:

```css
  .social-link {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    border-radius: var(--radius-md);
    transition: color var(--transition-base);
  }

  .social-link:hover {
    color: var(--color-text-primary);
  }
```

Also change the `@media (max-width: 768px)` query in this file to `@media (max-width: 899.98px)`.

- [ ] **Step 3: Swap Nav for TransportBar on every page**

In each of the eight files, change the import line

```astro
import Nav from '../components/Nav.astro';
```

(path depth varies: `../../components/` in `src/pages/blog/index.astro`, `src/layouts/BlogPost.astro` uses `../components/`, newsletter pages use `../../components/`) to

```astro
import TransportBar from '<same relative path>/TransportBar.astro';
```

and replace `<Nav />` with:

| File | Tag |
|---|---|
| `src/layouts/BlogPost.astro` | `<TransportBar active="writing" />` |
| `src/pages/blog/index.astro` | `<TransportBar active="writing" />` |
| `src/pages/roadmap.astro` | `<TransportBar active="learning" />` |
| `src/pages/index.astro` | `<TransportBar showZoom now={new Date()} />` (Task 8 replaces this page wholesale; this keeps it building now) |
| `src/pages/404.astro`, the three `src/pages/newsletter/*.astro` | `<TransportBar />` |

Then: `git rm src/components/Nav.astro`.

Run: `grep -rn "Nav.astro\|<Nav" src` — expected: no output.

- [ ] **Step 4: Build and check**

Run: `npm run build && npm run preview`
Expected: build exits 0. At `http://localhost:4321/blog`, the bar shows "Writing" underlined in gold; at `/roadmap`, "Learning" underlined in blue; at `/`, the zoom control and date appear. Narrow the window below 900px: the menu button appears, opens a panel with the five links and two socials, and Escape closes it.

- [ ] **Step 5: Commit**

```bash
git add -A src/components src/layouts src/pages
git commit -m "feat(nav): transport bar replaces Nav; footer restyled for the console palette"
```

---

### Task 8: The timeline component and the new home page

**Files:**
- Modify: `src/lib/timeline/layout.ts` (append `whenLabel`), `src/lib/timeline/__tests__/layout.test.ts` (append)
- Create: `src/components/Timeline.astro`
- Modify: `src/pages/index.astro` (rewrite)

**Interfaces:**
- Consumes: `getTimeline()` from `src/lib/timeline/astro.ts`; `windowFor`, `positionIn`, `packLane`, `estimateLabelWidth`, `ticksFor`, `laneSummary`, `graphLayout`, `fraction`, `Zoom` from `layout.ts`; `LANES` from `types.ts`
- Produces:
  - `whenLabel(date: Date, zoom: Zoom): string` ("Jan" at year zoom, "Jan 2026" otherwise)
  - `<Timeline items now zoom? />` and these DOM hooks for Task 9 and Task 10: `section[data-timeline][data-now][data-zoom]`, `ol.tl-items > li.tl-item[data-id][data-lane][data-kind][data-status][data-start][data-end?][data-labeled][data-out?]` each containing `a.tl-clip[href]` with `.tl-title` and optional `.tl-sub`, plus `span.tl-when`; `[data-ticks]`, `[data-window-label]`, `[data-ov-window]`, `[data-playhead]`, `[data-gutter]`, `[data-nowline]`, `[data-lane-summary="<lane>"]`.
  - CSS custom properties the script writes per item: `--lane`, `--row`, `--x`, `--w`.

- [ ] **Step 1: Append the `whenLabel` test and implementation**

Test (append to `layout.test.ts`, add `whenLabel` to its import):

```ts
describe("whenLabel", () => {
  it("is the month at year zoom and month plus year otherwise", () => {
    expect(whenLabel(d("2026-03-05"), "year")).toBe("Mar");
    expect(whenLabel(d("2026-03-05"), "three-years")).toBe("Mar 2026");
    expect(whenLabel(d("2026-03-05"), "all")).toBe("Mar 2026");
  });
});
```

Run `npx vitest run src/lib/timeline/__tests__/layout.test.ts`; expected FAIL on `whenLabel`. Append to `layout.ts`:

```ts
/** The date column in the vertical graph. */
export function whenLabel(date: Date, zoom: Zoom): string {
  const m = MONTHS[date.getMonth()];
  return zoom === "year" ? m : `${m} ${date.getFullYear()}`;
}
```

Run again; expected PASS, 33 tests. Commit:

```bash
git add src/lib/timeline/layout.ts src/lib/timeline/__tests__/layout.test.ts
git commit -m "feat(timeline): whenLabel for the graph's date column"
```

- [ ] **Step 2: Write `src/components/Timeline.astro`**

```astro
---
import type { TimelineItem } from "../lib/timeline/types";
import { LANES } from "../lib/timeline/types";
import {
  estimateLabelWidth,
  fraction,
  graphLayout,
  laneSummary,
  packLane,
  positionIn,
  ticksFor,
  whenLabel,
  windowFor,
  type Zoom,
} from "../lib/timeline/layout";

interface Props {
  items: TimelineItem[];
  now: Date;
  zoom?: Zoom;
}

const { items, now, zoom = "year" } = Astro.props;

const win = windowFor(zoom, now, items);
const allWin = windowFor("all", now, items);
const estimate = estimateLabelWidth();

// Arrangement positions, per lane, then indexed by item id.
const placed = new Map<string, { lane: number; row: number; x: number; w: number; labeled: boolean }>();
LANES.forEach((lane, laneIndex) => {
  for (const p of packLane(items, lane, win, now, estimate)) {
    placed.set(p.item.id, { lane: laneIndex, row: p.row, x: p.x, w: p.w, labeled: p.labeled });
  }
});

// Vertical graph.
const graph = graphLayout(items, win, now);
const byId = new Map(items.map((i) => [i.id, i]));
const laneIndex = (lane: string) => LANES.indexOf(lane as (typeof LANES)[number]);

const ticks = ticksFor(zoom, win);
const allTicks = ticksFor("all", allWin);
const summaries = LANES.map((lane) => laneSummary(lane, items, win, now));
const windowLabel =
  zoom === "year" ? String(win.from.getFullYear()) : `${win.from.getFullYear()} to ${win.to.getFullYear()}`;
const nowX = fraction(now, win);
const ovX = fraction(win.from, allWin);
const ovW = fraction(win.to, allWin) - ovX;
const overview = LANES.map((lane) =>
  items.filter((i) => i.lane === lane).flatMap((i) => positionIn(i, allWin, now) ?? []),
);
const iso = (d: Date) => d.toISOString().slice(0, 10);
---

<section class="tl" data-timeline data-now={now.toISOString()} data-zoom={zoom} aria-label="Timeline">
  <div class="tl-ov" aria-hidden="true">
    {allTicks.map((t) => <span class="tl-ov-yr" style={`--x:${t.x}`}>{t.label}</span>)}
    {LANES.map((lane, li) => (
      <div class="tl-ov-row" style={`--lane:${li};--c:var(--lane-${lane})`}>
        {overview[li].map((p) => <i style={`--x:${p.x};--w:${p.w}`}></i>)}
      </div>
    ))}
    <div class="tl-ov-win" data-ov-window style={`--x:${ovX};--w:${ovW}`}></div>
  </div>

  <div class="tl-stage">
    <div class="tl-ruler" aria-hidden="true">
      <span class="tl-corner" data-window-label>{windowLabel}</span>
      <div class="tl-ticks" data-ticks>
        {ticks.map((t) => <span style={`--x:${t.x}`}>{t.label}</span>)}
      </div>
    </div>

    <ul class="tl-heads">
      {LANES.map((lane, li) => (
        <li class="tl-head" id={`lane-${lane}`} style={`--lane:${li};--c:var(--lane-${lane})`}>
          <b><i aria-hidden="true"></i>{lane[0].toUpperCase() + lane.slice(1)}</b>
          <small data-lane-summary={lane}>{summaries[li]}</small>
        </li>
      ))}
    </ul>

    <ol class="tl-items">
      {items.map((item) => {
        const p = placed.get(item.id);
        const style = p ? `--lane:${p.lane};--row:${p.row};--x:${p.x};--w:${p.w};--c:var(--lane-${item.lane})` : `--c:var(--lane-${item.lane})`;
        return (
          <li
            class="tl-item"
            data-id={item.id}
            data-lane={item.lane}
            data-kind={item.kind}
            data-status={item.status}
            data-start={iso(item.start)}
            data-end={item.end ? iso(item.end) : undefined}
            data-labeled={p ? String(p.labeled) : "true"}
            data-out={p ? undefined : ""}
            style={style}
          >
            <span class="tl-when">{whenLabel(item.start, zoom)}</span>
            <a class="tl-clip" href={item.href} data-item-link={item.id}>
              <span class="tl-title">{item.title}</span>
              {item.subtitle && <small class="tl-sub">{item.subtitle}</small>}
            </a>
          </li>
        );
      })}
    </ol>

    <div class="tl-gutter" aria-hidden="true" data-gutter>
      {graph.bars.map((b) => (
        <i
          class:list={["tl-bar", { live: byId.get(b.id)?.status === "in-progress", "to-now": b.toRow === null }]}
          style={`--lane:${laneIndex(b.lane)};--slot:${b.slot};--from:${b.fromRow};--to:${b.toRow ?? graph.nowRow};--c:var(--lane-${b.lane})`}
        ></i>
      ))}
      {graph.dots.map((d) => (
        <i class="tl-dot" style={`--lane:${laneIndex(d.lane)};--row:${d.row};--c:var(--lane-${d.lane})`}></i>
      ))}
    </div>
    <div class="tl-nowline" aria-hidden="true" data-nowline style={`--row:${graph.nowRow}`}><span>now</span></div>

    <div class="tl-playhead" aria-hidden="true" data-playhead style={`--x:${nowX}`}><span>now</span></div>
  </div>
</section>

<style>
  .tl {
    --lane-h: 120px;
    --row-pitch: 36px;
    --row-top: 12px;
    --head-w: 160px;
    --ruler-h: 32px;
    --row-h: 50px;
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 40px;
  }

  /* ---------- overview strip ---------- */
  .tl-ov {
    position: relative;
    height: 60px;
    margin: 0 0 10px var(--head-w);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
  }
  .tl-ov-yr {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--x) * 100%);
    border-left: 1px solid var(--color-border);
    padding: 3px 0 0 5px;
  }
  .tl-ov-row {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(18px + var(--lane) * 10px);
    height: 6px;
  }
  .tl-ov-row i {
    position: absolute;
    top: 0;
    height: 6px;
    left: calc(var(--x) * 100%);
    width: max(6px, calc(var(--w) * 100%));
    border-radius: 2px;
    background: var(--c);
  }
  .tl-ov-win {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--x) * 100%);
    width: calc(var(--w) * 100%);
    border: 1px solid var(--color-text-primary);
    background: rgba(236, 234, 228, 0.07);
  }

  /* ---------- arrangement (900px and up) ---------- */
  .tl-stage {
    position: relative;
    display: grid;
    grid-template-columns: var(--head-w) 1fr;
    grid-template-rows: var(--ruler-h) repeat(4, var(--lane-h));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
    overflow: hidden;
  }
  .tl-ruler {
    grid-column: 1 / 3;
    grid-row: 1;
    display: grid;
    grid-template-columns: var(--head-w) 1fr;
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .tl-corner {
    border-right: 1px solid var(--color-border);
    padding: 8px 16px;
    color: var(--color-text-primary);
  }
  .tl-ticks {
    position: relative;
  }
  .tl-ticks span {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--x) * 100%);
    border-left: 1px solid var(--color-border);
    padding: 8px 0 0 7px;
    white-space: nowrap;
  }
  .tl-heads {
    display: contents;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tl-head {
    grid-column: 1;
    grid-row: calc(var(--lane) + 2);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    padding: 0 16px;
    border-right: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
  }
  .tl-head:last-child {
    border-bottom: 0;
  }
  .tl-head b {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    font-size: 14px;
  }
  .tl-head b i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--c);
  }
  .tl-head small {
    font-size: 12px;
    color: var(--color-text-muted);
    padding-left: 20px;
  }
  .tl-items {
    grid-column: 2;
    grid-row: 2 / 6;
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
    background-image: linear-gradient(var(--color-border) 1px, transparent 1px);
    background-size: 100% var(--lane-h);
    background-position: 0 -1px;
  }
  .tl-item {
    position: absolute;
    left: calc(var(--x) * 100%);
    width: calc(var(--w) * 100%);
    top: calc(var(--lane) * var(--lane-h) + var(--row-top) + var(--row) * var(--row-pitch));
    margin: 0;
  }
  .tl-item[data-out] {
    display: none;
  }
  .tl-item[data-kind="moment"] {
    width: auto;
  }
  .tl-when {
    display: none;
  }
  .tl-clip {
    display: block;
    box-sizing: border-box;
    height: 32px;
    padding: 4px 10px 0;
    border-left: 3px solid var(--c);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--c) 22%, var(--color-bg-elevated));
    color: var(--color-text-primary);
    font-size: 13px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tl-sub {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .tl-item[data-status="in-progress"] .tl-clip {
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--c) 10%, var(--color-bg-elevated)) 0 6px,
      color-mix(in srgb, var(--c) 26%, var(--color-bg-elevated)) 6px 12px
    );
    border-right: 2px dashed var(--c);
  }
  .tl-item[data-kind="moment"] .tl-clip {
    position: relative;
    height: 20px;
    padding: 0 0 0 16px;
    border-left: 0;
    background: transparent;
    line-height: 20px;
    overflow: visible;
  }
  .tl-item[data-kind="moment"] .tl-clip::before {
    content: "";
    position: absolute;
    left: 0;
    top: 5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
  }
  .tl-item[data-kind="moment"] .tl-sub {
    display: inline;
    margin: 0 0 0 8px;
  }
  /* Demoted moment: bare dot; label appears on hover or focus. */
  .tl-item[data-labeled="false"] .tl-title,
  .tl-item[data-labeled="false"] .tl-sub {
    position: absolute;
    left: -9999px;
  }
  .tl-item[data-labeled="false"] .tl-clip:is(:hover, :focus-visible) .tl-title {
    position: absolute;
    left: 16px;
    top: 0;
    z-index: 3;
    padding: 0 6px;
    border-radius: var(--radius-sm);
    background: var(--color-bg);
  }
  .tl-item[data-selected] .tl-clip {
    outline: 2px solid var(--c);
    outline-offset: -1px;
  }
  .tl-clip:focus-visible {
    outline: 2px solid var(--c);
    outline-offset: 2px;
  }
  .tl-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--head-w) + (100% - var(--head-w)) * var(--x));
    width: 2px;
    background: var(--color-text-primary);
    pointer-events: none;
    z-index: 2;
  }
  .tl-playhead span {
    position: absolute;
    top: 7px;
    right: 6px;
    padding: 1px 5px;
    border-radius: 2px;
    background: var(--color-text-primary);
    color: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
  }
  .tl-gutter,
  .tl-nowline {
    display: none;
  }

  /* ---------- vertical graph (below 900px) ---------- */
  @media (max-width: 899.98px) {
    .tl {
      padding: 0 18px;
    }
    .tl-ov {
      margin-left: 0;
      height: 40px;
      font-size: 9px;
    }
    .tl-ov-row {
      top: calc(13px + var(--lane) * 7px);
      height: 4px;
    }
    .tl-ov-row i {
      height: 4px;
      width: max(4px, calc(var(--w) * 100%));
    }
    .tl-stage {
      display: block;
      border: 0;
      background: none;
      overflow: visible;
    }
    .tl-ruler,
    .tl-playhead {
      display: none;
    }
    .tl-heads {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 6px;
      font-size: 10.5px;
      color: var(--color-text-muted);
    }
    .tl-head {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
      padding: 0;
      border: 0;
    }
    .tl-head b {
      font-size: inherit;
      font-weight: 400;
      gap: 5px;
    }
    .tl-head b i {
      width: 8px;
      height: 8px;
    }
    .tl-head small {
      display: none;
    }
    .tl-items {
      position: relative;
      background: none;
    }
    .tl-item,
    .tl-item[data-kind="moment"] {
      position: static;
      display: grid;
      grid-template-columns: 30px 74px 1fr;
      gap: 0 10px;
      width: auto;
      height: var(--row-h);
      align-items: start;
      padding-top: 8px;
      border-top: 1px solid var(--color-border);
    }
    .tl-when {
      display: block;
      padding-top: 3px;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
    }
    .tl-clip,
    .tl-item[data-kind="moment"] .tl-clip,
    .tl-item[data-status="in-progress"] .tl-clip {
      grid-column: 3;
      height: auto;
      padding: 0;
      border: 0;
      background: none;
      font-size: 13.5px;
      line-height: 1.25;
    }
    .tl-item[data-kind="moment"] .tl-clip::before {
      display: none;
    }
    .tl-sub,
    .tl-item[data-kind="moment"] .tl-sub {
      display: block;
      margin: 2px 0 0;
      font-size: 11px;
    }
    .tl-item[data-labeled="false"] .tl-title,
    .tl-item[data-labeled="false"] .tl-sub {
      position: static;
    }
    .tl-gutter {
      display: block;
      position: absolute;
      left: 40px;
      top: 0;
      width: 74px;
      height: 100%;
      pointer-events: none;
    }
    .tl-bar {
      position: absolute;
      display: block;
      width: 6px;
      border-radius: 3px;
      background: var(--c);
      left: calc(var(--lane) * 20px + var(--slot) * 8px);
      top: calc(var(--from) * var(--row-h) + 11px);
      height: calc((var(--to) - var(--from)) * var(--row-h) + 8px);
    }
    .tl-bar.to-now {
      height: calc((var(--to) - var(--from)) * var(--row-h) - 11px);
    }
    .tl-bar.live {
      background: repeating-linear-gradient(
        -45deg,
        color-mix(in srgb, var(--c) 40%, var(--color-bg-elevated)) 0 3px,
        var(--c) 3px 6px
      );
    }
    .tl-dot {
      position: absolute;
      display: block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--c);
      left: calc(var(--lane) * 20px - 1px);
      top: calc(var(--row) * var(--row-h) + 10px);
    }
    .tl-nowline {
      display: block;
      position: absolute;
      left: -18px;
      right: -18px;
      top: calc(var(--row) * var(--row-h));
      height: 2px;
      background: var(--color-text-primary);
      pointer-events: none;
    }
    .tl-nowline span {
      position: absolute;
      left: 18px;
      top: -9px;
      padding: 0 5px;
      border-radius: 2px;
      background: var(--color-text-primary);
      color: var(--color-bg);
      font-family: var(--font-mono);
      font-size: 9px;
      line-height: 1.7;
    }
  }
</style>
```

- [ ] **Step 3: Rewrite `src/pages/index.astro`**

```astro
---
import Layout from "../layouts/Layout.astro";
import TransportBar from "../components/TransportBar.astro";
import Timeline from "../components/Timeline.astro";
import Footer from "../components/Footer.astro";
import { getTimeline } from "../lib/timeline/astro";

const { items, now } = await getTimeline();
---

<Layout title="Sean Campbell | Software Engineer">
  <TransportBar showZoom now={now} />

  <main class="home">
    <section class="hero">
      <h1>Everything I've built, written and taught, in the order it happened.</h1>
      <p>Software engineer in Dallas. Go, Rust and .NET. Click any clip to open it.</p>
    </section>

    <Timeline items={items} now={now} />
  </main>

  <Footer />
</Layout>

<style>
  .home {
    padding-top: 110px;
    padding-bottom: var(--space-4xl);
  }
  .hero {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 40px 26px;
    display: grid;
    grid-template-columns: 1.35fr 1fr;
    gap: 40px;
    align-items: end;
  }
  .hero h1 {
    font-size: 62px;
    line-height: 1;
    margin: 0;
    font-variation-settings: "wdth" 100, "opsz" 96;
  }
  .hero p {
    max-width: 36ch;
    margin: 0 0 4px;
    font-size: 17px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }
  @media (max-width: 899.98px) {
    .home {
      padding-top: 84px;
    }
    .hero {
      display: block;
      padding: 0 18px 12px;
    }
    .hero h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .hero p {
      font-size: 13.5px;
    }
  }
</style>
```

- [ ] **Step 4: Build and look at both layouts**

Run: `npm run build && npm run preview`
Expected: build exits 0. At `http://localhost:4321/` on a 1280px-wide window: the overview strip, the ruler with twelve month ticks, four lane heads with summaries ("3 essays", "1 live, 1 in progress" or similar), clips positioned across 2026, the playhead with its "now" tag left of the line. Narrow to 390px: rows in date order with a date column, colored bars and dots in the gutter, and a "now" line after the last row. Every clip is a link; with JavaScript disabled (DevTools, Command Menu, "Disable JavaScript") the page looks identical.

- [ ] **Step 5: Commit**

```bash
git add src/components/Timeline.astro src/pages/index.astro
git commit -m "feat(home): timeline component with arrangement and vertical graph layouts"
```

---
### Task 9: Inspector, contact block, and the old components' removal

**Files:**
- Create: `src/components/Inspector.astro`, `src/components/ContactBlock.astro`
- Modify: `src/pages/index.astro`
- Delete: `src/components/Hero.astro`, `Beyond.astro`, `Projects.astro`, `Currently.astro`, `Testimonial.astro`, `Contact.astro`, `public/images/beyond/speaking.jpg`, `mentoring.jpg`, `opensource.jpg`

**Interfaces:**
- Consumes: `TimelineItem`, `InspectorBody` from `types.ts`; `CollectionEntry<'projects'>` and `entry.render()`; `Icon.astro` (`github`, `linkedin`)
- Produces: `<Inspector items projects />` rendering one `section.insp#item-<id>[tabindex="-1"]` per item, shown by `html:not(.js) .insp:target` without JavaScript and by `.insp[data-open]` with it; `[data-inspector-close]` links inside each panel. `<ContactBlock />` renders `section#contact`.

- [ ] **Step 1: Write `src/components/Inspector.astro`**

```astro
---
import type { CollectionEntry } from "astro:content";
import type { Lane, TimelineItem } from "../lib/timeline/types";

interface Props {
  items: TimelineItem[];
  projects: CollectionEntry<"projects">[];
}

const { items, projects } = Astro.props;

// Case-study bodies, rendered once, keyed by slug (which is the item id).
const caseStudies = new Map<string, any>();
for (const p of projects) {
  const { Content } = await p.render();
  caseStudies.set(p.slug, Content);
}

const laneName = (lane: Lane) => lane[0].toUpperCase() + lane.slice(1);
const monthYear = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function statusText(item: TimelineItem): string {
  switch (item.status) {
    case "in-progress":
      return `in progress since ${monthYear(item.start)}`;
    case "live":
      return "live";
    case "planned":
      return "planned";
    default:
      return item.end ? `${monthYear(item.start)} to ${monthYear(item.end)}` : longDate(item.start);
  }
}

const capitalized = (s: string) => (s === "in-progress" ? "In progress" : s[0].toUpperCase() + s.slice(1));
---

<div class="inspector">
  {items.map((item) => {
    const b = item.body;
    const CaseStudy = item.lane === "building" ? caseStudies.get(item.id) : undefined;
    return (
      <section
        class="insp"
        id={`item-${item.id}`}
        tabindex="-1"
        role="region"
        aria-labelledby={`item-${item.id}-title`}
        style={`--c:var(--lane-${item.lane})`}
      >
        <div class="insp-main">
          <p class="insp-k"><i aria-hidden="true"></i>{laneName(item.lane)}, {statusText(item)}</p>
          <h2 id={`item-${item.id}-title`}>{item.title}</h2>
          {b && <p class="insp-desc">{b.description}</p>}
          {b?.lane === "learning" && b.testimonial && (
            <figure class="insp-quote">
              <blockquote>{b.testimonial.quote}</blockquote>
              <figcaption>{b.testimonial.author}, {b.testimonial.role}</figcaption>
            </figure>
          )}
          {CaseStudy && (
            <div class="insp-body">
              <CaseStudy />
            </div>
          )}
          <div class="insp-links">
            {b?.lane === "writing" && <a href={b.href}>Read the essay</a>}
            {b?.lane === "building" && b.url && (
              <a href={b.url} target="_blank" rel="noopener noreferrer">Visit the site</a>
            )}
            {b?.lane === "building" && b.source && (
              <a href={b.source} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
            )}
            {b?.lane === "learning" && <a href={b.roadmapHref}>See it on the roadmap</a>}
            {b?.lane === "community" && b.url && (
              <a href={b.url} target="_blank" rel="noopener noreferrer">Details</a>
            )}
            <a href="#" class="insp-close" data-inspector-close>Close</a>
          </div>
        </div>
        <aside class="insp-side">
          {b?.lane === "building" && (
            <dl class="insp-facts">
              <dt>Stack</dt><dd>{b.stack.join(", ")}</dd>
              <dt>Started</dt><dd>{monthYear(b.started)}</dd>
              <dt>Status</dt><dd>{capitalized(b.status)}</dd>
            </dl>
          )}
          {b?.lane === "writing" && (
            <dl class="insp-facts">
              <dt>Published</dt><dd>{longDate(b.published)}</dd>
            </dl>
          )}
          {b?.lane === "community" && (
            <dl class="insp-facts">
              <dt>With</dt><dd>{b.org}</dd>
            </dl>
          )}
          {b?.lane === "learning" && (
            <dl class="insp-facts">
              <dt>When</dt>
              <dd>{item.end ? `${monthYear(item.start)} to ${monthYear(item.end)}` : `since ${monthYear(item.start)}`}</dd>
            </dl>
          )}
        </aside>
      </section>
    );
  })}
</div>

<style>
  .inspector {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 40px;
  }
  .insp {
    display: none;
    grid-template-columns: 1.4fr 1fr;
    margin-top: 20px;
    border: 1px solid var(--color-border);
    border-top: 3px solid var(--c);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
  }
  /* Without JavaScript the URL hash shows a panel; with it, the script owns the state
     (see src/scripts/timeline.ts, which adds the js class). */
  html:not(.js) .insp:target,
  .insp[data-open] {
    display: grid;
  }
  .insp:focus {
    outline: none;
  }
  .insp-main {
    padding: 24px 28px 26px;
  }
  .insp-side {
    padding: 24px 28px;
    border-left: 1px solid var(--color-border);
  }
  .insp-k {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .insp-k i {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--c);
  }
  .insp h2 {
    margin: 0 0 12px;
    font-size: 34px;
    line-height: 1.05;
  }
  .insp-desc {
    margin: 0;
    max-width: 52ch;
    font-size: 15.5px;
    line-height: 1.55;
    color: var(--color-text-secondary);
  }
  .insp-quote {
    margin: 18px 0 0;
    padding: 2px 0 2px 18px;
    border-left: 3px solid var(--c);
  }
  .insp-quote blockquote {
    margin: 0;
    font-size: 15.5px;
    line-height: 1.55;
    font-style: italic;
    color: var(--color-text-primary);
  }
  .insp-quote figcaption {
    margin-top: 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .insp-body {
    margin-top: 18px;
    max-width: 62ch;
    font-size: 15px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }
  .insp-body :global(h2) {
    margin: 18px 0 6px;
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--color-text-primary);
  }
  .insp-body :global(p) {
    margin: 0 0 10px;
  }
  .insp-links {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-top: 18px;
    font-size: 14px;
  }
  .insp-links a {
    padding-bottom: 1px;
    color: var(--c);
    border-bottom: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  }
  .insp-links .insp-close {
    margin-left: auto;
    color: var(--color-text-muted);
    border-bottom-color: transparent;
  }
  .insp-facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 18px;
    margin: 0;
    font-size: 13.5px;
  }
  .insp-facts dt {
    color: var(--color-text-muted);
  }
  .insp-facts dd {
    margin: 0;
  }

  @media (max-width: 899.98px) {
    .inspector {
      padding: 0;
    }
    /* Bottom sheet (spec §9). */
    .insp {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 90;
      max-height: 72vh;
      overflow: auto;
      margin: 0;
      grid-template-columns: 1fr;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.35);
    }
    .insp-main {
      padding: 18px 18px 8px;
    }
    .insp-side {
      padding: 0 18px 18px;
      border-left: 0;
    }
    .insp h2 {
      font-size: 22px;
    }
  }
</style>
```

- [ ] **Step 2: Write `src/components/ContactBlock.astro`**

```astro
---
import Icon from "./Icon.astro";

const email = "sean@seanthedeveloper.com";
---

<section id="contact" class="contact">
  <img src="/images/profile.jpg" alt="Sean Campbell" class="contact-photo" width="96" height="114" loading="lazy" />
  <div>
    <h2>Get in touch</h2>
    <p>
      Whether you're looking for a software engineer who can hit the ground running, or you just want to
      talk shop about architecture patterns, I'd love to hear from you.
    </p>
    <p class="contact-links">
      <a href={`mailto:${email}`}>{email}</a>
      <a href="https://github.com/seancampbell3161" target="_blank" rel="noopener noreferrer"><Icon name="github" size={16} />GitHub</a>
      <a href="https://linkedin.com/in/seancampbelldev" target="_blank" rel="noopener noreferrer"><Icon name="linkedin" size={16} />LinkedIn</a>
    </p>
  </div>
</section>

<style>
  .contact {
    max-width: var(--max-width);
    margin: var(--space-4xl) auto 0;
    padding: 0 40px;
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 28px;
    align-items: start;
  }
  .contact-photo {
    width: 96px;
    height: 114px;
    object-fit: cover;
    object-position: 50% 20%;
    border-radius: var(--radius-md);
  }
  .contact h2 {
    margin: 0 0 10px;
    font-size: 34px;
    line-height: 1.05;
  }
  .contact p {
    margin: 0;
    max-width: 52ch;
    font-size: 17px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }
  .contact-links {
    display: flex;
    flex-wrap: wrap;
    gap: 22px;
    margin-top: 16px;
    font-size: 15px;
  }
  .contact-links a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border-hover);
  }

  @media (max-width: 899.98px) {
    .contact {
      margin-top: var(--space-3xl);
      padding: 0 18px;
      grid-template-columns: 72px 1fr;
      gap: 16px;
    }
    .contact-photo {
      width: 72px;
      height: 86px;
    }
    .contact h2 {
      font-size: 26px;
    }
  }
</style>
```

- [ ] **Step 3: Assemble the page and remove the old components**

In `src/pages/index.astro`, add the imports

```astro
import Inspector from "../components/Inspector.astro";
import ContactBlock from "../components/ContactBlock.astro";
```

change the destructuring to `const { items, now, projects } = await getTimeline();`, and make the `<main>` body:

```astro
    <section class="hero">
      <h1>Everything I've built, written and taught, in the order it happened.</h1>
      <p>Software engineer in Dallas. Go, Rust and .NET. Click any clip to open it.</p>
    </section>

    <Timeline items={items} now={now} />
    <Inspector items={items} projects={projects} />
    <ContactBlock />
```

Then:

```bash
git rm src/components/Hero.astro src/components/Beyond.astro src/components/Projects.astro \
  src/components/Currently.astro src/components/Testimonial.astro src/components/Contact.astro \
  public/images/beyond/speaking.jpg public/images/beyond/mentoring.jpg public/images/beyond/opensource.jpg
grep -rn "Hero.astro\|Beyond.astro\|Projects.astro\|Currently.astro\|Testimonial.astro\|Contact.astro\|images/beyond" src public/images/README.md
```

Expected: the grep prints only lines from `public/images/README.md`, if any; edit that file to drop its "beyond" rows. (Leave `public/images/beyond/.DS_Store` alone; it is untracked.)

- [ ] **Step 4: Build and check the no-JavaScript path**

Run: `npm run build && npm run preview`
Expected: build exits 0. Disable JavaScript in DevTools, load `http://localhost:4321/`, click the "Browser DAW engine" clip: the URL becomes `/#item-daw-engine` (or whichever project slug), the page jumps to its panel, which shows the description, Stack, Started, Status, and the four case-study headings. Click "Close": the panel hides. Click the "100Devs" clip: the panel shows Leon Noel's quote. Below 900px the open panel is a bottom sheet. Re-enable JavaScript before Task 10.

- [ ] **Step 5: Commit**

```bash
git add -A src/components src/pages/index.astro public/images
git commit -m "feat(home): inspector panels with case studies, contact block; remove old sections"
```

---

### Task 10: The client script: zoom, inspector, hash, playhead, sheet

**Files:**
- Create: `src/scripts/timeline.ts`
- Modify: `src/pages/index.astro` (add the script tag)

**Interfaces:**
- Consumes: DOM hooks from Task 7 (`[data-zoom-control] button[data-zoom]`, `[data-now-label]`), Task 8 (`[data-timeline]`, `.tl-item[...]`, `[data-ticks]`, `[data-window-label]`, `[data-ov-window]`, `[data-playhead]`, `[data-gutter]`, `[data-nowline]`, `[data-lane-summary]`, `a[data-item-link]`), Task 9 (`#item-<id>`, `[data-inspector-close]`); `windowFor`, `packLane`, `ticksFor`, `laneSummary`, `graphLayout`, `fraction`, `whenLabel`, `ZOOMS` from `layout.ts`; `LANES` from `types.ts`
- Produces: `html.js` class on load; `localStorage["timeline-zoom"]`.

- [ ] **Step 1: Write `src/scripts/timeline.ts`**

```ts
// src/scripts/timeline.ts
// Progressive enhancement for the home timeline (spec §9). Without this file
// the page already works: clips are links and CSS :target shows panels.
import { LANES, type Kind, type Lane, type Status, type TimelineItem } from "../lib/timeline/types";
import {
  ZOOMS,
  fraction,
  graphLayout,
  laneSummary,
  packLane,
  ticksFor,
  whenLabel,
  windowFor,
  type WidthEstimator,
  type Zoom,
} from "../lib/timeline/layout";

document.documentElement.classList.add("js");

const root = document.querySelector<HTMLElement>("[data-timeline]");
if (root) init(root);

function init(root: HTMLElement) {
  const now = new Date();

  // ---- items, read back from the server-rendered list ----
  const itemEls = Array.from(root.querySelectorAll<HTMLLIElement>(".tl-item"));
  const items: TimelineItem[] = itemEls.map((el) => ({
    id: el.dataset.id ?? "",
    lane: el.dataset.lane as Lane,
    kind: el.dataset.kind as Kind,
    status: el.dataset.status as Status,
    start: new Date(el.dataset.start ?? ""),
    end: el.dataset.end ? new Date(el.dataset.end) : undefined,
    title: el.querySelector(".tl-title")?.textContent ?? "",
    subtitle: el.querySelector(".tl-sub")?.textContent ?? undefined,
    href: el.querySelector<HTMLAnchorElement>(".tl-clip")?.getAttribute("href") ?? "#",
  }));
  const elById = new Map(itemEls.map((el) => [el.dataset.id ?? "", el]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // ---- today's date in the transport bar ----
  const nowLabel = document.querySelector<HTMLTimeElement>("[data-now-label]");
  if (nowLabel) {
    nowLabel.textContent = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    nowLabel.dateTime = now.toISOString().slice(0, 10);
  }

  // ---- measured label widths (spec §7) ----
  function makeMeasurer(): WidthEstimator {
    const area = root.querySelector<HTMLElement>(".tl-items");
    const sample = root.querySelector<HTMLElement>(".tl-clip");
    const font = sample ? getComputedStyle(sample).font : "13px sans-serif";
    const ctx = document.createElement("canvas").getContext("2d");
    return (item) => {
      const width = area?.clientWidth || 1040;
      if (!ctx) return ((item.title.length + (item.subtitle?.length ?? 0)) * 7 + 30) / width;
      ctx.font = font;
      let px = ctx.measureText(item.title).width + 26;
      if (item.subtitle) {
        ctx.font = font.replace(/\d+(\.\d+)?px/, "12px");
        px += 8 + ctx.measureText(item.subtitle).width;
      }
      return px / width;
    };
  }

  // ---- zoom ----
  function readZoom(): Zoom | null {
    try {
      const z = localStorage.getItem("timeline-zoom");
      return ZOOMS.includes(z as Zoom) ? (z as Zoom) : null;
    } catch {
      return null;
    }
  }
  function saveZoom(z: Zoom) {
    try {
      localStorage.setItem("timeline-zoom", z);
    } catch {
      /* private mode or blocked storage: the choice just isn't remembered */
    }
  }

  function apply(zoom: Zoom) {
    const win = windowFor(zoom, now, items);
    const allWin = windowFor("all", now, items);
    const measure = makeMeasurer();

    const placedIds = new Set<string>();
    LANES.forEach((lane, laneIndex) => {
      for (const p of packLane(items, lane, win, now, measure)) {
        const el = elById.get(p.item.id);
        if (!el) continue;
        el.style.setProperty("--lane", String(laneIndex));
        el.style.setProperty("--row", String(p.row));
        el.style.setProperty("--x", String(p.x));
        el.style.setProperty("--w", String(p.w));
        el.dataset.labeled = String(p.labeled);
        el.removeAttribute("data-out");
        placedIds.add(p.item.id);
      }
    });
    for (const el of itemEls) {
      if (!placedIds.has(el.dataset.id ?? "")) el.setAttribute("data-out", "");
      const when = el.querySelector(".tl-when");
      const item = itemById.get(el.dataset.id ?? "");
      if (when && item) when.textContent = whenLabel(item.start, zoom);
    }

    const windowLabel = root.querySelector("[data-window-label]");
    if (windowLabel) {
      windowLabel.textContent =
        zoom === "year" ? String(win.from.getFullYear()) : `${win.from.getFullYear()} to ${win.to.getFullYear()}`;
    }
    const ticksEl = root.querySelector<HTMLElement>("[data-ticks]");
    if (ticksEl) {
      ticksEl.replaceChildren(
        ...ticksFor(zoom, win).map((t) => {
          const s = document.createElement("span");
          s.style.setProperty("--x", String(t.x));
          s.textContent = t.label;
          return s;
        }),
      );
    }
    const ovWin = root.querySelector<HTMLElement>("[data-ov-window]");
    if (ovWin) {
      const x = fraction(win.from, allWin);
      ovWin.style.setProperty("--x", String(x));
      ovWin.style.setProperty("--w", String(fraction(win.to, allWin) - x));
    }
    for (const lane of LANES) {
      const el = root.querySelector(`[data-lane-summary="${lane}"]`);
      if (el) el.textContent = laneSummary(lane, items, win, now);
    }
    root.querySelector<HTMLElement>("[data-playhead]")?.style.setProperty("--x", String(fraction(now, win)));

    const g = graphLayout(items, win, now);
    const gutter = root.querySelector<HTMLElement>("[data-gutter]");
    if (gutter) {
      const bars = g.bars.map((b) => {
        const i = document.createElement("i");
        const live = itemById.get(b.id)?.status === "in-progress";
        i.className = `tl-bar${live ? " live" : ""}${b.toRow === null ? " to-now" : ""}`;
        i.style.cssText = `--lane:${LANES.indexOf(b.lane)};--slot:${b.slot};--from:${b.fromRow};--to:${b.toRow ?? g.nowRow};--c:var(--lane-${b.lane})`;
        return i;
      });
      const dots = g.dots.map((d) => {
        const i = document.createElement("i");
        i.className = "tl-dot";
        i.style.cssText = `--lane:${LANES.indexOf(d.lane)};--row:${d.row};--c:var(--lane-${d.lane})`;
        return i;
      });
      gutter.replaceChildren(...bars, ...dots);
    }
    root.querySelector<HTMLElement>("[data-nowline]")?.style.setProperty("--row", String(g.nowRow));

    root.dataset.zoom = zoom;
    document
      .querySelectorAll<HTMLButtonElement>("[data-zoom-control] button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zoom === zoom)));
  }

  const initialZoom = readZoom() ?? (root.dataset.zoom as Zoom) ?? "year";
  apply(initialZoom);

  document.querySelectorAll<HTMLButtonElement>("[data-zoom-control] button").forEach((b) =>
    b.addEventListener("click", () => {
      const z = b.dataset.zoom as Zoom;
      apply(z);
      saveZoom(z);
    }),
  );
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => apply(root.dataset.zoom as Zoom), 150);
  });

  // ---- inspector ----
  let openId: string | null = null;
  const panelFor = (id: string) => document.getElementById(`item-${id}`);

  function open(id: string, opts: { scroll?: boolean; focus?: boolean } = {}) {
    const panel = panelFor(id);
    const el = elById.get(id);
    if (!panel || !el) return;
    if (openId && openId !== id) {
      panelFor(openId)?.removeAttribute("data-open");
      elById.get(openId)?.removeAttribute("data-selected");
    }
    panel.setAttribute("data-open", "");
    el.setAttribute("data-selected", "");
    openId = id;
    history.replaceState(null, "", `#item-${id}`);
    if (opts.scroll) panel.scrollIntoView({ block: "nearest" });
    if (opts.focus !== false) panel.focus({ preventScroll: !opts.scroll });
  }

  function close() {
    if (!openId) return;
    const id = openId;
    panelFor(id)?.removeAttribute("data-open");
    const el = elById.get(id);
    el?.removeAttribute("data-selected");
    openId = null;
    history.replaceState(null, "", location.pathname + location.search);
    el?.querySelector<HTMLElement>(".tl-clip")?.focus();
  }

  root.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-item-link]");
    if (!a) return;
    e.preventDefault();
    open(a.dataset.itemLink ?? "", { scroll: true });
  });
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest("[data-inspector-close]")) return;
    e.preventDefault();
    close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openId) close();
  });

  const deepLink = location.hash.match(/^#item-([a-z0-9-]+)$/);
  if (deepLink && panelFor(deepLink[1])) open(deepLink[1], { scroll: true, focus: false });

  // ---- one motion on load: the playhead draws in (spec §9) ----
  const playhead = root.querySelector<HTMLElement>("[data-playhead]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (playhead && !reduceMotion && !deepLink) {
    const target = playhead.style.getPropertyValue("--x");
    playhead.style.setProperty("--x", "0");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        playhead.style.transition = "left 600ms ease-out";
        playhead.style.setProperty("--x", target);
      }),
    );
  }
}
```

- [ ] **Step 2: Load it from the home page**

In `src/pages/index.astro`, after the closing `</Layout>` tag (or anywhere at top level), add:

```astro
<script>
  import "../scripts/timeline";
</script>
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "\.astro" | head -20`
Expected: no errors reported for `src/scripts/timeline.ts` or `src/lib/timeline/*` (Astro files are not type-checked by `tsc`; ignore any lines mentioning them). Then `npm run build` exits 0.

- [ ] **Step 4: Exercise every behavior by hand**

Run `npm run preview`, open `http://localhost:4321/` at 1280px:

1. The playhead slides in once from the left edge. Reload with the OS "reduce motion" setting on (macOS: System Settings, Accessibility, Display): no slide.
2. Click "3 yr": the ruler shows quarter labels, the corner reads "2023 to 2026", the overview box widens, older clips appear. Click "All": year labels. Reload: the last choice is remembered. Click the year button to return.
3. Click the "I Won't Stop Coding" clip: the panel opens beneath the arrangement, the clip gets an outline, the URL ends in `#item-essay-i-wont-stop-coding`, and focus is inside the panel (press Tab: "Read the essay" is next). Press Escape: the panel closes, the URL hash is gone, and focus is back on the clip.
4. Open a project, then an essay: only one panel is open at a time.
5. Reload the page with `#item-100devs` in the URL: the 100Devs panel is open, scrolled into view, and the playhead did not animate.
6. Tab from the top of the page: the transport bar links, the zoom buttons, then every visible clip in chronological order, each with a visible outline in its lane color.
7. Narrow to 390px: rows and gutter; tap a row: the panel is a bottom sheet; "Close" dismisses it. Rotate or widen: the sheet becomes the in-flow panel.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/timeline.ts src/pages/index.astro
git commit -m "feat(home): zoom, inspector, deep links, and playhead as progressive enhancement"
```

---

### Task 11: Screenshots, documentation, and OG images

**Files:**
- Create: `scripts/home-screenshots.mjs`
- Modify: `package.json` (script), `.gitignore`, `CLAUDE.md`
- Modify after deploy: `public/og/home.png` (regenerated)

**Interfaces:**
- Produces: `npm run shots` writing `screenshots/home-1280.png` and `screenshots/home-390.png` (gitignored).

- [ ] **Step 1: Write `scripts/home-screenshots.mjs`**

```js
// scripts/home-screenshots.mjs
// Full-page screenshots of the home page at desktop and phone widths for
// review. Run against `npm run preview` (default) or SHOT_BASE_URL.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = (process.env.SHOT_BASE_URL ?? "http://localhost:4321").replace(/\/$/, "");
const OUT_DIR = "screenshots";
const SHOTS = [
  { name: "home-1280", width: 1280, height: 900 },
  { name: "home-390", width: 390, height: 844 },
];

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  let failures = 0;
  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    try {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT_DIR}/${shot.name}.png`, fullPage: true });
      console.log(`✓ ${shot.name}`);
    } catch (err) {
      failures++;
      console.error(`✗ ${shot.name}\n`, err);
    } finally {
      await context.close();
    }
  }
  await browser.close();
  if (failures) process.exit(1);
}

run();
```

Add to `package.json` scripts: `"shots": "node scripts/home-screenshots.mjs"`. Add a line `screenshots/` to `.gitignore`.

- [ ] **Step 2: Render and review both widths**

Run: `npm run build && (npm run preview &) && sleep 2 && npm run shots`
Expected: two PNGs in `screenshots/`. Open both. Check against the mockups saved in `.superpowers/brainstorm/`: lane heads with summaries, clips not overlapping, the "now" tag clear of ruler labels, the overview box over the current year, and on the phone the gutter bars aligned with their rows and the now line after the last row. Fix anything off in `Timeline.astro` and re-run. Stop the preview server when done.

- [ ] **Step 3: Update `CLAUDE.md`**

Replace the **Component composition** paragraph with:

```markdown
**Component composition:** The home page (`src/pages/index.astro`) is `TransportBar`, a hero, `Timeline`, `Inspector`, `ContactBlock`, and `Footer`. `Timeline` renders one chronological list of items and lays it out as four lanes at 900px and up, and as a vertical graph below; `Inspector` server-renders a panel for every item (shown by CSS `:target` without JavaScript, by `src/scripts/timeline.ts` with it).

**Timeline data:** `src/lib/timeline/` is pure TypeScript (unit-tested in Vitest): `types.ts` (item shape and zod validation), `sources.ts` (adapters from the blog, the `projects` collection, `src/data/community.ts`, `src/data/learning.ts`), `layout.ts` (zoom windows, positions, row packing, ruler ticks, graph layout). `astro.ts` is the only file that imports from Astro. Learning entries are hand-authored until the roadmap sub-project derives them.
```

Under **Content collections**, add: `Projects are MDX files in src/content/projects/ validated by projectFrontmatterSchema (title, description, start, end, status, stack, url, source); the body uses ## Problem, ## Solution, ## Tradeoffs, ## Impact.`

Under **Styling**, replace the fonts sentence with: `Fonts: Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (ruler and dates) from Google Fonts. Lane colors are --lane-writing, --lane-building, --lane-learning, --lane-community. The responsive breakpoint is 900px.`

Under **Build & Development Commands**, add `npm run shots` and `npm test`.

Under **Image Requirements**, delete the "Beyond section images" line.

- [ ] **Step 4: Commit**

```bash
git add scripts/home-screenshots.mjs package.json .gitignore CLAUDE.md
git commit -m "chore: home screenshot script; document the timeline architecture"
```

- [ ] **Step 5: After the deploy, regenerate the OG image**

Push, wait for Netlify to publish, then:

```bash
npm run og
git add public/og/home.png public/og/blog.png public/og/roadmap.png
git commit -m "chore(og): regenerate share images for the Arrangement design"
git push
```

Expected: `public/og/home.png` shows the transport bar, hero, and the top of the arrangement.

---

## Self-review notes

- Spec coverage: §4 hero, overview, arrangement, inspector, contact, footer (Tasks 7, 8, 9); §5 model (Task 2); §6 sources (Tasks 5, 6); §7 math (Tasks 3, 4); §8 responsive and one-list rule (Task 8); §9 no-JS, hash, keyboard, motion, zoom memory (Tasks 9, 10); §10 tokens and type (Task 1, component styles); §11 files (all); §12 validation (Tasks 2, 6); §13 verification (Tasks 2 to 5 tests, Task 8 and 9 no-JS checks, Task 10 manual pass, Task 11 screenshots and OG). §14 out of scope: nothing here touches the blog layout, roadmap structure, or README.
- Dates in `community.ts`, `learning.ts`, and the project frontmatter are placeholders (spec §15). Ask the owner for real ones before or during Task 6; replacing them is data-only.
