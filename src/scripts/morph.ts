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
