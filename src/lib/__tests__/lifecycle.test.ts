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
