# Arrangement, interactions 6: View transitions

Design, 2026-09-06. The sixth and last sub-project of the interactions plan.

## 1. Context

The site is static Astro: every navigation is a full page load, so the transport
bar repaints, the page blinks white, and every client script runs from scratch.
That last part is what has made the first five sub-projects simple — a script
that only ever runs once on a fresh document does not need teardown.

This sub-project turns navigation into a client-side swap under the View
Transitions API. It was deliberately left until last, because it inverts that
assumption: a bundled module script executes **once per browser session**, not
once per page, and is ignored on every later navigation. Every enhancement on
the site stops working on the second page unless it moves to a lifecycle event.

Sub-projects 4 and 5 already built for this day: `initReader()` and
`initIoFigure()` are re-runnable behind an `AbortController`. Two items deferred
from earlier sub-projects are paid off here — threading an `AbortSignal` through
the timeline's `Ctx` (sub-project 1) and normalising the figure's tally rows on
re-run (sub-project 5).

## 2. Scope

In:

- `<ClientRouter />` site-wide, with a cross-fade and a persisting-looking
  transport bar.
- A shared-element morph on the routes that have one: pictures **and** titles.
- One lifecycle contract every enhancement obeys, replacing six ad-hoc entry
  points.
- Teardown for the four scripts that have none, including flushing the two
  debounced saves.
- Explicit prefetch configuration, replacing the one `<ClientRouter />` turns on
  silently.

Out:

- Morphing on **back** navigation (§7.4).
- Any change to what the pages contain, to the roadmap's API, or to the no-script
  experience, which is unaffected: without scripting there is no router and every
  navigation is what it is today.
- Loading indicators. The pages are static and prefetched; there is nothing to
  wait for.

## 3. Decisions from brainstorming

Shown as working demos in the visual companion, chosen by Sean:

1. **The transition** is a cross-fade of the content with the transport bar held
   still, **plus** a shared-element morph. Rejected: a plain hard cut (today), and
   a lane-coloured wipe.
2. **The morph reaches pictures and titles**, not pictures alone. A picture
   morph is only possible on the building routes; titles carry the effect on the
   writing routes, which have no pictures anywhere.
3. **Only a cold load replays a page's intro.** Arriving at Home from inside the
   site finds the arrangement already running, with no playhead draw-in. A hard
   load, a reload, or an arrival from outside replays it. This is what makes the
   site read as one continuous session rather than a set of pages.
4. **Per-page registration** of inits (approach A), not one site-wide bundle
   (B) and not exempting the roadmap from client routing (C). B would ship the
   spaced-repetition scheduler to every essay; C would leave the two scripts that
   most need the discipline permanently outside it.

## 4. The transport bar does not persist

`transition:persist` moves the **old** element into the new document. The bar
takes four per-page props (`TransportBar.astro`): `active` (which link is
underlined, and in which lane colour), `showZoom` (home only), `progress` (the
reading line's existence, reader pages only) and `now`. Persisting would freeze
all four: the underline would stay on Writing while you read a case study, and
an essay reached by navigation would have no reading line.

Instead the bar is **replaced like everything else, but named** so it sits outside
the root cross-fade and does not flicker:

```css
.tb { view-transition-name: bar; }
```

Every per-page prop stays server-rendered and correct, and there is no frozen-state
class of bug to reason about later.

## 5. The router

`Layout.astro` — the single layout every page routes through — gains
`<ClientRouter fallback="swap" />` in `<head>`.

`fallback="swap"` over Astro's default `animate`: browsers without the API keep
client-side routing (no white flash, no re-parse) and simply do not animate.
Astro's `animate` fallback simulates a cross-fade in plain CSS and cannot carry
the shared-element morph, so it would show a *different* effect rather than an
honest absence of one. `swap` also keeps every visitor on one runtime path, so
the lifecycle contract is exercised identically whether or not the browser can
animate.

## 6. The lifecycle contract

### 6.1 The helper

`src/lib/lifecycle.ts` holds the logic, taking its `EventTarget` as an argument
so it is unit-testable in the suite's `node` environment.
`src/scripts/lifecycle.ts` binds it to `document` and re-exports `onPage`.

```ts
export type PageInit = (ctx: { first: boolean; signal: AbortSignal }) => void;

export function createLifecycle(target: EventTarget) {
  return function onPage(init: PageInit): void {
    let runs = 0;
    let ctl: AbortController | null = null;

    target.addEventListener("astro:page-load", () => {
      ctl?.abort();
      ctl = new AbortController();
      init({ first: runs++ === 0, signal: ctl.signal });
    });
    target.addEventListener("astro:before-swap", () => {
      ctl?.abort();
      ctl = null;
    });
  };
}
```

Two properties earn their lines:

- **Teardown fires on `astro:before-swap`**, before the DOM is replaced, so a
  script can still see the elements it is cleaning up. The `abort()` at the head
  of the page-load handler is belt and braces for a swap that never announced
  itself.
- **`first`** is true only on the run that follows a cold load (§3.3).

A module arriving mid-session needs no special handling. Land on an essay,
navigate to Home, and `timeline/index.ts` executes for the first time *inside*
the swap — but Astro's router does `await runScripts(); onPageLoad();`
(`astro/dist/transitions/router.js`), executing and awaiting newly-arrived
scripts **before** dispatching `astro:page-load`. The listener registered during
that execution receives the very event that follows it. An earlier draft of this
spec carried a `generation`/`navigating`/`ranFor` guard for the opposite
ordering; reading the router settled it, and the guard was deleted rather than
kept "just in case" — it would have been dead code defending against a case the
framework does not produce.

### 6.2 The rule every init obeys

> Take `{ first, signal }`. Pass `signal` to every `addEventListener`. Register
> anything else — observers, timers, frames — on `signal.addEventListener("abort", …)`.

`initReader` and `initIoFigure` already work this way with private controllers;
they hand that job to the helper and keep the rest.

### 6.3 The `js` class

`timeline/index.ts:17` adds `js` to `<html>`, and `Inspector.astro` gates its
no-script `:target` fallback behind `html:not(.js)`. Astro's swap copies `<html>`
attributes from the incoming document, so the class is lost on the first
navigation and the CSS fallback starts showing panels while the script also
believes it owns them — two systems driving one panel.

`lifecycle.ts` takes ownership: it sets the class at import **and** on
`astro:after-swap`. Both are needed, and neither is redundant — a module first
imported *during* a swap registers its listener after that navigation's
`astro:after-swap` has already fired, so the import-time write is what covers
its own arrival, and the listener covers every navigation afterwards. The line
leaves `timeline/index.ts`.

### 6.4 Per-script work

| Script | Today | Change |
|---|---|---|
| `scripts/reader.ts` | `initReader()` + private controller | Take `{ signal }`, register via `onPage` |
| `scripts/figures/io-multiplexing.ts` | Same shape | Same, plus: normalise tally rows on re-run, and never `paintIdle` at upgrade — the server-rendered still frame must survive (deferred from sub-project 5) |
| `scripts/timeline/index.ts` | Top-level `init(root)`, no teardown | Export `initTimeline`; thread `signal` through `Ctx` into `apply`/`inspector`/`pan`/`scrub`/`now` (deferred from sub-project 1); `initMotion` reads `first`; clear `hashTimer` on abort; drop the `js` line |
| `scripts/roadmap-arrangement.ts` | Top-level block | Export an init; rebind the zoom buttons each run |
| `scripts/roadmap.ts` | `init()` on `DOMContentLoaded`; module state | Export an init; reset `completed`, `logEntries`, `editing`; signal every listener; **flush** the pending save on abort (§6.5) |
| `scripts/review.ts` | Same | Export an init; reset `completedIds`, `state`, `queue`, `authed`, `revealed`; same save discipline |
| `components/TransportBar.astro` | Inline script, leaks a document `keydown` | Move to `scripts/transport-bar.ts`, take `signal` |
| `components/Newsletter.astro` | Inline script | Move to `scripts/newsletter.ts`, register via `onPage` |
| `pages/404.astro` | `is:inline` | Add `data-astro-rerun` |

### 6.5 Abort means flush, for the two saves

`roadmap.ts` and `review.ts` debounce writes by 500 ms. Today the only way to
leave is a full navigation, so a lost timer is not a lost edit that the app
itself dropped. Under client routing, leaving is something the app does in
process, with a live timer in module scope: tick a checkbox, click "Writing"
within half a second, and the edit evaporates — timer aborted, DOM gone, nothing
sent.

For these two scripts only, the abort handler **flushes** the pending save
instead of cancelling it. This is the opposite of what abort means everywhere
else in the codebase and is called out in a comment at both sites.

## 7. The morph

### 7.1 Destinations are static, sources are dynamic

A case study has exactly one hero and one `<h1>`, so the destination names are
markup:

- `ProjectPage.astro`: hero `<Image>` gets `data-morph-dest="shot"`, `<h1>` gets
  `data-morph-dest="ptitle"`
- `BlogPost.astro`: `<h1>` gets `data-morph-dest="ptitle"`

Sources cannot be static. The home page server-renders a thumbnail on every
building clip **and** a picture in every inspector panel, while
`view-transition-name` must be unique within a document; static names would make
the page invalid the moment a transition began.

### 7.2 Naming comes from CSS, never from Astro directives

`src/styles/view-transitions.css` holds the whole scheme in one place, so the
transition can be read without cross-referencing components:

```css
.tb { view-transition-name: bar; }
[data-morph-dest="shot"]   { view-transition-name: shot; }
[data-morph-dest="ptitle"] { view-transition-name: ptitle; }

::view-transition-old(root) { animation: vt-out 200ms ease both; }
::view-transition-new(root) { animation: vt-in 260ms cubic-bezier(.2,.7,.3,1) both; }
::view-transition-group(shot),
::view-transition-group(ptitle) {
  animation-duration: 430ms;
  animation-timing-function: cubic-bezier(.2,.7,.3,1);
}

@keyframes vt-out { to { opacity: 0; } }
@keyframes vt-in  { from { opacity: 0; transform: translateY(7px); } }

html[data-astro-transition] { scroll-behavior: auto; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root), ::view-transition-new(root),
  ::view-transition-group(shot), ::view-transition-group(ptitle) {
    animation-duration: 1ms !important;
  }
}
```

Astro's `transition:name` directive compiles to a generated scope class rather
than a plain name, which would make the contract tests assert on a build
artefact instead of on intent. It is not used anywhere.

Reduced motion collapses durations to 1 ms rather than setting `animation: none`,
which can strand the old snapshot on screen. The block is not redundant with
Astro's own handling: the router disables only the animations *it* defines
(`transition:animate` and the fallback), and warns about it in dev. The rules
above are ours, and nothing else turns them off.

`html[data-astro-transition]` disables `global.css`'s `scroll-behavior: smooth`
for the duration of a navigation: Astro scrolls the incoming page to the top as
part of the swap, and under `smooth` that becomes an animated scroll racing the
cross-fade. Astro marks the root for exactly this window.

### 7.3 Arming a source

`src/scripts/morph.ts` is the one script that stays a plain top-level module: it
registers document-level listeners once and must never re-register — the same
"bundled modules run once" semantics that make every other script a problem.

```ts
import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

const armed: HTMLElement[] = [];
const disarm = () => { for (const el of armed) el.style.viewTransitionName = ""; armed.length = 0; };
const arm = (el: Element | null | undefined, name: string) => {
  if (!(el instanceof HTMLElement)) return;
  el.style.viewTransitionName = name;
  armed.push(el);
};

document.addEventListener("astro:before-preparation", (e) => {
  disarm();
  const box = (e as TransitionBeforePreparationEvent).sourceElement?.closest("[data-morph]");
  if (!box) return;
  arm(box.querySelector("[data-morph-shot]"), "shot");
  arm(box.querySelector("[data-morph-title]"), "ptitle");
});
document.addEventListener("astro:page-load", disarm);
```

The armed element normally needs no cleanup — it lives in the document about to
be discarded. `disarm()` is insurance against an abandoned navigation (a failed
fetch, a second click) leaving a stale name on a live element: two elements
holding one name makes the browser skip the next transition silently.

Hooks, added to three components:

- `Inspector.astro` — panel gets `data-morph`, its `<Image>` `data-morph-shot`,
  its heading `data-morph-title`. This is the Home → case study route, and the
  only picture-to-picture morph on the site: with scripting on, a clip click
  opens the panel rather than navigating, so the panel's picture is the one on
  screen when the visitor clicks "Read the case study".
- `Track.astro` — each row gets `data-morph`, its title `data-morph-title`.
  Covers both indexes and the essay sidebar's neighbour segment, which share the
  component.
- `WhileList.astro` — the same two attributes, so "Written while" and "While
  building" behave like every other list of links.

### 7.4 Back does not morph

Astro reports no `sourceElement` for a popstate, so going back from a case study
to Home is a plain cross-fade with the hero fading out on its own. Morphing back
would mean reaching into `astro:before-swap`'s `newDocument` to find the panel
the visitor came from and arming it there — real work for an animation that
plays while attention is on where they *were*. Explicitly deferred, not
overlooked.

## 8. Prefetch

`<ClientRouter />` silently enables prefetching at `prefetchAll: true`. The
decision is written down instead of inherited, in `astro.config.mjs`:

```js
prefetch: { prefetchAll: true, defaultStrategy: "hover" }
```

…with `data-astro-prefetch="false"` on every `[data-item-link]` — the clips in
`Timeline.astro` and the rows in `RightNow.astro`. `prefetchAll` assumes an
`href` means "will navigate here", and those links break that assumption:
`inspector.ts` intercepts the click to open a panel, so with scripting on,
hovering a clip **never** leads to a navigation and every such prefetch is
bandwidth spent on a page the visitor will not be sent to. The home page is
where hovering is most likely, because sub-project 1's scrub invites sweeping
the pointer across the lanes.

## 9. Accessibility

`<ClientRouter />` ships a route announcer (page `<title>`, else the first
`<h1>`, else the pathname), so no live region is added here. Every page already
sets a distinct `<title>` through `Layout.astro`.

Nothing else in the accessibility surface changes: the arrangement's strip and
ruler are still `aria-hidden` in the built HTML and upgraded by script, the
figure's grid is still `aria-hidden` with one live region, and the no-script
experience is untouched.

## 10. Testing

**Unit** (`src/lib/__tests__/lifecycle.test.ts`, `node` environment, a bare
`EventTarget`): a cold load runs the init once with `first: true`; a swap aborts
the previous run before the next init; the second run gets `first: false`;
`astro:before-swap` aborts even when no navigation completes; a module
registering mid-session runs exactly once, not twice.

**Contract** (`src/__tests__/transitions-contract.test.ts`, over `dist/`): every
page kind carries the router's two markers,
`<meta name="astro-view-transitions-enabled" content="true">` and
`<meta name="astro-view-transitions-fallback" content="swap">` — the second
guards the `fallback` choice in §5, which is otherwise invisible until a
browser without the API loads the site; `data-morph` and
`data-morph-title` are on track rows and inspector panels; `data-morph-shot` is
on the inspector's picture; `data-morph-dest` is on both destinations;
`data-astro-prefetch="false"` is on the clips; and the inlined stylesheet still
carries `.tb { view-transition-name: bar }` and the
`html[data-astro-transition]` rule.

**e2e** (a new section in `scripts/interactions.mjs`):

1. Cold-load an essay, navigate to Home, assert the arrangement upgraded. §6.1
   establishes from the router's source that this must work; the check guards it
   against a future Astro that reorders `runScripts()` and `onPageLoad()`, which
   would otherwise fail silently and only on the second page a visitor opens.
2. Home → open a building panel → "Read the case study": assert the morph armed
   and the case study's reading line initialised.
3. Edit the roadmap and navigate within the 500 ms debounce window: assert the
   save request still fired (§6.5).
4. Leave the roadmap and return, toggle edit: assert **one** request, not two —
   the duplicate-listener regression, which is invisible until it corrupts
   something.
5. Under reduced motion a navigation completes immediately.
6. Back from a case study restores `#item-…` and the panel is open, with no
   playhead draw-in.

## 11. Files

New:

- `src/lib/lifecycle.ts`, `src/scripts/lifecycle.ts`
- `src/scripts/morph.ts`, `src/scripts/transport-bar.ts`, `src/scripts/newsletter.ts`
- `src/styles/view-transitions.css`
- `src/lib/__tests__/lifecycle.test.ts`, `src/__tests__/transitions-contract.test.ts`

Changed:

- `src/layouts/Layout.astro` (router, stylesheet import)
- `src/layouts/ProjectPage.astro`, `src/layouts/BlogPost.astro` (`data-morph-dest`)
- `src/components/Inspector.astro`, `Track.astro`, `WhileList.astro` (morph hooks)
- `src/components/Timeline.astro`, `RightNow.astro` (`data-astro-prefetch="false"`)
- `src/components/TransportBar.astro`, `Newsletter.astro` (scripts extracted)
- `src/scripts/reader.ts`, `figures/io-multiplexing.ts`, `timeline/index.ts` and
  its modules, `roadmap.ts`, `roadmap-arrangement.ts`, `review.ts`
- `src/pages/index.astro`, `roadmap.astro`, `404.astro` (registration)
- `src/styles/global.css` (import), `astro.config.mjs` (prefetch)
- `CLAUDE.md` (the lifecycle contract and the transition, for later work)

## 12. After the merge

`npm run og` needs no rerun: no share image changes. Deploy and confirm the
routes in §10's e2e list by hand once on the live site, because prefetching and
the fallback path both behave differently over a real network than over
`astro preview`.
