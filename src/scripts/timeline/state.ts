// src/scripts/timeline/state.ts
// The one place the home timeline's client state lives, plus the shared context
// every module's init receives. Modules never call each other's layout or DOM
// code directly: they set state, and listeners react (interactions spec §8.2).
import type { WidthEstimator, Zoom } from "../../lib/timeline/layout";
import { ZOOMS } from "../../lib/timeline/layout";
import type { TimelineItem } from "../../lib/timeline/types";

export interface TimelineState {
  zoom: Zoom;
  /** Whole years back from the preset window; 0 is the preset itself (spec §5.1). */
  offset: number;
  /** The scrub cursor's pinned date (spec §4.2), or null. */
  pinned: Date | null;
  /** The open inspector item, or null. */
  openId: string | null;
}

export type Listener = (state: TimelineState, prev: TimelineState) => void;

export interface Store {
  get(): TimelineState;
  /** Merge a patch; notify listeners only when something changed. */
  set(patch: Partial<TimelineState>): void;
  subscribe(fn: Listener): () => void;
}

const sameDate = (a: Date | null, b: Date | null): boolean =>
  a === null || b === null ? a === b : a.getTime() === b.getTime();

export function createStore(initial: TimelineState): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const next = { ...state, ...patch };
      if (
        next.zoom === prev.zoom &&
        next.offset === prev.offset &&
        next.openId === prev.openId &&
        sameDate(next.pinned, prev.pinned)
      ) {
        return;
      }
      state = next;
      for (const fn of listeners) fn(next, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** What every module's init receives. */
export interface Ctx {
  root: HTMLElement;
  now: Date;
  items: TimelineItem[];
  itemEls: HTMLLIElement[];
  elById: Map<string, HTMLLIElement>;
  itemById: Map<string, TimelineItem>;
  /** Fresh each call: label widths depend on the current clip-area width. */
  measure: () => WidthEstimator;
  store: Store;
  /** Aborted before the next swap. Every module's listeners take it, so a
   *  navigation leaves nothing bound to a page that is gone. */
  signal: AbortSignal;
}

// ---- zoom persistence (spec §5.5: the zoom is remembered, the offset is not) ----
const ZOOM_KEY = "timeline-zoom";

export function readZoom(): Zoom | null {
  try {
    const z = localStorage.getItem(ZOOM_KEY);
    return ZOOMS.includes(z as Zoom) ? (z as Zoom) : null;
  } catch {
    return null;
  }
}

export function saveZoom(z: Zoom): void {
  try {
    localStorage.setItem(ZOOM_KEY, z);
  } catch {
    /* private mode or blocked storage: the choice just isn't remembered */
  }
}
