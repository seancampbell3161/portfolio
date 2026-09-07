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

// One CSS selector per name, scoped to the box the visitor clicked. Keyed the
// same as the names view-transitions.css hands to [data-morph-dest].
const NAMES = { shot: "[data-morph-shot]", ptitle: "[data-morph-title]" } as const;

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
  for (const [name, selector] of Object.entries(NAMES)) {
    const src = box.querySelector(selector);
    if (!(src instanceof HTMLElement)) continue;
    // The outgoing document can itself be a reader page: its own <h1> (and,
    // on a case study, its hero) already holds this name permanently, from
    // view-transitions.css's [data-morph-dest] rule. Arming the element the
    // visitor actually clicked -- a sidebar row, say -- would then leave TWO
    // elements holding the same view-transition-name at once, and the spec's
    // answer to a duplicate name is to skip the ENTIRE transition, silently:
    // no morph, no cross-fade, not even the held transport bar. So the page's
    // own destination has to give up the name for this one navigation; it is
    // in `armed` alongside the source, so disarm() hands it back (via the
    // empty string, which falls through to the stylesheet rule) the moment
    // this run ends, whether that is a completed swap or an abandoned one.
    const dest = document.querySelector<HTMLElement>(`[data-morph-dest="${name}"]`);
    if (dest && dest !== src) arm(dest, "none");
    arm(src, name);
  }
});

document.addEventListener("astro:page-load", disarm);
