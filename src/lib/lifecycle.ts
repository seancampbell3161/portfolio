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
  // A swap means this document was reached from inside the site. The flag is
  // shared by every registration and set by a listener registered here, once:
  // a per-init listener would be registered too late by a module that first
  // executes during the very swap it needs to know about. That is exactly how
  // a page-specific bundle behaves: Astro runs its scripts (runScripts, which
  // is where an `onPage` call first executes) after astro:before-swap has
  // already fired, so a per-init listener would never see that swap and would
  // wrongly call its own arrival a cold load.
  let cold = true;
  target.addEventListener("astro:before-swap", () => {
    cold = false;
  });

  return function onPage(init: PageInit): void {
    let runs = 0;
    let ctl: AbortController | null = null;

    target.addEventListener("astro:page-load", () => {
      // Belt and braces: a swap that never announced itself still leaves no
      // two runs alive at once.
      ctl?.abort();
      ctl = new AbortController();
      init({ first: runs++ === 0 && cold, signal: ctl.signal });
    });

    // Before the DOM is replaced, not after: teardown must still be able to see
    // the elements it is unhooking.
    target.addEventListener("astro:before-swap", () => {
      ctl?.abort();
      ctl = null;
    });
  };
}
