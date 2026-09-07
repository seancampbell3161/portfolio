# View Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every navigation on the portfolio into a client-side swap with a cross-fade and a shared-element morph, and put every client script under one re-runnable lifecycle contract.

**Architecture:** `<ClientRouter />` goes into the one shared layout. A tiny `onPage(init)` helper owns `astro:page-load` and `astro:before-swap`, handing each init `{ first, signal }` and aborting the previous run before the DOM is swapped. Every transition name lives in one stylesheet; a single top-level module arms the morph's source element from the link the visitor clicked.

**Tech Stack:** Astro 5 (`astro:transitions`), TypeScript, Vitest (`node` environment), Playwright (`scripts/interactions.mjs`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-view-transitions-design.md`

## Global Constraints

- **No new dependencies.** Everything here ships with Astro 5.16 already in `package.json`.
- **Every transition name comes from `src/styles/view-transitions.css`.** Astro's `transition:name`, `transition:animate` and `transition:persist` directives are not used anywhere in this project — they compile to generated scope classes, which would make contract tests assert on build artefacts.
- **The transport bar is never persisted.** It takes four per-page props (`active`, `showZoom`, `progress`, `now`); persisting freezes all four.
- **Every init has the signature `(ctx: { first: boolean; signal: AbortSignal }) => void`.** Pass `signal` to every `addEventListener`; register observers, timers and animation frames on `signal.addEventListener("abort", …)`.
- **`first` is true only on the run following a cold load.** Arriving at a page by navigation must not replay its intro.
- **Abort means *flush*, not cancel, in `roadmap.ts` and `review.ts` only.** Both debounce saves by 500 ms; a navigation inside that window must still write.
- **Reduced motion collapses durations to `1ms`, never `animation: none`** — `none` can strand the old snapshot on screen.
- **Verification commands:** `npm test` (unit), `npm run check` (build + full suite, needed for contract tests which read `dist/`), `npm run e2e` (needs `npm run preview` running in another shell).
- **Commit message trailers** (every commit):

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017QhWLNipbgnTxaVDj4kAJw
  ```

- **Expect a degraded window between Task 2 and Task 6.** Once the router lands, module scripts still run at import, so enhancements work on a cold load but are lost on the *second* page until that script's task converts it. This is expected on the branch, and gone by Task 6.

---

## File Structure

**New:**

| File | Responsibility |
|---|---|
| `src/lib/lifecycle.ts` | `createLifecycle(target)` — the whole contract, pure, testable against a bare `EventTarget` |
| `src/scripts/lifecycle.ts` | Binds it to `document`, exports `onPage`, owns the `js` class on `<html>` |
| `src/scripts/morph.ts` | Arms one morph source per navigation; the only script that stays a top-level module |
| `src/scripts/transport-bar.ts` | The mobile menu, extracted from `TransportBar.astro` |
| `src/scripts/newsletter.ts` | The subscribe form, extracted from `Newsletter.astro` |
| `src/styles/view-transitions.css` | Every `view-transition-name`, the root animations, reduced motion, the scroll-behavior override |
| `src/lib/__tests__/lifecycle.test.ts` | Unit tests for the contract |
| `src/__tests__/transitions-contract.test.ts` | Built-HTML/CSS contract for the router, morph hooks and prefetch opt-outs |

**Modified:** `src/layouts/Layout.astro`, `ProjectPage.astro`, `BlogPost.astro`; `src/components/Inspector.astro`, `Track.astro`, `WhileList.astro`, `Timeline.astro`, `RightNow.astro`, `TransportBar.astro`, `Newsletter.astro`; `src/scripts/reader.ts`, `figures/io-multiplexing.ts`, `timeline/*.ts`, `roadmap.ts`, `roadmap-arrangement.ts`, `review.ts`; `src/pages/404.astro`; `src/styles/global.css`; `astro.config.mjs`; `scripts/interactions.mjs`; `CLAUDE.md`.

---

### Task 1: The lifecycle contract

**Files:**
- Create: `src/lib/lifecycle.ts`
- Create: `src/scripts/lifecycle.ts`
- Test: `src/lib/__tests__/lifecycle.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type PageCtx = { first: boolean; signal: AbortSignal }`; `type PageInit = (ctx: PageCtx) => void`; `createLifecycle(target: EventTarget): (init: PageInit) => void`; and from `src/scripts/lifecycle.ts`, `export const onPage: (init: PageInit) => void`. Every later task imports `onPage` and `PageCtx` from `src/scripts/lifecycle` / `src/lib/lifecycle`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/lifecycle.test.ts`:

```ts
// The contract every client enhancement obeys once navigation is client-side
// (view transitions spec §6). Astro's router dispatches astro:page-load after
// every navigation and astro:before-swap before the DOM is replaced; these
// tests drive a bare EventTarget so the rules can be checked without a browser.
import { describe, it, expect } from "vitest";
import { createLifecycle, type PageCtx } from "../lifecycle";

const load = (t: EventTarget) => t.dispatchEvent(new Event("astro:page-load"));
const swap = (t: EventTarget) => t.dispatchEvent(new Event("astro:before-swap"));

describe("createLifecycle", () => {
  it("does not run an init before the first page load", () => {
    const target = new EventTarget();
    const onPage = createLifecycle(target);
    const runs: PageCtx[] = [];
    onPage((ctx) => runs.push(ctx));
    expect(runs).toHaveLength(0);
  });

  it("runs on page load, and only the first run is a cold load", () => {
    const target = new EventTarget();
    const onPage = createLifecycle(target);
    const first: boolean[] = [];
    onPage(({ first: f }) => first.push(f));

    load(target);
    swap(target);
    load(target);
    swap(target);
    load(target);

    expect(first).toEqual([true, false, false]);
  });

  it("aborts the previous run's signal before the swap", () => {
    const target = new EventTarget();
    const onPage = createLifecycle(target);
    const signals: AbortSignal[] = [];
    onPage(({ signal }) => signals.push(signal));

    load(target);
    expect(signals[0].aborted).toBe(false);
    swap(target);
    expect(signals[0].aborted).toBe(true);
  });

  it("gives each run a fresh, unaborted signal", () => {
    const target = new EventTarget();
    const onPage = createLifecycle(target);
    const signals: AbortSignal[] = [];
    onPage(({ signal }) => signals.push(signal));

    load(target);
    swap(target);
    load(target);

    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("aborts a still-running init when a load arrives with no swap between", () => {
    const target = new EventTarget();
    const onPage = createLifecycle(target);
    const signals: AbortSignal[] = [];
    onPage(({ signal }) => signals.push(signal));

    load(target);
    load(target);

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("keeps registrations independent", () => {
    const target = new EventTarget();
    const onPage = createLifecycle(target);
    const a: boolean[] = [];
    const b: boolean[] = [];
    onPage(({ first }) => a.push(first));
    load(target);
    onPage(({ first }) => b.push(first));
    swap(target);
    load(target);

    expect(a).toEqual([true, false]);
    expect(b).toEqual([true]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/lifecycle.test.ts`
Expected: FAIL — `Failed to resolve import "../lifecycle"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/lifecycle.ts`:

```ts
// src/lib/lifecycle.ts
// One contract for every client enhancement on the site (view transitions spec
// §6.1). Astro bundles each <script> as a module, and a module executes once
// per browser session: after a client-side navigation it is ignored, even
// though its page is on screen again. So nothing initialises at import; each
// enhancement registers here and is re-run on every astro:page-load, with the
// previous run torn down on astro:before-swap while its elements still exist.
//
// The EventTarget is an argument so the rules can be unit-tested in the
// suite's node environment; src/scripts/lifecycle.ts binds it to `document`.

export interface PageCtx {
  /** True only on the run that follows a cold load: a hard load, a reload, or
   *  an arrival from outside the site. False on every client-side navigation,
   *  so a page reached from inside does not replay its intro (spec §3.3). */
  first: boolean;
  /** Aborted before the next swap. Pass it to every listener; register
   *  observers, timers and frames on its "abort" event. */
  signal: AbortSignal;
}

export type PageInit = (ctx: PageCtx) => void;

export function createLifecycle(target: EventTarget): (init: PageInit) => void {
  return function onPage(init: PageInit): void {
    let runs = 0;
    let ctl: AbortController | null = null;

    target.addEventListener("astro:page-load", () => {
      // Belt and braces: a swap that never announced itself still leaves no
      // two runs alive at once.
      ctl?.abort();
      ctl = new AbortController();
      init({ first: runs++ === 0, signal: ctl.signal });
    });

    // Before the DOM is replaced, not after: teardown must still be able to see
    // the elements it is unhooking.
    target.addEventListener("astro:before-swap", () => {
      ctl?.abort();
      ctl = null;
    });
  };
}
```

A module arriving mid-session needs no special case: Astro's router runs
`await runScripts(); onPageLoad();` (`astro/dist/transitions/router.js`), so a
script executing for the first time inside a swap registers its listener before
the event it is waiting for is dispatched.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/lifecycle.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the document binding**

Create `src/scripts/lifecycle.ts`:

```ts
// src/scripts/lifecycle.ts
// The document-bound half of the lifecycle contract (src/lib/lifecycle.ts).
// Every enhancement imports onPage from here.
import { createLifecycle } from "../lib/lifecycle";

export type { PageCtx, PageInit } from "../lib/lifecycle";

export const onPage = createLifecycle(document);

// Inspector.astro gates its no-script :target fallback behind html:not(.js).
// Astro's swap copies <html> attributes from the incoming document, so the
// class is lost on the first navigation and the CSS fallback would start
// showing panels while the script also believes it owns them. Both writes are
// needed and neither is redundant: a module first imported *during* a swap
// registers its listener after that navigation's astro:after-swap has already
// fired, so the import-time write covers its own arrival and the listener
// covers every navigation after it.
const markJs = () => document.documentElement.classList.add("js");
markJs();
document.addEventListener("astro:after-swap", markJs);
```

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: PASS — the existing suite (394 tests) plus the 6 new ones.

- [ ] **Step 7: Commit**

```bash
git add src/lib/lifecycle.ts src/scripts/lifecycle.ts src/lib/__tests__/lifecycle.test.ts
git commit -m "feat(transitions): one re-runnable lifecycle contract for client scripts"
```

---

### Task 2: The router, the transition, and prefetch

**Files:**
- Create: `src/styles/view-transitions.css`
- Create: `src/__tests__/transitions-contract.test.ts`
- Modify: `src/layouts/Layout.astro`, `src/styles/global.css`, `astro.config.mjs`, `src/components/Timeline.astro:118`, `src/components/RightNow.astro`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the names `bar`, `shot` and `ptitle`, and the attribute contract `data-morph-dest="shot" | "ptitle"` that Task 7 attaches to destinations.

- [ ] **Step 1: Write the stylesheet**

Create `src/styles/view-transitions.css`:

```css
/* src/styles/view-transitions.css
   Every view-transition name on the site, in one place (spec §7.2). Astro's
   transition:* directives are deliberately unused: they compile to generated
   scope classes, and the contract tests assert on intent, not build output. */

/* The transport bar is replaced like everything else -- it carries four
   per-page props -- but named, so it sits outside the root cross-fade and does
   not flicker (spec §4). */
.tb { view-transition-name: bar; }

/* Morph destinations. Sources are armed at click time by src/scripts/morph.ts,
   because a page holds many candidates and a name must be unique. */
[data-morph-dest="shot"] { view-transition-name: shot; }
[data-morph-dest="ptitle"] { view-transition-name: ptitle; }

::view-transition-old(root) { animation: vt-out 200ms ease both; }
::view-transition-new(root) { animation: vt-in 260ms cubic-bezier(0.2, 0.7, 0.3, 1) both; }
::view-transition-group(shot),
::view-transition-group(ptitle) {
  animation-duration: 430ms;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1);
}

@keyframes vt-out { to { opacity: 0; } }
@keyframes vt-in { from { opacity: 0; transform: translateY(7px); } }

/* global.css sets scroll-behavior: smooth. Astro scrolls the incoming page to
   the top as part of the swap, which under `smooth` becomes an animated scroll
   racing the cross-fade. Astro marks the root for exactly this window. */
html[data-astro-transition] { scroll-behavior: auto; }

@media (prefers-reduced-motion: reduce) {
  /* 1ms, never `animation: none` -- `none` can strand the old snapshot on
     screen. Astro's own reduced-motion handling covers only the animations the
     router defines, not these. */
  ::view-transition-old(root),
  ::view-transition-new(root),
  ::view-transition-group(shot),
  ::view-transition-group(ptitle) {
    animation-duration: 1ms !important;
  }
}
```

- [ ] **Step 2: Import it from `global.css`**

In `src/styles/global.css`, directly after the existing Google Fonts `@import` on line 2, add:

```css
@import url("./view-transitions.css");
```

(`@import` rules must precede all other rules; the fonts import is already first, so this is the only valid position.)

- [ ] **Step 3: Add the router to the shared layout**

In `src/layouts/Layout.astro`, add to the frontmatter imports:

```astro
import { ClientRouter } from "astro:transitions";
```

and immediately before `</head>` (after the two `preconnect` links):

```astro
    <ClientRouter fallback="swap" />
```

`fallback="swap"` keeps browsers without the API on client-side routing without a simulated animation they cannot complete (spec §5).

- [ ] **Step 4: Make the prefetch decision explicit**

In `astro.config.mjs`, add to the `defineConfig` object, after `site`:

```js
  // <ClientRouter /> silently enables prefetching at prefetchAll: true. Written
  // down rather than inherited (spec §8). Links whose clicks JavaScript
  // reinterprets opt out with data-astro-prefetch="false".
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
```

- [ ] **Step 5: Opt the intercepted links out of prefetch**

`prefetchAll` assumes an `href` means "will navigate here". Clips and "Right now" rows carry `data-item-link`, and `inspector.ts` intercepts their clicks to open a panel — with scripting on they *never* navigate, so every prefetch is wasted.

In `src/components/Timeline.astro:118`, add the attribute to the clip anchor:

```astro
            <a class="tl-clip" href={item.href} data-item-link={item.id} data-astro-prefetch="false">
```

In `src/components/RightNow.astro`, add `data-astro-prefetch="false"` to the anchor that already carries `data-item-link`.

- [ ] **Step 6: Write the contract test**

Create `src/__tests__/transitions-contract.test.ts`:

```ts
// The router, the transition names and the prefetch opt-outs are invisible to
// the unit suite: they live in built HTML and in the bundled stylesheet. A
// markup or config change can drop any of them with a green suite and a clean
// build, so this reads dist/ and asserts each one. Needs dist/; skipped without
// one. `npm run check` builds first.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function firstPage(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const slug = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory())?.name;
  return slug ? join(dir, slug, "index.html") : null;
}

const PAGES: Record<string, string | null> = {
  home: "dist/index.html",
  writing: "dist/blog/index.html",
  building: "dist/building/index.html",
  roadmap: "dist/roadmap/index.html",
  essay: firstPage("dist/blog"),
  "case study": firstPage("dist/building"),
};

const built = Object.values(PAGES).every((p) => p !== null && existsSync(p));
const read = (p: string) => readFileSync(p, "utf8");

/** Every stylesheet the build emitted, plus any inline <style> in the page. */
function styles(html: string): string {
  const dir = "dist/_astro";
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => read(join(dir, f)))
    : [];
  return [...files, ...(html.match(/<style[\s\S]*?<\/style>/g) ?? [])].join("\n");
}

describe.skipIf(!built)("view transitions contract (dist/)", () => {
  for (const [kind, path] of Object.entries(PAGES)) {
    const html = built ? read(path!) : "";

    it(`${kind}: enables the client router`, () => {
      expect(html).toContain('<meta name="astro-view-transitions-enabled" content="true">');
    });

    it(`${kind}: keeps the swap fallback rather than Astro's simulated animation`, () => {
      expect(html).toContain('<meta name="astro-view-transitions-fallback" content="swap">');
    });
  }

  it("keeps the transport bar out of the root cross-fade", () => {
    expect(styles(read("dist/index.html"))).toMatch(/\.tb\s*\{[^}]*view-transition-name:\s*bar/);
  });

  it("stands smooth scrolling down for the length of a navigation", () => {
    expect(styles(read("dist/index.html"))).toMatch(
      /html\[data-astro-transition\]\s*\{[^}]*scroll-behavior:\s*auto/,
    );
  });

  it("names both morph destinations", () => {
    const css = styles(read("dist/index.html"));
    expect(css).toMatch(/\[data-morph-dest=["']?shot["']?\]\s*\{[^}]*view-transition-name:\s*shot/);
    expect(css).toMatch(/\[data-morph-dest=["']?ptitle["']?\]\s*\{[^}]*view-transition-name:\s*ptitle/);
  });

  it("home: does not prefetch links whose clicks the inspector intercepts", () => {
    const html = read("dist/index.html");
    const links = html.match(/<a[^>]*data-item-link[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a).toContain('data-astro-prefetch="false"');
  });
});
```

- [ ] **Step 7: Build and run the suite**

Run: `npm run check`
Expected: PASS. The "names both morph destinations" test passes on the stylesheet alone — Task 7 adds the attributes that use it.

- [ ] **Step 8: Commit**

```bash
git add src/styles/view-transitions.css src/styles/global.css src/layouts/Layout.astro astro.config.mjs src/components/Timeline.astro src/components/RightNow.astro src/__tests__/transitions-contract.test.ts
git commit -m "feat(transitions): the client router, the cross-fade, and an explicit prefetch policy"
```

---

### Task 3: The three straightforward scripts

**Files:**
- Create: `src/scripts/transport-bar.ts`, `src/scripts/newsletter.ts`
- Modify: `src/scripts/reader.ts`, `src/components/TransportBar.astro:100-115`, `src/components/Newsletter.astro:33-77`, `src/pages/404.astro:55`

**Interfaces:**
- Consumes: `onPage` and `PageCtx` from `src/scripts/lifecycle`.
- Produces: `initReader(ctx: PageCtx)`, `initTransportBar(ctx: PageCtx)`, `initNewsletter(ctx: PageCtx)` — each registered by its own module, so the `.astro` files keep their existing `import "…"` side-effect form.

- [ ] **Step 1: Convert `reader.ts` to the shared contract**

In `src/scripts/reader.ts`:

Replace the import block and the private controller:

```ts
import { readingProgress } from "../lib/reading";
import { onPage, type PageCtx } from "./lifecycle";

/** Room kept under the sidebar when deciding that it fits (the sticky offset comes from CSS). */
const GAP = 24;

export function initReader({ signal }: PageCtx): void {
```

Delete the two lines `let current: AbortController | null = null;` and `current?.abort();`, and delete `current = new AbortController(); const { signal } = current;` — `signal` now arrives as a parameter. Everything between is unchanged.

Replace the final line `initReader();` with:

```ts
onPage(initReader);
```

Update the header comment's last sentence to read: *"Re-runnable: registered through onPage, so every navigation gets a fresh run and the previous one is aborted before the swap."*

- [ ] **Step 2: Extract the transport bar's script**

Create `src/scripts/transport-bar.ts`:

```ts
// src/scripts/transport-bar.ts
// The mobile navigation menu. Unlike most of the site this is not progressive
// enhancement: without scripting the menu does not open at all. Extracted from
// TransportBar.astro so it can be torn down -- its Escape handler is on the
// document, which survives a swap and would otherwise stack one handler per
// navigation.
import { onPage, type PageCtx } from "./lifecycle";

export function initTransportBar({ signal }: PageCtx): void {
  const bar = document.querySelector<HTMLElement>(".tb");
  const toggle = bar?.querySelector<HTMLButtonElement>(".tb-menu");
  const panel = bar?.querySelector<HTMLElement>(".tb-mobile");
  if (!bar || !toggle || !panel) return;

  function setOpen(open: boolean) {
    toggle!.setAttribute("aria-expanded", String(open));
    panel!.hidden = !open;
    bar!.classList.toggle("menu-open", open);
  }

  toggle.addEventListener(
    "click",
    () => setOpen(toggle.getAttribute("aria-expanded") !== "true"),
    { signal },
  );
  for (const a of panel.querySelectorAll("a")) {
    a.addEventListener("click", () => setOpen(false), { signal });
  }
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") setOpen(false);
    },
    { signal },
  );
}

onPage(initTransportBar);
```

Replace the whole `<script>` block in `src/components/TransportBar.astro` (lines 100-115) with:

```astro
<script>
  import "../scripts/transport-bar";
</script>
```

- [ ] **Step 2a: Note why this one matters**

The old inline version bound `keydown` to `document` with no teardown. `document` is not replaced by a swap, so without this extraction every navigation would add another Escape handler that closes a menu belonging to a page that no longer exists.

- [ ] **Step 3: Extract the newsletter form's script**

Create `src/scripts/newsletter.ts` containing the body of the current `<script>` in `Newsletter.astro`, wrapped:

```ts
// src/scripts/newsletter.ts
// The subscribe form. Not progressive enhancement: without scripting the form
// does not submit. Extracted from Newsletter.astro so it is re-bound after a
// navigation -- the form element is replaced by every swap, so a listener bound
// once at import would be attached to a detached node.
import { onPage, type PageCtx } from "./lifecycle";

export function initNewsletter({ signal }: PageCtx): void {
  const form = document.querySelector<HTMLFormElement>("[data-newsletter-form]");
  const message = document.querySelector<HTMLParagraphElement>("[data-newsletter-message]");
  if (!form || !message) return;

  form.addEventListener(
    "submit",
    async (e) => {
      e.preventDefault();
      const button = form.querySelector<HTMLButtonElement>("button");
      const input = form.querySelector<HTMLInputElement>("input[name=email]");
      if (!input || !button) return;
      const email = input.value.trim();
      if (!email) {
        message.textContent = "Please enter an email address.";
        message.dataset.state = "error";
        return;
      }
      button.disabled = true;
      message.textContent = "";
      message.dataset.state = "";
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          form.reset();
          message.textContent = "Check your inbox for a confirmation email.";
          message.dataset.state = "success";
        } else if (res.status === 429) {
          message.textContent = "Too many attempts. Please try again in a few minutes.";
          message.dataset.state = "error";
        } else {
          message.textContent = "That didn't look right — please check the email address.";
          message.dataset.state = "error";
        }
      } catch {
        message.textContent = "Network error. Please try again.";
        message.dataset.state = "error";
      } finally {
        button.disabled = false;
      }
    },
    { signal },
  );
}

onPage(initNewsletter);
```

Replace the whole `<script>` block in `src/components/Newsletter.astro` with:

```astro
<script>
  import "../scripts/newsletter";
</script>
```

- [ ] **Step 4: Make the 404 page's inline script re-run**

In `src/pages/404.astro:55`, change:

```astro
<script is:inline data-astro-rerun>
```

`data-astro-rerun` is the documented way to force an `is:inline` script to execute after every view transition. It is the right tool here precisely because this script has no listeners and no state — it just reads `location.pathname` into the page.

- [ ] **Step 5: Build and run the suite**

Run: `npm run check`
Expected: PASS — 400 tests (394 + 6 from Task 1); the reader contract test still passes because the markup did not change.

- [ ] **Step 6: Verify by hand**

Start `npm run preview`, open the home page, click **Writing**, click an essay, and confirm: the reading line appears and tracks scrolling, and the mobile menu (narrow the window below 900px) opens and closes on the *second* page, not just the first.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/reader.ts src/scripts/transport-bar.ts src/scripts/newsletter.ts src/components/TransportBar.astro src/components/Newsletter.astro src/pages/404.astro
git commit -m "refactor(transitions): the reader, transport bar and newsletter run per navigation"
```

---

### Task 4: The I/O multiplexing figure

**Files:**
- Modify: `src/scripts/figures/io-multiplexing.ts:37-58, 296-307`

**Interfaces:**
- Consumes: `onPage`, `PageCtx`.
- Produces: `initIoFigure(ctx: PageCtx)`.

This task also pays off the item deferred from sub-project 5.

- [ ] **Step 1: Adopt the shared contract**

In `src/scripts/figures/io-multiplexing.ts`, add to the imports:

```ts
import { onPage, type PageCtx } from "../lifecycle";
```

Change the signature and delete the private controller:

```ts
export function initIoFigure({ signal }: PageCtx): void {
  // The site puts one figure on a page; a second instance on the same page
  // would be ignored, not upgraded.
  const root = document.querySelector<HTMLElement>("[data-io-figure]");
  if (!root) return;
```

Delete `let current: AbortController | null = null;`, the `current?.abort();` line, and `current = new AbortController(); const { signal } = current;`.

Replace the final `initIoFigure();` with `onPage(initIoFigure);`.

- [ ] **Step 2: Normalise the tally rows at upgrade**

The figure's `tallies` starts empty on every run, but the tally rows in the DOM are whatever the server rendered. Today those agree by construction; making the invariant explicit costs four lines and removes a silent dependency on the markup matching `emptyTallies()`.

Immediately before the final two lines of `initIoFigure` (`controls.hidden = false;`), add:

```ts
  // State and DOM agree from the first frame: the run starts with empty
  // tallies, so the rows say so, whatever the markup shipped.
  for (const m of MECHANISMS) {
    const row = q(`[data-io-tally="${m}"]`);
    if (row) row.textContent = tallyText(tallies[m]);
  }
```

- [ ] **Step 3: Do not paint idle at upgrade**

Confirm — do not change — that `initIoFigure` ends with `controls.hidden = false;` and `root.toggleAttribute("data-live", true);` and **never calls `paintIdle()`**. The server-rendered still frame (epoll at 32 sockets, fds 4/19/27) must survive the upgrade; `paintIdle()` would clear it and leave an empty grid until the visitor pressed Step. Add this comment above those two lines:

```ts
  // Never paintIdle() here: the server-rendered still frame is the figure's
  // resting state and must survive the upgrade, on a cold load and on every
  // navigation back to this essay.
```

- [ ] **Step 4: Build and run the suite**

Run: `npm run check`
Expected: PASS — the figure contract test still finds the still frame in the built essay.

- [ ] **Step 5: Verify by hand**

With `npm run preview` running: open the I/O multiplexing essay directly, press **Step** twice, navigate to **Writing**, then back into the same essay. The figure must show its still frame again with tallies reading empty — not the state you left it in, and not an empty grid.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/figures/io-multiplexing.ts
git commit -m "refactor(figure): the I/O figure runs per navigation, with its tallies normalised at upgrade"
```

---

### Task 5: The home timeline

**Files:**
- Modify: `src/scripts/timeline/index.ts`, `state.ts:60-72`, `apply.ts:119-150`, `inspector.ts:26-57`, `pan.ts`, `scrub.ts`, `motion.ts`, `now.ts`

**Interfaces:**
- Consumes: `onPage`, `PageCtx`.
- Produces: `initTimeline(ctx: PageCtx)`; `Ctx` gains `signal: AbortSignal`; `initMotion(ctx: Ctx, opts: { skip: boolean })` is unchanged in signature — `index.ts` computes `skip` from `first` and the deep link.

This task pays off the `AbortSignal`-through-`Ctx` item deferred from sub-project 1.

- [ ] **Step 1: Add the signal to the shared context**

In `src/scripts/timeline/state.ts`, add to the `Ctx` interface:

```ts
  /** Aborted before the next swap. Every module's listeners take it, so a
   *  navigation leaves nothing bound to a page that is gone. */
  signal: AbortSignal;
```

- [ ] **Step 2: Convert the entry point**

In `src/scripts/timeline/index.ts`:

Add `import { onPage, type PageCtx } from "../lifecycle";`.

Delete line 17, `document.documentElement.classList.add("js");` — `src/scripts/lifecycle.ts` owns that class now, and re-applies it after every swap.

Move `hashTimer` into the init so it cannot leak across runs, and replace the module-level `const root = …; if (root) init(root);` with:

```ts
export function initTimeline({ first, signal }: PageCtx): void {
  const root = document.querySelector<HTMLElement>("[data-timeline]");
  if (!root) return;

  const now = new Date();
  const refs = readItems(root);
  const store = createStore({
    zoom: readZoom() ?? (root.dataset.zoom as Zoom) ?? "year",
    offset: 0,
    pinned: null,
    openId: null,
  });
  const ctx: Ctx = { root, now, ...refs, measure: () => makeMeasurer(root), store, signal };

  let hashTimer = 0;
  signal.addEventListener("abort", () => window.clearTimeout(hashTimer));

  function writeHash(hash: string): void {
    try {
      history.replaceState(null, "", location.pathname + location.search + hash);
    } catch {
      /* rate-limited or blocked: the URL lags, nothing else does */
    }
  }
  function syncHash(s: TimelineState, prev: TimelineState): void {
    if (s.openId === prev.openId && s.pinned?.getTime() === prev.pinned?.getTime()) return;
    window.clearTimeout(hashTimer);
    const hash = s.openId ? `#item-${s.openId}` : s.pinned ? hashFor(s.pinned) : "";
    const pinMoved = s.pinned !== null && prev.pinned !== null && s.openId === null;
    if (pinMoved) {
      hashTimer = window.setTimeout(() => writeHash(hash), HASH_DELAY_MS);
    } else {
      writeHash(hash);
    }
  }

  initApply(ctx);
  initNow(ctx);
  initInspector(ctx);
  initPan(ctx);
  initScrub(ctx);
  // Last: the URL is a courtesy and must never run ahead of rendering, so a
  // throw or a slow write in here cannot starve the listeners that draw.
  store.subscribe(syncHash);
  applyLayout(ctx, store.get());

  const deepLinked = openDeepLink(ctx);
  // Only a cold load replays the playhead draw-in (spec §3.3): arriving here
  // from inside the site finds the arrangement already running.
  initMotion(ctx, { skip: deepLinked || !first });
}

onPage(initTimeline);
```

Keep `HASH_DELAY_MS`, `openDeepLink` and the file's header comment at module level, unchanged apart from the header's final sentence, which becomes: *"Re-runnable: registered through onPage, so every navigation rebuilds the store and the previous run's listeners are dropped with its signal."*

- [ ] **Step 3: Thread the signal through every listener**

Add `, { signal: ctx.signal }` as the final argument to every `addEventListener` call in these modules:

- `apply.ts:132` (the zoom buttons' `click`) and `apply.ts:146` (`resize`). Also add, at the end of `initApply`:

  ```ts
  ctx.signal.addEventListener("abort", () => window.clearTimeout(resizeTimer));
  ```

- `inspector.ts:41` (`click` on `document`) and `inspector.ts:54` (`keydown` on `document`).
- `pan.ts:37, 89, 104, 136, 137`.
- `scrub.ts:136, 148, 152, 167, 168, 171, 177, 194`.

The document-level ones in `inspector.ts` and `scrub.ts` are the leaks that matter: `document` is not replaced by a swap, so without the signal each navigation would stack another copy.

- [ ] **Step 4: Cancel the playhead's frames on abort**

In `src/scripts/timeline/motion.ts`, capture and cancel the two nested frames:

```ts
export function initMotion(ctx: Ctx, opts: { skip: boolean }): void {
  const playhead = ctx.root.querySelector<HTMLElement>("[data-playhead]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!playhead || reduceMotion || opts.skip) return;
  const target = playhead.style.getPropertyValue("--x");
  playhead.style.setProperty("--x", "0");
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      playhead.style.transition = "left 600ms ease-out";
      playhead.style.setProperty("--x", target);
    });
  });
  ctx.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
}
```

- [ ] **Step 5: Build and run the suite**

Run: `npm run check`
Expected: PASS — the home contract test is unaffected; it asserts markup, and none changed.

- [ ] **Step 6: Verify by hand**

With `npm run preview`: load the home page cold and watch the playhead draw in. Navigate to **Writing**, then click **Sean Campbell** to come back — the playhead must be in place with *no* draw-in. Then scrub the ruler and drag the overview strip to confirm both still work on the second visit. Finally press Escape twice on the second visit with a panel open: it must close once, not throw.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/timeline/
git commit -m "refactor(timeline): the arrangement runs per navigation behind one signal"
```

---

### Task 6: The roadmap page

**Files:**
- Modify: `src/scripts/roadmap.ts:224-238`, `src/scripts/review.ts:200-237`, `src/scripts/roadmap-arrangement.ts:19-82`

**Interfaces:**
- Consumes: `onPage`, `PageCtx`.
- Produces: `initRoadmap(ctx: PageCtx)`, `initReview(ctx: PageCtx)`, `initRoadmapArrangement(ctx: PageCtx)`.

- [ ] **Step 1: Convert `roadmap.ts`**

Add `import { onPage, type PageCtx } from "./lifecycle";`.

Replace `function init() { … }` and the `readyState` block at the end of the file with:

```ts
export function initRoadmap({ signal }: PageCtx): void {
  if (!document.querySelector(".roadmap-page")) return;

  // Module state is per-page: a navigation must not carry one page's edits into
  // the next run.
  completed.clear();
  for (const key of Object.keys(logEntries)) delete logEntries[key];
  editing = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  document.addEventListener("change", onToggle, { signal });
  document.addEventListener("input", onLogFieldChange, { signal });
  document.addEventListener("change", onLogFieldChange, { signal });
  document.getElementById("rm-edit")?.addEventListener("click", onEditClick, { signal });

  // Abort means FLUSH here, not cancel -- the opposite of everywhere else on
  // the site. Saves are debounced by 500ms, and under client-side routing
  // leaving the page is something the app does in process: tick a checkbox,
  // click "Writing" within half a second, and the edit would evaporate with the
  // timer. The write is fired instead, and outlives the page.
  signal.addEventListener("abort", () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    void save();
  });

  if (sessionStorage.getItem(TOKEN_KEY)) setEditable(true);
  void load();
}

onPage(initRoadmap);
```

`save()` writes progress text into elements that are about to be detached; those writes land nowhere and are harmless. The `fetch` is what matters and it is already in flight.

- [ ] **Step 2: Convert `review.ts`**

Add the same import. Replace `function init() { … }` and the `readyState` block with:

```ts
export function initReview({ signal }: PageCtx): void {
  if (!byId("rv-runner")) return;

  completedIds = new Set<string>();
  state = emptyReviewState();
  queue = [];
  authed = false;
  revealed = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  byId("rv-reveal")?.addEventListener("click", () => setRevealed(true), { signal });
  for (const btn of document.querySelectorAll<HTMLElement>("[data-rv-rate]")) {
    btn.addEventListener("click", () => onRate(Number(btn.dataset.rvRate) as Rating), { signal });
  }

  // The progress "Edit" button collects the shared token via a synchronous
  // window.prompt. Re-check for it right after any click and light up the runner.
  byId("rm-edit")?.addEventListener(
    "click",
    () => {
      window.setTimeout(() => {
        if (!authed && sessionStorage.getItem(TOKEN_KEY)) void loadReview();
      }, 0);
    },
    { signal },
  );

  // Keyboard: space reveals, 1–4 rate (ignore while focus is in a form field).
  document.addEventListener(
    "keydown",
    (e) => {
      if (!authed || (byId("rv-runner")?.hidden ?? true)) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        onRate((Number(e.key) - 1) as Rating);
      }
    },
    { signal },
  );

  // Abort means FLUSH, as in roadmap.ts: a rating given moments before leaving
  // the page must still reach /api/review.
  signal.addEventListener("abort", () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    void save();
  });

  void (async () => {
    await loadProgress(); // completedIds first…
    await loadReview(); // …then the queue depends on it
  })();
}

onPage(initReview);
```

`save()` is `review.ts:161`, the same name `scheduleSave()` at line 193 defers to — this file's own writer, not `roadmap.ts`'s.

- [ ] **Step 3: Convert `roadmap-arrangement.ts`**

Wrap the existing `if (arr && dataEl) { … }` body in an exported init and bind the zoom buttons with the signal:

```ts
export function initRoadmapArrangement({ signal }: PageCtx): void {
  const arr = document.querySelector<HTMLElement>(".rm-arr");
  const dataEl = document.getElementById("rm-clip-data");
  if (!arr || !dataEl) return;

  // …existing body unchanged, except:
  //   for (const b of zoomButtons) b.addEventListener("click", () => apply(...), { signal });
}

onPage(initRoadmapArrangement);
```

Move the `const arr` / `const dataEl` declarations from module scope into the function, and drop the `arr!` non-null assertions inside `apply()` now that `arr` is a narrowed local.

- [ ] **Step 4: Point the page at the inits**

`src/pages/roadmap.astro`'s `<script>` block keeps its three side-effect imports unchanged — each module now registers itself:

```astro
<script>
  import "../scripts/roadmap.ts";
  import "../scripts/roadmap-arrangement.ts";
  import "../scripts/review.ts";
</script>
```

- [ ] **Step 5: Build and run the suite**

Run: `npm run check`
Expected: PASS — including the roadmap contract test, which asserts the element ids and `data-*` hooks these scripts drive.

- [ ] **Step 6: Verify by hand**

With `npm run preview`: open `/roadmap`, navigate to **Home**, navigate back to **Learning**, and confirm the meters still populate and the zoom control still works. Then open DevTools' network tab, click **Edit**, enter the token, tick a checkbox and *immediately* click **Writing** — a `POST /api/progress` must appear.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/roadmap.ts src/scripts/review.ts src/scripts/roadmap-arrangement.ts
git commit -m "refactor(roadmap): the roadmap's three scripts run per navigation, and a swap flushes a pending save"
```

---

### Task 7: The morph

**Files:**
- Create: `src/scripts/morph.ts`
- Modify: `src/layouts/Layout.astro`, `src/layouts/ProjectPage.astro:44,47`, `src/layouts/BlogPost.astro:44`, `src/components/Inspector.astro:19-63`, `src/components/Track.astro:64,94-99`, `src/components/WhileList.astro:31-34`, `src/__tests__/transitions-contract.test.ts`

**Interfaces:**
- Consumes: the CSS names `shot` and `ptitle` from Task 2.
- Produces: the DOM contract `[data-morph]` (container) → `[data-morph-shot]`, `[data-morph-title]` (sources); `[data-morph-dest]` (destinations).

- [ ] **Step 1: Write the morph script**

Create `src/scripts/morph.ts`:

```ts
// src/scripts/morph.ts
// The shared-element morph (spec §7): the picture and title you clicked fly
// into the page you land on. Destinations are named in CSS -- a case study has
// exactly one hero and one heading -- but sources cannot be, because the home
// page server-renders a thumbnail on every building clip AND a picture in every
// inspector panel, while a view-transition-name must be unique in a document.
// So exactly one source is armed per navigation, from the element Astro reports
// as having triggered it.
//
// This is the one script on the site that stays a plain top-level module: it
// registers document-level listeners once and must never re-register. The same
// "bundled modules execute once" rule that makes every other script a problem
// is exactly what this one wants.
import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

const armed: HTMLElement[] = [];

function disarm(): void {
  for (const el of armed) el.style.viewTransitionName = "";
  armed.length = 0;
}

function arm(el: Element | null | undefined, name: string): void {
  if (!(el instanceof HTMLElement)) return;
  el.style.viewTransitionName = name;
  armed.push(el);
}

document.addEventListener("astro:before-preparation", (e) => {
  // Insurance, not bookkeeping: the armed element normally goes away with the
  // old document. But a navigation can be abandoned -- a failed fetch, a second
  // click -- and a stale name left on a live element collides with the next
  // arming. Two elements holding one name makes the browser skip the whole
  // transition, silently.
  disarm();
  const source = (e as TransitionBeforePreparationEvent).sourceElement;
  const box = source?.closest("[data-morph]");
  if (!box) return;
  arm(box.querySelector("[data-morph-shot]"), "shot");
  arm(box.querySelector("[data-morph-title]"), "ptitle");
});

document.addEventListener("astro:page-load", disarm);
```

- [ ] **Step 2: Load it from the layout**

In `src/layouts/Layout.astro`, immediately before `</body>`, add:

```astro
    <script>
      import "../scripts/morph";
    </script>
```

- [ ] **Step 3: Name the destinations**

`src/layouts/ProjectPage.astro`:

```astro
  <h1 data-morph-dest="ptitle">{title}</h1>
```

and on the hero image (line 47), add `data-morph-dest="shot"` to the `<Image>`.

`src/layouts/BlogPost.astro:44`:

```astro
  <h1 data-morph-dest="ptitle">{title}</h1>
```

- [ ] **Step 4: Mark the sources in `Inspector.astro`**

On the `<section class="insp" …>` element, add `data-morph`. On the `<h2 id={`item-${item.id}-title`}>`, add `data-morph-title`. On the `<Image class="insp-shot" …>`, add `data-morph-shot`.

This is the Home → case study route, and the site's only picture-to-picture morph: with scripting on a clip click opens the panel rather than navigating, so the panel's picture is what is on screen when the visitor clicks "Read the case study".

- [ ] **Step 5: Mark the sources in `Track.astro`**

On the entry `<li>` (line 64), add `data-morph`. On **both** `.tr-title` elements (the `<h2>` at line 94 and the `<span>` at line 98 — the component renders one or the other), add `data-morph-title`.

This covers the Writing and Building indexes and the essay sidebar's neighbour segment, which share the component.

- [ ] **Step 6: Mark the sources in `WhileList.astro`**

On the `<li>` (line 31), add `data-morph`. Wrap or mark the element holding `{item.title}` with `data-morph-title` — if the title is bare text inside the `<a>`, put the attribute on the `<a>` itself.

- [ ] **Step 7: Extend the contract test**

Add to `src/__tests__/transitions-contract.test.ts`, inside the `describe`:

```ts
  it("home: every inspector panel offers a morph source", () => {
    const html = read("dist/index.html");
    const panels = html.match(/<section class="insp"[^>]*>/g) ?? [];
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) expect(p).toContain("data-morph");
    expect(html).toContain("data-morph-title");
    expect(html).toContain("data-morph-shot");
  });

  it("building index: rows offer a title to morph", () => {
    const html = read("dist/building/index.html");
    expect(html).toContain("data-morph");
    expect(html).toContain("data-morph-title");
  });

  it("case study: names both destinations", () => {
    const html = read(PAGES["case study"]!);
    expect(html).toContain('data-morph-dest="ptitle"');
    expect(html).toContain('data-morph-dest="shot"');
  });

  it("essay: names its heading as a destination", () => {
    expect(read(PAGES.essay!)).toContain('data-morph-dest="ptitle"');
  });
```

- [ ] **Step 8: Build and run the suite**

Run: `npm run check`
Expected: PASS, including the four new assertions.

- [ ] **Step 9: Verify by hand**

With `npm run preview`: on the home page click a **building** clip to open its panel, then **Read the case study** — the panel's picture and heading must fly into the hero and title rather than cross-fading. Then go to **Building** and click a row: the row's title alone should fly into the heading. Turn on "Reduce motion" in the OS and repeat: both navigations must complete instantly with no half-drawn frame.

- [ ] **Step 10: Commit**

```bash
git add src/scripts/morph.ts src/layouts/Layout.astro src/layouts/ProjectPage.astro src/layouts/BlogPost.astro src/components/Inspector.astro src/components/Track.astro src/components/WhileList.astro src/__tests__/transitions-contract.test.ts
git commit -m "feat(transitions): the picture and title you clicked morph into the page you land on"
```

---

### Task 8: The end-to-end pass and the documentation

**Files:**
- Modify: `scripts/interactions.mjs`, `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing later depends on.

- [ ] **Step 1: Read the harness's conventions**

Open `scripts/interactions.mjs` and follow its existing section structure — how it names checks, how it reports pass/fail, and how it opens pages. Two rulings from earlier sub-projects apply and must be preserved: scroll with `behavior: "instant"` (the site sets `scroll-behavior: smooth`), and derive expectations from page attributes rather than hard-coding ids.

- [ ] **Step 2: Add the view-transitions section**

Add a section with these six checks:

1. **A script arriving mid-session still upgrades its page.** Load an essay cold. Click **Home** in the transport bar. Assert the arrangement upgraded — the overview strip has `role="slider"`, which the built HTML does not carry (the server ships it `aria-hidden`). This guards against a future Astro reordering `runScripts()` and `onPageLoad()`, which would fail silently and only on the second page a visitor opens.
2. **The morph arms the element that was clicked.** From the home page, open a building panel and click "Read the case study". Before the click, install a listener on `astro:before-preparation` that records `getComputedStyle(panelImage).viewTransitionName`; assert it becomes `shot`. Assert the case study rendered and its reading line initialised (`[data-reader-progress]` is present and not `hidden` once the body is taller than the viewport).
3. **A pending save survives a navigation.** On `/roadmap`, intercept `POST /api/progress` with `page.route`. Set the admin token in `sessionStorage`, enable editing, toggle a checkbox, and click a nav link within 200 ms. Assert the POST was still made.
4. **Listeners do not stack.** Load `/roadmap`, navigate away and back, then click **Edit**. Count the `POST /api/progress` requests triggered by a single checkbox toggle: assert exactly one.
5. **Reduced motion completes immediately.** With `page.emulateMedia({ reducedMotion: "reduce" })`, navigate from Home to an essay and assert the new page's heading is visible within 100 ms of the click.
6. **Back restores the open panel.** From Home, open a building panel, click through to the case study, then `page.goBack()`. Assert the URL ends with `#item-<id>`, that panel has `data-open`, and that the playhead has no inline `transition` style — the draw-in must not replay.

- [ ] **Step 3: Run the e2e pass**

Run `npm run preview` in one shell, then `npm run e2e` in another.
Expected: every check passes, including the 32 pre-existing ones.

- [ ] **Step 4: Update `CLAUDE.md`**

Add a section after "Reader frame interactions", and amend the Architecture preamble.

New section:

```markdown
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
```

Also update the Architecture paragraph's first sentence, which currently says the site "ships no framework or client-side rendering" — it still ships no framework, but navigation is now client-side, so say so.

- [ ] **Step 5: Final verification**

Run: `npm run check` — expected: green, all tests.
Run: `npm run e2e` (with preview running) — expected: green.

- [ ] **Step 6: Commit**

```bash
git add scripts/interactions.mjs CLAUDE.md
git commit -m "test(transitions): an e2e pass over the lifecycle, the morph and the flushed save"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §4 bar named, not persisted | 2 (stylesheet) |
| §5 router, `fallback="swap"` | 2 |
| §6.1 the helper | 1 |
| §6.2 the rule every init obeys | 3, 4, 5, 6 |
| §6.3 the `js` class | 1 (added), 5 (removed from timeline) |
| §6.4 per-script table | 3 (reader, bar, newsletter, 404), 4 (figure), 5 (timeline), 6 (roadmap ×3) |
| §6.5 abort means flush | 6 |
| §7.1–7.3 the morph | 7 |
| §7.4 back does not morph | not implemented, by design; e2e check 6 asserts the cross-fade path still restores the panel |
| §8 prefetch | 2 |
| §9 accessibility | no work — Astro's route announcer covers it; no task needed |
| §10 testing | 1 (unit), 2 and 7 (contract), 8 (e2e) |
| §11 files | all |
| §12 after the merge | recorded here, executed after deploy |

**Placeholder scan:** none — every step carries the code or the exact edit. One step (Task 4, Step 3) instructs the implementer to *confirm rather than change*: that `initIoFigure` still never calls `paintIdle()`. That is a guard against a regression, not a deferred decision, and it adds a comment recording why.

**Type consistency:** `PageCtx` / `PageInit` / `createLifecycle` / `onPage` are defined in Task 1 and used with those exact names in Tasks 3–7. `Ctx.signal` is added in Task 5 Step 1 and consumed as `ctx.signal` in Steps 3 and 4 of the same task. The CSS names `bar`, `shot`, `ptitle` are defined in Task 2 and matched by the `data-morph-dest` values in Task 7. `initReader`, `initIoFigure`, `initTimeline`, `initTransportBar`, `initNewsletter`, `initRoadmap`, `initReview`, `initRoadmapArrangement` each appear once as a definition and once as a registration.
